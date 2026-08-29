import { redis } from '../config/redis';
import { env } from '../config/env';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  rescheduleDelayMs: number;
  hourWindow: string;
}

export class RateLimiterService {
  /**
   * Generates a deterministic hour window string: YYYY-MM-DD-HH
   */
  static getHourWindow(date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    return `${y}-${m}-${d}-${h}`;
  }

  /**
   * Calculates milliseconds until the start of the next UTC hour window
   */
  static getMsUntilNextHour(date: Date = new Date()): number {
    const nextHour = new Date(date);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
    return Math.max(1000, nextHour.getTime() - date.getTime());
  }

  /**
   * Atomically checks and increments the sender's hourly counter using Redis.
   * If the limit has been reached, the counter is NOT incremented beyond the limit,
   * and allowed: false with the required delay until next hour is returned.
   * 
   * Uses Redis Lua script for 100% atomic check-and-increment.
   */
  static async checkAndConsumeRateLimit(
    senderId: string,
    customLimit?: number
  ): Promise<RateLimitResult> {
    const limit = customLimit && customLimit > 0 ? customLimit : env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const redisKey = `email-rate:${senderId}:${hourWindow}`;

    // Lua script:
    // 1. Get current count
    // 2. If count < limit, INCR and if new set EXPIRE to 7200 seconds (2 hours)
    // 3. Return { allowed (1 or 0), currentCount }
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return { 0, tonumber(current) }
      else
        local newCount = redis.call('INCR', KEYS[1])
        if tonumber(newCount) == 1 then
          redis.call('EXPIRE', KEYS[1], 7200)
        end
        return { 1, tonumber(newCount) }
      end
    `;

    try {
      const result = (await redis.eval(luaScript, 1, redisKey, limit)) as [number, number];
      const allowed = result[0] === 1;
      const currentCount = result[1];

      const rescheduleDelayMs = allowed ? 0 : this.getMsUntilNextHour(now);

      return {
        allowed,
        currentCount,
        limit,
        rescheduleDelayMs,
        hourWindow,
      };
    } catch (err) {
      console.warn('[RateLimiterService] Redis unavailable, allowing email processing (fail-open):', (err as Error).message);
      return {
        allowed: true,
        currentCount: 0,
        limit,
        rescheduleDelayMs: 0,
        hourWindow,
      };
    }
  }

  /**
   * Get current usage count for a sender in the current hour without incrementing
   */
  static async getCurrentHourlyCount(senderId: string): Promise<number> {
    try {
      const hourWindow = this.getHourWindow(new Date());
      const redisKey = `email-rate:${senderId}:${hourWindow}`;
      const val = await redis.get(redisKey);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  }
}
