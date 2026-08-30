import Redis from 'ioredis';
import { env } from './env';

// Singleton Redis connection used by the Express app (sessions, rate limits)
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export let isRedisConnected = false;

function createRedisConnection(name: string): Redis {
  const connectionUrl = process.env.REDIS_URL;
  const client = connectionUrl
    ? new Redis(connectionUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        enableOfflineQueue: false,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      })
    : new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        enableOfflineQueue: false,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

  client.on('connect', () => {
    isRedisConnected = true;
    console.log(`[Redis:${name}] Connected successfully`);
  });
  client.on('error', () => {
    isRedisConnected = false;
  });
  client.on('close', () => {
    isRedisConnected = false;
  });

  return client;
}

export const redis =
  globalForRedis.redis ?? createRedisConnection('app');

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * Create a fresh Redis connection for BullMQ.
 * BullMQ requires separate connections for Queue, Worker, and QueueEvents
 * because of how ioredis handles blocking commands.
 */
export function createBullMQRedisConnection(): Redis {
  const connectionUrl = process.env.REDIS_URL;
  if (connectionUrl) {
    return new Redis(connectionUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 50, 1000),
    });
  }
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 50, 1000),
  });
}


// Graceful shutdown
process.on('beforeExit', async () => {
  try {
    await redis.quit();
  } catch {}
});
