import { Request, Response } from 'express';
import { SenderService } from '../services/senderService';

export class SenderController {
  /**
   * GET /api/senders
   */
  static async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    let senders = await SenderService.getSendersByUser(userId);

    // Auto-create initial ethereal sender if none exists
    if (senders.length === 0) {
      const defaultSender = await SenderService.getOrCreateSender(userId);
      senders = [defaultSender];
    }

    res.json({
      success: true,
      data: senders.map((s) => ({
        id: s.id,
        email: s.email,
        etherealUser: s.etherealUser,
        createdAt: s.createdAt,
      })),
    });
  }

  /**
   * POST /api/senders
   */
  static async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { email } = req.body;

    const sender = await SenderService.createEtherealSender(userId, email);

    res.status(201).json({
      success: true,
      message: 'New Ethereal sender account created',
      data: {
        id: sender.id,
        email: sender.email,
        etherealUser: sender.etherealUser,
        createdAt: sender.createdAt,
      },
    });
  }
}
