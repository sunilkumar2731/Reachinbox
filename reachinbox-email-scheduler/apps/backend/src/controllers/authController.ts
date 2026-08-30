import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { memoryStore } from '../services/memoryStore';
import { AuthService } from '../services/authService';

export class AuthController {
  /**
   * Register a new user with Email + Password
   */
  static async register(req: Request, res: Response): Promise<void> {
    const { email, password, name } = req.body || {};
    const user = await AuthService.registerUser(email, password, name);

    req.logIn(user, (err) => {
      if (err) {
        res.status(500).json({ success: false, error: { message: 'Registration session error' } });
        return;
      }
      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
      });
    });
  }

  /**
   * Log in an existing user with Email + Password
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body || {};
    const user = await AuthService.loginUser(email, password);

    req.logIn(user, (err) => {
      if (err) {
        res.status(500).json({ success: false, error: { message: 'Login session error' } });
        return;
      }
      res.json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
      });
    });
  }

  /**
   * Initiate Google OAuth flow
   */
  static googleLogin(req: Request, res: Response, next: NextFunction): void {
    if (!env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID === 'REPLACE_ME' || env.GOOGLE_CLIENT_ID === 'your-google-client-id') {
      res.redirect(`${env.FRONTEND_URL}/login?error=google_oauth_not_configured`);
      return;
    }

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
    })(req, res, next);
  }


  /**
   * Google OAuth Callback
   */
  static googleCallback(req: Request, res: Response, next: NextFunction): void {
    passport.authenticate('google', (err: Error | null, user: Express.User) => {
      if (err || !user) {
        console.error('[Auth] Google OAuth callback error:', err);
        return res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[Auth] Session login error:', loginErr);
          return res.redirect(`${env.FRONTEND_URL}/login?error=session_failed`);
        }

        return res.redirect(`${env.FRONTEND_URL}/dashboard`);
      });
    })(req, res, next);
  }

  /**
   * Return currently authenticated user
   */
  static getMe(req: Request, res: Response): void {
    let user = req.user;

    if (!user) {
      user = (req.session as any)?.devUser;
    }

    if (!user && env.NODE_ENV !== 'production') {
      user = memoryStore.getOrCreateDevUser();
      if (req.session) {
        (req.session as any).devUser = user;
      }
    }

    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: 'Not authenticated' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  }

  /**
   * Dev Login helper (for seamless testing before configuring Google Cloud Console or when backing services are launching)
   */
  static async devLogin(req: Request, res: Response): Promise<void> {
    if (env.NODE_ENV === 'production') {
      res.status(403).json({ success: false, error: { message: 'Forbidden in production' } });
      return;
    }

    const testEmail = req.body?.email || 'demo@reachinbox.ai';
    const testName = req.body?.name || 'Sarah Jenkins';
    const googleId = `dev_${testEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      const user = await prisma.user.upsert({
        where: { email: testEmail },
        update: { name: testName },
        create: {
          googleId,
          email: testEmail,
          name: testName,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(testEmail)}`,
        },
      });

      memoryStore.saveUser(user);
      if (req.session) {
        (req.session as any).devUser = user;
      }

      req.logIn(user, (err) => {
        res.json({ success: true, data: user });
      });
    } catch {
      // Fallback dev session object if PostgreSQL is offline
      const mockUser = memoryStore.getOrCreateDevUser(testEmail, testName);

      if (req.session) {
        (req.session as any).devUser = mockUser;
      }

      req.logIn(mockUser, () => {
        res.json({ success: true, data: mockUser });
      });
    }
  }

  /**
   * Log out and clear session
   */
  static logout(req: Request, res: Response): void {
    if (req.session) {
      delete (req.session as any).devUser;
    }

    req.logout((err) => {
      if (err) {
        res.status(500).json({ success: false, error: { message: 'Logout failed' } });
        return;
      }

      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
      });
    });
  }
}
