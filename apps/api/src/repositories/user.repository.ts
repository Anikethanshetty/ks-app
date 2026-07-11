import type { MePatchBody } from "@kss/shared";
import { prisma } from "../lib/prisma.js";
import type { Actor } from "../types/actor.js";

/**
 * users access.
 * - The `…ForAuth` methods run before there is an actor (login) and are called
 *   only by the auth/otp services.
 * - The actor-scoped methods below serve /me and only ever touch the caller's
 *   own row. `role` and `isBlocked` are never writable here (§5.3).
 */
export const userRepository = {
  findByPhoneForAuth(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },

  findByIdForAuth(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  /** Login upsert: create a customer on first sight, keep the row otherwise. */
  async upsertByPhoneForAuth(
    phone: string,
  ): Promise<{ user: Awaited<ReturnType<typeof prisma.user.create>>; isNewUser: boolean }> {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return { user: existing, isNewUser: false };
    const user = await prisma.user.create({ data: { phone } });
    return { user, isNewUser: true };
  },

  /** GET /me — the caller's own row only. */
  findSelf(actor: Actor) {
    return prisma.user.findUnique({ where: { id: actor.userId } });
  },

  /** PATCH /me — scoped to the actor; only whitelisted fields, never `role`. */
  updateSelf(actor: Actor, data: MePatchBody) {
    return prisma.user.update({
      where: { id: actor.userId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.language !== undefined && { language: data.language }),
      },
    });
  },
};
