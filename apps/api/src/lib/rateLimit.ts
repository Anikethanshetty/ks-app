import { redis } from "./redis.js";

/**
 * Fixed-window counter in Redis. Returns true if this hit is ALLOWED, false if
 * the window is already at its limit. Used for the OTP/auth limits that need a
 * custom key (per-phone, per-IP) beyond the global @fastify/rate-limit.
 */
export async function allowWithinWindow(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const redisKey = `rl:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }
  return count <= max;
}
