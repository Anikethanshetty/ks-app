import { Prisma } from "@prisma/client";
import type { InventoryTab } from "@kss/shared";
import { prisma } from "../lib/prisma.js";

export type InventoryRow = {
  id: string;
  productId: string;
  productNameEn: string;
  productNameKn: string;
  productNameHi: string;
  categoryNameEn: string;
  packLabel: string;
  sku: string;
  mrp: string;
  sellingPrice: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
};

/** A05 tab → SQL predicate. Column-to-column comparison isn't expressible in
 * Prisma's generated filters, so this is raw SQL (tagged, per TRD §9.3). */
function tabFilter(tab: InventoryTab) {
  if (tab === "low_stock") return Prisma.sql`AND v.stock > 0 AND v.stock <= v.low_stock_threshold`;
  if (tab === "out_of_stock") return Prisma.sql`AND v.stock <= 0`;
  return Prisma.empty;
}

export const inventoryRepository = {
  list(tab: InventoryTab, page: number, pageSize: number): Promise<InventoryRow[]> {
    return prisma.$queryRaw<InventoryRow[]>`
      SELECT v.id, v.product_id AS "productId",
             p.name_en AS "productNameEn", p.name_kn AS "productNameKn", p.name_hi AS "productNameHi",
             c.name_en AS "categoryNameEn",
             v.pack_label AS "packLabel", v.sku, v.mrp, v.selling_price AS "sellingPrice",
             v.stock, v.low_stock_threshold AS "lowStockThreshold", v.is_active AS "isActive"
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE v.is_active = true ${tabFilter(tab)}
      ORDER BY p.name_en ASC, v.pack_label ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;
  },

  async counts(): Promise<{ all: number; lowStock: number; outOfStock: number }> {
    const rows = await prisma.$queryRaw<Array<{ bucket: string; n: bigint }>>`
      SELECT
        CASE
          WHEN stock <= 0 THEN 'out_of_stock'
          WHEN stock <= low_stock_threshold THEN 'low_stock'
          ELSE 'ok'
        END AS bucket,
        count(*) AS n
      FROM product_variants
      WHERE is_active = true
      GROUP BY bucket
    `;
    const byBucket = Object.fromEntries(rows.map((r) => [r.bucket, Number(r.n)]));
    const lowStock = byBucket.low_stock ?? 0;
    const outOfStock = byBucket.out_of_stock ?? 0;
    const ok = byBucket.ok ?? 0;
    return { all: lowStock + outOfStock + ok, lowStock, outOfStock };
  },
};
