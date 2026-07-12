import { z } from "zod";

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
