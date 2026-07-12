import { z } from "zod";
import { OrderSource } from "../enums.js";

// ─────────────────────────── cart schemas (T2.1) ───────────────────────────

export const CartItemDto = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productNameEn: z.string(),
  productNameKn: z.string(),
  productNameHi: z.string(),
  packLabel: z.string(),
  packSize: z.number(),
  unit: z.string(),
  quantity: z.number().positive(),
  mrpPaise: z.number().int().nonnegative(),
  sellingPricePaise: z.number().int().nonnegative(),
  lineTotalPaise: z.number().int().nonnegative(),
  stock: z.number(),
  addedVia: OrderSource,
});
export type CartItemDto = z.infer<typeof CartItemDto>;

export const CartDto = z.object({
  items: z.array(CartItemDto),
  itemCount: z.number().int().nonnegative(),
  subtotalPaise: z.number().int().nonnegative(),
});
export type CartDto = z.infer<typeof CartDto>;

export const AddToCartBody = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive().max(100000),
  addedVia: OrderSource.default("manual"),
});
export type AddToCartBody = z.infer<typeof AddToCartBody>;

export const UpdateCartItemBody = z.object({
  quantity: z.number().positive().max(100000),
});
export type UpdateCartItemBody = z.infer<typeof UpdateCartItemBody>;

export const CartCountDto = z.object({
  count: z.number().int().nonnegative(),
});
export type CartCountDto = z.infer<typeof CartCountDto>;
