import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../services/emailService';
import { RateLimiterService } from '../services/rateLimiterService';
import { DelayService } from '../services/delayService';
import { ElasticsearchService } from '../services/elasticsearchService';
import { SlackService } from '../services/slackService';
import { processEmailJob } from '../queues/emailWorker';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { EmailStatus } from '@prisma/client';
import { Job } from 'bullmq';

describe('Email Scheduling & Validation', () => {
  it('should reject schedule requests without subject or body', async () => {
    await expect(
      EmailService.scheduleEmails('user_123', {
        subject: '',
        body: 'Hello',
        recipients: ['test@example.com'],
        delayBetweenEmails: 2000,
        hourlyLimit: 100,
      })
    ).rejects.toThrow('Subject is required');

    await expect(
      EmailService.scheduleEmails('user_123', {
        subject: 'Subject',
        body: '',
        recipients: ['test@example.com'],
        delayBetweenEmails: 2000,
        hourlyLimit: 100,
      })
    ).rejects.toThrow('Body is required');
  });

  it('should correctly validate and filter valid RFC email formats', () => {
    expect(EmailService.isValidEmail('john.doe@example.com')).toBe(true);
    expect(EmailService.isValidEmail('user+tag@domain.co.uk')).toBe(true);
    expect(EmailService.isValidEmail('invalid-email')).toBe(false);
    expect(EmailService.isValidEmail('missing@domain')).toBe(false);
    expect(EmailService.isValidEmail('@nodomain.com')).toBe(false);
  });
});

describe('Redis Hourly Rate Limiting', () => {
  it('should calculate deterministic hour windows correctly', () => {
    const date = new Date('2026-08-28T14:35:00Z');
    const window = RateLimiterService.getHourWindow(date);
    expect(window).toBe('2026-08-28-14');
  });

  it('should calculate milliseconds remaining until next hour window', () => {
    const date = new Date('2026-08-28T14:45:00Z');
    const ms = RateLimiterService.getMsUntilNextHour(date);
    // 15 minutes = 15 * 60 * 1000 = 900,000 ms
    expect(ms).toBe(900000);
  });
});

describe('Worker Idempotency & State Transitions', () => {
  it('should never send an email if status is already SENT in PostgreSQL', async () => {
    const mockEmail = {
      id: 'email_sent_123',
      userId: 'user_1',
      senderId: 'sender_1',
      recipient: 'already_sent@example.com',
      subject: 'Test',
      body: 'Body',
      status: EmailStatus.SENT,
      scheduledAt: new Date(),
      idempotencyKey: 'email_sent_123',
      createdAt: new Date(),
      updatedAt: new Date(),
      sender: {
        id: 'sender_1',
        email: 'sender@example.com',
        etherealUser: 'eth_user',
        etherealPassword: 'eth_pass',
      },
    };

    vi.spyOn(prisma.email, 'findUnique').mockResolvedValueOnce(mockEmail as any);
    const updateSpy = vi.spyOn(prisma.email, 'updateMany');

    const fakeJob = {
      id: 'email_sent_123',
      data: { emailId: 'email_sent_123' },
    } as unknown as Job;

    const result = await processEmailJob(fakeJob);

    expect(result.success).toBe(true);
    // updateMany (claiming) should never even be called because email was already SENT
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should atomically abort if another worker claimed the job (SCHEDULED -> PROCESSING count is 0)', async () => {
    const mockEmail = {
      id: 'email_concurrent_123',
      userId: 'user_1',
      senderId: 'sender_1',
      recipient: 'concurrent@example.com',
      subject: 'Test',
      body: 'Body',
      status: EmailStatus.PROCESSING,
      scheduledAt: new Date(),
      idempotencyKey: 'email_concurrent_123',
      createdAt: new Date(),
      updatedAt: new Date(),
      sender: {
        id: 'sender_1',
        email: 'sender@example.com',
        etherealUser: 'eth_user',
        etherealPassword: 'eth_pass',
      },
    };

    vi.spyOn(prisma.email, 'findUnique').mockResolvedValueOnce(mockEmail as any);
    // Simulate race condition where updateMany matches 0 rows because another worker already flipped it
    vi.spyOn(prisma.email, 'updateMany').mockResolvedValueOnce({ count: 0 });

    const fakeJob = {
      id: 'email_concurrent_123',
      data: { emailId: 'email_concurrent_123' },
    } as unknown as Job;

    const result = await processEmailJob(fakeJob);

    expect(result.success).toBe(false);
  });
});

describe('Slack Notification Resilience', () => {
  it('should fail silently and not crash if Slack throws an API error', async () => {
    vi.spyOn(redis, 'get').mockResolvedValueOnce(null);
    vi.spyOn(redis, 'set').mockResolvedValueOnce('OK');
    vi.spyOn(prisma.slackConnection, 'findUnique').mockRejectedValueOnce(new Error('Slack API down'));

    // Calling sendRateLimitNotification should not throw
    await expect(
      SlackService.sendRateLimitNotification('user_1', 'sender@example.com', 100, '2026-08-28-14')
    ).resolves.not.toThrow();
  });
});

describe('Elasticsearch Fail-Open Resilience', () => {
  it('should fail-open and not throw if Elasticsearch throws a network or connection error', async () => {
    const { elastic } = await import('../config/elasticsearch');
    vi.spyOn(elastic, 'update').mockRejectedValueOnce(new Error('ConnectionRefused: 9200'));

    await expect(
      ElasticsearchService.updateEmailStatus('email_test_123', EmailStatus.SENT, { sentAt: new Date() })
    ).resolves.not.toThrow();
  });

  it('should fail-open on search when Elasticsearch is down and return empty array', async () => {
    const { elastic } = await import('../config/elasticsearch');
    vi.spyOn(elastic, 'search').mockRejectedValueOnce(new Error('ConnectionRefused: 9200'));

    const results = await ElasticsearchService.searchUserEmails('user_1', 'software engineer');
    expect(results).toEqual([]);
  });
});
