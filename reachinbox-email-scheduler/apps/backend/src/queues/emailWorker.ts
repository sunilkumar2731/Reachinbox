import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createBullMQRedisConnection } from '../config/redis';
import { EMAIL_QUEUE_NAME, rescheduleEmailJob } from './emailQueue';
import { SenderService } from '../services/senderService';
import { RateLimiterService } from '../services/rateLimiterService';
import { DelayService } from '../services/delayService';
import { SlackService } from '../services/slackService';
import { ElasticsearchService } from '../services/elasticsearchService';
import { EmailJobData } from '../types';
import { EmailStatus, Email, Sender } from '@prisma/client';
import { memoryStore, isDbConnectionError } from '../services/memoryStore';

/**
 * Process a single email job with strict idempotency, rate limiting, and atomic state transitions
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<{ success: boolean; messageId?: string; previewUrl?: string | false; rescheduled?: boolean }> {
  const { emailId } = job.data;
  console.log(`[Worker] Starting job ${job.id} for email ${emailId}`);

  // 1. Fetch Email and sender from PostgreSQL (or memoryStore fallback)
  let email: (Email & { sender: Sender }) | null = null;

  try {
    email = (await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: true },
    })) as any;
  } catch (err) {
    if (isDbConnectionError(err)) {
      email = memoryStore.getEmailWithSender(emailId) as any;
    }
  }

  if (!email) {
    email = memoryStore.getEmailWithSender(emailId) as any;
  }

  if (!email) {
    console.warn(`[Worker] Email record ${emailId} not found in database or memoryStore. Skipping.`);
    return { success: false };
  }

  // 2. Strict Idempotency Check: if already SENT, never send again
  if (email.status === EmailStatus.SENT) {
    console.log(`[Worker] Email ${emailId} is already marked as SENT. Skipping.`);
    return { success: true };
  }

  // 3. Atomically claim the email (SCHEDULED -> PROCESSING)
  let claimed = false;
  try {
    const claimResult = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: EmailStatus.SCHEDULED,
      },
      data: {
        status: EmailStatus.PROCESSING,
      },
    });
    claimed = claimResult.count > 0;
  } catch (err) {
    if (isDbConnectionError(err)) {
      claimed = memoryStore.claimEmail(emailId);
    }
  }

  if (!claimed) {
    console.log(`[Worker] Email ${emailId} was already claimed by another worker or is not SCHEDULED. Aborting.`);
    return { success: false };
  }

  memoryStore.updateEmailStatus(emailId, EmailStatus.PROCESSING);

  // 4. Redis-backed Hourly Rate Limit Check
  const rateLimitResult = await RateLimiterService.checkAndConsumeRateLimit(email.senderId);

  if (!rateLimitResult.allowed) {
    console.warn(`[Worker] Hourly rate limit reached for sender ${email.sender.email} (${rateLimitResult.currentCount}/${rateLimitResult.limit}). Rescheduling...`);

    const newScheduledAt = new Date(Date.now() + rateLimitResult.rescheduleDelayMs);

    try {
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SCHEDULED,
          scheduledAt: newScheduledAt,
        },
      });
    } catch (err) {
      if (isDbConnectionError(err)) {
        memoryStore.updateEmailStatus(emailId, EmailStatus.SCHEDULED, { scheduledAt: newScheduledAt });
      }
    }

    try {
      await rescheduleEmailJob(emailId, rateLimitResult.rescheduleDelayMs);
    } catch {}

    await SlackService.sendRateLimitNotification(
      email.userId,
      email.sender.email,
      rateLimitResult.limit,
      rateLimitResult.hourWindow
    );

    return {
      success: true,
      rescheduled: true,
    };
  }

  // 5. Provider Minimum Delay Enforcement
  await DelayService.enforceMinDelay(email.senderId);

  // 6. Send Email through Resend HTTPS API (or Nodemailer SMTP fallback)
  try {
    let messageId = '';
    let previewUrl: string | false = false;

    const resendApiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;

    if (resendApiKey) {
      // 🚀 Production Resend HTTPS API Delivery (Port 443 — bypasses Render outbound SMTP restrictions)
      const { sendEmailViaResend } = await import('../services/resendService');
      const resendResult = await sendEmailViaResend({
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'onboarding@resend.dev',
      });
      messageId = resendResult.id;
      console.log(`[Worker] ✅ Real Email ${emailId} SENT via Resend HTTPS API (ID: ${messageId}) to ${email.recipient}`);
    } else {
      // Nodemailer SMTP fallback (for local dev / sandbox)
      try {
        const senderAddress = env.SMTP_USER || email.sender.email;
        const transporter = SenderService.getTransporter(email.sender);
        const info = await transporter.sendMail({
          from: `"${email.sender.email || 'ReachInbox Scheduler'}" <${senderAddress}>`,
          to: email.recipient,
          subject: email.subject,
          text: email.body,
          html: `<div>${email.body.replace(/\n/g, '<br/>')}</div>`,
        });
        messageId = info.messageId;
        previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`[Worker] ✅ Email ${emailId} SENT via SMTP (${senderAddress}) to ${email.recipient}`);
      } catch (smtpErr: any) {
        const rawErrorMsg = smtpErr?.message || String(smtpErr);
        console.warn(`[Worker] ⚠️ Primary SMTP failed for ${email.recipient}: ${rawErrorMsg}`);

        try {
          const fallbackTransporter = SenderService.getEtherealFallbackTransporter(email.sender);
          const info = await fallbackTransporter.sendMail({
            from: `"ReachInbox Sandbox" <${email.sender.etherealUser}>`,
            to: email.recipient,
            subject: email.subject,
            text: email.body,
            html: `<div>${email.body.replace(/\n/g, '<br/>')}</div>`,
          });
          messageId = info.messageId;
          previewUrl = nodemailer.getTestMessageUrl(info) || `https://ethereal.email/message/${info.messageId}`;
          console.log(`[Worker] 📬 Ethereal Sandbox Fallback SENT to ${email.recipient}. Preview: ${previewUrl}`);
        } catch (fallbackErr) {
          console.error(`[Worker] ❌ Fallback send failed:`, (fallbackErr as Error).message);
          throw smtpErr;
        }
      }
    }


    // 7. Update PostgreSQL / MemoryStore to SENT
    const sentAt = new Date();
    try {
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SENT,
          sentAt,
          errorMessage: null,
        },
      });
    } catch (err) {
      if (isDbConnectionError(err)) {
        console.warn('[Worker] PostgreSQL connection issue, updating sent status in memoryStore');
      }
    }

    memoryStore.updateEmailStatus(emailId, EmailStatus.SENT, { sentAt });

    // 8. Update Elasticsearch document
    await ElasticsearchService.updateEmailStatus(emailId, EmailStatus.SENT, { sentAt });

    return {
      success: true,
      messageId,
      previewUrl,
    };

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] ❌ Failed to send email ${emailId}:`, errorMsg);

    SenderService.clearTransporterCache(email.sender.id);

    const failedAt = new Date();

    try {
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.FAILED,
          failedAt,
          errorMessage: errorMsg,
        },
      });
    } catch (dbErr) {}

    memoryStore.updateEmailStatus(emailId, EmailStatus.FAILED, {
      failedAt,
      errorMessage: errorMsg,
    });

    await ElasticsearchService.updateEmailStatus(emailId, EmailStatus.FAILED, {
      failedAt,
      errorMessage: errorMsg,
    });

    throw err;
  }
}

/**
 * Creates and starts the BullMQ Worker instance
 */
export function startEmailWorker(): Worker<EmailJobData> {
  const workerRedis = createBullMQRedisConnection();

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      return processEmailJob(job);
    },
    {
      connection: workerRedis,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  worker.on('ready', () => {
    console.log(`[BullMQ Worker] Ready and listening on queue "${EMAIL_QUEUE_NAME}" (Concurrency: ${env.WORKER_CONCURRENCY})`);
  });

  worker.on('completed', (job: Job) => {
    console.log(`[BullMQ Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[BullMQ Worker] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err: Error) => {
    if (!err.message.includes('ECONNREFUSED')) {
      console.error(`[BullMQ Worker] Worker error: ${err.message}`);
    }
  });


  return worker;
}
