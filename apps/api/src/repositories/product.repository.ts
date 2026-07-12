import { prisma } from "../lib/prisma.js";
import type { Actor } from "../types/actor.js";

export type ProductWithVariants = Awaited<
  ReturnType<typeof prisma.product.findUnique>
> & { variants: Awaited<ReturnType<typeof prisma.productVariant.findMany>> };

export type CategoryRow = {
  id: string;
  nameEn: string;
  nameKn: string;
  nameHi: string;
  slug: string;
};

export const productRepository = {
  /** Get all active categories for the admin dropdown. */
  async listCategories(): Promise<CategoryRow[]> {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameEn: true, nameKn: true, nameHi: true, slug: true },
    });
  },

  /** Get a product with its variants by ID. Admin-only — no actor scoping needed
   *  since the caller must have been authorized as admin at the route level. */
  async findById(_actor: Actor, id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        category: { select: { id: true, nameEn: true, nameKn: true, nameHi: true } },
      },
    });
  },

  /** Create a product (admin, no per-row scoping). */
  async create(
    _actor: Actor,
    data: {
      categoryId: string;
      nameEn: string;
      nameKn: string;
      nameHi: string;
      brand?: string;
      imageUrl?: string;
    },
  ) {
    return prisma.product.create({ data });
  },

  /** Update a product (admin). */
  async update(
    _actor: Actor,
    id: string,
    data: {
      categoryId?: string;
      nameEn?: string;
      nameKn?: string;
      nameHi?: string;
      brand?: string;
      imageUrl?: string;
      isAvailable?: boolean;
    },
  ) {
    return prisma.product.update({ where: { id }, data });
  },

  /** Create a variant for a product. */
  async createVariant(
    _actor: Actor,
    data: {
      productId: string;
      sku: string;
      packSize: number;
      unit: string;
      packLabel: string;
      mrp: number;
      sellingPrice: number;
      costPrice?: number;
      stock: number;
      lowStockThreshold: number;
      isDefault: boolean;
    },
  ) {
    return prisma.productVariant.create({
      data: {
        productId: data.productId,
        sku: data.sku,
        packSize: data.packSize,
        unit: data.unit as import("@prisma/client").$Enums.UnitType,
        packLabel: data.packLabel,
        mrp: data.mrp,
        sellingPrice: data.sellingPrice,
        costPrice: data.costPrice ?? null,
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold,
        isDefault: data.isDefault,
      },
    });
  },

  /** Update a variant. */
  async updateVariant(
    _actor: Actor,
    id: string,
    data: {
      sku?: string;
      packSize?: number;
      unit?: string;
      packLabel?: string;
      mrp?: number;
      sellingPrice?: number;
      costPrice?: number | null;
      stock?: number;
      lowStockThreshold?: number;
      isDefault?: boolean;
      isActive?: boolean;
    },
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.packSize !== undefined) updateData.packSize = data.packSize;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.packLabel !== undefined) updateData.packLabel = data.packLabel;
    if (data.mrp !== undefined) updateData.mrp = data.mrp;
    if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice;
    if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    return prisma.productVariant.update({ where: { id }, data: updateData });
  },

  /** Check if a SKU already exists (for uniqueness validation). */
  async skuExists(sku: string, excludeVariantId?: string): Promise<boolean> {
    const existing = await prisma.productVariant.findUnique({ where: { sku } });
    if (!existing) return false;
    if (excludeVariantId && existing.id === excludeVariantId) return false;
    return true;
  },
};
