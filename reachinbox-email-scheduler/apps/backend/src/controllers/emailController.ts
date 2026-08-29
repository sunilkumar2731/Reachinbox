import { Request, Response } from 'express';
import { EmailService } from '../services/emailService';
import { ElasticsearchService } from '../services/elasticsearchService';
import { createError } from '../middleware/errorHandler';

export class EmailController {
  /**
   * POST /api/emails/schedule
   */
  static async schedule(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { subject, body, recipients, startTime, delayBetweenEmails, hourlyLimit, senderId } = req.body;

    const result = await EmailService.scheduleEmails(userId, {
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmails: Number(delayBetweenEmails) || 2000,
      hourlyLimit: Number(hourlyLimit) || 100,
      senderId,
    });

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${result.scheduledCount} email(s)`,
      data: result,
    });
  }

  /**
   * GET /api/emails/scheduled
   */
  static async getScheduled(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const emails = await EmailService.getScheduledEmails(userId);

    res.json({
      success: true,
      data: emails,
      meta: { total: emails.length },
    });
  }

  /**
   * GET /api/emails/sent
   */
  static async getSent(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const emails = await EmailService.getSentEmails(userId);

    res.json({
      success: true,
      data: emails,
      meta: { total: emails.length },
    });
  }

  /**
   * GET /api/emails/search?q=keyword
   */
  static async search(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: [], meta: { total: 0 } });
      return;
    }

    const results = await ElasticsearchService.searchUserEmails(userId, query);

    res.json({
      success: true,
      data: results,
      meta: { total: results.length },
    });
  }

  /**
   * GET /api/emails/:id
   */
  static async getById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!id) {
      throw createError('Email ID is required', 400);
    }

    const email = await EmailService.getEmailById(userId, id);

    res.json({
      success: true,
      data: email,
    });
  }
}
