import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "@kss/shared";
import { env } from "../config/env.js";

/**
 * Minimal HS256 JWT for the 15-minute access token. Hand-rolled (no library) so
 * the auth path has zero framework coupling — "own JWT auth" (TRD §2.1).
 * Refresh tokens are opaque and live in the DB; they are NOT JWTs.
 */

const ACCESS_TTL_SECONDS = 15 * 60;

export type AccessClaims = { sub: string; role: Role };

type FullClaims = AccessClaims & { iat: number; exp: number };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", env.JWT_ACCESS_SECRET).update(data).digest("base64url");
}

export class JwtError extends Error {
  constructor(
    message: string,
    readonly reason: "expired" | "invalid",
  ) {
    super(message);
  }
}

export function signAccessToken(claims: AccessClaims): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ ...claims, iat: now, exp: now + ACCESS_TTL_SECONDS }),
  );
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(token: string): AccessClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("Malformed token", "invalid");
  const [header, payload, signature] = parts as [string, string, string];

  const expected = sign(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new JwtError("Bad signature", "invalid");
  }

  let claims: FullClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new JwtError("Bad payload", "invalid");
  }
  if (Math.floor(Date.now() / 1000) >= claims.exp) {
    throw new JwtError("Token expired", "expired");
  }
  return { sub: claims.sub, role: claims.role };
}
