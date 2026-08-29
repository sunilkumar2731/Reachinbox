import { WebClient } from '@slack/web-api';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { env } from '../config/env';

export class SlackService {
  /**
   * Generates Slack OAuth authorization URL
   */
  static getAuthorizationUrl(userId: string): string {
    const scopes = ['chat:write', 'channels:read', 'groups:read', 'im:write', 'users:read'];
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: scopes.join(','),
      redirect_uri: env.SLACK_REDIRECT_URI,
      state: userId, // Pass userId in state for secure CSRF + user mapping
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Handles OAuth callback from Slack, exchanging code for access token
   */
  static async handleCallback(code: string, userId: string): Promise<void> {
    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    if (!response.ok || !response.access_token) {
      throw new Error(`Slack OAuth failed: ${response.error || 'Unknown error'}`);
    }

    const teamId = response.team?.id || 'default-team';
    const teamName = response.team?.name || undefined;
    const botUserId = response.bot_user_id || undefined;
    const accessToken = response.access_token;

    // Upsert SlackConnection in PostgreSQL
    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        teamId,
        accessToken,
        teamName,
        botUserId,
      },
      create: {
        userId,
        teamId,
        accessToken,
        teamName,
        botUserId,
      },
    });

    console.log(`[SlackService] User ${userId} connected Slack team ${teamName} (${teamId})`);
  }

  /**
   * Get Slack connection status for a user
   */
  static async getStatus(userId: string) {
    try {
      const connection = await prisma.slackConnection.findUnique({
        where: { userId },
        select: {
          teamId: true,
          teamName: true,
          botUserId: true,
          createdAt: true,
        },
      });

      return {
        connected: !!connection,
        teamId: connection?.teamId,
        teamName: connection?.teamName,
        createdAt: connection?.createdAt,
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Disconnect Slack for a user
   */
  static async disconnect(userId: string): Promise<void> {
    try {
      await prisma.slackConnection.deleteMany({
        where: { userId },
      });
      console.log(`[SlackService] User ${userId} disconnected Slack`);
    } catch {}
  }

  /**
   * Send rate limit warning message to Slack when hourly limit is reached.
   * Deduplicates per sender + hourWindow using Redis so at most 1 notification is sent per hour.
   * Wrapped in try/catch to NEVER break email execution.
   */
  static async sendRateLimitNotification(
    userId: string,
    senderEmail: string,
    hourlyLimit: number,
    hourWindow: string
  ): Promise<void> {
    try {
      // 1. Check Redis deduplication key
      const dedupKey = `slack-notif:${senderEmail}:${hourWindow}`;
      const alreadyNotified = await redis.get(dedupKey);
      if (alreadyNotified) {
        return; // Already notified for this window
      }

      // Mark as notified in Redis for 2 hours
      await redis.set(dedupKey, '1', 'EX', 7200);

      // 2. Fetch Slack connection for this user
      const connection = await prisma.slackConnection.findUnique({
        where: { userId },
      });

      if (!connection || !connection.accessToken) {
        // Slack not connected for this user — silent no-op
        return;
      }

      const client = new WebClient(connection.accessToken);

      const messageText = `⚠️ *Email rate limit reached.*\n• *Sender:* ${senderEmail}\n• *Hourly limit:* ${hourlyLimit}\n• *Action:* Remaining emails have been safely rescheduled for the next hour window.`;

      // Find a default channel to post in (or general/random or bot channel)
      let targetChannel = '#general';
      try {
        const convos = await client.conversations.list({
          types: 'public_channel,private_channel',
          limit: 10,
        });
        if (convos.channels && convos.channels.length > 0) {
          const general = convos.channels.find((c) => c.name === 'general' || c.is_general);
          targetChannel = general?.id || convos.channels[0]?.id || '#general';
        }
      } catch {
        // Default to fallback channel name
      }

      await client.chat.postMessage({
        channel: targetChannel,
        text: messageText,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Email Rate Limit Alert',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n${senderEmail}`,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n${hourlyLimit} emails/hr`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Status:* All subsequent pending emails for this sender have been automatically rescheduled for the next available hour. No emails were dropped.`,
            },
          },
        ],
      });

      console.log(`[SlackService] Sent rate limit alert for ${senderEmail} to Slack team ${connection.teamName}`);
    } catch (err) {
      // Slack notification failures must NEVER fail email processing
      console.error('[SlackService] Error sending Slack notification (non-fatal):', (err as Error).message);
    }
  }
}
