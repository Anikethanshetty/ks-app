import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AliasDto,
  CategoryDto,
  CreateAliasBody,
  CreateProductBody,
  CreateVariantBody,
  ProductDto,
  UpdateProductBody,
  UpdateVariantBody,
  OkResponse,
} from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { toPaise } from "../lib/money.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { productRepository } from "../repositories/product.repository.js";
import { productService } from "../services/product.service.js";

const IdParam = z.object({ id: z.string().uuid() });
const ProductIdParam = z.object({ productId: z.string().uuid() });
const VariantIdParam = z.object({ productId: z.string().uuid(), variantId: z.string().uuid() });
const AliasIdParam = z.object({ productId: z.string().uuid(), aliasId: z.string().uuid() });

function toProductDto(product: NonNullable<Awaited<ReturnType<typeof productRepository.findById>>>): z.infer<typeof ProductDto> {
  return {
    id: product.id,
    categoryId: product.categoryId,
    nameEn: product.nameEn,
    nameKn: product.nameKn,
    nameHi: product.nameHi,
    brand: product.brand,
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable,
    variants: product.variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      packSize: Number(v.packSize),
      unit: v.unit,
      packLabel: v.packLabel,
      mrpPaise: toPaise(v.mrp),
      costPricePaise: v.costPrice ? toPaise(v.costPrice) : null,
      sellingPricePaise: toPaise(v.sellingPrice),
      stock: Number(v.stock),
      lowStockThreshold: Number(v.lowStockThreshold),
      isActive: v.isActive,
    })),
  };
}

function toCategoryDto(c: Awaited<ReturnType<typeof productRepository.listCategories>>[number]): z.infer<typeof CategoryDto> {
  return { id: c.id, nameEn: c.nameEn, nameKn: c.nameKn, nameHi: c.nameHi, slug: c.slug };
}

function toAliasDto(a: Awaited<ReturnType<typeof productRepository.listAliases>>[number]): z.infer<typeof AliasDto> {
  return { id: a.id, productId: a.productId, alias: a.alias, language: a.language, source: a.source };
}

export const productRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Categories ──
  app.get(
    "/admin/categories",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "List all active categories for the product form",
        response: { 200: z.object({ items: z.array(CategoryDto) }) },
      },
    },
    async () => {
      const categories = await productRepository.listCategories();
      return { items: categories.map(toCategoryDto) };
    },
  );

  // ── Create product ──
  app.post(
    "/admin/products",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "Create a new product with an optional first variant",
        body: z.object({
          categoryId: z.string().uuid(),
          nameEn: z.string().min(1),
          nameKn: z.string().min(1),
          nameHi: z.string().min(1),
          brand: z.string().optional(),
          imageUrl: z.string().optional(),
          variants: z
            .array(CreateVariantBody)
            .max(1)
            .optional(),
        }),
        response: { 200: ProductDto },
      },
    },
    async (req) => {
      const product = await productService.createProduct(req.actor!, req.body);
      const fresh = await productRepository.findById(req.actor!, product.id);
      if (!fresh) throw new AppError("NOT_FOUND", "Product not found.");
      return toProductDto(fresh);
    },
  );

  // ── Get product (for edit) ──
  app.get(
    "/admin/products/:id",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "Get a product with all variants for editing",
        params: IdParam,
        response: { 200: ProductDto },
      },
    },
    async (req) => {
      const product = await productRepository.findById(req.actor!, req.params.id);
      if (!product) throw new AppError("NOT_FOUND", "Product not found.");
      return toProductDto(product);
    },
  );

  // ── Update product ──
  app.patch(
    "/admin/products/:id",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "Update a product's fields",
        params: IdParam,
        body: UpdateProductBody,
        response: { 200: ProductDto },
      },
    },
    async (req) => {
      const body = req.body as Record<string, unknown>;
      await productService.updateProduct(req.actor!, req.params.id, body);
      const product = await productRepository.findById(req.actor!, req.params.id);
      if (!product) throw new AppError("NOT_FOUND", "Product not found.");
      return toProductDto(product);
    },
  );

  // ── Add variant ──
  app.post(
    "/admin/products/:productId/variants",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "Add a new variant to a product",
        params: ProductIdParam,
        body: CreateVariantBody,
        response: { 200: ProductDto },
      },
    },
    async (req) => {
      await productService.addVariant(req.actor!, req.params.productId, req.body);
      const product = await productRepository.findById(req.actor!, req.params.productId);
      if (!product) throw new AppError("NOT_FOUND", "Product not found.");
      return toProductDto(product);
    },
  );

  // ── Update variant ──
  app.patch(
    "/admin/products/:productId/variants/:variantId",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "Update a variant's fields",
        params: VariantIdParam,
        body: UpdateVariantBody,
        response: { 200: ProductDto },
      },
    },
    async (req) => {
      await productService.updateVariant(req.actor!, req.params.productId, req.params.variantId, req.body as any);
      const product = await productRepository.findById(req.actor!, req.params.productId);
      if (!product) throw new AppError("NOT_FOUND", "Product not found.");
      return toProductDto(product);
    },
  );

  // ── ⭐ Aliases (T1.3) ──

  app.get(
    "/admin/products/:productId/aliases",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "List aliases for a product",
        params: ProductIdParam,
        response: { 200: z.object({ items: z.array(AliasDto) }) },
      },
    },
    async (req) => {
      const aliases = await productRepository.listAliases(req.actor!, req.params.productId);
      return { items: aliases.map(toAliasDto) };
    },
  );

  app.post(
    "/admin/products/:productId/aliases",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "Add an alias (busts the voice catalogue cache)",
        params: ProductIdParam,
        body: CreateAliasBody,
        response: { 200: AliasDto },
      },
    },
    async (req) => {
      try {
        const alias = await productRepository.createAlias(
          req.actor!,
          req.params.productId,
          req.body.alias,
          req.body.language,
        );
        return toAliasDto(alias);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new AppError(
            "VALIDATION_ERROR",
            "This alias already exists for this product.",
          );
        }
        throw err;
      }
    },
  );

  app.delete(
    "/admin/products/:productId/aliases/:aliasId",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "products"],
        summary: "Delete an alias",
        params: AliasIdParam,
        response: { 200: OkResponse },
      },
    },
    async (req) => {
      await productRepository.deleteAlias(req.actor!, req.params.productId, req.params.aliasId);
      return { ok: true as const };
    },
  );
};
