import { z } from "zod";
import { MovementReason } from "../enums.js";

/** A05 tabs. "all" ignores stock, the other two filter by it server-side. */
export const InventoryTab = z.enum(["all", "low_stock", "out_of_stock"]);
export type InventoryTab = z.infer<typeof InventoryTab>;

export const InventoryVariantDto = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productNameEn: z.string(),
  productNameKn: z.string(),
  productNameHi: z.string(),
  categoryNameEn: z.string(),
  packLabel: z.string(),
  sku: z.string(),
  mrpPaise: z.number().int().nonnegative(),
  sellingPricePaise: z.number().int().nonnegative(),
  stock: z.number(),
  lowStockThreshold: z.number(),
  isLowStock: z.boolean(),
  isOutOfStock: z.boolean(),
  isActive: z.boolean(),
});
export type InventoryVariantDto = z.infer<typeof InventoryVariantDto>;

export const InventoryCounts = z.object({
  all: z.number().int().nonnegative(),
  lowStock: z.number().int().nonnegative(),
  outOfStock: z.number().int().nonnegative(),
});
export type InventoryCounts = z.infer<typeof InventoryCounts>;

export const InventoryListResponse = z.object({
  items: z.array(InventoryVariantDto),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  counts: InventoryCounts,
});
export type InventoryListResponse = z.infer<typeof InventoryListResponse>;

// ─────────────────────────── stock adjust (T1.4, A07) ───────────────────────────

/**
 * Stock-in body (purchase).
 */
export const StockInBody = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  costPricePaise: z.number().int().nonnegative().optional(),
  batchCode: z.string().optional(),
  supplierName: z.string().optional(),
  expiryDate: z.string().optional(), // ISO date string
  note: z.string().optional(),
});
export type StockInBody = z.infer<typeof StockInBody>;

/**
 * Stock-out body (damage / expiry / shop use).
 */
export const StockOutBody = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  reason: MovementReason.exclude(["purchase", "sale", "correction", "return"]),
  note: z.string().optional(),
});
export type StockOutBody = z.infer<typeof StockOutBody>;

/**
 * Stock correction body (set counted stock).
 */
export const CorrectionBody = z.object({
  variantId: z.string().uuid(),
  countedStock: z.number().nonnegative(),
  note: z.string().optional(),
});
export type CorrectionBody = z.infer<typeof CorrectionBody>;

/**
 * Union body for the stock adjust endpoint. The `type` discriminator selects
 * which payload schema applies.
 */
export const AdjustStockBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stock_in"), ...StockInBody.shape }),
  z.object({ type: z.literal("stock_out"), ...StockOutBody.shape }),
  z.object({ type: z.literal("correction"), ...CorrectionBody.shape }),
]);
export type AdjustStockBody = z.infer<typeof AdjustStockBody>;

/** Response after a stock adjustment — the updated variant stock. */
export const AdjustStockResponse = z.object({
  variantId: z.string().uuid(),
  previousStock: z.number(),
  newStock: z.number(),
  delta: z.number(),
  reason: MovementReason,
});
export type AdjustStockResponse = z.infer<typeof AdjustStockResponse>;
