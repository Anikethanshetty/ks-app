import Papa from "papaparse";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import type { Actor } from "../types/actor.js";

type CsvRow = {
  name_en: string;
  name_kn: string;
  name_hi: string;
  category: string;
  brand: string;
  pack_size: string;
  unit: string;
  pack_label: string;
  mrp: string;
  price: string;
  cost: string;
  stock: string;
  aliases: string;
};

type ParsedRow = {
  rowNumber: number;
  nameEn: string;
  nameKn: string;
  nameHi: string;
  category: string;
  brand: string | null;
  packSize: number | null;
  unit: string | null;
  packLabel: string;
  mrpPaise: number | null;
  sellingPricePaise: number | null;
  costPaise: number | null;
  stock: number | null;
  aliases: string[];
  errors: string[];
  valid: boolean;
};

function parsePaise(value: string): number | null {
  const n = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseNumber(value: string): number | null {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseRow(row: Record<string, unknown>, rowNumber: number): ParsedRow {
  const r = row as unknown as Partial<CsvRow>;
  const errors: string[] = [];
  let mrpPaise: number | null = null;
  let sellingPricePaise: number | null = null;
  let costPaise: number | null = null;
  let packSize: number | null = null;
  let unit: string | null = null;
  let stock: number | null = null;

  const nameEn = (r.name_en ?? "").trim();
  const nameKn = (r.name_kn ?? "").trim();
  const nameHi = (r.name_hi ?? "").trim();
  const category = (r.category ?? "").trim();
  const brand = (r.brand ?? "").trim() || null;
  const packLabel = (r.pack_label ?? "").trim();
  const aliasStr = (r.aliases ?? "").trim();

  if (!nameEn) errors.push("Row " + rowNumber + ": name_en is required.");
  if (!nameKn) errors.push("Row " + rowNumber + ": name_kn is required.");
  if (!nameHi) errors.push("Row " + rowNumber + ": name_hi is required.");
  if (!category) errors.push("Row " + rowNumber + ": category is required.");

  if (r.mrp) {
    mrpPaise = parsePaise(r.mrp);
    if (mrpPaise === null) errors.push("Row " + rowNumber + ": mrp is invalid.");
  }
  if (r.price) {
    sellingPricePaise = parsePaise(r.price);
    if (sellingPricePaise === null) errors.push("Row " + rowNumber + ": price is invalid.");
  }
  if (r.cost) {
    costPaise = parsePaise(r.cost);
    if (costPaise === null) errors.push("Row " + rowNumber + ": cost is invalid.");
  }
  if (r.pack_size) {
    packSize = parseNumber(r.pack_size);
    if (packSize === null) errors.push("Row " + rowNumber + ": pack_size is invalid.");
  }
  if (r.stock) {
    stock = parseNumber(r.stock);
    if (stock === null) errors.push("Row " + rowNumber + ": stock is invalid.");
  }
  if (r.unit) {
    unit = r.unit.trim().toLowerCase();
    const validUnits = ["kg", "g", "l", "ml", "piece", "packet", "dozen", "bundle"];
    if (!validUnits.includes(unit)) errors.push("Row " + rowNumber + ": unit is invalid.");
  }

  const aliases = aliasStr
    .split("|")
    .map((a) => a.trim())
    .filter(Boolean);

  return {
    rowNumber,
    nameEn,
    nameKn,
    nameHi,
    category,
    brand,
    packSize,
    unit,
    packLabel,
    mrpPaise,
    sellingPricePaise,
    costPaise,
    stock,
    aliases,
    errors,
    valid: errors.length === 0,
  };
}

export const importService = {
  /** Parse and validate CSV content. Returns preview without saving anything. */
  async preview(csv: string): Promise<{
    totalRows: number;
    validRows: number;
    errorRows: number;
    rows: ParsedRow[];
  }> {
    const parsed = Papa.parse<Record<string, unknown>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    });

    if (parsed.errors.length > 0) {
      throw new AppError("VALIDATION_ERROR", "CSV parsing failed: " + parsed.errors[0]?.message);
    }

    if (parsed.data.length === 0) {
      throw new AppError("VALIDATION_ERROR", "CSV is empty.");
    }

    const rows = parsed.data.map((row, i) => parseRow(row, i + 1));
    const validRows = rows.filter((r) => r.valid).length;
    const errorRows = rows.length - validRows;

    return { totalRows: rows.length, validRows, errorRows, rows };
  },

  /** Commit a validated CSV import. Creates categories, products, variants, aliases. */
  async commit(actor: Actor, csv: string): Promise<{
    productsCreated: number;
    variantsCreated: number;
    aliasesCreated: number;
    errors: Array<{ rowNumber: number; error: string }>;
  }> {
    const preview = await this.preview(csv);
    const commitErrors: Array<{ rowNumber: number; error: string }> = [];
    let productsCreated = 0;
    let variantsCreated = 0;
    let aliasesCreated = 0;

    // Get or create categories by name
    const categoryNames = [...new Set(preview.rows.filter((r) => r.valid).map((r) => r.category))];
    const categoryMap = new Map<string, string>();

    for (const catName of categoryNames) {
      const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const existing = await prisma.category.findFirst({
        where: { OR: [{ nameEn: catName }, { slug }] },
      });
      if (existing) {
        categoryMap.set(catName, existing.id);
      } else {
        const created = await prisma.category.create({
          data: {
            slug: slug || "category-" + Date.now(),
            nameEn: catName,
            nameKn: catName,
            nameHi: catName,
          },
        });
        categoryMap.set(catName, created.id);
      }
    }

    // Process each valid row
    for (const row of preview.rows) {
      if (!row.valid) {
        commitErrors.push({
          rowNumber: row.rowNumber,
          error: row.errors.join("; "),
        });
        continue;
      }

      const categoryId = categoryMap.get(row.category);
      if (!categoryId) {
        commitErrors.push({ rowNumber: row.rowNumber, error: "Category not found." });
        continue;
      }

      // Check for duplicate product by name_en + category
      const existingProduct = await prisma.product.findFirst({
        where: { nameEn: row.nameEn, categoryId },
      });

      if (existingProduct) {
        commitErrors.push({
          rowNumber: row.rowNumber,
          error: "Product '" + row.nameEn + "' already exists in this category.",
        });
        continue;
      }

      try {
        const product = await prisma.product.create({
          data: {
            categoryId,
            nameEn: row.nameEn,
            nameKn: row.nameKn,
            nameHi: row.nameHi,
            brand: row.brand,
          },
        });
        productsCreated++;

        // Create variant
        const sku = "CSV-" + row.nameEn.replace(/[^a-zA-Z0-9]/g, "-") + "-" + Date.now() + "-" + row.rowNumber;
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku,
            packSize: row.packSize ?? 1,
            unit: (row.unit as import("@prisma/client").$Enums.UnitType) ?? "piece",
            packLabel: row.packLabel || "1 pc",
            mrp: row.mrpPaise != null ? row.mrpPaise / 100 : 0,
            sellingPrice: row.sellingPricePaise != null ? row.sellingPricePaise / 100 : 0,
            costPrice: row.costPaise != null ? row.costPaise / 100 : null,
            stock: row.stock ?? 0,
            isDefault: true,
          },
        });
        variantsCreated++;

        // Create aliases
        if (row.aliases.length > 0) {
          for (const alias of row.aliases) {
            await prisma.productAlias.create({
              data: { productId: product.id, alias, source: "admin" },
            }).catch(() => {
              // Skip duplicate aliases silently
            });
          }
          aliasesCreated += row.aliases.length;
        }
      } catch (err) {
        commitErrors.push({
          rowNumber: row.rowNumber,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return { productsCreated, variantsCreated, aliasesCreated, errors: commitErrors };
  },
};
