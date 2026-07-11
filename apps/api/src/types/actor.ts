import type { Role } from "@kss/shared";

/**
 * The authenticated caller. Set ONLY by the authenticate middleware from a
 * verified JWT — never from a request body (TRD §9.1). Every repository method
 * takes this as its first parameter and scopes its query by it.
 */
export type Actor = {
  userId: string;
  role: Role;
};

// Make req.actor available and typed across the app.
declare module "fastify" {
  interface FastifyRequest {
    actor?: Actor;
  }
}
