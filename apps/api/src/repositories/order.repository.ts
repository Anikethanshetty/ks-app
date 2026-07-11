import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { Actor } from "../types/actor.js";

/**
 * Orders access. Every read is scoped by the actor (TRD §9.1):
 *   customer → own orders · delivery → actively assigned · admin → all.
 * A row the actor is not entitled to comes back as null → the route returns 404.
 */
function actorScope(actor: Actor): Prisma.OrderWhereInput {
  if (actor.role === "customer") return { userId: actor.userId };
  if (actor.role === "delivery") {
    return {
      deliveryAssignments: {
        some: { deliveryUserId: actor.userId, isActive: true },
      },
    };
  }
  return {}; // admin: no extra filter
}

const withItems = { items: true } satisfies Prisma.OrderInclude;

export const orderRepository = {
  findByIdForActor(actor: Actor, orderId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, ...actorScope(actor) },
      include: withItems,
    });
  },

  async listForActor(actor: Actor, cursor: string | undefined, limit: number) {
    const rows = await prisma.order.findMany({
      where: actorScope(actor),
      include: withItems,
      orderBy: { placedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  },
};

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof withItems }>;
