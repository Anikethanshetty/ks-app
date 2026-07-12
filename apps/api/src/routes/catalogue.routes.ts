import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  CatalogueCategoryDto,
  CatalogueProductDto,
  CatalogueProductListResponse,
  CategoriesResponse,
  ProductDetailDto,
  SearchResponse,
} from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { toPaise } from "../lib/money.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { catalogueRepository } from "../repositories/catalogue.repository.js";

function toCatalogueProductDto(row: NonNullable<Awaited<ReturnType<typeof catalogueRepository.listProductsByCategory>>["rows"][0]>): z.infer<typeof CatalogueProductDto> {
  return {
    id: row.id,
    categoryId: row.categoryId,
    nameEn: row.nameEn,
    nameKn: row.nameKn,
    nameHi: row.nameHi,
    brand: row.brand,
    imageUrl: row.imageUrl,
    isAvailable: row.isAvailable,        defaultVariant: row.variantId
      ? {
          id: row.variantId,
          productId: row.id,
          sku: row.variantSku!,
          packSize: Number(row.variantPackSize),
          unit: row.variantUnit as any,
          packLabel: row.variantPackLabel!,
          mrpPaise: toPaise(Number(row.variantMrp)),
          sellingPricePaise: toPaise(Number(row.variantSellingPrice)),
          stock: Number(row.variantStock),
          isDefault: row.variantIsDefault ?? false,
        }
      : null,
  };
}

function toCatalogueCategoryDto(c: Awaited<ReturnType<typeof catalogueRepository.listActiveCategories>>[number]): z.infer<typeof CatalogueCategoryDto> {
  return {
    id: c.id,
    nameEn: c.nameEn,
    nameKn: c.nameKn,
    nameHi: c.nameHi,
    slug: c.slug,
    iconUrl: c.iconUrl,
    productCount: Number(c.productCount),
  };
}

function toSearchResultDto(r: Awaited<ReturnType<typeof catalogueRepository.searchProducts>>[0]) {
  const product = toCatalogueProductDto(r as unknown as NonNullable<
    Awaited<ReturnType<typeof catalogueRepository.listProductsByCategory>>["rows"][0]
  >);
  return {
    product,
    matchedAlias: r.matchedAlias,
    score: r.score,
  };
}

export const catalogueRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Categories ──
  app.get(
    "/categories",
    {
      preHandler: authorize("customer", "delivery", "admin"),
      schema: {
        tags: ["catalogue"],
        summary: "List active categories with product counts",
        response: { 200: CategoriesResponse },
      },
    },
    async (_req) => {
      const categories = await catalogueRepository.listActiveCategories(_req.actor!);
      return { items: categories.map(toCatalogueCategoryDto) };
    },
  );

  // ── Products by category ──
  app.get(
    "/products",
    {
      preHandler: authorize("customer", "delivery", "admin"),
      schema: {
        tags: ["catalogue"],
        summary: "List available products in a category, paginated",
        querystring: z.object({
          categoryId: z.string().uuid(),
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().positive().max(100).default(50),
        }),
        response: { 200: CatalogueProductListResponse },
      },
    },
    async (req) => {
      const { categoryId, page, pageSize } = req.query;
      const { rows, total } = await catalogueRepository.listProductsByCategory(
        req.actor!,
        categoryId,
        page,
        pageSize,
      );
      return {
        items: rows.map(toCatalogueProductDto),
        page,
        pageSize,
        total,
      };
    },
  );

  // ── Product detail ──
  app.get(
    "/products/:id",
    {
      preHandler: authorize("customer", "delivery", "admin"),
      schema: {
        tags: ["catalogue"],
        summary: "Get full product detail with all variants",
        params: z.object({ id: z.string().uuid() }),
        response: { 200: ProductDetailDto },
      },
    },
    async (req) => {
      const result = await catalogueRepository.getProductById(req.actor!, req.params.id);
      if (!result) {
        throw new AppError("NOT_FOUND", "Product not found.");
      }

      return {
        id: result.product.id,
        categoryId: result.product.categoryId,
        categoryNameEn: result.product.categoryNameEn,
        categoryNameKn: result.product.categoryNameKn,
        categoryNameHi: result.product.categoryNameHi,
        nameEn: result.product.nameEn,
        nameKn: result.product.nameKn,
        nameHi: result.product.nameHi,
        brand: result.product.brand,
        descriptionEn: result.product.descriptionEn,
        descriptionKn: result.product.descriptionKn,
        descriptionHi: result.product.descriptionHi,
        imageUrl: result.product.imageUrl,
        isAvailable: result.product.isAvailable,
        variants: result.variants.map((v) => ({
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          packSize: Number(v.packSize),
          unit: v.unit as any,
          packLabel: v.packLabel,
          mrpPaise: toPaise(Number(v.mrp)),
          sellingPricePaise: toPaise(Number(v.sellingPrice)),
          stock: Number(v.stock),
          isDefault: v.isDefault,
        })),
      };
    },
  );

  // ── Search ──
  app.get(
    "/search",
    {
      preHandler: authorize("customer", "delivery", "admin"),
      schema: {
        tags: ["catalogue"],
        summary: "Search products across names and aliases (pg_trgm)",
        querystring: z.object({
          q: z.string().min(1).max(100),
          lang: z.enum(["kn", "hi", "en"]).default("kn"),
          limit: z.coerce.number().int().positive().max(50).default(20),
        }),
        response: { 200: SearchResponse },
      },
    },
    async (req) => {
      const { q, lang, limit } = req.query;
      const rows = await catalogueRepository.searchProducts(req.actor!, q, lang, limit);
      return {
        items: rows.map(toSearchResultDto),
        query: q,
      };
    },
  );
};
