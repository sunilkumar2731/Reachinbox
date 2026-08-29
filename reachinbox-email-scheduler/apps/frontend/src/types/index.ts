export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Sender {
  id: string;
  email: string;
  etherealUser: string;
  createdAt: string;
}

export interface Email {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  status: EmailStatus;
  bullJobId?: string | null;
  idempotencyKey: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    email: string;
  };
}

export interface SlackStatus {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  createdAt?: string;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string;
  delayBetweenEmails?: number;
  hourlyLimit?: number;
  senderId?: string;
}

export interface ScheduleResponse {
  scheduledCount: number;
  invalidEmails: string[];
  emails: Email[];
}
