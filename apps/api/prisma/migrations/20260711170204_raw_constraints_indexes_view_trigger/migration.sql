-- AlterTable (Prisma-generated: normalises the time-column defaults)
ALTER TABLE "shop_settings" ALTER COLUMN "opens_at" SET DEFAULT '07:00:00'::time,
ALTER COLUMN "closes_at" SET DEFAULT '21:00:00'::time;

-- ═══════════════════════════════════════════════════════════════════════════
-- Raw SQL that Prisma cannot express (Backend Schema §3, §4, §7 and §9).
-- None of these objects live in schema.prisma, so they do not appear as drift.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────── partial / filtered indexes (§3) ───────────────────────

CREATE INDEX IF NOT EXISTS users_role_active_idx
  ON users(role) WHERE is_active;

CREATE INDEX IF NOT EXISTS refresh_tokens_user_active_idx
  ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS one_default_address
  ON addresses(user_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS products_category_available_idx
  ON products(category_id) WHERE is_available;

CREATE INDEX IF NOT EXISTS product_variants_product_active_idx
  ON product_variants(product_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS product_variants_low_stock_idx
  ON product_variants(stock) WHERE is_active AND stock <= low_stock_threshold;

CREATE UNIQUE INDEX IF NOT EXISTS one_default_variant
  ON product_variants(product_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS stock_batches_expiry_idx
  ON stock_batches(expiry_date) WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_pending_idx
  ON payments(status) WHERE status = 'pending_verification';

CREATE UNIQUE INDEX IF NOT EXISTS one_active_assignment
  ON delivery_assignments(order_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS voice_sessions_unmatched_idx
  ON voice_sessions(created_at DESC) WHERE unmatched_count > 0;

-- ─────────────────────── CHECK constraints (§3) ───────────────────────

ALTER TABLE users
  ADD CONSTRAINT users_language_check CHECK (language IN ('kn','hi','en'));

ALTER TABLE addresses
  ADD CONSTRAINT addresses_pincode_check CHECK (pincode ~ '^[1-9][0-9]{5}$');

ALTER TABLE product_aliases
  ADD CONSTRAINT product_aliases_language_check
    CHECK (language IS NULL OR language IN ('kn','hi','en','mixed')),
  ADD CONSTRAINT product_aliases_source_check
    CHECK (source IN ('admin','seed','learned'));

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_mrp_check CHECK (mrp >= 0),
  ADD CONSTRAINT product_variants_selling_price_check CHECK (selling_price >= 0),
  ADD CONSTRAINT product_variants_cost_price_check CHECK (cost_price IS NULL OR cost_price >= 0),
  ADD CONSTRAINT product_variants_stock_check CHECK (stock >= 0);

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_quantity_check CHECK (quantity > 0);

ALTER TABLE orders
  ADD CONSTRAINT orders_subtotal_check CHECK (subtotal >= 0),
  ADD CONSTRAINT orders_total_check CHECK (total >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);

ALTER TABLE device_tokens
  ADD CONSTRAINT device_tokens_platform_check CHECK (platform IS NULL OR platform IN ('ios','android'));

ALTER TABLE shop_settings
  ADD CONSTRAINT shop_settings_singleton_check CHECK (id = 1);

-- ─────────────────────── sequences (§3.10, §3.15) ───────────────────────

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- ─────────────────────── v_voice_catalogue view (§4) ───────────────────────
-- The compact catalogue the LLM sees on every voice request. Cached in Redis
-- 300 s by catalogueRepository.getVoiceCatalogue(); busted on any product,
-- variant or alias write. Plain view — no materialized view, no refresh triggers.

CREATE OR REPLACE VIEW v_voice_catalogue AS
SELECT v.id AS variant_id,
       p.name_en, p.name_kn, p.name_hi,
       v.pack_label, v.pack_size, v.unit, v.selling_price,
       v.is_default,
       (v.stock > 0) AS in_stock,
       COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
FROM product_variants v
JOIN products p ON p.id = v.product_id
LEFT JOIN product_aliases a ON a.product_id = p.id
WHERE v.is_active AND p.is_available
GROUP BY v.id, p.name_en, p.name_kn, p.name_hi,
         v.pack_label, v.pack_size, v.unit, v.selling_price, v.is_default, v.stock;

-- ─────────────────────── set_updated_at trigger (§7) ───────────────────────
-- The one true database trigger that stays: keep updated_at fresh in SQL so the
-- app never has to remember. Applied to every table with an updated_at column.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON shop_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
