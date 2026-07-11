import { Redis } from "ioredis";
import { env } from "../config/env.js";

/** Shared Redis connection: cache, OTP rate limits, session revocation, BullMQ. */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

export async function pingRedis(): Promise<boolean> {
  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
