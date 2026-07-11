import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../lib/errors.js";
import { JwtError, verifyAccessToken } from "../lib/jwt.js";

/**
 * Verifies the Bearer access token and sets req.actor. This is the ONLY way the
 * app learns who the caller is — req.body.userId is never read (TRD §9.1).
 * Register as a preHandler on every protected route.
 */
export async function authenticate(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHENTICATED", "Missing bearer token.");
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const claims = verifyAccessToken(token);
    req.actor = { userId: claims.sub, role: claims.role };
  } catch (err) {
    if (err instanceof JwtError && err.reason === "expired") {
      throw new AppError("TOKEN_EXPIRED", "Access token expired.");
    }
    throw new AppError("TOKEN_INVALID", "Invalid access token.");
  }
}
