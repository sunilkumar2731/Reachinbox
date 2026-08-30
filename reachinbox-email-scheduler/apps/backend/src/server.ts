/**
 * server.ts — Express application entry point
 *
 * Architecture notes:
 * - express-async-errors patches all async route handlers so thrown errors
 *   propagate to the centralized error handler without try/catch boilerplate.
 * - Sessions are stored with memory fallback when Redis is offline.
 * - Bull Board is mounted at /admin/queues.
 * - Passport manages Google OAuth 2.0 authentication.
 */

import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';

import { env } from './config/env';
import { prisma } from './config/prisma';
import { ensureEmailIndex } from './config/elasticsearch';
import { configurePassport } from './config/passport';
import { setupBullBoard } from './config/bullBoard';
import { startEmailWorker } from './queues/emailWorker';

import { errorHandler } from './middleware/errorHandler';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import emailsRouter from './routes/emails';
import sendersRouter from './routes/senders';
import slackRouter from './routes/slack';

const app = express();

// ─── Security & parsing middleware ────────────────────────────────────────────
app.use(
  helmet({
    // Allow Bull Board UI assets
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // Required for session cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Enable trust proxy for Render / Cloud deployment SSL termination
app.set('trust proxy', 1);

// ─── Session middleware ───────────────────────────────────────────────────────
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);


// ─── Passport Authentication ──────────────────────────────────────────────────
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// ─── Bull Board Queue Monitor ─────────────────────────────────────────────────
try {
  const bullBoardAdapter = setupBullBoard();
  app.use('/admin/queues', bullBoardAdapter.getRouter());
} catch {
  // Non-fatal if Redis is offline during initial boot
}

// ─── Application API Routes ───────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/senders', sendersRouter);
app.use('/api/slack', slackRouter);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ success: false, error: { message: 'Route not found' } });
});


// ─── Centralized error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${env.PORT}/health`);
  console.log(`   Bull Board: http://localhost:${env.PORT}/admin/queues`);

  // Initialize backing services asynchronously
  prisma.$connect()
    .then(() => console.log('✅ PostgreSQL connected'))
    .catch((err) => console.warn('⚠️  PostgreSQL offline (start with docker compose up -d):', (err as Error).message));

  ensureEmailIndex()
    .then(() => console.log('✅ Elasticsearch index checked'))
    .catch(() => {});

  try {
    startEmailWorker();
    console.log('✅ BullMQ Email Worker initialized');
  } catch {}
});

export { app };
