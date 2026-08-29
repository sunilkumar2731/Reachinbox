import { Queue, QueueOptions } from 'bullmq';
import { createBullMQRedisConnection } from '../config/redis';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';

const redisConnection = createBullMQRedisConnection();

const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 10000, // Keep last 10,000 completed jobs for Bull Board inspection
    },
    removeOnFail: {
      count: 10000, // Keep last 10,000 failed jobs for Bull Board inspection
    },
  },
};

export const emailQueue = new Queue<EmailJobData>(
  EMAIL_QUEUE_NAME,
  defaultQueueOptions
);

/**
 * Add a delayed email job to BullMQ
 * @param emailId Database ID of the email, used as BullMQ jobId for 1-to-1 mapping
 * @param delayMs Milliseconds from now when the job should become ready
 */
export async function addEmailJob(emailId: string, delayMs: number) {
  const safeDelay = Math.max(0, Math.floor(delayMs));

  const addPromise = emailQueue.add(
    'send-email',
    { emailId },
    {
      jobId: emailId, // BullMQ jobId equals Email ID for guaranteed idempotency
      delay: safeDelay,
    }
  );

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('BullMQ connection timeout')), 1000)
  );

  return Promise.race([addPromise, timeoutPromise]);
}

/**
 * Reschedule a job to a new time by removing old job (if exists) and adding a new delayed job
 */
export async function rescheduleEmailJob(emailId: string, delayMs: number) {
  try {
    const existingJob = await emailQueue.getJob(emailId);
    if (existingJob) {
      await existingJob.remove();
    }
  } catch (err) {
    // Job might already have been removed or in different state
    console.warn(`[BullMQ] Could not remove old job ${emailId} during reschedule:`, (err as Error).message);
  }

  return addEmailJob(emailId, delayMs);
}
