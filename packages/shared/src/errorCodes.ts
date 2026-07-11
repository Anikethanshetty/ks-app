/**
 * Canonical error codes. The mobile app switches on `code`, never on `message`.
 * Keep this list authoritative — every AppError code must be a member here.
 */
export const ERROR_CODES = [
  // generic
  "INTERNAL_ERROR",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "RATE_LIMITED",
  // auth
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
  "REFRESH_REUSE_DETECTED",
  "FORBIDDEN",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_MAX_ATTEMPTS",
  // orders / inventory
  "OUT_OF_STOCK",
  "VARIANT_NOT_FOUND",
  "EMPTY_ORDER",
  "INVALID_ADDRESS",
  "COD_LIMIT_EXCEEDED",
  "SHOP_NOT_ACCEPTING_ORDERS",
  "INVALID_TRANSITION",
  "DELIVERY_RADIUS_EXCEEDED",
  // payments
  "PAYMENT_ALREADY_SUBMITTED",
  "PAYMENT_NOT_FOUND",
  // voice
  "VOICE_TRANSCRIPTION_FAILED",
  "VOICE_RATE_LIMITED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(x: unknown): x is ErrorCode {
  return typeof x === "string" && (ERROR_CODES as readonly string[]).includes(x);
}
