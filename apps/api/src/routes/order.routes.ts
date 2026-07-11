import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  CancelOrderBody,
  OrderDto,
  OrderSummaryDto,
  PlaceOrderInput,
  UpdateStatusBody,
  paginated,
} from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { toOrderDto, toOrderSummaryDto } from "../lib/mappers.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { orderRepository } from "../repositories/order.repository.js";
import { orderService } from "../services/order.service.js";

const IdParam = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const orderRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  app.post(
    "/orders",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["orders"],
        summary: "Place an order (server computes all money)",
        body: PlaceOrderInput,
        response: { 200: OrderDto },
      },
    },
    async (req) => {
      const key = req.headers["idempotency-key"];
      const idempotencyKey = typeof key === "string" ? key : undefined;
      return orderService.placeOrder(req.actor!, req.body, idempotencyKey);
    },
  );

  app.get(
    "/orders",
    {
      schema: {
        tags: ["orders"],
        summary: "List orders (role-scoped)",
        querystring: ListQuery,
        response: { 200: paginated(OrderSummaryDto) },
      },
    },
    async (req) => {
      const { items, nextCursor } = await orderRepository.listForActor(
        req.actor!,
        req.query.cursor,
        req.query.limit,
      );
      return { items: items.map(toOrderSummaryDto), nextCursor };
    },
  );

  app.get(
    "/orders/:id",
    {
      schema: {
        tags: ["orders"],
        summary: "Get an order (404 if not entitled)",
        params: IdParam,
        response: { 200: OrderDto },
      },
    },
    async (req) => {
      const order = await orderRepository.findByIdForActor(req.actor!, req.params.id);
      if (!order) throw new AppError("NOT_FOUND", "Order not found.");
      return toOrderDto(order);
    },
  );

  app.post(
    "/orders/:id/cancel",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["orders"],
        summary: "Cancel an order (customer only before packed)",
        params: IdParam,
        body: CancelOrderBody,
        response: { 200: OrderDto },
      },
    },
    async (req) => orderService.cancel(req.actor!, req.params.id, req.body.reason),
  );

  app.patch(
    "/orders/:id/status",
    {
      preHandler: authorize("delivery", "admin"),
      schema: {
        tags: ["orders"],
        summary: "Update order status (Idempotency-Key supported)",
        params: IdParam,
        body: UpdateStatusBody,
        response: { 200: OrderDto },
      },
    },
    async (req) => {
      const key = req.headers["idempotency-key"];
      const clientMutationId = typeof key === "string" ? key : undefined;
      return orderService.updateStatus(
        req.actor!,
        req.params.id,
        req.body.status,
        req.body.note,
        clientMutationId,
      );
    },
  );
};
