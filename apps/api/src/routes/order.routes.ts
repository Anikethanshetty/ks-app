import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  CancelOrderBody,
  OrderDto,
  OrderPreviewDto,
  OrderSummaryDto,
  PlaceOrderInput,
  ShopSettingsDto,
  UpdateStatusBody,
  paginated,
} from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { toOrderDto, toOrderSummaryDto } from "../lib/mappers.js";
import { toPaise } from "../lib/money.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { orderRepository } from "../repositories/order.repository.js";
import { orderService } from "../services/order.service.js";
import { prisma } from "../lib/prisma.js";

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

  // ── Shop settings (T2.2) ──
  app.get(
    "/shop/settings",
    {
      preHandler: authorize("customer", "delivery", "admin"),
      schema: {
        tags: ["orders"],
        summary: "Get shop settings visible to customers",
        response: { 200: ShopSettingsDto },
      },
    },
    async () => {
      const s = await prisma.shopSettings.findFirstOrThrow();
      return {
        shopName: s.shopName,
        shopPhone: s.shopPhone,
        deliveryFeePaise: toPaise(s.deliveryFee),
        freeDeliveryAbovePaise: toPaise(s.freeDeliveryAbove),
        deliveryRadiusKm: Number(s.deliveryRadiusKm),
        codLimitPaise: toPaise(s.codLimit),
        isOpen: s.isOpen,
        acceptingOrders: s.acceptingOrders,
        upiVpa: s.upiVpa,
        upiPayeeName: s.upiPayeeName,
      };
    },
  );

  // ── Order preview (T2.2): validate cart + compute bill without placing ──
  app.get(
    "/orders/preview",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["orders"],
        summary: "Preview order from current cart (validates stock + computes bill)",
        querystring: z.object({ addressId: z.string().uuid() }),
        response: { 200: OrderPreviewDto },
      },
    },
    async (req) => {
      const addressId = req.query.addressId;

      // Verify address belongs to actor
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId: req.actor!.userId },
      });
      if (!address) throw new AppError("INVALID_ADDRESS");

      const settings = await prisma.shopSettings.findFirstOrThrow();

      // Load cart items with variant details
      const rows: Array<{
        variantId: string;
        nameEn: string;
        nameKn: string;
        nameHi: string;
        packLabel: string;
        quantity: string;
        sellingPrice: string;
        stock: string;
      }> = await prisma.$queryRaw`
        SELECT
          ci.variant_id::text AS "variantId",
          p.name_en::text AS "nameEn",
          p.name_kn::text AS "nameKn",
          p.name_hi::text AS "nameHi",
          v.pack_label::text AS "packLabel",
          ci.quantity::text AS "quantity",
          v.selling_price::text AS "sellingPrice",
          v.stock::text AS "stock"
        FROM cart_items ci
        JOIN carts c ON c.id = ci.cart_id
        JOIN product_variants v ON v.id = ci.variant_id
        JOIN products p ON p.id = v.product_id
        WHERE c.user_id = ${req.actor!.userId}::uuid
        ORDER BY ci.created_at ASC
      `;

      if (rows.length === 0) throw new AppError("EMPTY_ORDER");

      let subtotalPaise = 0;
      const items = rows.map((r) => {
        const qty = Number(r.quantity);
        const unitPricePaise = Math.round(Number(r.sellingPrice) * 100);
        const lineTotalPaise = unitPricePaise * qty;
        subtotalPaise += lineTotalPaise;
        return {
          variantId: r.variantId,
          productNameEn: r.nameEn,
          productNameKn: r.nameKn,
          productNameHi: r.nameHi,
          packLabel: r.packLabel,
          quantity: qty,
          unitPricePaise,
          lineTotalPaise,
          available: Number(r.stock),
          inStock: Number(r.stock) >= qty,
        };
      });

      const freeDeliveryAbovePaise = toPaise(settings.freeDeliveryAbove);
      const deliveryFeePaise = subtotalPaise >= freeDeliveryAbovePaise ? 0 : toPaise(settings.deliveryFee);
      const totalPaise = subtotalPaise + deliveryFeePaise;
      const codLimitPaise = toPaise(settings.codLimit);

      return {
        items,
        itemCount: items.length,
        subtotalPaise,
        deliveryFeePaise,
        freeDeliveryAbovePaise,
        totalPaise,
        codLimitPaise,
        codExceeded: totalPaise > codLimitPaise,
        isAcceptingOrders: settings.acceptingOrders,
        shopName: settings.shopName,
      };
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
