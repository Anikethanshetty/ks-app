import { z } from "zod";
import { OrderSource, OrderStatus, PaymentMethod } from "../enums.js";

/** Quantity supports loose grocery (0.5 kg), up to 3 decimals. */
const Quantity = z.number().positive().max(100000);

export const PlaceOrderItem = z.object({
  variantId: z.string().uuid(),
  quantity: Quantity,
});
export type PlaceOrderItem = z.infer<typeof PlaceOrderItem>;

/**
 * The client sends ONLY variantId + quantity. No prices, no totals — the server
 * is the sole authority on money (TRD §2.4, §6.1).
 */
export const PlaceOrderInput = z.object({
  addressId: z.string().uuid(),
  paymentMethod: PaymentMethod,
  items: z.array(PlaceOrderItem).min(1),
  source: OrderSource.default("manual"),
  voiceSessionId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});
export type PlaceOrderInput = z.infer<typeof PlaceOrderInput>;

/** A status event in the order timeline. */
export const StatusEventDto = z.object({
  status: OrderStatus,
  actorId: z.string().uuid().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type StatusEventDto = z.infer<typeof StatusEventDto>;

/** All money fields are integer paise on the wire (26600 = ₹266.00). */
export const OrderItemDto = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  lineTotalPaise: z.number().int().nonnegative(),
  productNameEn: z.string(),
  productNameKn: z.string(),
  productNameHi: z.string(),
  packLabel: z.string(),
  addedVia: OrderSource,
});
export type OrderItemDto = z.infer<typeof OrderItemDto>;

export const OrderDto = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  status: OrderStatus,
  source: OrderSource,
  paymentMethod: PaymentMethod,
  subtotalPaise: z.number().int().nonnegative(),
  deliveryFeePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative(),
  totalPaise: z.number().int().nonnegative(),
  deliverySlot: z.string().nullable(),
  customerNote: z.string().nullable(),
  addressSnapshot: z.record(z.string(), z.unknown()),
  items: z.array(OrderItemDto),
  statusEvents: z.array(StatusEventDto),
  placedAt: z.string(),
});
export type OrderDto = z.infer<typeof OrderDto>;

export const OrderSummaryDto = OrderDto.omit({ items: true, addressSnapshot: true, statusEvents: true });
export type OrderSummaryDto = z.infer<typeof OrderSummaryDto>;

export const UpdateStatusBody = z.object({
  status: OrderStatus,
  note: z.string().max(500).optional(),
});
export type UpdateStatusBody = z.infer<typeof UpdateStatusBody>;

export const CancelOrderBody = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelOrderBody = z.infer<typeof CancelOrderBody>;
