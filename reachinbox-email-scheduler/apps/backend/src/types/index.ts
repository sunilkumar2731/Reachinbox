import { User } from '@prisma/client';

// Extend Express Request to include Passport user
declare global {
  namespace Express {
    interface User extends Omit<import('@prisma/client').User, 'createdAt' | 'updatedAt'> {
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export type AuthenticatedUser = User;

// Consistent API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    stack?: string;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Schedule email request body
export interface ScheduleEmailBody {
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string; // ISO 8601
  delayBetweenEmails?: number; // ms
  hourlyLimit?: number;
  senderId?: string;
}

// BullMQ job data shape
export interface EmailJobData {
  emailId: string;
}

// Rate limiter Redis key shape
// email-rate:{senderId}:{hourWindow}
export type RateLimitKey = `email-rate:${string}:${string}`;
