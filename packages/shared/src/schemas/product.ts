import { z } from "zod";
import { UnitType } from "../enums.js";

export const CategoryDto = z.object({
  id: z.string().uuid(),
  nameEn: z.string(),
  nameKn: z.string(),
  nameHi: z.string(),
  slug: z.string(),
});
export type CategoryDto = z.infer<typeof CategoryDto>;

export const ProductVariantDto = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  sku: z.string(),
  packSize: z.number(),
  unit: UnitType,
  packLabel: z.string(),
  mrpPaise: z.number().int().nonnegative(),
  costPricePaise: z.number().int().nonnegative().nullable(),
  sellingPricePaise: z.number().int().nonnegative(),
  stock: z.number(),
  lowStockThreshold: z.number(),
  isActive: z.boolean(),
});
export type ProductVariantDto = z.infer<typeof ProductVariantDto>;

export const ProductDto = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  nameEn: z.string(),
  nameKn: z.string(),
  nameHi: z.string(),
  brand: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  variants: z.array(ProductVariantDto),
});
export type ProductDto = z.infer<typeof ProductDto>;

/** kn/hi/en all required — the whole point of the catalogue (voice needs all three scripts). */
export const CreateProductBody = z.object({
  categoryId: z.string().uuid(),
  nameEn: z.string().min(1),
  nameKn: z.string().min(1),
  nameHi: z.string().min(1),
  brand: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
});
export type CreateProductBody = z.infer<typeof CreateProductBody>;

export const UpdateProductBody = CreateProductBody.partial().extend({
  isAvailable: z.boolean().optional(),
});
export type UpdateProductBody = z.infer<typeof UpdateProductBody>;

export const CreateVariantBody = z.object({
  sku: z.string().min(1),
  packSize: z.number().positive(),
  unit: UnitType,
  packLabel: z.string().min(1),
  mrpPaise: z.number().int().nonnegative(),
  costPricePaise: z.number().int().nonnegative().optional(),
  sellingPricePaise: z.number().int().nonnegative(),
  stock: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().nonnegative().default(5),
});
export type CreateVariantBody = z.infer<typeof CreateVariantBody>;

export const UpdateVariantBody = CreateVariantBody.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateVariantBody = z.infer<typeof UpdateVariantBody>;

// ─────────────────────────── aliases (T1.3) ───────────────────────────

export const AliasDto = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  alias: z.string(),
  language: z.string().nullable(),
  source: z.string(),
});
export type AliasDto = z.infer<typeof AliasDto>;

export const CreateAliasBody = z.object({
  alias: z.string().min(1).max(120),
  language: z.string().optional(),
});
export type CreateAliasBody = z.infer<typeof CreateAliasBody>;
