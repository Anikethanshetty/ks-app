import { Prisma } from "@prisma/client";
import type { OrderStatus, OrderDto, PlaceOrderInput } from "@kss/shared";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { Decimal, lineTotal } from "../lib/money.js";
import { events } from "../lib/events.js";
import {
  getIdempotentResponse,
  saveIdempotentResponse,
} from "../lib/idempotency.js";
import { toOrderDto } from "../lib/mappers.js";
import { orderRepository } from "../repositories/order.repository.js";
import type { Actor } from "../types/actor.js";

/** Legal status transitions (schema §6.2). Anything else → INVALID_TRANSITION. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["payment_pending_verification", "confirmed", "cancelled"],
  payment_pending_verification: ["confirmed", "payment_failed", "cancelled"],
  payment_failed: ["payment_pending_verification", "confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "returned"],
  delivered: [],
  cancelled: [],
  returned: [],
};

/** Statuses a customer is still allowed to cancel from (before packed). */
const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  "placed",
  "payment_pending_verification",
  "payment_failed",
  "confirmed",
];

type LockedVariant = {
  id: string;
  product_id: string;
  stock: Prisma.Decimal;
  selling_price: Prisma.Decimal;
  name_en: string;
  name_kn: string;
  name_hi: string;
  pack_label: string;
  hsn_code: string | null;
};

async function loadOrderDto(orderId: string): Promise<OrderDto> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new AppError("INTERNAL_ERROR", "Order vanished after write.");
  return toOrderDto(order);
}

export const orderService = {
  /**
   * Atomic, authoritative order placement (TRD §6.1). Prices come from the DB,
   * variant rows are locked FOR UPDATE in a deterministic (sorted) order, and
   * every side effect happens inside one transaction. Two concurrent orders for
   * the last unit → exactly one succeeds, one gets OUT_OF_STOCK.
   */
  async placeOrder(
    actor: Actor,
    input: PlaceOrderInput,
    idempotencyKey?: string,
  ): Promise<OrderDto> {
    if (idempotencyKey) {
      const cached = await getIdempotentResponse<OrderDto>("placeOrder", idempotencyKey);
      if (cached) return cached;
    }
    if (input.items.length === 0) throw new AppError("EMPTY_ORDER");

    // Aggregate duplicate variants so the stock check is correct.
    const wanted = new Map<string, Prisma.Decimal>();
    for (const it of input.items) {
      const prev = wanted.get(it.variantId) ?? new Decimal(0);
      wanted.set(it.variantId, prev.add(it.quantity));
    }
    const ids = [...wanted.keys()].sort();

    const orderId = await prisma.$transaction(
      async (tx) => {
        const settings = await tx.shopSettings.findFirstOrThrow();
        if (!settings.acceptingOrders) throw new AppError("SHOP_NOT_ACCEPTING_ORDERS");

        // The address must belong to the actor. Never trust an addressId.
        const address = await tx.address.findFirst({
          where: { id: input.addressId, userId: actor.userId },
        });
        if (!address) throw new AppError("INVALID_ADDRESS");

        // ⭐ Lock the requested variant rows in a deterministic order (sorted by
        // id) so two concurrent orders can never deadlock. FOR UPDATE OF v locks
        // only the variant rows, not the joined products.
        const locked = await tx.$queryRaw<LockedVariant[]>(Prisma.sql`
          SELECT v.id, v.product_id, v.stock, v.selling_price,
                 p.name_en, p.name_kn, p.name_hi, v.pack_label, p.hsn_code
          FROM product_variants v
          JOIN products p ON p.id = v.product_id
          WHERE v.id = ANY(ARRAY[${Prisma.join(ids)}]::uuid[]) AND v.is_active
          ORDER BY v.id
          FOR UPDATE OF v
        `);
        const byId = new Map(locked.map((v) => [v.id, v]));

        let subtotal = new Decimal(0);
        const itemRows: Prisma.OrderItemCreateManyOrderInput[] = [];
        for (const variantId of ids) {
          const v = byId.get(variantId);
          if (!v) throw new AppError("VARIANT_NOT_FOUND", "Variant not found", { variantId });
          const qty = wanted.get(variantId)!;
          const stock = new Decimal(v.stock);
          if (stock.lessThan(qty)) {
            throw new AppError("OUT_OF_STOCK", "Not enough stock", {
              variantId,
              available: stock.toNumber(),
            });
          }
          const unitPrice = new Decimal(v.selling_price);
          const line = lineTotal(unitPrice, qty);
          subtotal = subtotal.add(line);
          itemRows.push({
            variantId,
            quantity: qty,
            unitPrice,
            lineTotal: line,
            productNameEn: v.name_en,
            productNameKn: v.name_kn,
            productNameHi: v.name_hi,
            packLabel: v.pack_label,
            hsnCode: v.hsn_code,
            addedVia: input.source,
          });
        }

        const deliveryFee = subtotal.greaterThanOrEqualTo(settings.freeDeliveryAbove)
          ? new Decimal(0)
          : new Decimal(settings.deliveryFee);
        const total = subtotal.add(deliveryFee);

        if (input.paymentMethod === "cod" && total.greaterThan(settings.codLimit)) {
          throw new AppError("COD_LIMIT_EXCEEDED");
        }

        const status: OrderStatus =
          input.paymentMethod === "cod" ? "confirmed" : "payment_pending_verification";

        const seqRows = await tx.$queryRaw<Array<{ seq: bigint }>>(
          Prisma.sql`SELECT nextval('order_number_seq') AS seq`,
        );
        const orderNumber = `KSS-${seqRows[0]!.seq}`;

        const addressSnapshot = {
          label: address.label,
          line1: address.line1,
          line2: address.line2,
          area: address.area,
          landmark: address.landmark,
          city: address.city,
          pincode: address.pincode,
        };

        const created = await tx.order.create({
          data: {
            orderNumber,
            userId: actor.userId,
            addressId: address.id,
            status,
            source: input.source,
            paymentMethod: input.paymentMethod,
            subtotal,
            deliveryFee,
            discount: new Decimal(0),
            total,
            customerNote: input.note ?? null,
            addressSnapshot,
            confirmedAt: status === "confirmed" ? new Date() : null,
            items: { createMany: { data: itemRows } },
            statusEvents: {
              createMany: {
                data: [
                  { status: "placed", actorId: actor.userId },
                  { status, actorId: actor.userId },
                ],
              },
            },
          },
        });

        // Decrement stock + write the compensating inventory_movement (sale).
        for (const variantId of ids) {
          const qty = wanted.get(variantId)!;
          await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: { decrement: qty } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId,
              delta: qty.neg(),
              reason: "sale",
              orderId: created.id,
              actorId: actor.userId,
            },
          });
        }

        // Clear the actor's cart.
        await tx.cartItem.deleteMany({ where: { cart: { userId: actor.userId } } });

        // Link the voice session that produced this order.
        if (input.source === "voice" && input.voiceSessionId) {
          await tx.voiceSession.update({
            where: { id: input.voiceSessionId },
            data: { resultedInOrder: true, orderId: created.id },
          });
        }

        return created.id;
      },
      { isolationLevel: "ReadCommitted", timeout: 10_000 },
    );

    // ── commit boundary ── side effects only after the transaction commits.
    const dto = await loadOrderDto(orderId);
    events.orderPlaced(dto.id, dto.status);
    if (idempotencyKey) await saveIdempotentResponse("placeOrder", idempotencyKey, dto);
    return dto;
  },

  /**
   * Status transition with the transition table, role gate, idempotency (via
   * order_status_events.client_mutation_id), and stock restoration on
   * cancelled/returned. All in one transaction (TRD §6.2).
   */
  async updateStatus(
    actor: Actor,
    orderId: string,
    newStatus: OrderStatus,
    note: string | undefined,
    clientMutationId: string | undefined,
  ): Promise<OrderDto> {
    // Idempotent replay: this exact mutation already applied → return as-is.
    if (clientMutationId) {
      const seen = await prisma.orderStatusEvent.findUnique({
        where: { clientMutationId },
      });
      if (seen) return loadOrderDto(seen.orderId);
    }

    // Scoped load: 404 for anyone not entitled to the order.
    const order = await orderRepository.findByIdForActor(actor, orderId);
    if (!order) throw new AppError("NOT_FOUND", "Order not found.");

    // Role gate (schema §6.2).
    if (actor.role === "delivery") {
      if (!["out_for_delivery", "delivered", "returned"].includes(newStatus)) {
        throw new AppError("FORBIDDEN", "Delivery cannot set this status.");
      }
    } else if (actor.role === "customer") {
      if (newStatus !== "cancelled") {
        throw new AppError("FORBIDDEN", "Customers may only cancel.");
      }
      if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
        throw new AppError("INVALID_TRANSITION", "Too late to cancel.");
      }
    }

    // Transition table.
    if (!TRANSITIONS[order.status].includes(newStatus)) {
      throw new AppError("INVALID_TRANSITION", `${order.status} → ${newStatus} not allowed`, {
        from: order.status,
        to: newStatus,
      });
    }

    const restores = newStatus === "cancelled" || newStatus === "returned";

    await prisma.$transaction(
      async (tx) => {
        try {
          await tx.orderStatusEvent.create({
            data: {
              orderId: order.id,
              status: newStatus,
              actorId: actor.userId,
              note: note ?? null,
              clientMutationId: clientMutationId ?? null,
            },
          });
        } catch (err) {
          // Unique violation on client_mutation_id = a concurrent replay. No-op.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            return;
          }
          throw err;
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: newStatus,
            ...(newStatus === "confirmed" && { confirmedAt: new Date() }),
            ...(newStatus === "delivered" && { deliveredAt: new Date() }),
            ...(newStatus === "cancelled" && {
              cancelledAt: new Date(),
              cancelReason: note ?? null,
            }),
          },
        });

        if (restores) {
          for (const it of order.items) {
            await tx.productVariant.update({
              where: { id: it.variantId },
              data: { stock: { increment: it.quantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                variantId: it.variantId,
                delta: it.quantity,
                reason: "return",
                orderId: order.id,
                actorId: actor.userId,
              },
            });
          }
        }
      },
      { isolationLevel: "ReadCommitted", timeout: 10_000 },
    );

    const dto = await loadOrderDto(order.id);
    events.orderStatusChanged(dto.id, dto.status);
    if (newStatus === "delivered") events.invoiceRequested(dto.id);
    return dto;
  },

  /** Customer/admin cancellation → status 'cancelled' (restores stock). */
  cancel(actor: Actor, orderId: string, reason: string | undefined): Promise<OrderDto> {
    return this.updateStatus(actor, orderId, "cancelled", reason, undefined);
  },
};
