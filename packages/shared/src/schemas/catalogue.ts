import { z } from "zod";
import { UnitType } from "../enums.js";

// ─────────────────────────── catalogue schemas (T1.6) ───────────────────────────

/** Category with active‑product count for the customer browse screen (C04). */
export const CatalogueCategoryDto = z.object({
  id: z.string().uuid(),
  nameEn: z.string(),
  nameKn: z.string(),
  nameHi: z.string(),
  slug: z.string(),
  iconUrl: z.string().nullable(),
  productCount: z.number().int().nonnegative(),
});
export type CatalogueCategoryDto = z.infer<typeof CatalogueCategoryDto>;

/** Variant visible to customers — prices in paise, no cost price. */
export const CatalogueVariantDto = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  sku: z.string(),
  packSize: z.number(),
  unit: UnitType,
  packLabel: z.string(),
  mrpPaise: z.number().int().nonnegative(),
  sellingPricePaise: z.number().int().nonnegative(),
  stock: z.number(),
  isDefault: z.boolean(),
});
export type CatalogueVariantDto = z.infer<typeof CatalogueVariantDto>;

/** Product in a category listing — only the default/first variant is shown. */
export const CatalogueProductDto = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  nameEn: z.string(),
  nameKn: z.string(),
  nameHi: z.string(),
  brand: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  defaultVariant: CatalogueVariantDto.nullable(),
});
export type CatalogueProductDto = z.infer<typeof CatalogueProductDto>;

/** Full product detail with all variants (C05). */
export const ProductDetailDto = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryNameEn: z.string(),
  categoryNameKn: z.string(),
  categoryNameHi: z.string(),
  nameEn: z.string(),
  nameKn: z.string(),
  nameHi: z.string(),
  brand: z.string().nullable(),
  descriptionEn: z.string().nullable(),
  descriptionKn: z.string().nullable(),
  descriptionHi: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  variants: z.array(CatalogueVariantDto),
});
export type ProductDetailDto = z.infer<typeof ProductDetailDto>;

/** Paginated envelope for product lists. */
export const CatalogueProductListResponse = z.object({
  items: z.array(CatalogueProductDto),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type CatalogueProductListResponse = z.infer<typeof CatalogueProductListResponse>;

/** Search result — product with its matched alias snippet. */
export const SearchResultDto = z.object({
  product: CatalogueProductDto,
  matchedAlias: z.string().nullable(),
  score: z.number(),
});
export type SearchResultDto = z.infer<typeof SearchResultDto>;

export const SearchResponse = z.object({
  items: z.array(SearchResultDto),
  query: z.string(),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

export const CategoriesResponse = z.object({
  items: z.array(CatalogueCategoryDto),
});
export type CategoriesResponse = z.infer<typeof CategoriesResponse>;
