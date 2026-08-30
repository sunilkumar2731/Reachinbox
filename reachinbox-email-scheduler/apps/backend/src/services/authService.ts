import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { memoryStore, isDbConnectionError } from './memoryStore';
import { createError } from '../middleware/errorHandler';
import { User } from '@prisma/client';

export class AuthService {
  /**
   * Register a new user with Email + Password
   */
  static async registerUser(email: string, password: string, name: string): Promise<User> {
    const cleanedEmail = (email || '').trim().toLowerCase();
    const cleanedName = (name || '').trim();

    if (!cleanedEmail) {
      throw createError('Email is required', 400);
    }
    if (!password || password.length < 6) {
      throw createError('Password must be at least 6 characters long', 400);
    }
    if (!cleanedName) {
      throw createError('Full name is required', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanedEmail)}`;

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanedEmail },
      });

      if (existingUser) {
        throw createError('An account with this email address already exists. Please log in instead.', 409);
      }

      const newUser = await prisma.user.create({
        data: {
          email: cleanedEmail,
          name: cleanedName,
          passwordHash,
          avatarUrl,
        },
      });

      memoryStore.saveUser(newUser);
      return newUser;
    } catch (err) {
      if (isDbConnectionError(err)) {
        const memExisting = memoryStore.getUserByEmail(cleanedEmail);
        if (memExisting) {
          throw createError('An account with this email address already exists. Please log in instead.', 409);
        }
        return memoryStore.createUserWithPassword(cleanedEmail, passwordHash, cleanedName);
      }
      throw err;
    }
  }

  /**
   * Authenticate a user with Email + Password
   */
  static async loginUser(email: string, password: string): Promise<User> {
    const cleanedEmail = (email || '').trim().toLowerCase();

    if (!cleanedEmail || !password) {
      throw createError('Email and password are required', 400);
    }

    let user: User | null = null;

    try {
      user = await prisma.user.findUnique({
        where: { email: cleanedEmail },
      });
    } catch (err) {
      if (isDbConnectionError(err)) {
        user = memoryStore.getUserByEmail(cleanedEmail) || null;
      } else {
        throw err;
      }
    }

    if (!user) {
      user = memoryStore.getUserByEmail(cleanedEmail) || null;
    }

    if (!user) {
      throw createError('Invalid email or password', 401);
    }

    if (!user.passwordHash) {
      throw createError('This account was created using Google Sign-In. Please click "Continue with Google" to log in.', 400);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw createError('Invalid email or password', 401);
    }

    return user;
  }

  /**
   * Find or create/link a user from Google OAuth profile
   */
  static async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    name: string,
    avatarUrl: string | null
  ): Promise<User> {
    const cleanedEmail = email.trim().toLowerCase();

    try {
      // First search by email to link existing account
      let user = await prisma.user.findUnique({
        where: { email: cleanedEmail },
      });

      if (user) {
        // Link googleId if missing or update profile
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: user.googleId || googleId,
            name: user.name || name,
            avatarUrl: user.avatarUrl || avatarUrl,
          },
        });
      } else {
        // Search by googleId as fallback
        user = await prisma.user.findUnique({
          where: { googleId },
        });

        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { email: cleanedEmail, name, avatarUrl },
          });
        } else {
          // Create new Google user
          user = await prisma.user.create({
            data: {
              googleId,
              email: cleanedEmail,
              name,
              avatarUrl,
            },
          });
        }
      }

      memoryStore.saveUser(user);
      return user;
    } catch (err) {
      if (isDbConnectionError(err)) {
        console.warn('[AuthService] PostgreSQL connection issue, using memoryStore fallback for Google login');
        let memUser = memoryStore.getUserByEmail(cleanedEmail);
        if (memUser) {
          memUser.googleId = memUser.googleId || googleId;
          if (avatarUrl) memUser.avatarUrl = avatarUrl;
        } else {
          memUser = memoryStore.getOrCreateDevUser(cleanedEmail, name);
          memUser.googleId = googleId;
          if (avatarUrl) memUser.avatarUrl = avatarUrl;
        }
        memoryStore.saveUser(memUser);
        return memUser;
      }
      throw err;
    }
  }
}
