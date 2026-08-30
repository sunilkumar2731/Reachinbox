import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { Sender } from '@prisma/client';
import { memoryStore, isDbConnectionError } from './memoryStore';

const transporterCache = new Map<string, Transporter>();

export class SenderService {
  /**
   * Find or create a sender for a user.
   * If senderId is supplied, retrieves it.
   * If senderId is not supplied, retrieves the user's primary sender or creates a new Ethereal account.
   */
  static async getOrCreateSender(userId: string, senderId?: string): Promise<Sender> {
    try {
      if (senderId) {
        const sender = await prisma.sender.findFirst({
          where: { id: senderId, userId },
        });
        if (sender) {
          memoryStore.saveSender(sender);
          return sender;
        }
      }

      // Check for existing sender
      const existing = await prisma.sender.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (existing) {
        memoryStore.saveSender(existing);
        return existing;
      }

      // Auto-provision real Ethereal SMTP test account for user
      return await this.createEtherealSender(userId);
    } catch (err) {
      if (isDbConnectionError(err)) {
        console.warn('[SenderService] PostgreSQL connection issue, using memoryStore fallback for getOrCreateSender');
        return memoryStore.getOrCreateSender(userId, senderId);
      }
      throw err;
    }
  }

  /**
   * Create a new Ethereal test account and persist in PostgreSQL (or fallback to memoryStore)
   */
  static async createEtherealSender(userId: string, customEmail?: string): Promise<Sender> {
    let etherealUser = env.ETHEREAL_USER;
    let etherealPassword = env.ETHEREAL_PASSWORD;
    let email = customEmail;

    if (!etherealUser || !etherealPassword) {
      try {
        // Auto-generate fresh test credentials using Nodemailer Ethereal API with 1.5s timeout
        const testAccountPromise = nodemailer.createTestAccount();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ethereal test account creation timeout')), 1500)
        );
        const testAccount = await Promise.race([testAccountPromise, timeoutPromise]);
        etherealUser = testAccount.user;
        etherealPassword = testAccount.pass;
        email = email || testAccount.user;
      } catch (err) {
        etherealUser = `eth_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@ethereal.email`;
        etherealPassword = `pass_${Date.now()}`;
        email = email || `${userId}@reachinbox-ethereal.dev`;
      }
    } else {
      email = email || etherealUser;
    }

    try {
      const sender = await prisma.sender.create({
        data: {
          userId,
          email: email || `${userId}@reachinbox-ethereal.dev`,
          etherealUser,
          etherealPassword,
        },
      });

      memoryStore.saveSender(sender);
      console.log(`[SenderService] Provisioned Ethereal sender: ${sender.email} (${sender.etherealUser}) for user ${userId}`);
      return sender;
    } catch (err) {
      if (isDbConnectionError(err)) {
        console.warn('[SenderService] PostgreSQL connection issue, storing new Ethereal sender in memoryStore');
        return memoryStore.createEtherealSender(userId, email, etherealUser, etherealPassword);
      }
      throw err;
    }
  }

  /**
   * Get all senders belonging to a user
   */
  static async getSendersByUser(userId: string): Promise<Sender[]> {
    try {
      const senders = await prisma.sender.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (senders.length > 0) {
        senders.forEach((s: Sender) => memoryStore.saveSender(s));
        return senders;
      }

    } catch (err) {
      if (!isDbConnectionError(err)) throw err;
      console.warn('[SenderService] PostgreSQL connection issue, fetching senders from memoryStore');
    }
    return memoryStore.getSendersByUser(userId);
  }

  /**
   * Get or create a cached nodemailer transporter for a specific sender.
   * If real SMTP credentials are provided in .env (SMTP_HOST, SMTP_USER, etc.),
   * it uses real SMTP (Gmail, Outlook, SendGrid, Amazon SES) for actual inbox delivery.
   * Otherwise, it uses Ethereal test accounts.
   */
  static getTransporter(sender: Sender): Transporter {
    const isRealSmtp = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
    const cacheKey = isRealSmtp ? `smtp_${env.SMTP_USER}_${env.SMTP_PASS}` : sender.id;
    const cached = transporterCache.get(cacheKey);
    if (cached) return cached;

    const host = env.SMTP_HOST || 'smtp.ethereal.email';
    const port = Number(env.SMTP_PORT) || 587;
    const user = env.SMTP_USER || sender.etherealUser;
    const pass = env.SMTP_PASS || sender.etherealPassword;
    const secure = env.SMTP_SECURE === 'true' || port === 465;

    console.log(`[SenderService] Creating Nodemailer transport using ${isRealSmtp ? 'REAL SMTP' : 'Ethereal Sandbox'} (${host}:${port}) with user ${user}`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    });

    transporterCache.set(cacheKey, transporter);
    return transporter;
  }

  /**
   * Get Ethereal fallback transporter for sandbox testing when primary SMTP fails auth
   */
  static getEtherealFallbackTransporter(sender: Sender): Transporter {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: sender.etherealUser || 'mock_ethereal_user',
        pass: sender.etherealPassword || 'mock_ethereal_pass',
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false },
    });
  }

  /**
   * Evict a broken transporter from the cache so the next call gets a fresh one.
   * Call this after a send failure to recover from ECONNRESET / stale connections.
   */
  static clearTransporterCache(senderId: string): void {
    const existing = transporterCache.get(senderId);
    if (existing) {
      try { existing.close(); } catch { /* ignore */ }
      transporterCache.delete(senderId);
    }
  }
}
