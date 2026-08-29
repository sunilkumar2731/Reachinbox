import Redis from 'ioredis';
import { env } from './env';

// Singleton Redis connection used by the Express app (sessions, rate limits)
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export let isRedisConnected = false;

function createRedisConnection(name: string): Redis {
  const client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false, // Prevents hanging requests when Redis is offline
    retryStrategy: (times) => {
      // Exponential backoff: 50ms, 100ms, 200ms … capped at 2s
      return Math.min(times * 50, 2000);
    },
    lazyConnect: false,
  });

  client.on('connect', () => {
    isRedisConnected = true;
    console.log(`[Redis:${name}] Connected successfully`);
  });
  client.on('error', (err) => {
    isRedisConnected = false;
    // Log once or sparingly without flooding
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
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false, // Prevents hanging requests when Redis is offline
    retryStrategy: (times) => Math.min(times * 50, 1000),
  });
}

// Graceful shutdown
process.on('beforeExit', async () => {
  try {
    await redis.quit();
  } catch {}
});
