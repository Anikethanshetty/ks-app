import { prisma } from "../lib/prisma.js";
import type { Actor } from "../types/actor.js";

export type CatalogueCategoryRow = {
  id: string;
  nameEn: string;
  nameKn: string;
  nameHi: string;
  slug: string;
  iconUrl: string | null;
  productCount: bigint;
};

export type CatalogueProductRow = {
  id: string;
  categoryId: string;
  nameEn: string;
  nameKn: string;
  nameHi: string;
  brand: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  variantId: string | null;
  variantSku: string | null;
  variantPackSize: string | null;
  variantUnit: string | null;
  variantPackLabel: string | null;
  variantMrp: string | null;
  variantSellingPrice: string | null;
  variantStock: string | null;
  variantIsDefault: boolean | null;
};

export type ProductDetailRow = {
  id: string;
  categoryId: string;
  categoryNameEn: string;
  categoryNameKn: string;
  categoryNameHi: string;
  nameEn: string;
  nameKn: string;
  nameHi: string;
  brand: string | null;
  descriptionEn: string | null;
  descriptionKn: string | null;
  descriptionHi: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
};

export type VariantRow = {
  id: string;
  productId: string;
  sku: string;
  packSize: string;
  unit: string;
  packLabel: string;
  mrp: string;
  sellingPrice: string;
  stock: string;
  isDefault: boolean;
};

export type SearchResultRow = {
  id: string;
  categoryId: string;
  nameEn: string;
  nameKn: string;
  nameHi: string;
  brand: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  variantId: string | null;
  variantSku: string | null;
  variantPackSize: string | null;
  variantUnit: string | null;
  variantPackLabel: string | null;
  variantMrp: string | null;
  variantSellingPrice: string | null;
  variantStock: string | null;
  variantIsDefault: boolean | null;
  matchedAlias: string | null;
  score: number;
};

export const catalogueRepository = {
  /** List active categories with their active‑product counts. */
  async listActiveCategories(_actor: Actor) {
    const rows: CatalogueCategoryRow[] = await prisma.$queryRaw`
      SELECT
        c.id,
        c.name_en::text AS "nameEn",
        c.name_kn::text AS "nameKn",
        c.name_hi::text AS "nameHi",
        c.slug,
        c.icon_url::text AS "iconUrl",
        COUNT(p.id)::bigint AS "productCount"
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_available = true
      WHERE c.is_active = true
      GROUP BY c.id, c.name_en, c.name_kn, c.name_hi, c.slug, c.icon_url
      ORDER BY c.sort_order ASC, c.name_en ASC
    `;
    return rows;
  },

  /** List available products in a category, paginated, with their default variant. */
  async listProductsByCategory(
    _actor: Actor,
    categoryId: string,
    page: number,
    pageSize: number,
  ) {
    const offset = (page - 1) * pageSize;

    const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM products p
      WHERE p.category_id = ${categoryId}::uuid
        AND p.is_available = true
    `;

    const rows: CatalogueProductRow[] = await prisma.$queryRaw`
      SELECT
        p.id,
        p.category_id::text AS "categoryId",
        p.name_en::text AS "nameEn",
        p.name_kn::text AS "nameKn",
        p.name_hi::text AS "nameHi",
        p.brand,
        p.image_url::text AS "imageUrl",
        p.is_available AS "isAvailable",
        v.id::text              AS "variantId",
        v.sku                   AS "variantSku",
        v.pack_size::text       AS "variantPackSize",
        v.unit::text            AS "variantUnit",
        v.pack_label::text      AS "variantPackLabel",
        v.mrp::text             AS "variantMrp",
        v.selling_price::text   AS "variantSellingPrice",
        v.stock::text           AS "variantStock",
        v.is_default            AS "variantIsDefault"
      FROM products p
      LEFT JOIN LATERAL (
        SELECT * FROM product_variants pv
        WHERE pv.product_id = p.id AND pv.is_active = true
        ORDER BY pv.is_default DESC, pv.created_at ASC
        LIMIT 1
      ) v ON true
      WHERE p.category_id = ${categoryId}::uuid
        AND p.is_available = true
      ORDER BY p.name_en ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return { rows, total: Number(count) };
  },

  /** Get a single product with all its active variants. */
  async getProductById(_actor: Actor, id: string) {
    const [product]: ProductDetailRow[] = await prisma.$queryRaw`
      SELECT
        p.id,
        p.category_id::text   AS "categoryId",
        c.name_en::text       AS "categoryNameEn",
        c.name_kn::text       AS "categoryNameKn",
        c.name_hi::text       AS "categoryNameHi",
        p.name_en::text       AS "nameEn",
        p.name_kn::text       AS "nameKn",
        p.name_hi::text       AS "nameHi",
        p.brand,
        p.description_en::text  AS "descriptionEn",
        p.description_kn::text  AS "descriptionKn",
        p.description_hi::text  AS "descriptionHi",
        p.image_url::text       AS "imageUrl",
        p.is_available          AS "isAvailable"
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = ${id}::uuid
    `;

    if (!product) return null;

    const variants: VariantRow[] = await prisma.$queryRaw`
      SELECT
        v.id,
        v.product_id::text AS "productId",
        v.sku,
        v.pack_size::text     AS "packSize",
        v.unit::text          AS "unit",
        v.pack_label::text    AS "packLabel",
        v.mrp::text           AS "mrp",
        v.selling_price::text AS "sellingPrice",
        v.stock::text         AS "stock",
        v.is_default          AS "isDefault"
      FROM product_variants v
      WHERE v.product_id = ${id}::uuid AND v.is_active = true
      ORDER BY v.is_default DESC, v.created_at ASC
    `;

    return { product, variants };
  },

  /** Full‑text search across product names (en/kn/hi) and aliases using pg_trgm. */
  async searchProducts(
    _actor: Actor,
    query: string,
    lang: string,
    limit: number,
  ) {
    // Determine which `similarity` / `%` column to use as the primary match
    // based on the requested language. The column name is safely constructed
    // from the enum, never from user input.
    const nameCol = lang === "kn" ? "p.name_kn" : lang === "hi" ? "p.name_hi" : "p.name_en";

    // Use $queryRawUnsafe with PostgreSQL positional params ($1, $2) so that
    // the user-supplied query text is always parameterised, never interpolated.
    // ${nameCol} IS safe — it is an enum-controlled string, not user input.
    const sql = [
      "SELECT",
      "  p.id,",
      '  p.category_id::text AS "categoryId",',
      '  p.name_en::text AS "nameEn",',
      '  p.name_kn::text AS "nameKn",',
      '  p.name_hi::text AS "nameHi",',
      "  p.brand,",
      '  p.image_url::text AS "imageUrl",',
      "  p.is_available AS \"isAvailable\",",
      '  v.id::text              AS "variantId",',
      '  v.sku                   AS "variantSku",',
      '  v.pack_size::text       AS "variantPackSize",',
      '  v.unit::text            AS "variantUnit",',
      '  v.pack_label::text      AS "variantPackLabel",',
      '  v.mrp::text             AS "variantMrp",',
      '  v.selling_price::text   AS "variantSellingPrice",',
      '  v.stock::text           AS "variantStock",',
      '  v.is_default            AS "variantIsDefault",',
      '  pa.alias                AS "matchedAlias",',
      '  GREATEST(',
      `    similarity(${nameCol}, $1),`,
      "    similarity(p.name_en, $1),",
      "    similarity(p.name_kn, $1),",
      "    similarity(p.name_hi, $1),",
      "    similarity(COALESCE(pa.alias, ''), $1)",
      "  )::double precision AS score",
      "FROM products p",
      "LEFT JOIN LATERAL (",
      "  SELECT * FROM product_variants pv",
      "  WHERE pv.product_id = p.id AND pv.is_active = true",
      "  ORDER BY pv.is_default DESC, pv.created_at ASC",
      "  LIMIT 1",
      ") v ON true",
      "LEFT JOIN product_aliases pa ON pa.product_id = p.id",
      "WHERE p.is_available = true",
      "  AND (",
      `    ${nameCol} % $1`,
      "    OR p.name_en % $1",
      "    OR p.name_kn % $1",
      "    OR p.name_hi % $1",
      "    OR pa.alias % $1",
      "  )",
      "ORDER BY score DESC",
      "LIMIT $2",
    ].join("\n");

    const rows: SearchResultRow[] = await prisma.$queryRawUnsafe(sql, query, limit);

    return rows;
  },
};
