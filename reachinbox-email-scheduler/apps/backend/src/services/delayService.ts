import { redis } from '../config/redis';
import { env } from '../config/env';

export class DelayService {
  /**
   * Enforces a Redis-backed minimum delay between sends for a given sender across all concurrent workers.
   * Unlike an in-memory sleep which only protects a single thread, this coordinates across
   * all worker instances by tracking the last-sent timestamp in Redis and holding a distributed lock
   * or spacing out executions.
   */
  static async enforceMinDelay(senderId: string, customDelayMs?: number): Promise<void> {
    const minDelayMs = customDelayMs !== undefined ? customDelayMs : env.MIN_EMAIL_DELAY_MS;
    if (minDelayMs <= 0) return;

    const key = `email-last-sent:${senderId}`;
    const now = Date.now();

    // Lua script atomically checks last sent timestamp and updates it to the scheduled send time
    // Returning the required wait in milliseconds
    const luaScript = `
      local lastSent = redis.call('GET', KEYS[1])
      local now = tonumber(ARGV[1])
      local minDelay = tonumber(ARGV[2])
      local waitMs = 0

      if lastSent then
        local diff = now - tonumber(lastSent)
        if diff < minDelay then
          waitMs = minDelay - diff
          redis.call('SET', KEYS[1], tostring(now + waitMs), 'PX', minDelay * 10)
          return waitMs
        end
      end

      redis.call('SET', KEYS[1], tostring(now), 'PX', minDelay * 10)
      return 0
    `;

    try {
      const waitMs = (await redis.eval(luaScript, 1, key, now, minDelayMs)) as number;

      if (waitMs > 0) {
        // Sleep for the exact required spacing to respect provider throttling
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } catch (err) {
      console.warn('[DelayService] Redis unavailable, skipping min delay enforcement:', (err as Error).message);
    }
  }
}
