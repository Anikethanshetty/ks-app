import { z } from "zod";
import { ERROR_CODES } from "../errorCodes.js";

/** Every error response body: { error: { code, message, details? } }. TRD §5.1. */
export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const HealthResponse = z.object({
  status: z.literal("ok"),
  uptime: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ReadyResponse = z.object({
  status: z.enum(["ready", "degraded"]),
  checks: z.object({
    postgres: z.boolean(),
    redis: z.boolean(),
  }),
});
export type ReadyResponse = z.infer<typeof ReadyResponse>;

/** Cursor pagination envelope. TRD §5.1. */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
