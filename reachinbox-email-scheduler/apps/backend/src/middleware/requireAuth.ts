import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import { memoryStore } from '../services/memoryStore';

/**
 * Require an authenticated session.
 * Passport stores the user object on req.user after successful OAuth or dev login.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  let isDevUser = !!(req.session && (req.session as any).devUser);

  // If no user on session yet in dev mode, auto-provision fallback dev user so operations can continue seamlessly
  if (!req.user && !isDevUser && process.env.NODE_ENV !== 'production') {
    const devUser = memoryStore.getOrCreateDevUser();
    if (req.session) {
      (req.session as any).devUser = devUser;
    }
    isDevUser = true;
  }

  if ((!req.isAuthenticated || !req.isAuthenticated()) && !isDevUser && !req.user) {
    return next(createError('Unauthorized — please log in', 401));
  }

  // Ensure req.user is populated for downstream controllers
  if (!req.user && isDevUser) {
    req.user = (req.session as any).devUser;
  }

  if (!req.user) {
    req.user = memoryStore.getOrCreateDevUser() as any;
  }

  next();
}
