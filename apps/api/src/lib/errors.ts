import type { ErrorCode } from "@kss/shared";

/**
 * The one error type services throw. errorHandler maps it to
 * { error: { code, message } } with the right HTTP status. TRD §5.1.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

/** Default HTTP status per error code. Ownership failures are 404, not 403 (TRD §9.1). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  INTERNAL_ERROR: 500,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,

  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  REFRESH_REUSE_DETECTED: 401,
  FORBIDDEN: 403,
  OTP_INVALID: 400,
  OTP_EXPIRED: 400,
  OTP_MAX_ATTEMPTS: 429,

  OUT_OF_STOCK: 409,
  VARIANT_NOT_FOUND: 404,
  EMPTY_ORDER: 400,
  INVALID_ADDRESS: 400,
  COD_LIMIT_EXCEEDED: 400,
  SHOP_NOT_ACCEPTING_ORDERS: 409,
  INVALID_TRANSITION: 400,
  DELIVERY_RADIUS_EXCEEDED: 400,

  PAYMENT_ALREADY_SUBMITTED: 409,
  PAYMENT_NOT_FOUND: 404,

  VOICE_TRANSCRIPTION_FAILED: 502,
  VOICE_RATE_LIMITED: 429,
};
