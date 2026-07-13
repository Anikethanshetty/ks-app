import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  OrderDto,
  PaymentDto,
  SubmitPaymentBody,
  VerifyPaymentBody,
  paginated,
} from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { toOrderDto, toPaymentDto } from "../lib/mappers.js";
import { toPaise } from "../lib/money.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { prisma } from "../lib/prisma.js";
import { events } from "../lib/events.js";

const OrderIdParam = z.object({ id: z.string().uuid() });
const PaymentIdParam = z.object({ id: z.string().uuid() });
const PendingQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const paymentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── UPI: Customer submits payment proof (T3.3, C09) ──
  app.post(
    "/orders/:id/submit-payment",
    {
      preHandler: authorize("customer"),
      schema: {
        tags: ["payments"],
        summary: "Customer submits UPI payment proof for an order",
        params: OrderIdParam,
        body: SubmitPaymentBody,
        response: { 200: PaymentDto },
      },
    },
    async (req) => {
      const order = await prisma.order.findFirst({
        where: { id: req.params.id, userId: req.actor!.userId },
      });
      if (!order) throw new AppError("NOT_FOUND", "Order not found.");
      if (order.paymentMethod !== "upi") throw new AppError("VALIDATION_ERROR", "Not a UPI order");
      if (order.status !== "payment_pending_verification" && order.status !== "placed") {
        throw new AppError("INVALID_TRANSITION", "Payment already processed");
      }

      // Check if payment already submitted
      const existing = await prisma.payment.findFirst({
        where: { orderId: order.id },
      });
      if (existing) throw new AppError("PAYMENT_ALREADY_SUBMITTED");

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          method: "upi",
          amount: order.total,
          status: "pending_verification",
          upiReference: req.body.upiReference,
          proofImageUrl: req.body.proofImageUrl ?? null,
          submittedAt: new Date(),
        },
      });

      // Update order status if it's still 'placed'
      if (order.status === "placed") {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "payment_pending_verification" },
        });
      }

      events.orderStatusChanged(order.id, "payment_pending_verification", order.userId);
      return toPaymentDto(payment);
    },
  );

  // ── Admin: list pending payments (T3.4, A04) ──
  app.get(
    "/admin/payments",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin"],
        summary: "List pending payments for verification",
        querystring: PendingQuery,
        response: {
          200: z.object({
            items: z.array(PaymentDto),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (req) => {
      const rows = await prisma.payment.findMany({
        where: { status: "pending_verification" },
        include: {
          order: { select: { orderNumber: true, total: true, userId: true, placedAt: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: req.query.limit + 1,
        ...(req.query.cursor ? { cursor: { id: req.query.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > req.query.limit;
      const items = hasMore ? rows.slice(0, req.query.limit) : rows;
      return {
        items: items.map(toPaymentDto),
        nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      };
    },
  );

  // ── Admin: verify or reject a payment (T3.4) ──
  app.post(
    "/admin/payments/:id/verify",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin"],
        summary: "Verify or reject a payment",
        params: PaymentIdParam,
        body: VerifyPaymentBody,
        response: { 200: PaymentDto },
      },
    },
    async (req) => {
      const payment = await prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { order: true },
      });
      if (!payment) throw new AppError("PAYMENT_NOT_FOUND");
      if (payment.status !== "pending_verification") {
        throw new AppError("PAYMENT_ALREADY_SUBMITTED", "Payment already processed");
      }

      if (req.body.action === "verify") {
        const updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "verified",
            verifiedBy: req.actor!.userId,
            verifiedAt: new Date(),
          },
        });

        // Transition order to 'confirmed'
        await prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "confirmed", confirmedAt: new Date() },
        });

        // Add status event
        await prisma.orderStatusEvent.create({
          data: {
            orderId: payment.orderId,
            status: "confirmed",
            actorId: req.actor!.userId,
            note: "Payment verified",
          },
        });

        events.orderStatusChanged(payment.orderId, "confirmed", payment.order.userId);
        return toPaymentDto(updated);
      } else {
        const updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "rejected",
            verifiedBy: req.actor!.userId,
            verifiedAt: new Date(),
            rejectionReason: req.body.rejectionReason ?? null,
          },
        });

        // Add status event — order stays in payment_pending_verification so customer can retry
        await prisma.orderStatusEvent.create({
          data: {
            orderId: payment.orderId,
            status: "payment_failed",
            actorId: req.actor!.userId,
            note: req.body.rejectionReason ?? "Payment rejected",
          },
        });

        events.orderStatusChanged(payment.orderId, "payment_failed", payment.order.userId);
        return toPaymentDto(updated);
      }
    },
  );

  // ── Admin: update shop settings (T3.1, A14) ──
  app.patch(
    "/admin/shop-settings",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin"],
        summary: "Update shop settings (UPI, delivery, etc.)",
        body: z.object({
          upiVpa: z.string().nullable().optional(),
          upiPayeeName: z.string().nullable().optional(),
          upiQrUrl: z.string().nullable().optional(),
          deliveryFeePaise: z.number().int().nonnegative().optional(),
          freeDeliveryAbovePaise: z.number().int().nonnegative().optional(),
          acceptingOrders: z.boolean().optional(),
          isOpen: z.boolean().optional(),
        }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const data: Record<string, unknown> = {};
      if (req.body.upiVpa !== undefined) data.upiVpa = req.body.upiVpa;
      if (req.body.upiPayeeName !== undefined) data.upiPayeeName = req.body.upiPayeeName;
      if (req.body.upiQrUrl !== undefined) data.upiQrUrl = req.body.upiQrUrl;
      if (req.body.deliveryFeePaise !== undefined) data.deliveryFee = req.body.deliveryFeePaise / 100;
      if (req.body.freeDeliveryAbovePaise !== undefined) data.freeDeliveryAbove = req.body.freeDeliveryAbovePaise / 100;
      if (req.body.acceptingOrders !== undefined) data.acceptingOrders = req.body.acceptingOrders;
      if (req.body.isOpen !== undefined) data.isOpen = req.body.isOpen;

      if (Object.keys(data).length === 0) return { ok: true as const };

      await prisma.shopSettings.update({ where: { id: 1 }, data });
      return { ok: true as const };
    },
  );
};
