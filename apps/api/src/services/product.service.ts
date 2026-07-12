import type { CreateProductBody, CreateVariantBody, UpdateProductBody, UpdateVariantBody } from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { Decimal } from "../lib/money.js";
import { productRepository } from "../repositories/product.repository.js";
import type { Actor } from "../types/actor.js";

/** The input paise values need converting to Decimal rupees for the DB. */
function paiseToRupees(paise: number): Decimal {
  return new Decimal(paise).div(100);
}

export const productService = {
  /** Create a product with its first variant in a single operation.
   *  Returns the raw product (caller must follow up with findById for full DTO). */
  async createProduct(actor: Actor, input: CreateProductBody & { variants?: CreateVariantBody[] }) {
    const firstSku = input.variants?.[0]?.sku;
    if (firstSku) {
      const existing = await productRepository.skuExists(firstSku);
      if (existing) throw new AppError("VALIDATION_ERROR", "SKU already exists.");
    }

    const product = await productRepository.create(actor, {
      categoryId: input.categoryId,
      nameEn: input.nameEn,
      nameKn: input.nameKn,
      nameHi: input.nameHi,
      brand: input.brand,
      imageUrl: input.imageUrl,
    });

    // Create the first variant inline
    if (input.variants?.[0]) {
      const v = input.variants[0]!;
      await productRepository.createVariant(actor, {
        productId: product.id,
        sku: v.sku,
        packSize: v.packSize,
        unit: v.unit,
        packLabel: v.packLabel,
        mrp: paiseToRupees(v.mrpPaise).toNumber(),
        sellingPrice: paiseToRupees(v.sellingPricePaise).toNumber(),
        costPrice: v.costPricePaise !== undefined ? paiseToRupees(v.costPricePaise).toNumber() : undefined,
        stock: new Decimal(v.stock).toNumber(),
        lowStockThreshold: new Decimal(v.lowStockThreshold).toNumber(),
        isDefault: true,
      });
    }

    return product;
  },

  /** Update a product. Returns nothing — caller should fetch the full DTO. */
  async updateProduct(actor: Actor, id: string, input: UpdateProductBody) {
    const existing = await productRepository.findById(actor, id);
    if (!existing) throw new AppError("NOT_FOUND", "Product not found.");

    await productRepository.update(actor, id, input);
  },

  /** Add a variant to an existing product. */
  async addVariant(actor: Actor, productId: string, input: CreateVariantBody) {
    const existing = await productRepository.findById(actor, productId);
    if (!existing) throw new AppError("NOT_FOUND", "Product not found.");

    const skuExists = await productRepository.skuExists(input.sku);
    if (skuExists) throw new AppError("VALIDATION_ERROR", "SKU already exists.");

    const hasVariants = existing.variants.length === 0;

    return productRepository.createVariant(actor, {
      productId,
      sku: input.sku,
      packSize: input.packSize,
      unit: input.unit,
      packLabel: input.packLabel,
      mrp: paiseToRupees(input.mrpPaise).toNumber(),
      sellingPrice: paiseToRupees(input.sellingPricePaise).toNumber(),
      costPrice: input.costPricePaise !== undefined ? paiseToRupees(input.costPricePaise).toNumber() : undefined,
      stock: new Decimal(input.stock).toNumber(),
      lowStockThreshold: new Decimal(input.lowStockThreshold).toNumber(),
      isDefault: hasVariants,
    });
  },

  /** Update a variant. */
  async updateVariant(
    actor: Actor,
    productId: string,
    variantId: string,
    input: UpdateVariantBody,
  ) {
    const product = await productRepository.findById(actor, productId);
    if (!product) throw new AppError("NOT_FOUND", "Product not found.");

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) throw new AppError("NOT_FOUND", "Variant not found.");

    // Check SKU uniqueness if changed
    if (input.sku && input.sku !== variant.sku) {
      const skuExists = await productRepository.skuExists(input.sku, variantId);
      if (skuExists) throw new AppError("VALIDATION_ERROR", "SKU already exists.");
    }

    const updateData: Parameters<typeof productRepository.updateVariant>[2] = {};
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.packSize !== undefined) updateData.packSize = input.packSize;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.packLabel !== undefined) updateData.packLabel = input.packLabel;
    if (input.mrpPaise !== undefined) updateData.mrp = paiseToRupees(input.mrpPaise).toNumber();
    if (input.sellingPricePaise !== undefined) updateData.sellingPrice = paiseToRupees(input.sellingPricePaise).toNumber();
    if (input.costPricePaise !== undefined) updateData.costPrice = paiseToRupees(input.costPricePaise).toNumber();
    if (input.stock !== undefined) updateData.stock = input.stock;
    if (input.lowStockThreshold !== undefined) updateData.lowStockThreshold = input.lowStockThreshold;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return productRepository.updateVariant(actor, variantId, updateData);
  },
};
