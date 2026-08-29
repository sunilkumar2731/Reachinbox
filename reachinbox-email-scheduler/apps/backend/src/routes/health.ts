import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { elastic } from '../config/elasticsearch';

const router = Router();

/**
 * GET /health
 * Checks connectivity to all external services.
 * Used by Docker health checks and load balancers.
 */
router.get('/', async (_req: Request, res: Response) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`.catch(err => { console.error('[Health] DB error:', err); throw err; }),
    redis.ping().catch(err => { console.error('[Health] Redis error:', err); throw err; }),
    elastic.ping().catch(err => { console.error('[Health] ES error:', err); throw err; }),
  ]);

  const [db, redisCheck, esCheck] = checks;

  const isFullyHealthy = checks.every((c) => c.status === 'fulfilled');

  const status = {
    status: isFullyHealthy ? 'healthy' : 'degraded (resilient memory fallback active)',
    timestamp: new Date().toISOString(),
    services: {
      database: db.status === 'fulfilled' ? 'ok' : 'offline (in-memory fallback)',
      redis: redisCheck.status === 'fulfilled' ? 'ok' : 'offline (fail-open)',
      elasticsearch: esCheck.status === 'fulfilled' ? 'ok' : 'offline (fail-open)',
    },
  };

  res.status(200).json(status);
});

export default router;
