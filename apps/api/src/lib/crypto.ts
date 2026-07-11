import { createHash, randomBytes, randomInt } from "node:crypto";
import { env } from "../config/env.js";

/** Opaque refresh token: 32 random bytes, base64url. Never a JWT. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Deterministic hash of a refresh token for storage. Peppered with the refresh
 * secret so a leaked DB alone cannot be used to forge a lookup. sha256 is fine
 * here — the token has full entropy (unlike a 6-digit OTP, which uses bcrypt).
 */
export function hashToken(token: string): string {
  return createHash("sha256")
    .update(`${token}${env.JWT_REFRESH_SECRET}`)
    .digest("hex");
}

/** Cryptographically-random 6-digit OTP as a zero-padded string. */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
