# Backend Schema Document
## Krishnappa Shetty and Son's — Home Delivery App

**Version:** 2.0 — *for the custom Node.js + TypeScript backend (TRD v2.0)*
**Database:** Postgres 16, managed (Neon / Railway / RDS), region **ap-south-1 (Mumbai)**
**Access layer:** Prisma. The SQL below is the source of truth; `schema.prisma` must mirror it exactly.

> **What changed from v1.0:** Row Level Security is gone — authorization now lives in the API's
> repository layer (§5). The Postgres stored procedures are gone — the same logic now lives in the
> TypeScript service layer (§6), with the same locking guarantees. `pg_cron` is replaced by BullMQ
> (§7) and Supabase Storage by Cloudflare R2 (§8). **The tables, columns, types, constraints and
> indexes are unchanged.**

---

## 1. Entity relationship overview

```
                  ┌──────────────────┐
   otp_codes  ───▶│      users       │  role: customer | delivery | admin
   refresh_tokens └──┬────┬───┬──────┘
                         │    │   └───────────────┐
              ┌──────────┘    └────────┐          │
              ▼                        ▼          ▼
      ┌──────────────┐        ┌──────────────┐  ┌──────────────┐
      │  addresses   │        │    carts     │  │ device_tokens│
      └──────┬───────┘        └──────┬───────┘  └──────────────┘
             │                       │
             │                ┌──────▼───────┐
             │                │  cart_items  │
             │                └──────────────┘
             │
  ┌──────────┴──────────────────────────────────────────────┐
  │                        orders                            │
  │  status · payment_method · totals · source(voice/manual) │
  └──┬────────────┬───────────────┬──────────────┬───────────┘
     │            │               │              │
     ▼            ▼               ▼              ▼
┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
│order_    │ │order_status_ │ │ payments │ │delivery_         │
│items     │ │events        │ │          │ │assignments       │
└────┬─────┘ └──────────────┘ └──────────┘ └──────────────────┘
     │                             │
     │                             ▼
     │                        ┌──────────┐
     │                        │ invoices │
     │                        └──────────┘
     ▼
┌──────────────────┐     ┌──────────────┐     ┌────────────────┐
│ product_variants │────▶│   products   │────▶│   categories   │
│ sku·pack·price·  │     │ name_en/kn/hi│     └────────────────┘
│ stock            │     └──────┬───────┘
└────────┬─────────┘            │
         │                      ▼
         │              ┌────────────────┐
         │              │product_aliases │  ⭐ powers voice matching
         │              └────────────────┘
         ▼
┌────────────────────┐   ┌──────────────┐   ┌────────────────┐
│inventory_movements │   │stock_batches │   │   suppliers    │
└────────────────────┘   └──────────────┘   └────────────────┘

┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ voice_sessions │  │ shop_settings  │  │   audit_log    │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## 2. Extensions and enums

```sql
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;      -- fuzzy product matching (voice)
create extension if not exists unaccent;

-- NOTE: pg_cron and pg_net are NOT used. Scheduled work runs in BullMQ (TRD §12)
-- and outbound calls are made by the Node API, not by the database.

create type user_role      as enum ('customer','delivery','admin');
create type order_status   as enum (
  'placed','payment_pending_verification','payment_failed','confirmed',
  'packed','out_for_delivery','delivered','cancelled','returned'
);
create type payment_method as enum ('upi','cod');
create type payment_status as enum ('pending_verification','verified','rejected','collected','refunded');
create type order_source   as enum ('manual','voice','admin');
create type movement_reason as enum ('purchase','sale','damage','expiry','shop_use','correction','return');
create type unit_type      as enum ('kg','g','l','ml','piece','packet','dozen','bundle');
```

---

## 3. Core tables

### 3.1 users
> Renamed from `profiles`. There is no `auth.users` any more — this table **is** the identity table.

```sql
create table users (
  id            uuid primary key default uuid_generate_v4(),
  phone         text not null unique,           -- E.164, e.g. +919876543210
  full_name     text,
  role          user_role not null default 'customer',
  language      text not null default 'kn' check (language in ('kn','hi','en')),
  is_active     boolean not null default true,  -- admin can block
  is_blocked    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on users(role) where is_active;

-- OTP login (no passwords anywhere in this system)
create table otp_codes (
  id          uuid primary key default uuid_generate_v4(),
  phone       text not null,
  code_hash   text not null,                    -- argon2/bcrypt. NEVER store the code in plaintext.
  attempts    int not null default 0,
  expires_at  timestamptz not null,             -- issued_at + 5 minutes
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on otp_codes(phone, created_at desc);

-- Rotating refresh tokens. Reuse of a revoked token revokes the whole family.
create table refresh_tokens (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null unique,             -- sha256 of the token; never the token itself
  family_id   uuid not null,                    -- rotation chain
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index on refresh_tokens(user_id) where revoked_at is null;
create index on refresh_tokens(family_id);
```
> `role` is read from the JWT that the API issued, and **nowhere else**. It is never read from a request body.
> There is no RLS behind you now: the role check is only as good as §5. Read §5.

### 3.2 addresses
```sql
create table addresses (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references users(id) on delete cascade,
  label        text default 'Home',
  line1        text not null,          -- house / flat / building
  line2        text,                   -- street / cross
  area         text not null,          -- Kuvempunagar, Vijayanagar…
  landmark     text,
  city         text not null default 'Mysuru',
  pincode      text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  latitude     double precision,
  longitude    double precision,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on addresses(user_id);
-- exactly one default per user
create unique index one_default_address on addresses(user_id) where is_default;
```

### 3.3 categories
```sql
create table categories (
  id          uuid primary key default uuid_generate_v4(),
  name_en     text not null,
  name_kn     text not null,
  name_hi     text not null,
  slug        text not null unique,
  icon_url    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);
```
Seed: Rice & Grains · Pulses & Dals · Oils & Ghee · Spices & Masala · Flour & Atta · Sugar & Jaggery · Dry Fruits · Snacks & Biscuits · Beverages · Dairy · Personal Care · Household & Cleaning · Pooja Items.

### 3.4 products
```sql
create table products (
  id             uuid primary key default uuid_generate_v4(),
  category_id    uuid not null references categories(id),
  name_en        text not null,
  name_kn        text not null,
  name_hi        text not null,
  brand          text,
  description_en text,
  description_kn text,
  description_hi text,
  image_url      text,
  hsn_code       text,                       -- optional, for GST invoices
  is_available   boolean not null default true,   -- admin master switch
  is_perishable  boolean not null default false,  -- drives expiry tracking
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on products(category_id) where is_available;
create index products_name_en_trgm on products using gin (name_en gin_trgm_ops);
create index products_name_kn_trgm on products using gin (name_kn gin_trgm_ops);
create index products_name_hi_trgm on products using gin (name_hi gin_trgm_ops);
```

### 3.5 ⭐ product_aliases — the table that makes voice work
```sql
create table product_aliases (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id) on delete cascade,
  alias       text not null,          -- 'akki', 'ಅಕ್ಕಿ', 'chawal', 'चावल', 'rice'
  language    text check (language in ('kn','hi','en','mixed')),
  source      text not null default 'admin'  -- 'admin' | 'seed' | 'learned'
              check (source in ('admin','seed','learned')),
  created_at  timestamptz not null default now(),
  unique (product_id, alias)
);
create index product_aliases_trgm on product_aliases using gin (alias gin_trgm_ops);
create index on product_aliases(product_id);
```
**Seed every product with at least 4 aliases** (English, Kannada script, Kannada romanised, Hindi). Voice accuracy is directly proportional to the quality of this table. When the admin taps "Add as alias" in the Voice Quality screen (A09), a row lands here with `source = 'learned'`.

### 3.6 product_variants
```sql
create table product_variants (
  id                  uuid primary key default uuid_generate_v4(),
  product_id          uuid not null references products(id) on delete cascade,
  sku                 text not null unique,
  pack_size           numeric(10,3) not null,      -- 1, 5, 500, 0.5
  unit                unit_type not null,           -- kg, g, l, ml, packet…
  pack_label          text not null,                -- "1 kg", "500 g", "5 kg bag"
  mrp                 numeric(10,2) not null check (mrp >= 0),
  selling_price       numeric(10,2) not null check (selling_price >= 0),
  cost_price          numeric(10,2) check (cost_price >= 0),  -- admin-only
  stock               numeric(10,3) not null default 0 check (stock >= 0),
  low_stock_threshold numeric(10,3) not null default 5,
  is_default          boolean not null default false,  -- used when voice says no qty
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on product_variants(product_id) where is_active;
create index on product_variants(stock) where is_active and stock <= low_stock_threshold;
create unique index one_default_variant on product_variants(product_id) where is_default;
```
> Stock is `numeric`, not `int`, because loose grocery is sold as 0.5 kg.
> `selling_price` is the **only** price the server ever charges. A price sent by the client is ignored.

### 3.7 suppliers & stock_batches
```sql
create table suppliers (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

create table stock_batches (
  id           uuid primary key default uuid_generate_v4(),
  variant_id   uuid not null references product_variants(id) on delete cascade,
  supplier_id  uuid references suppliers(id),
  quantity     numeric(10,3) not null,
  cost_per_unit numeric(10,2),
  batch_code   text,
  expiry_date  date,                      -- for perishables
  received_at  timestamptz not null default now()
);
create index on stock_batches(variant_id);
create index on stock_batches(expiry_date) where expiry_date is not null;
```

### 3.8 inventory_movements (the audit trail for every unit of stock)
```sql
create table inventory_movements (
  id           uuid primary key default uuid_generate_v4(),
  variant_id   uuid not null references product_variants(id),
  delta        numeric(10,3) not null,      -- negative = out
  reason       movement_reason not null,
  order_id     uuid references orders(id),  -- when reason = 'sale' or 'return'
  batch_id     uuid references stock_batches(id),
  note         text,
  actor_id     uuid references users(id),
  created_at   timestamptz not null default now()
);
create index on inventory_movements(variant_id, created_at desc);
create index on inventory_movements(order_id);
```
**Invariant:** `product_variants.stock` must always equal `sum(inventory_movements.delta)` for that variant. The nightly `stockIntegrityCheck` BullMQ job asserts this and alerts the admin on drift.

### 3.9 carts & cart_items
```sql
create table carts (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null unique references users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table cart_items (
  id         uuid primary key default uuid_generate_v4(),
  cart_id    uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity   numeric(10,3) not null check (quantity > 0),
  added_via  order_source not null default 'manual',   -- tracks voice usage
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
```

### 3.10 orders
```sql
create table orders (
  id                uuid primary key default uuid_generate_v4(),
  order_number      text not null unique,          -- 'KSS-1042', from a sequence
  user_id           uuid not null references users(id),
  address_id        uuid not null references addresses(id),
  status            order_status not null default 'placed',
  source            order_source not null default 'manual',
  payment_method    payment_method not null,

  subtotal          numeric(10,2) not null check (subtotal >= 0),
  delivery_fee      numeric(10,2) not null default 0,
  discount          numeric(10,2) not null default 0,
  total             numeric(10,2) not null check (total >= 0),

  delivery_slot     text,                          -- 'asap' | 'evening'
  customer_note     text,
  cancel_reason     text,

  -- denormalised address snapshot: the customer may edit the address later,
  -- but the invoice must show where it actually went
  address_snapshot  jsonb not null,

  voice_session_id  uuid references voice_sessions(id),

  placed_at         timestamptz not null default now(),
  confirmed_at      timestamptz,
  delivered_at      timestamptz,
  cancelled_at      timestamptz,
  updated_at        timestamptz not null default now()
);
create index on orders(user_id, placed_at desc);
create index on orders(status, placed_at desc);
create index on orders(placed_at desc);

create sequence order_number_seq start 1001;
```

### 3.11 order_items
```sql
create table order_items (
  id             uuid primary key default uuid_generate_v4(),
  order_id       uuid not null references orders(id) on delete cascade,
  variant_id     uuid not null references product_variants(id),
  quantity       numeric(10,3) not null check (quantity > 0),
  -- SNAPSHOTS: prices and names are frozen at order time. If the shop raises
  -- the price of rice tomorrow, this invoice must not change.
  unit_price     numeric(10,2) not null,
  line_total     numeric(10,2) not null,
  product_name_en text not null,
  product_name_kn text not null,
  product_name_hi text not null,
  pack_label     text not null,
  hsn_code       text,
  added_via      order_source not null default 'manual'
);
create index on order_items(order_id);
```

### 3.12 order_status_events
```sql
create table order_status_events (
  id                 uuid primary key default uuid_generate_v4(),
  order_id           uuid not null references orders(id) on delete cascade,
  status             order_status not null,
  actor_id           uuid references users(id),
  note               text,
  client_mutation_id text unique,     -- ⭐ idempotency key for the offline queue
  created_at         timestamptz not null default now()
);
create index on order_status_events(order_id, created_at);
```
`client_mutation_id` is generated on the delivery boy's phone. If the queue retries after a flaky network, the unique index makes the duplicate a no-op instead of a double status change.

### 3.13 payments
```sql
create table payments (
  id                 uuid primary key default uuid_generate_v4(),
  order_id           uuid not null references orders(id) on delete cascade,
  method             payment_method not null,
  amount             numeric(10,2) not null check (amount >= 0),
  status             payment_status not null,

  -- UPI (manual verification, v1)
  upi_reference      text,                -- UTR entered by the customer
  proof_image_url    text,                -- screenshot in `payment-proofs` bucket
  submitted_at       timestamptz,
  verified_by        uuid references users(id),
  verified_at        timestamptz,
  rejection_reason   text,

  -- COD
  collected_by       uuid references users(id),   -- the delivery user
  collected_at       timestamptz,
  amount_collected   numeric(10,2),                  -- may differ; note required

  -- phase 2 (gateway)
  gateway            text,
  gateway_payment_id text,

  note               text,
  created_at         timestamptz not null default now()
);
create index on payments(order_id);
create index on payments(status) where status = 'pending_verification';
create index on payments(collected_by, collected_at);
```

### 3.14 delivery_assignments
```sql
create table delivery_assignments (
  id               uuid primary key default uuid_generate_v4(),
  order_id         uuid not null references orders(id) on delete cascade,
  delivery_user_id uuid not null references users(id),
  assigned_by      uuid not null references users(id),
  assigned_at      timestamptz not null default now(),
  picked_up_at     timestamptz,
  completed_at     timestamptz,
  is_active        boolean not null default true,   -- false when reassigned
  failure_reason   text
);
create index on delivery_assignments(delivery_user_id, is_active);
create unique index one_active_assignment on delivery_assignments(order_id) where is_active;
```

### 3.15 invoices
```sql
create table invoices (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null unique references orders(id),
  invoice_number  text not null unique,       -- 'KSS/2026-27/0042'
  pdf_url         text,                       -- private bucket, signed URL
  total           numeric(10,2) not null,
  gst_enabled     boolean not null default false,
  cgst            numeric(10,2) default 0,
  sgst            numeric(10,2) default 0,
  issued_at       timestamptz not null default now()
);
create sequence invoice_number_seq start 1;
```

### 3.16 ⭐ voice_sessions
```sql
create table voice_sessions (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references users(id) on delete cascade,
  audio_path         text,                  -- voice-notes bucket; deleted after 30d
  transcript         text,
  detected_language  text,
  stt_provider       text,                  -- 'sarvam' | 'google'
  stt_confidence     real,
  parsed_result      jsonb,                 -- the full LLM output
  matched_count      int not null default 0,
  ambiguous_count    int not null default 0,
  unmatched_count    int not null default 0,
  unmatched_terms    text[],                -- ⭐ feeds the admin's alias screen
  resulted_in_order  boolean not null default false,
  order_id           uuid references orders(id),
  latency_ms         int,
  created_at         timestamptz not null default now()
);
create index on voice_sessions(user_id, created_at desc);
create index on voice_sessions(created_at desc) where unmatched_count > 0;
```

### 3.17 shop_settings (single row)
```sql
create table shop_settings (
  id                     int primary key default 1 check (id = 1),
  shop_name              text not null default 'Krishnappa Shetty and Son''s',
  shop_phone             text not null,
  shop_address           text not null,
  is_open                boolean not null default true,
  opens_at               time not null default '07:00',
  closes_at              time not null default '21:00',
  accepting_orders       boolean not null default true,

  delivery_fee           numeric(10,2) not null default 20,
  free_delivery_above    numeric(10,2) not null default 500,
  delivery_radius_km     numeric(5,2) not null default 5,
  cod_limit              numeric(10,2) not null default 3000,

  -- ⭐ the owner's payment details, editable from the app
  upi_vpa                text,               -- 'krishnappa@okaxis'
  upi_payee_name         text,
  upi_qr_url             text,               -- uploaded QR image

  gst_enabled            boolean not null default false,
  gstin                  text,
  invoice_prefix         text not null default 'KSS',

  updated_at             timestamptz not null default now()
);
insert into shop_settings (id, shop_phone, shop_address)
values (1, '+91XXXXXXXXXX', 'Mysuru, Karnataka');
```

### 3.18 device_tokens & audit_log
```sql
create table device_tokens (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users(id) on delete cascade,
  token      text not null unique,       -- Expo push token
  platform   text check (platform in ('ios','android')),
  updated_at timestamptz not null default now()
);

create table audit_log (
  id         bigserial primary key,
  actor_id   uuid references users(id),
  action     text not null,        -- 'price_changed', 'stock_corrected', 'order_cancelled'
  entity     text not null,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log(entity, entity_id, created_at desc);
```
Trigger `audit_log` on: price changes, stock corrections, order cancellations, payment verifications, role changes.

---

## 4. Views

```sql
-- Compact catalogue passed to the LLM on every voice request. Keep it small.
-- With the Node backend this is a PLAIN VIEW, cached in Redis for 300 s by
-- catalogueRepository.getVoiceCatalogue(). The cache is busted whenever a product,
-- variant or alias changes. (No materialized view, no refresh triggers.)
create view v_voice_catalogue as
select v.id as variant_id,
       p.name_en, p.name_kn, p.name_hi,
       v.pack_label, v.pack_size, v.unit, v.selling_price,
       v.is_default,
       (v.stock > 0) as in_stock,
       coalesce(array_agg(a.alias) filter (where a.alias is not null), '{}') as aliases
from product_variants v
join products p on p.id = v.product_id
left join product_aliases a on a.product_id = p.id
where v.is_active and p.is_available
group by v.id, p.name_en, p.name_kn, p.name_hi,
         v.pack_label, v.pack_size, v.unit, v.selling_price, v.is_default, v.stock;

```
Redis key: `voice:catalogue` · TTL 300 s · invalidated by `inventoryService` on any product,
variant or alias write.

Also build: `v_daily_summary`, `v_low_stock`, `v_expiring_soon`, `v_delivery_cash_in_hand`.

---

---

## 5. Authorization — the layer that replaces RLS

> ⚠️ **This is the most dangerous change in v2.0.** In v1.0, Postgres refused to return another customer's order even if the API asked for it. It will now hand it over cheerfully. Every safeguard below is load-bearing.

### 5.1 The actor rule
```ts
export type Actor = { userId: string; role: 'customer' | 'delivery' | 'admin' };
```
**Every repository method takes `actor` as its first parameter and scopes its query by it.** No exceptions. A method that genuinely needs shop-wide reach is suffixed `…AsAdmin()` and asserts the role on its first line.

```ts
// ✅ CORRECT
async findOrderById(actor: Actor, orderId: string) {
  return this.prisma.order.findFirst({
    where: {
      id: orderId,
      ...(actor.role === 'customer' && { userId: actor.userId }),
      ...(actor.role === 'delivery' && {
        deliveryAssignments: { some: { deliveryUserId: actor.userId, isActive: true } },
      }),
      // admin: no extra filter
    },
  });   // → null for anyone not entitled to it → the route returns 404, not 403
}

// ❌ WRONG — this is a data breach waiting to happen
async findOrderById(orderId: string) {
  return this.prisma.order.findUnique({ where: { id: orderId } });
}
```

### 5.2 Access matrix (what each role may reach, enforced in the repository)

| Table | customer | delivery | admin |
|---|---|---|---|
| `users` | own row (read/update, **never `role`**) | name + phone of customers on their **active** assignments only | all |
| `addresses` | own | address of an **active** assignment only | all (read) |
| `categories` `products` `product_variants` `product_aliases` | read all | read all | full |
| `carts` `cart_items` | own | — | — |
| `orders` | own | actively assigned only | all |
| `order_items` `order_status_events` | via own orders | via assigned orders | all |
| `payments` | own orders (read + submit UTR) | collect COD on own assignment | all + verify |
| `delivery_assignments` | — | own | all |
| `invoices` | own | — | all |
| `voice_sessions` | own | — | all |
| `inventory_movements` `stock_batches` `suppliers` `audit_log` | — | — | full |
| `shop_settings` | **read only** (needs the UPI VPA + QR + fees) | read | read/write |
| `device_tokens` | own | own | own |
| `otp_codes` `refresh_tokens` | **nobody** — service layer only | | |

**`shop_settings` is readable by every logged-in user. It must therefore contain no secrets — no API keys, no bank account number.** Only the public UPI VPA and the QR image URL, which are printed on a sticker on the counter anyway.

### 5.3 Fields the API must never accept from a client
`users.role` · `users.is_blocked` · any `*_price` on an order · `orders.total` · `orders.subtotal` · `product_variants.stock` (except through `adjustStock`) · `payments.status` · any `id` of a row the actor doesn't own.

Enforce this structurally: the Zod schema for `PATCH /me` simply **does not have a `role` field**, so it is stripped before the handler ever runs. Don't rely on a runtime check where a type can do the job.

### 5.4 The authz test suite (`apps/api/tests/authz/`) — release gate
Full list in TRD §9.2. Run in CI. **A new endpoint without an authz test does not merge.**

---

## 6. Business logic — the TypeScript service layer

The v1.0 Postgres functions (`place_order`, `update_order_status`, `adjust_stock`, …) are now services. **The guarantees are identical; only the language changed.**

### 6.1 `orderService.placeOrder()` — atomic
Full implementation sketch in TRD §6.1. The four rules the schema depends on:

1. **Prices come from `product_variants.selling_price`, read inside the transaction.** The client sends only `variantId` and `quantity`.
2. **Row locking:**
   ```sql
   SELECT * FROM product_variants
   WHERE id = ANY($1::uuid[]) AND is_active
   ORDER BY id
   FOR UPDATE;
   ```
   The `ORDER BY id` is not cosmetic — locking in a deterministic order is what prevents a deadlock when two orders contend for the same two variants.
3. **Everything in one transaction:** insert `orders` → insert `order_items` (with the name/price **snapshots**) → decrement `product_variants.stock` → insert `inventory_movements` (`reason = 'sale'`) → insert `payments` → insert two `order_status_events` → clear `cart_items` → link `voice_sessions`.
4. **Push and Socket.IO emits happen after the commit, never inside it.** A notification for an order that then rolls back is worse than no notification.

Error codes thrown (all in `packages/shared/src/errorCodes.ts`):
`OUT_OF_STOCK` · `VARIANT_NOT_FOUND` · `INVALID_ADDRESS` · `EMPTY_ORDER` · `COD_LIMIT_EXCEEDED` · `SHOP_NOT_ACCEPTING_ORDERS`

### 6.2 `orderService.updateStatus()`
```ts
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed:                       ['payment_pending_verification', 'confirmed', 'cancelled'],
  payment_pending_verification: ['confirmed', 'payment_failed', 'cancelled'],
  payment_failed:               ['payment_pending_verification', 'confirmed', 'cancelled'],
  confirmed:                    ['packed', 'cancelled'],
  packed:                       ['out_for_delivery', 'cancelled'],
  out_for_delivery:             ['delivered', 'returned'],
  delivered:                    [],
  cancelled:                    [],
  returned:                     [],
};
```
- Anything not in this table → `INVALID_TRANSITION`.
- Role gate: **admin** any valid move · **delivery** only `out_for_delivery | delivered | returned`, and only on their own active assignment · **customer** only `cancelled`, and only before `packed`.
- **Idempotent** on `order_status_events.client_mutation_id` (unique index). The delivery app's offline queue sends this as an `Idempotency-Key` header; a replay changes nothing and returns the original response.
- On `cancelled` / `returned`: restore stock **and** write compensating `inventory_movements` (`reason = 'return'`) in the same transaction.
- On `delivered`: enqueue the `generateInvoice` job.

### 6.3 Remaining services

| Service method | Replaces (v1.0) | Must guarantee |
|---|---|---|
| `inventoryService.adjustStock(actor, variantId, delta, reason, note)` | `adjust_stock()` | Admin only. Writes the `inventory_movement` **and** updates `stock` in one transaction. The only way stock changes outside an order. |
| `paymentService.verify(actor, paymentId, approve, reason)` | `verify_payment()` | Admin only. Sets `payments.status`, moves the order to `confirmed` or `payment_failed`, notifies the customer, writes an `audit_log` row. |
| `paymentService.collectCod(actor, orderId, amountPaise, note)` | `collect_cod()` | Delivery only, own active assignment. Creates the `collected` payment row. A different amount requires a note. |
| `deliveryService.assign(actor, orderId, deliveryUserId)` | `assign_delivery()` | Admin only. Deactivates any existing assignment (`is_active = false`), inserts the new one, emits `assignment:new`. The partial unique index guarantees one active assignment per order. |
| `invoiceService.generate(orderId)` | `generate_invoice_number()` + edge fn | Financial-year-aware, **gapless** number (`KSS/2026-27/0042`) from `invoice_number_seq`, inside a transaction. Renders the PDF, uploads to R2, writes the `invoices` row. |
| `catalogueRepository.searchVariants(q, limit)` | `search_variants()` | Raw `$queryRaw` with pg_trgm (TRD §4.5). Tagged-template parameters only — **never** string concatenation. |

---

## 7. Scheduled & background work (BullMQ)

`pg_cron` and database triggers are gone. Everything below runs as a BullMQ job in the Node process (or a separate worker process at scale). **All jobs are idempotent and safe to run twice.**

| Job | Schedule | Does | Replaces |
|---|---|---|---|
| `expireUnpaidOrders` | */10 min | Cancel `payment_pending_verification` orders > 60 min old, restore stock, notify | `pg_cron` |
| `remindPendingPayments` | */5 min | Re-ping the admin about payments pending > 10 min | `pg_cron` |
| `purgeVoiceAudio` | daily 02:00 IST | Delete R2 objects > 30 days old, null `voice_sessions.audio_path` | `pg_cron` |
| `stockIntegrityCheck` | daily 03:00 | Assert `stock == sum(movements)` per variant; alert on drift | `pg_cron` |
| `lowStockDigest` | daily 08:00 | Push the low-stock list to the admin | `pg_cron` |
| `expiryAlert` | daily 08:05 | Items expiring within 15 days | `pg_cron` |
| `generateInvoice` | on `delivered` | Render + upload the PDF | trigger + edge fn |
| `sendPush` | on demand | Expo Push API, 3 retries with backoff | trigger + edge fn |

**Application-level side effects that used to be triggers** (`notify_new_order`, `notify_status_change`, `refresh_voice_catalogue`, `audit_price_change`) now live in the service layer, **after the transaction commits**:

```ts
// order.service.ts — the shape every mutating service follows
const order = await this.prisma.$transaction(async (tx) => { /* … */ });
// ── commit boundary ──
this.realtime.emitToAdmins('order:new', toSummary(order));
await this.queue.add('sendPush', { userId: order.userId, template: 'order_placed' });
await this.cache.del('voice:catalogue');   // only where the catalogue changed
```

**The one true database trigger that stays:** `set_updated_at` (BEFORE UPDATE) on every table with an `updated_at` column. Keep it in SQL — it's the one thing the app should not have to remember.

---

## 8. Object storage (Cloudflare R2, S3-compatible)

| Prefix | Access | Notes |
|---|---|---|
| `product-images/` | **Public read** via an R2 custom domain · admin writes via presigned PUT | |
| `shop-assets/` | **Public read** | The UPI QR must render for every customer |
| `voice-notes/` | **Private** · owner-scoped presigned GET | Purged at 30 days by `purgeVoiceAudio` |
| `payment-proofs/` | **Private** · owner + admin only | UPI screenshots |
| `invoices/` | **Private** · 5-minute presigned GET only | Never a permanent link |

**Upload rules (all enforced server-side):**
- The **server generates the object key** — `{prefix}/{userId}/{uuid}.{ext}`. The client never chooses it.
- Validate MIME type **and magic bytes**. A `.jpg` extension proves nothing.
- Size caps: images 5 MB, audio 20 MB, proofs 5 MB.
- Presigned PUT URLs expire in 5 minutes and are single-purpose.
- Database columns store the **object key**, not a URL. URLs are minted at read time so the bucket, CDN or expiry policy can change without a migration.

---

## 9. Prisma mapping notes

`schema.prisma` must mirror the SQL above exactly. The traps:

| SQL | Prisma | Why it matters |
|---|---|---|
| `numeric(10,2)` | `Decimal @db.Decimal(10, 2)` | **Never `Float`.** Convert to integer paise at the API boundary (TRD §5.1). |
| `numeric(10,3)` (stock, quantity) | `Decimal @db.Decimal(10, 3)` | Loose grocery sells in 0.5 kg. |
| enums | `enum` blocks matching the Postgres types exactly | Regenerate types after every migration. |
| partial unique indexes (`one_default_address`, `one_active_assignment`) | **Prisma cannot express these.** Add them in a raw SQL migration and add a comment in `schema.prisma` pointing at it. | These are real integrity constraints. Losing them silently allows two "default" addresses or two active delivery assignments. |
| GIN trigram indexes | Same — raw SQL migration | Voice search dies without them. |
| `FOR UPDATE` | `$queryRaw` inside `$transaction` | The concurrency guarantee (§6.1). |

**Rule:** run `prisma migrate diff` in CI against the committed SQL. Any drift between `schema.prisma` and the migrations fails the build.

---

## 10. Seed data checklist
- [ ] 13 categories (kn / hi / en names)
- [ ] One `shop_settings` row with the real phone, UPI VPA and QR object key
- [ ] One **admin** user — the owner's phone number, inserted by the seed script (there is no other way to bootstrap the first admin)
- [ ] ~300 products with **all three names**
- [ ] ≥ 4 aliases per product (en, kn-script, kn-roman, hi) → **~1,200 alias rows**
- [ ] 1–3 variants per product with real prices and opening stock
- [ ] Dev-only: 3 test users (customer / delivery / admin) and a fixed OTP `000000` **behind `NODE_ENV !== 'production'`** — a bypass that reaches production is a total compromise
