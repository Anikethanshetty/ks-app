import { z } from "zod";

export const Role = z.enum(["customer", "delivery", "admin"]);
export type Role = z.infer<typeof Role>;

export const Language = z.enum(["kn", "hi", "en"]);
export type Language = z.infer<typeof Language>;

// DB enum payment_method = ('upi','cod'). DB is the source of truth.
export const PaymentMethod = z.enum(["upi", "cod"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

// DB enum order_source = ('manual','voice','admin').
export const OrderSource = z.enum(["manual", "voice", "admin"]);
export type OrderSource = z.infer<typeof OrderSource>;

// DB enum unit_type.
export const UnitType = z.enum([
  "kg",
  "g",
  "l",
  "ml",
  "piece",
  "packet",
  "dozen",
  "bundle",
]);
export type UnitType = z.infer<typeof UnitType>;

// DB enum movement_reason.
export const MovementReason = z.enum([
  "purchase",
  "sale",
  "damage",
  "expiry",
  "shop_use",
  "correction",
  "return",
]);
export type MovementReason = z.infer<typeof MovementReason>;

/** Order lifecycle. Transition table is enforced server-side in orderService. */
export const OrderStatus = z.enum([
  "placed",
  "payment_pending_verification",
  "payment_failed",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

// DB enum payment_status.
export const PaymentStatus = z.enum([
  "pending_verification",
  "verified",
  "rejected",
  "collected",
  "refunded",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;
