import { redis } from "./redis.js";

/**
 * Idempotency-Key store (TRD §5.1). The server remembers the response for a key
 * for 24 h and replays it on a repeat — making a retried offline mutation a
 * no-op that returns the original result instead of acting twice.
 */
const TTL_SECONDS = 24 * 60 * 60;

export async function getIdempotentResponse<T>(
  scope: string,
  key: string,
): Promise<T | null> {
  const raw = await redis.get(`idem:${scope}:${key}`);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function saveIdempotentResponse(
  scope: string,
  key: string,
  value: unknown,
): Promise<void> {
  await redis.set(`idem:${scope}:${key}`, JSON.stringify(value), "EX", TTL_SECONDS);
}
