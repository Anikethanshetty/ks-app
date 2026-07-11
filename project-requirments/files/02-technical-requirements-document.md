# Technical Requirements Document (TRD)
## Krishnappa Shetty and Son's — Home Delivery App

**Version:** 2.0 — *custom Node.js + TypeScript backend (replaces the Supabase BaaS design in v1.0)*
**Companion to:** PRD v1.0, App Flow v1.0, UI/UX Brief v1.0, Backend Schema v2.0
**Audience:** The AI coding agent and any human developer

---

## 0. What changed from v1.0 and what it costs you

| v1.0 (Supabase) | v2.0 (own Node backend) | Consequence |
|---|---|---|
| Row Level Security enforced in Postgres | **Authorization enforced in application code** | The database no longer protects you. Every query must be scoped by hand. §9 is now the most safety-critical section in this document. |
| Auto-generated REST/PostgREST API | **Hand-written REST API** (§5) | ~40 endpoints to build. More work, total control. |
| Supabase Auth (phone OTP) | **Own JWT auth + an SMS provider** | You own refresh tokens, rotation and rate limiting. |
| Supabase Realtime | **Socket.IO** | Explicit rooms and events. |
| Edge Functions (Deno) | **Routes/services in the same Node app** | Simpler mental model, one deploy. |
| `pg_cron` | **BullMQ + Redis** | Real job queue with retries and a dashboard. Better. |
| Supabase Storage | **S3-compatible object storage** (Cloudflare R2) with presigned URLs | Cheaper egress, standard tooling. |
| Postgres functions (`place_order`) | **TypeScript service layer inside a DB transaction** | Testable in Vitest, debuggable, still atomic. Same locking guarantees. |

**Everything in the PRD, App Flow and UI/UX Brief is unchanged.** Same features, same screens, same design, same voice pipeline. Only the server changes.

---

## 1. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  MOBILE APP — React Native (Expo), TypeScript, expo-router         │
│  (app)/(customer)   (app)/(delivery)   (app)/(admin)               │
│  TanStack Query · Zustand · i18next (kn/hi/en) · Socket.IO client  │
└──────────────┬──────────────────────────────┬──────────────────────┘
               │ REST (HTTPS, JWT)            │ WebSocket (Socket.IO)
               ▼                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  API SERVER — Node 22 · TypeScript · Fastify                       │
│                                                                    │
│  routes/          ← thin: parse, authenticate, authorize, delegate │
│  services/        ← ALL business rules live here                   │
│     orderService · voiceService · paymentService · inventoryService│
│     invoiceService · authService · notificationService             │
│  repositories/    ← the ONLY place that touches the DB.            │
│                     Every method takes an actor and scopes by it.  │
│  middleware/      ← auth · authorize · rateLimit · idempotency     │
│  jobs/            ← BullMQ workers                                 │
│  realtime/        ← Socket.IO gateway                              │
└───┬───────────┬───────────┬──────────────┬─────────────────┬───────┘
    │           │           │              │                 │
    ▼           ▼           ▼              ▼                 ▼
┌────────┐ ┌────────┐ ┌──────────┐  ┌────────────┐  ┌──────────────┐
│Postgres│ │ Redis  │ │Cloudflare│  │  External  │  │ Expo Push    │
│  16    │ │(cache, │ │   R2     │  │  Sarvam STT│  │ → FCM/APNs   │
│(Prisma)│ │ queue, │ │ (images, │  │  Claude LLM│  └──────────────┘
│        │ │ OTP RL)│ │ audio,   │  │  MSG91 SMS │
└────────┘ └────────┘ │ invoices)│  └────────────┘
                      └──────────┘
```

**The one architectural rule that matters:**
> **Routes never touch the database. Services never build SQL. Repositories never make business decisions.**
> Every repository method's first parameter is the `actor` (`{ userId, role }`). A repository method that can return another user's data without checking the actor is a bug, and it is the bug class that will hurt you most now that RLS is gone.

---

## 2. Technology stack (fixed — do not substitute)

### 2.1 Backend

| Layer | Choice | Version | Why |
|---|---|---|---|
| Runtime | **Node.js** | 22 LTS | |
| Language | **TypeScript**, `strict: true`, `noUncheckedIndexedAccess: true` | 5.x | |
| HTTP framework | **Fastify** | 5.x | Fast, first-class TypeScript, schema-driven validation, plugin encapsulation. Chosen over Express (no native validation, weaker types) and NestJS (a lot of ceremony for a 40-endpoint API). |
| Validation | **Zod** + `fastify-type-provider-zod` | latest | One schema validates the request, types the handler, and generates the OpenAPI doc. Shared with the mobile app via `packages/shared`. |
| ORM | **Prisma** | 6.x | Type-safe client, real migrations, and `$transaction` with an escape hatch to raw SQL for the `SELECT … FOR UPDATE` locking the ordering path needs. |
| Auth | **JWT** (`@fastify/jwt`) — access 15 min, refresh 30 days, rotating | — | No passwords anywhere. Phone OTP only. |
| SMS OTP | **MSG91** (India), interface-wrapped | — | Cheaper and more reliable than Twilio for Indian numbers. Behind an `SmsProvider` interface. |
| Realtime | **Socket.IO** + `@socket.io/redis-adapter` | 4.x | Rooms per user / order / role. Redis adapter so it survives more than one server instance. |
| Jobs / cron | **BullMQ** + Redis | 5.x | Replaces `pg_cron`. Retries, backoff, and a `bull-board` dashboard the owner never sees but you will need. |
| Cache | **Redis** (ioredis) | 7.x | Voice catalogue cache, OTP rate limits, session revocation list. |
| Object storage | **Cloudflare R2** via `@aws-sdk/client-s3` | — | S3-compatible. Zero egress fees. Presigned PUT for uploads, presigned GET for private files. |
| PDF | **`@react-pdf/renderer`** (server-side) | — | Invoices. |
| CSV | **PapaParse** | — | Bulk catalogue import. |
| Logging | **Pino** + `pino-pretty` (dev) | — | Structured JSON logs with a request id on every line. |
| Errors | **Sentry** (`@sentry/node`) | — | |
| API docs | **`@fastify/swagger`** generated from the Zod schemas | — | |
| Testing | **Vitest** + **Supertest** + **Testcontainers** (real Postgres, not a mock) | — | |
| Container | **Docker** (multi-stage, distroless runtime) | — | |

### 2.2 Mobile (unchanged from v1.0)

Expo SDK 52+ · TypeScript · expo-router 4 · TanStack Query 5 · Zustand 5 · NativeWind 4 · i18next · expo-audio · expo-speech · expo-notifications · expo-location · react-native-maps · Sentry.

**Changed:** the app no longer imports `supabase-js`. It talks to the API through a single typed client in `src/lib/api.ts` (fetch + Zod response parsing + automatic token refresh + retry), and to Socket.IO through `src/lib/realtime.ts`.

### 2.3 External services

| Service | Used for | Where the key lives |
|---|---|---|
| **Sarvam AI (Saarika)** | Speech-to-text: Kannada, Hindi, English, code-mixed | API server only |
| **Google Cloud STT v2 (chirp)** | STT fallback | API server only |
| **Anthropic Claude (`claude-sonnet-4-6`)** | Transcript → structured order items | API server only |
| **MSG91** | OTP SMS | API server only |
| **Expo Push** | Notifications | API server only |

**No third-party API key ever ships in the mobile bundle.** The app's only secret is nothing — it holds a JWT and an API base URL.

### 2.4 Explicitly forbidden
- ❌ Any price, total, or stock number computed on the client and trusted by the server.
- ❌ A repository method without an `actor` parameter.
- ❌ `SELECT * FROM orders WHERE id = ?` without an ownership check. Ever.
- ❌ `float` for money.
- ❌ Secrets in the Expo bundle or in `app.json`.
- ❌ `localStorage` / `sessionStorage`.
- ❌ Business logic inside a route handler.

---

## 3. Monorepo structure

```
kss/
├─ apps/
│  ├─ api/                                  ← the Node backend
│  │  ├─ src/
│  │  │  ├─ index.ts                        # bootstrap, graceful shutdown
│  │  │  ├─ server.ts                       # Fastify instance + plugin registration
│  │  │  ├─ config/env.ts                   # Zod-validated process.env — fails fast
│  │  │  ├─ middleware/
│  │  │  │  ├─ authenticate.ts              # verifies JWT → req.actor
│  │  │  │  ├─ authorize.ts                 # requireRole('admin') etc.
│  │  │  │  ├─ idempotency.ts               # Idempotency-Key header (offline queue)
│  │  │  │  ├─ rateLimit.ts
│  │  │  │  └─ errorHandler.ts              # maps AppError → HTTP + a safe body
│  │  │  ├─ routes/
│  │  │  │  ├─ auth.routes.ts      addresses.routes.ts   catalogue.routes.ts
│  │  │  │  ├─ cart.routes.ts      order.routes.ts       payment.routes.ts
│  │  │  │  ├─ voice.routes.ts     invoice.routes.ts     upload.routes.ts
│  │  │  │  └─ admin/  products · inventory · orders · payments · staff
│  │  │  │             · reports · settings · voice-quality
│  │  │  │  └─ delivery/  orders.routes.ts  summary.routes.ts
│  │  │  ├─ services/
│  │  │  │  ├─ auth.service.ts        otp.service.ts
│  │  │  │  ├─ order.service.ts       ← placeOrder(), updateStatus(), cancel()
│  │  │  │  ├─ inventory.service.ts   ← adjustStock(), import()
│  │  │  │  ├─ payment.service.ts     ← createIntent(), submitUpi(), verify(), collectCod()
│  │  │  │  ├─ voice.service.ts       ← ⭐ STT → LLM → match
│  │  │  │  ├─ invoice.service.ts     notification.service.ts  report.service.ts
│  │  │  ├─ repositories/             ← the only files that import PrismaClient
│  │  │  ├─ providers/                ← swappable externals, all behind interfaces
│  │  │  │  ├─ stt/  SttProvider.ts  sarvam.ts  google.ts
│  │  │  │  ├─ llm/  LlmProvider.ts  anthropic.ts
│  │  │  │  ├─ sms/  SmsProvider.ts  msg91.ts
│  │  │  │  ├─ payment/  PaymentProvider.ts  upiQr.ts  cod.ts  (razorpay.ts — phase 2)
│  │  │  │  └─ storage/  StorageProvider.ts  r2.ts
│  │  │  ├─ jobs/
│  │  │  │  ├─ queues.ts
│  │  │  │  ├─ expireUnpaidOrders.job.ts     remindPendingPayments.job.ts
│  │  │  │  ├─ purgeVoiceAudio.job.ts        lowStockDigest.job.ts
│  │  │  │  ├─ expiryAlert.job.ts            stockIntegrityCheck.job.ts
│  │  │  │  └─ generateInvoice.job.ts        sendPush.job.ts
│  │  │  ├─ realtime/  gateway.ts  events.ts  rooms.ts
│  │  │  ├─ lib/  money.ts  upi.ts  errors.ts  logger.ts  prisma.ts  redis.ts
│  │  │  └─ types/  actor.ts
│  │  ├─ prisma/  schema.prisma  migrations/  seed.ts
│  │  └─ tests/   unit/  integration/  authz/     ← authz/ is a release gate
│  │
│  └─ mobile/                                ← Expo app (structure as in v1.0 §11)
│     └─ src/lib/api.ts  src/lib/realtime.ts
│
├─ packages/
│  ├─ shared/          ← ⭐ imported by BOTH api and mobile
│  │  └─ src/  schemas/ (zod: order, cart, voice, payment, product…)
│  │            types/  enums.ts  constants.ts  errorCodes.ts
│  └─ config/          eslint · tsconfig · prettier
│
├─ docker-compose.yml   # postgres + redis for local dev
└─ pnpm-workspace.yaml
```

**Why the shared package matters more now than it did with Supabase:** it is the only thing keeping the client and server in agreement about what an order looks like. Define every request and response body as a Zod schema in `packages/shared`, import it in the Fastify route (for validation) and in the mobile API client (for parsing). If they drift, TypeScript breaks the build. Without this, you will spend the project chasing shape mismatches.

---

## 4. The voice ordering pipeline

Unchanged in behaviour from v1.0. Now it runs in `voice.service.ts` instead of an Edge Function.

### 4.1 Sequence
```
1. MOBILE   User holds the mic → expo-audio records (16 kHz mono AAC, max 30 s)
2. MOBILE   POST /api/v1/voice/orders  (multipart: audio file + languageHint)
            → 20 MB body limit, 45 s timeout
3. API      Stream the audio to R2 (voice-notes/{userId}/{uuid}.m4a)
4. API      SttProvider.transcribe(buffer)
              → Sarvam Saarika, language auto-detect across kn-IN/hi-IN/en-IN
              → on error or 6 s timeout, retry once with Google STT v2
5. API      Load the voice catalogue:
              redis.get('voice:catalogue')  →  miss? build from Postgres, cache 300 s
              (~300 variants: id, names kn/hi/en, aliases[], pack, unit, price, inStock)
6. API      LlmProvider.parseOrder({ transcript, catalogue })
              → Claude claude-sonnet-4-6 with the system prompt in §4.3
              → response validated against VoiceOrderResult (Zod). Invalid → retry once
                → still invalid → fall back to pure fuzzy matching (step 7)
7. API      For every item the LLM left unmatched: fuzzy search in Postgres (§4.5)
8. API      Persist a voice_sessions row (transcript, parsed JSON, unmatched terms,
            latency, provider). Return VoiceOrderResult.
9. MOBILE   Render the CONFIRMATION SCREEN (C03). NOTHING IS ORDERED YET.
10. MOBILE  User edits → POST /api/v1/orders with source='voice' + voiceSessionId
```

### 4.2 Provider interfaces (must exist — the whole point is that they're swappable)
```ts
// providers/stt/SttProvider.ts
export interface SttProvider {
  readonly id: 'sarvam' | 'google';
  transcribe(audio: Buffer, hint?: 'kn' | 'hi' | 'en'):
    Promise<{ transcript: string; language: string; confidence: number }>;
}

// providers/llm/LlmProvider.ts
export interface LlmProvider {
  parseOrder(input: { transcript: string; catalogue: VoiceCatalogueItem[] }):
    Promise<unknown>;   // ALWAYS Zod-validated by the caller. Never trusted raw.
}
```

### 4.3 The LLM system prompt (verbatim intent — keep every rule)
```
You convert a grocery shop customer's spoken order into structured line items.
The customer speaks Kannada, Hindi, English, or a mix of these.

You are given the shop's full catalogue as JSON. You may ONLY return products
that exist in that catalogue, referenced by their exact variantId.

Rules:
- Numbers may be spoken in any of the three languages (ondu/ಒಂದು/एक/one = 1,
  eradu/ಎರಡು/दो/two = 2, ardha/half = 0.5, ...). Convert them to digits.
- Units: kg/kilo/ಕೆಜಿ/किलो, gram/g/ಗ್ರಾಂ, litre/L/ಲೀಟರ್, ml, packet/ಪ್ಯಾಕೆಟ್/पैकेट,
  dozen, bottle, piece. "half kg" = 0.5 kg = 500 g.
- If the requested quantity maps to a different pack variant of the same product
  (e.g. "5 kg rice" and a 5 kg bag exists), choose that variant with quantity 1.
  Otherwise choose the base variant and set quantity = requested / packSize.
- If no quantity is stated, quantity = 1 of the default variant.
- If a spoken item could be more than one catalogue product (e.g. "oil", "rice",
  "dal"), do NOT guess: return it in `ambiguous` with up to 4 candidate variantIds.
- If a spoken item is not in the catalogue at all, return it in `unmatched` with
  the exact words the customer used.
- Ignore filler, greetings, and anything that is not an order item.
- Never invent a product, a price, or a variantId.

Return ONLY a JSON object matching the given schema. No prose, no markdown fences.
```

### 4.4 Response contract (`packages/shared/src/schemas/voice.ts`)
```ts
export const VoiceOrderResult = z.object({
  sessionId: z.string().uuid(),
  transcript: z.string(),
  detectedLanguage: z.enum(['kn', 'hi', 'en', 'mixed']),
  matched: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().positive(),
    spokenAs: z.string(),          // the customer's own words — shown in the UI
    confidence: z.number().min(0).max(1),
    inStock: z.boolean(),
  })),
  ambiguous: z.array(z.object({
    spokenAs: z.string(),
    quantity: z.number().positive(),
    candidates: z.array(z.object({ variantId: z.string().uuid(), label: z.string() })).max(4),
  })),
  unmatched: z.array(z.object({
    spokenAs: z.string(),
    quantity: z.number().positive().nullable(),
  })),
});
export type VoiceOrderResult = z.infer<typeof VoiceOrderResult>;
```

### 4.5 Fuzzy matching (raw SQL through Prisma)
```ts
// repositories/catalogue.repository.ts
async searchVariants(q: string, limit = 4) {
  return this.prisma.$queryRaw<Array<{ variantId: string; label: string; score: number }>>`
    SELECT v.id AS "variantId",
           p.name_en || ' ' || v.pack_label AS label,
           GREATEST(
             similarity(p.name_en, ${q}),
             similarity(p.name_kn, ${q}),
             similarity(p.name_hi, ${q}),
             COALESCE((SELECT MAX(similarity(a.alias, ${q}))
                       FROM product_aliases a WHERE a.product_id = p.id), 0)
           ) AS score
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    WHERE p.is_available AND v.is_active
    ORDER BY score DESC
    LIMIT ${limit};
  `;
}
```
Promotion thresholds: `score ≥ 0.5` → matched · `0.35–0.5` → ambiguous · `< 0.35` → unmatched (and the spoken words are recorded in `voice_sessions.unmatched_terms`, which feeds the admin's alias screen).

Requires `CREATE EXTENSION pg_trgm` and GIN trigram indexes on all name and alias columns (Backend Schema §3).

### 4.6 Quality loop (build it in v1, not later)
`GET /api/v1/admin/voice/unmatched` returns the terms customers said that the system could not match, grouped with counts. `POST /api/v1/admin/products/:id/aliases` turns one into an alias in two taps and busts the Redis catalogue cache. This is the mechanism by which voice accuracy improves. Without it, accuracy is frozen at whatever the seed data gave you.

---

## 5. REST API

**Base:** `https://api.kss.app/api/v1` · JSON · `Authorization: Bearer <accessToken>`
Every request and response body is a Zod schema in `packages/shared`.

### 5.1 Conventions
- **Errors** always return: `{ error: { code: 'OUT_OF_STOCK', message: '…', details?: {...} } }`. `code` is a member of the `ErrorCode` union in `packages/shared/src/errorCodes.ts`; the mobile app switches on `code`, never on `message`.
- **Idempotency:** any state-changing request may send `Idempotency-Key: <uuid>`. The delivery app **must** send one on every status update (§8). The server stores the key + response for 24 h in Redis and replays it on a repeat.
- **Pagination:** cursor-based — `?cursor=<id>&limit=20` → `{ items, nextCursor }`.
- **Money:** all amounts are **integer paise** on the wire (`26600` = ₹266.00), `Decimal` in the DB, and formatted only at render time. This kills float-rounding bugs permanently.

### 5.2 Endpoints

**Auth**
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/otp/request` | public | `{ phone }`. Rate limit: 5/hour/phone, 20/hour/IP. |
| POST | `/auth/otp/verify` | public | `{ phone, code }` → `{ accessToken, refreshToken, user, isNewUser }` |
| POST | `/auth/refresh` | public | Rotating refresh token; the old one is revoked. Reuse of a revoked token revokes the whole family and forces re-login. |
| POST | `/auth/logout` | any | Revokes the refresh token. |
| GET | `/me` | any | |
| PATCH | `/me` | any | `{ fullName?, language? }` — **`role` is not an accepted field.** |
| POST | `/me/device-tokens` | any | Expo push token upsert. |

**Addresses** — `GET/POST /addresses`, `PATCH/DELETE /addresses/:id` (customer, own only)

**Catalogue** (any authenticated role)
| GET | `/categories` |
| GET | `/products?categoryId=&q=&cursor=&limit=` |
| GET | `/products/:id` |
| GET | `/search?q=` | Fuzzy, all three scripts + aliases (§4.5) |

**Cart** (customer, own only) — `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:id` · `DELETE /cart/items/:id`

**Orders**
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/orders` | customer, admin | `{ addressId, paymentMethod, items[], source, voiceSessionId?, note? }` → **`orderService.placeOrder()`** (§6). Errors: `OUT_OF_STOCK`, `COD_LIMIT_EXCEEDED`, `SHOP_NOT_ACCEPTING_ORDERS`, `EMPTY_ORDER`, `INVALID_ADDRESS`. |
| GET | `/orders` | any | **Role-scoped in the repository:** customer → own; delivery → actively assigned; admin → all. |
| GET | `/orders/:id` | any | Same scoping. A customer requesting someone else's order gets **404, not 403** (don't leak existence). |
| POST | `/orders/:id/cancel` | customer, admin | Customer allowed only before `packed`. |
| PATCH | `/orders/:id/status` | delivery, admin | `{ status, note? }` + `Idempotency-Key`. Transition table enforced server-side (§6.2). |

**Payments**
| GET | `/orders/:id/payment-intent` | customer (own) | → `{ amount, reference, upiVpa, upiQrUrl, deepLinks: { gpay, phonepe, paytm, generic } }` |
| POST | `/orders/:id/payment/submit` | customer (own) | `{ utr, proofImageKey? }` → status `pending_verification` |
| GET | `/admin/payments/pending` | admin | The verification queue |
| POST | `/admin/payments/:id/verify` | admin | `{ approve: boolean, reason? }` |
| POST | `/delivery/orders/:id/collect-cod` | delivery (assigned) | `{ amountPaise, note? }` + `Idempotency-Key` |

**Voice**
| POST | `/voice/orders` | customer, admin | multipart audio → `VoiceOrderResult`. Rate limit **30/hour/user** — every call costs real money. |
| GET | `/admin/voice/unmatched` | admin | The quality loop |

**Admin**
| POST/PATCH/DELETE | `/admin/products`, `/admin/products/:id` | admin |
| POST/PATCH/DELETE | `/admin/products/:id/variants[/:variantId]` | admin |
| POST/DELETE | `/admin/products/:id/aliases[/:aliasId]` | admin | ⭐ busts the catalogue cache |
| POST | `/admin/inventory/adjust` | admin | `{ variantId, delta, reason, note }` |
| POST | `/admin/inventory/import` | admin | CSV multipart → dry-run preview, then commit |
| GET | `/admin/inventory/low-stock` | admin |
| GET/POST/PATCH | `/admin/staff` | admin | Promote a phone number to `delivery` |
| POST | `/admin/orders/:id/assign` | admin | `{ deliveryUserId }` |
| GET | `/admin/reports/daily?date=` · `/admin/reports/range?from=&to=&format=csv` | admin |
| GET/PATCH | `/admin/settings` | admin | Delivery fee, hours, COD limit, **UPI VPA + QR** |

**Delivery** — `GET /delivery/orders` (assigned only) · `GET /delivery/summary` (cash in hand)

**Invoices** — `GET /invoices` (own) · `GET /invoices/:id/pdf` → **short-lived presigned R2 URL (5 min)**, never a public link.

**Uploads** — `POST /uploads/presign` `{ kind: 'product-image' | 'payment-proof' | 'shop-qr' }` → presigned PUT URL + the object key to send back. The API never proxies large file bodies except voice audio.

**Ops** — `GET /health` (liveness) · `GET /ready` (DB + Redis reachable)

---

## 6. Business logic (services)

### 6.1 `orderService.placeOrder()` — atomic, authoritative
This replaces the Postgres `place_order()` function from v1.0. Same guarantees, now in TypeScript.

```ts
async placeOrder(actor: Actor, input: PlaceOrderInput): Promise<Order> {
  return this.prisma.$transaction(async (tx) => {
    const settings = await tx.shopSettings.findFirstOrThrow();
    if (!settings.acceptingOrders) throw new AppError('SHOP_NOT_ACCEPTING_ORDERS');

    // The address must belong to the actor. Never trust an addressId.
    const address = await tx.address.findFirst({
      where: { id: input.addressId, userId: actor.userId },
    });
    if (!address) throw new AppError('INVALID_ADDRESS');

    // ⭐ LOCK every requested variant row, in a DETERMINISTIC ORDER (sorted by id)
    //    to make deadlocks between two concurrent orders impossible.
    const ids = [...new Set(input.items.map(i => i.variantId))].sort();
    const variants = await tx.$queryRaw<VariantRow[]>`
      SELECT * FROM product_variants
      WHERE id = ANY(${ids}::uuid[]) AND is_active
      ORDER BY id
      FOR UPDATE`;                       // ← the concurrency guarantee lives here

    let subtotal = 0n;
    for (const item of input.items) {
      const v = variants.find(x => x.id === item.variantId);
      if (!v) throw new AppError('VARIANT_NOT_FOUND', { variantId: item.variantId });
      if (v.stock < item.quantity)
        throw new AppError('OUT_OF_STOCK', { variantId: v.id, available: v.stock });
      subtotal += toPaise(v.sellingPrice) * BigInt(item.quantity);   // SERVER price only
    }

    const deliveryFee = subtotal >= toPaise(settings.freeDeliveryAbove)
      ? 0n : toPaise(settings.deliveryFee);
    const total = subtotal + deliveryFee;

    if (input.paymentMethod === 'cod' && total > toPaise(settings.codLimit))
      throw new AppError('COD_LIMIT_EXCEEDED');

    const status = input.paymentMethod === 'cod'
      ? 'confirmed' : 'payment_pending_verification';

    // create order + items (with price/name SNAPSHOTS)
    // decrement stock + write inventory_movements (reason: 'sale')
    // create the payment row
    // write order_status_events: 'placed', then `status`
    // clear the cart
    // link the voice session if source === 'voice'
    // ... all inside this same transaction
  }, { isolationLevel: 'ReadCommitted', timeout: 10_000 });

  // AFTER the transaction commits (never inside it):
  //   realtime.emitToAdmins('order:new', order)
  //   queue.add('sendPush', { … })
}
```

**Non-negotiables in this function**
1. Prices come from the **database**, never from `input`. The client sends `variantId` and `quantity`. Nothing else about money.
2. `FOR UPDATE` with a **sorted** id list. Sorting prevents the classic deadlock where two orders lock the same two rows in opposite order.
3. Push notifications and Socket.IO emits happen **after commit**. Emitting inside the transaction sends a notification for an order that may still roll back.
4. Two concurrent orders for the last bag of rice → exactly one succeeds, one gets `OUT_OF_STOCK`. **This has an integration test and it is a release gate.**

### 6.2 `orderService.updateStatus()`
- Transition table (same as v1.0 App Flow §5) hard-coded as a `Record<OrderStatus, OrderStatus[]>`. Any transition not in the table → `INVALID_TRANSITION`.
- Permission by role: admin → anything valid; delivery → only `out_for_delivery | delivered | returned`, and only on an **active assignment of their own**; customer → only `cancelled`, and only before `packed`.
- **Idempotent** on the `Idempotency-Key` header (unique index on `order_status_events.client_mutation_id`). A replayed offline mutation returns the original response and changes nothing.
- On `cancelled` / `returned`: restore stock and write compensating `inventory_movements` — in the same transaction.
- On `delivered`: enqueue `generateInvoice`.

### 6.3 `paymentService`
```ts
export interface PaymentProvider {
  readonly id: 'upi_qr' | 'cod' | 'razorpay';
  createIntent(order: Order, settings: ShopSettings): Promise<PaymentIntent>;
}
```
**`upiQr` provider** builds the deep link exactly:
```
upi://pay?pa={vpa}&pn={payeeName}&am={amount}&cu=INR&tn=KSS%20Order%20{orderNumber}&tr={orderNumber}
```
plus `tez://` (GPay), `phonepe://`, `paytmmp://` variants, and returns the shop's uploaded QR image URL. The mobile app filters these with `Linking.canOpenURL` and only shows installed apps.

**Verification is manual in v1**, exactly as in the PRD. `POST /admin/payments/:id/verify` sets the payment status, moves the order to `confirmed` or `payment_failed`, and notifies the customer.

> ⚠️ **Stated plainly:** this cannot detect a fake UTR. The mitigation is procedural — the owner does not dispatch until he has seen the money land, which is what he does today anyway. Phase 2 swaps in a `razorpay` provider with webhook reconciliation and **touches only `providers/payment/`**. That is the entire reason this interface exists.

### 6.4 `inventoryService.adjustStock()`
The **only** sanctioned way stock changes outside an order. Writes an `inventory_movement` and updates `product_variants.stock` in one transaction. The nightly `stockIntegrityCheck` job asserts `stock === sum(movements)` per variant and alerts the admin on drift.

---

## 7. Realtime (Socket.IO)

**Connection:** the client sends the JWT in `auth.token` on handshake. The gateway verifies it and joins rooms based on the role. **A client never asks to join a room; the server decides.** (With Supabase this was RLS's job. Now it's yours.)

| Room | Who is in it |
|---|---|
| `user:{userId}` | That user only |
| `order:{orderId}` | The order's customer, the assigned delivery user, all admins |
| `role:admin` | All admins |
| `delivery:{userId}` | That delivery user |

| Event | Emitted to | Payload |
|---|---|---|
| `order:new` | `role:admin` | Order summary. **The admin app plays a loud sound on this.** |
| `order:status` | `order:{id}` | `{ orderId, status, at }` |
| `payment:pending` | `role:admin` | `{ paymentId, orderId, amount }` |
| `payment:resolved` | `user:{customerId}` | `{ orderId, approved }` |
| `assignment:new` | `delivery:{userId}` | Order summary |
| `stock:low` | `role:admin` | Daily digest ping |

Redis adapter (`@socket.io/redis-adapter`) so this still works with more than one API instance behind a load balancer.

---

## 8. Offline (delivery app) — now that there is no BaaS to lean on

- TanStack Query with an AsyncStorage persister → assigned orders readable offline.
- A **durable mutation queue** in AsyncStorage:
  ```ts
  type QueuedMutation = {
    id: string;                     // uuid → sent as the Idempotency-Key
    endpoint: string;
    method: 'POST' | 'PATCH';
    body: unknown;
    createdAt: string;
    attempts: number;
  };
  ```
- On reconnect (`expo-network` listener), the queue drains **in creation order**, sending `Idempotency-Key: <id>` on every request. The server's idempotency middleware (Redis, 24 h) makes a replay a no-op that returns the original response.
- The UI shows "⏳ will sync" on any order with pending mutations. A "Delivered" tap is **never** lost and **never** applied twice.

**Release gate test:** airplane mode → tap Delivered → force-quit the app → reopen → restore network → the status syncs exactly once. Do not ship without this passing.

---

## 9. Security — read this twice

**The database no longer protects you.** With Supabase, a forgotten `WHERE user_id = ?` was caught by RLS. Now it is a data breach. Everything below is mandatory.

### 9.1 The actor pattern (the core defence)
```ts
// types/actor.ts
export type Actor = { userId: string; role: 'customer' | 'delivery' | 'admin' };
```
1. `authenticate` middleware verifies the JWT and sets `req.actor`. There is no other way to learn who the caller is. **`req.body.userId` is never read. Ever.**
2. **Every repository method takes `actor` as its first parameter and scopes its query by it.** Not "should" — *does*. A method that cannot be scoped (e.g. a genuine admin-wide query) is named `…AsAdmin()` and asserts `actor.role === 'admin'` on its first line.
3. `authorize(...roles)` guards each route. Route-level role checks are the *coarse* layer; the repository scoping is the *real* layer. **Both.**
4. Ownership failures return **404**, not 403 — do not confirm that another user's order exists.

### 9.2 The authorization test suite (`tests/authz/`) — a release gate
Automated, run in CI, must pass before any deploy. Three authenticated clients: customer A, customer B, delivery D, admin.
- [ ] A cannot `GET /orders/:id` for B's order → 404
- [ ] A cannot `GET /invoices/:id` for B's invoice → 404
- [ ] A cannot `PATCH /orders/:id/status` at all → 403
- [ ] A cannot `PATCH /me` with `{ role: 'admin' }` → the field is stripped; the role is unchanged
- [ ] D cannot see an order that is not actively assigned to them → 404
- [ ] D cannot move an order backwards, or to `confirmed` → 400 `INVALID_TRANSITION` / 403
- [ ] D cannot `collect-cod` on an order that isn't theirs → 404
- [ ] Nobody but admin can hit any `/admin/*` route → 403
- [ ] A cannot fetch B's `payment-proof` object (presigned URLs are scoped and expire)
- [ ] An expired/revoked JWT is rejected everywhere → 401
- [ ] A reused refresh token revokes the whole token family

**A new endpoint without a corresponding authz test does not get merged.**

### 9.3 The rest
- **Secrets:** environment variables only, injected at deploy (Doppler / Railway / AWS Secrets Manager). Never in git. `config/env.ts` validates them with Zod at boot and **crashes on a missing one** — fail loudly at startup, not mysteriously at 2 a.m.
- **Bundle scan** before every mobile release: `grep -rE "sk-|api_key|SECRET" dist/` → must be empty.
- **Rate limits** (`@fastify/rate-limit`, Redis-backed): OTP 5/h/phone · voice 30/h/user · global 100/min/IP · auth endpoints 20/h/IP.
- **Helmet** (`@fastify/helmet`), CORS locked to the app's origin(s), body limit 1 MB (20 MB on the voice route only).
- **SQL injection:** Prisma parameterises everything. The handful of `$queryRaw` calls **must** use tagged-template interpolation (`${q}`), never string concatenation.
- **Uploads:** validate MIME type *and* magic bytes, cap size (5 MB images, 20 MB audio), and generate the object key server-side. Never let the client choose the key.
- **Logging:** never log a JWT, an OTP, a phone number in full, or a UTR. Pino redaction paths configured for `req.headers.authorization`, `req.body.code`, `req.body.utr`.
- **Audit log:** price changes, stock corrections, order cancellations, payment verifications and role changes all write an `audit_log` row with the actor.
- **Postgres:** the app connects as a least-privilege role that has no `SUPERUSER` and no DDL rights in production. Migrations run as a separate role in the deploy step.

---

## 10. Non-functional requirements

| # | Requirement |
|---|---|
| NFR-1 | **Voice latency:** end-of-speech → confirmation screen ≤ 5 s (p90) on 4G, 5 items. Budget: upload 1 s · STT 2 s · LLM 1.5 s · match 0.3 s. |
| NFR-2 | **API latency:** p95 < 300 ms for reads, < 800 ms for `POST /orders`. |
| NFR-3 | **Cold start** ≤ 3 s on a ₹10,000 Android phone (the delivery boy's phone — test on a real one). |
| NFR-4 | **Offline:** the delivery app loses nothing (§8). |
| NFR-5 | **Realtime:** a new order reaches the admin board in ≤ 2 s. |
| NFR-6 | **Concurrency:** the last bag of rice is sold exactly once (§6.1). |
| NFR-7 | **Money:** integer paise on the wire, `Decimal(10,2)` in Postgres. `float` appears nowhere in the money path. |
| NFR-8 | **Accessibility:** 48 dp tap targets (56 dp in the delivery app), 16 sp base font, OS font scaling to 130%. |
| NFR-9 | **Region:** Postgres, Redis, R2 and the API all in **Mumbai (ap-south-1)**. |
| NFR-10 | **Privacy:** voice audio purged after 30 days by a BullMQ repeatable job. Customers are told, and can opt out. |
| NFR-11 | **Availability:** the API is a single point of failure now. Two instances behind a load balancer, health checks, auto-restart. If it is down, the customer app shows "Can't reach the shop right now" **with the shop's phone number** — always a human fallback. |
| NFR-12 | **Backups:** automated daily Postgres backup with **point-in-time recovery**, retained 30 days. **Restore must be tested once before launch.** An untested backup is not a backup. |

---

## 11. Environment & deployment

```bash
# apps/api  (all secret — never in git)
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://…            # Neon / RDS, ap-south-1
REDIS_URL=redis://…
JWT_ACCESS_SECRET=                     # 32+ random bytes
JWT_REFRESH_SECRET=
MSG91_AUTH_KEY=
MSG91_TEMPLATE_ID=
ANTHROPIC_API_KEY=
SARVAM_API_KEY=
GOOGLE_STT_API_KEY=
R2_ACCOUNT_ID=  R2_ACCESS_KEY_ID=  R2_SECRET_ACCESS_KEY=  R2_BUCKET=
EXPO_ACCESS_TOKEN=
SENTRY_DSN=
CORS_ORIGINS=

# apps/mobile  (public — nothing secret, by design)
EXPO_PUBLIC_API_URL=https://api.kss.app/api/v1
EXPO_PUBLIC_WS_URL=wss://api.kss.app
EXPO_PUBLIC_SENTRY_DSN=
```

**Local dev:** `docker compose up` → Postgres 16 + Redis 7 → `pnpm --filter api prisma migrate dev` → `pnpm --filter api seed` → `pnpm dev`.

**Deploy:** Docker image → **Railway** or **Render** (both have Mumbai regions and managed Postgres + Redis; either is fine for this scale and far less operational burden than AWS). Two API replicas. Migrations run as a release command before the new version takes traffic. Object storage on Cloudflare R2.

**Object storage layout** (all buckets private except product images):
| Prefix | Access |
|---|---|
| `product-images/` | Public read via an R2 custom domain; admin writes via presigned PUT |
| `shop-assets/` | Public read (the UPI QR must render for every customer) |
| `voice-notes/` | Private. Owner-scoped presigned GET. Purged at 30 days. |
| `payment-proofs/` | Private. Owner + admin only. |
| `invoices/` | Private. 5-minute presigned GET only. |

---

## 12. Background jobs (BullMQ) — replaces `pg_cron`

| Job | Schedule | Does |
|---|---|---|
| `expireUnpaidOrders` | every 10 min | Cancels `payment_pending_verification` orders older than 60 min, **restores stock**, notifies the customer |
| `remindPendingPayments` | every 5 min | Re-pings the admin about payments pending > 10 min |
| `purgeVoiceAudio` | daily 02:00 IST | Deletes R2 objects older than 30 days, nulls `audioPath` |
| `stockIntegrityCheck` | daily 03:00 | Asserts `stock === sum(movements)`; alerts on drift |
| `lowStockDigest` | daily 08:00 | Pushes the low-stock list to the admin |
| `expiryAlert` | daily 08:05 | Items expiring within 15 days |
| `generateInvoice` | on demand | Renders the PDF, uploads to R2, writes the `invoices` row |
| `sendPush` | on demand | Expo Push API, with retry + exponential backoff |

All jobs are **idempotent** and safe to run twice. Failed jobs retry 3× with backoff, then land in a dead-letter queue that alerts Sentry.

---

## 13. Definition of done (per feature)
- [ ] TypeScript strict, zero `any`
- [ ] Request + response Zod schemas live in `packages/shared` and are used by **both** sides
- [ ] Repository methods take `actor` and scope by it
- [ ] **An entry in `tests/authz/` proving a hostile client cannot reach it**
- [ ] Integration test against a real Postgres (Testcontainers), not a mock
- [ ] Money paths unit-tested in paise
- [ ] All three languages; no hardcoded English strings in the app
- [ ] Loading / empty / error / offline / success states (UI Brief §7)
- [ ] Tested once on a low-end Android device
