import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@kss/shared";
import { AppError } from "../lib/errors.js";

/**
 * Coarse route-level role gate (TRD §9.1). Must run AFTER `authenticate`.
 * This is the outer layer only — the real defence is per-actor scoping in the
 * repositories. Use both.
 */
export function authorize(...roles: Role[]) {
  return async function authorizeGuard(
    req: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!req.actor) throw new AppError("UNAUTHENTICATED", "Not authenticated.");
    if (!roles.includes(req.actor.role)) {
      throw new AppError("FORBIDDEN", "You do not have access to this resource.");
    }
  };
}
