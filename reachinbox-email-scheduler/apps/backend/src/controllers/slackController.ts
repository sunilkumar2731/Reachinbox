import { Request, Response } from 'express';
import { SlackService } from '../services/slackService';
import { env } from '../config/env';
import { createError } from '../middleware/errorHandler';

export class SlackController {
  /**
   * GET /api/slack/connect
   */
  static connect(req: Request, res: Response): void {
    const userId = req.user!.id;

    if (!env.SLACK_CLIENT_ID || env.SLACK_CLIENT_ID === 'REPLACE_ME') {
      throw createError('Slack OAuth is not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env', 400);
    }

    const authUrl = SlackService.getAuthorizationUrl(userId);
    res.redirect(authUrl);
  }

  /**
   * GET /api/slack/callback
   */
  static async callback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[SlackController] Slack authorization error:', error);
      return res.redirect(`${env.FRONTEND_URL}/settings?slack_error=${encodeURIComponent(String(error))}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${env.FRONTEND_URL}/settings?slack_error=missing_code`);
    }

    // State carries userId
    const userId = (state as string) || req.user?.id;

    if (!userId) {
      return res.redirect(`${env.FRONTEND_URL}/settings?slack_error=unauthorized`);
    }

    try {
      await SlackService.handleCallback(code, userId);
      return res.redirect(`${env.FRONTEND_URL}/settings?slack=success`);
    } catch (err) {
      console.error('[SlackController] Callback exchange error:', err);
      return res.redirect(`${env.FRONTEND_URL}/settings?slack_error=${encodeURIComponent((err as Error).message)}`);
    }
  }

  /**
   * GET /api/slack/status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const status = await SlackService.getStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  }

  /**
   * POST /api/slack/disconnect
   */
  static async disconnect(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    await SlackService.disconnect(userId);

    res.json({
      success: true,
      message: 'Slack disconnected successfully',
    });
  }
}
