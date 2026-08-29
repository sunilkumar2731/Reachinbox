import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './prisma';
import { env } from './env';

import { memoryStore, isDbConnectionError } from '../services/memoryStore';

export function configurePassport(): void {
  // Only register real Google strategy if configured, or with placeholder
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== 'REPLACE_ME') {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            const name = profile.displayName || profile.name?.givenName || 'User';
            const avatarUrl = profile.photos?.[0]?.value || null;

            if (!email) {
              return done(new Error('No email found in Google profile'));
            }

            try {
              // Upsert user in PostgreSQL
              const user = await prisma.user.upsert({
                where: { googleId },
                update: {
                  name,
                  email,
                  avatarUrl,
                },
                create: {
                  googleId,
                  name,
                  email,
                  avatarUrl,
                },
              });
              memoryStore.saveUser(user);
              return done(null, user);
            } catch (dbErr) {
              if (isDbConnectionError(dbErr)) {
                const fallbackUser = memoryStore.getOrCreateDevUser(email, name);
                return done(null, fallbackUser);
              }
              throw dbErr;
            }
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      if (user) {
        memoryStore.saveUser(user);
        return done(null, user);
      }
    } catch (err) {
      if (!isDbConnectionError(err)) {
        return done(err);
      }
      console.warn('[Passport] PostgreSQL offline during deserializeUser, checking memory store fallback');
    }

    const fallbackUser = memoryStore.getUserById(id) || memoryStore.getOrCreateDevUser();
    return done(null, fallbackUser);
  });
}
