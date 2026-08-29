import { prisma } from '../config/prisma';
import { addEmailJob } from '../queues/emailQueue';
import { ElasticsearchService } from './elasticsearchService';
import { SenderService } from './senderService';
import { createError } from '../middleware/errorHandler';
import { ScheduleEmailBody } from '../types';
import { Email, EmailStatus } from '@prisma/client';
import { memoryStore, isDbConnectionError } from './memoryStore';

export class EmailService {
  /**
   * Basic RFC-compliant email validator
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Schedule a batch of emails.
   * For each valid recipient:
   * 1. Creates a database record in PostgreSQL (or fallback to memoryStore if offline)
   * 2. Sets idempotencyKey = email.id
   * 3. Calculates the delayed send time based on startTime + (index * delayBetweenEmails)
   * 4. Enqueues a delayed BullMQ job with jobId = email.id
   * 5. Indexes the email in Elasticsearch
   */
  static async scheduleEmails(
    userId: string,
    params: ScheduleEmailBody
  ): Promise<{
    scheduledCount: number;
    invalidEmails: string[];
    emails: Email[];
  }> {
    const {
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmails = 2000,
      senderId,
    } = params;

    if (!subject || !subject.trim()) {
      throw createError('Subject is required', 400);
    }
    if (!body || !body.trim()) {
      throw createError('Body is required', 400);
    }
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw createError('At least one recipient email is required', 400);
    }

    // Resolve or create sender
    const sender = await SenderService.getOrCreateSender(userId, senderId);

    // Validate and clean recipient list
    const validRecipients: string[] = [];
    const invalidEmails: string[] = [];

    for (const rawEmail of recipients) {
      const cleaned = (rawEmail || '').trim().toLowerCase();
      if (this.isValidEmail(cleaned)) {
        if (!validRecipients.includes(cleaned)) {
          validRecipients.push(cleaned);
        }
      } else {
        invalidEmails.push(rawEmail);
      }
    }

    if (validRecipients.length === 0) {
      throw createError('No valid recipient email addresses found', 400);
    }

    const startTimestamp = startTime ? new Date(startTime).getTime() : Date.now();
    const baseDelay = Math.max(0, startTimestamp - Date.now());

    const createdEmails: Email[] = [];

    // Process each recipient sequentially or in batches
    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i]!;
      const jobDelay = baseDelay + i * Math.max(0, delayBetweenEmails);
      const scheduledTime = new Date(Date.now() + jobDelay);

      let updatedEmail: Email;

      try {
        // Create record with a generated ID
        const emailRecord = await prisma.email.create({
          data: {
            userId,
            senderId: sender.id,
            recipient,
            subject,
            body,
            scheduledAt: scheduledTime,
            status: EmailStatus.SCHEDULED,
            idempotencyKey: `email_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${recipient}`,
          },
        });

        // Update idempotencyKey to be equal to emailRecord.id for clean 1-to-1 mapping
        updatedEmail = await prisma.email.update({
          where: { id: emailRecord.id },
          data: {
            idempotencyKey: emailRecord.id,
            bullJobId: emailRecord.id,
          },
        });
      } catch (err) {
        if (isDbConnectionError(err)) {
          console.warn('[EmailService] PostgreSQL connection issue, storing scheduled email in memoryStore');
          updatedEmail = memoryStore.createEmail({
            userId,
            senderId: sender.id,
            recipient,
            subject,
            body,
            scheduledAt: scheduledTime,
            status: EmailStatus.SCHEDULED,
          });
        } else {
          throw err;
        }
      }

      // Add delayed BullMQ job with jobId = email.id
      try {
        await addEmailJob(updatedEmail.id, jobDelay);
      } catch (queueErr) {
        console.warn(`[EmailService] Redis / BullMQ offline for job ${updatedEmail.id}, using memory timer fallback:`, (queueErr as Error).message);
        setTimeout(async () => {
          try {
            const { processEmailJob } = await import('../queues/emailWorker');
            await processEmailJob({
              id: updatedEmail.id,
              data: { emailId: updatedEmail.id },
            } as any);
          } catch (e) {
            console.error(`[EmailService] Fallback timer failed for email ${updatedEmail.id}:`, e);
          }
        }, jobDelay);
      }

      // Index in Elasticsearch
      ElasticsearchService.indexEmail(updatedEmail).catch(() => {});

      createdEmails.push(updatedEmail);
    }

    console.log(`[EmailService] Successfully scheduled ${createdEmails.length} emails for user ${userId}`);

    return {
      scheduledCount: createdEmails.length,
      invalidEmails,
      emails: createdEmails,
    };
  }

  /**
   * Get all scheduled / in-progress emails for a user
   */
  static async getScheduledEmails(userId: string): Promise<Email[]> {
    try {
      return await prisma.email.findMany({
        where: {
          userId,
          status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] },
        },
        orderBy: { scheduledAt: 'asc' },
        include: {
          sender: {
            select: { email: true },
          },
        },
      });
    } catch (err) {
      console.warn('[EmailService] Database query error, loading scheduled emails from memoryStore');
      return memoryStore.getScheduledEmails(userId) as any;
    }
  }

  /**
   * Get all sent and failed emails for a user
   */
  static async getSentEmails(userId: string): Promise<Email[]> {
    try {
      return await prisma.email.findMany({
        where: {
          userId,
          status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          sender: {
            select: { email: true },
          },
        },
      });
    } catch (err) {
      console.warn('[EmailService] Database query error, loading sent emails from memoryStore');
      return memoryStore.getSentEmails(userId) as any;
    }
  }

  /**
   * Get a specific email by ID scoped to user
   */
  static async getEmailById(userId: string, emailId: string): Promise<Email> {
    try {
      const email = await prisma.email.findFirst({
        where: { id: emailId, userId },
        include: {
          sender: true,
        },
      });

      if (email) return email;
    } catch (err) {
      if (!isDbConnectionError(err)) throw err;
      console.warn('[EmailService] PostgreSQL connection issue during getEmailById');
    }

    const memEmail = memoryStore.getEmailById(userId, emailId);
    if (!memEmail) {
      throw createError('Email not found', 404);
    }
    return memEmail as any;
  }
}
