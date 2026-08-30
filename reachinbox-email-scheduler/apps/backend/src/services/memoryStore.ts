import { Sender, Email, User, EmailStatus } from '@prisma/client';

export function isDbConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes("can't reach database server") ||
    msg.includes("econnrefused") ||
    msg.includes("connection refused") ||
    msg.includes("failed to connect") ||
    msg.includes("connect econnrefused") ||
    (msg.includes("prisma") && msg.includes("5432")) ||
    err.code === 'P1001' || // Can't reach database server
    err.code === 'P1002' || // Database server timed out
    err.code === 'P1017'    // Server closed connection
  );
}

class MemoryStore {
  private users = new Map<string, User>();
  private senders = new Map<string, Sender>();
  private emails = new Map<string, Email>();

  constructor() {
    // Pre-populate default dev user & sender for instant offline availability
    const defaultUser: User = {
      id: 'dev_user_mock',
      googleId: 'dev_demo_reachinbox_ai',
      passwordHash: null,
      email: 'demo@reachinbox.ai',
      name: 'Sarah Jenkins',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=demo%40reachinbox.ai',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);
    this.users.set(defaultUser.email, defaultUser);

    const defaultSender: Sender = {
      id: 'sender_default_mock',
      userId: defaultUser.id,
      email: 'sarah.jenkins@ethereal.email',
      etherealUser: 'mock_ethereal_user',
      etherealPassword: 'mock_ethereal_password',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.senders.set(defaultSender.id, defaultSender);

    this.startBackgroundRunner();
  }

  // ── Background Runner ────────────────────────────────────────────────────────
  private startBackgroundRunner(): void {
    setInterval(async () => {
      const now = new Date();
      const pending = Array.from(this.emails.values()).filter(
        (e) => e.status === EmailStatus.SCHEDULED && e.scheduledAt <= now
      );

      for (const email of pending) {
        try {
          const { processEmailJob } = await import('../queues/emailWorker');
          await processEmailJob({
            id: email.id,
            data: { emailId: email.id },
          } as any);
        } catch (err) {
          console.error(`[MemoryStore Runner] Error processing email ${email.id}:`, (err as Error).message);
        }
      }
    }, 1500);
  }

  // ── User Methods ─────────────────────────────────────────────────────────────
  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    const cleaned = (email || '').trim().toLowerCase();
    return Array.from(this.users.values()).find((u) => u.email.toLowerCase() === cleaned);
  }

  createUserWithPassword(email: string, passwordHash: string, name: string): User {
    const cleanedEmail = email.trim().toLowerCase();
    const user: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      googleId: null,
      passwordHash,
      email: cleanedEmail,
      name,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanedEmail)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    this.users.set(user.email, user);
    return user;
  }

  getOrCreateDevUser(testEmail = 'demo@reachinbox.ai', testName = 'Sarah Jenkins'): User {
    const existing = this.getUserByEmail(testEmail);
    if (existing) return existing;

    const googleId = `dev_${testEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const user: User = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      googleId,
      passwordHash: null,
      email: testEmail,
      name: testName,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(testEmail)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);
    this.users.set(user.email, user);
    return user;
  }

  saveUser(user: User): void {
    this.users.set(user.id, user);
    if (user.email) this.users.set(user.email, user);
  }


  // ── Sender Methods ───────────────────────────────────────────────────────────
  getOrCreateSender(userId: string, senderId?: string): Sender {
    if (senderId && this.senders.has(senderId)) {
      return this.senders.get(senderId)!;
    }

    const userSenders = Array.from(this.senders.values()).filter((s) => s.userId === userId);
    if (userSenders.length > 0) {
      return userSenders[0]!;
    }

    return this.createEtherealSender(userId);
  }

  createEtherealSender(
    userId: string,
    customEmail?: string,
    etherealUser?: string,
    etherealPassword?: string
  ): Sender {
    const id = `sender_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const email = customEmail || `${userId}@reachinbox-ethereal.dev`;
    const sender: Sender = {
      id,
      userId,
      email,
      etherealUser: etherealUser || `eth_${Date.now()}`,
      etherealPassword: etherealPassword || `pass_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.senders.set(id, sender);
    return sender;
  }

  saveSender(sender: Sender): void {
    this.senders.set(sender.id, sender);
  }

  getSendersByUser(userId: string): Sender[] {
    const userSenders = Array.from(this.senders.values()).filter((s) => s.userId === userId);
    if (userSenders.length === 0) {
      return [this.getOrCreateSender(userId)];
    }
    return userSenders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ── Email Methods ────────────────────────────────────────────────────────────
  createEmail(data: {
    userId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    status?: EmailStatus;
  }): Email {
    const id = `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const emailRecord: Email = {
      id,
      userId: data.userId,
      senderId: data.senderId,
      recipient: data.recipient,
      subject: data.subject,
      body: data.body,
      scheduledAt: data.scheduledAt,
      sentAt: null,
      failedAt: null,
      status: data.status || EmailStatus.SCHEDULED,
      bullJobId: id,
      idempotencyKey: id,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.emails.set(id, emailRecord);
    return emailRecord;
  }

  getScheduledEmails(userId: string): (Email & { sender?: { email: string } })[] {
    return Array.from(this.emails.values())
      .filter((e) => e.userId === userId && (e.status === EmailStatus.SCHEDULED || e.status === EmailStatus.PROCESSING))
      .map((e) => {
        const sender = this.senders.get(e.senderId);
        return {
          ...e,
          sender: sender ? { email: sender.email } : { email: 'sender@reachinbox.ai' },
        };
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  getSentEmails(userId: string): (Email & { sender?: { email: string } })[] {
    return Array.from(this.emails.values())
      .filter((e) => e.userId === userId && (e.status === EmailStatus.SENT || e.status === EmailStatus.FAILED))
      .map((e) => {
        const sender = this.senders.get(e.senderId);
        return {
          ...e,
          sender: sender ? { email: sender.email } : { email: 'sender@reachinbox.ai' },
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getEmailById(userId: string, emailId: string): Email | undefined {
    const email = this.emails.get(emailId);
    if (email && email.userId === userId) return email;
    return undefined;
  }

  getEmailWithSender(emailId: string): (Email & { sender: Sender }) | undefined {
    const email = this.emails.get(emailId);
    if (!email) return undefined;

    let sender = this.senders.get(email.senderId);
    if (!sender) {
      sender = this.getOrCreateSender(email.userId, email.senderId);
    }
    return { ...email, sender };
  }

  claimEmail(emailId: string): boolean {
    const email = this.emails.get(emailId);
    if (!email || email.status !== EmailStatus.SCHEDULED) {
      return false;
    }
    email.status = EmailStatus.PROCESSING;
    email.updatedAt = new Date();
    return true;
  }

  updateEmailStatus(
    emailId: string,
    status: EmailStatus,
    extra?: { sentAt?: Date; failedAt?: Date; errorMessage?: string; scheduledAt?: Date }
  ): void {
    const email = this.emails.get(emailId);
    if (!email) return;

    email.status = status;
    email.updatedAt = new Date();

    if (extra?.sentAt) email.sentAt = extra.sentAt;
    if (extra?.failedAt) email.failedAt = extra.failedAt;
    if (extra?.errorMessage !== undefined) email.errorMessage = extra.errorMessage;
    if (extra?.scheduledAt) email.scheduledAt = extra.scheduledAt;
  }
}

export const memoryStore = new MemoryStore();
