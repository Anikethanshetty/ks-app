# Implementation Plan
## Krishnappa Shetty and Son's — Home Delivery App

**Version:** 2.0 — *aligned to the Node.js + TypeScript backend (TRD v2.0)*
Build order, task by task, with acceptance criteria and the exact prompts to give an AI coding agent.

---

## 0. How to use this plan with an AI coding agent

**The single most important rule:** paste the relevant document *sections* into the agent's context before each phase. Do not paste all six documents at once and say "build it" — the agent will run out of context and start inventing.

**A working loop that actually works:**
1. Give the agent the **TRD §2 (stack)** + **TRD §11 (repo structure)** once, at project setup. In Cursor/Claude Code, put these in `AGENTS.md` or `CLAUDE.md` at the repo root so they're always in context.
2. For each task below: paste the **task description + acceptance criteria + the named doc sections**.
3. After every task: **run it, look at it, and commit.** Never let the agent stack three unverified tasks on top of each other.
4. When something breaks, give the agent the *error and the file*, not "it doesn't work".

**Files to create on day one:**
- `CLAUDE.md` / `AGENTS.md` — stack, repo structure, coding conventions, "never do this" list from TRD §2.
- `docs/` — all six of these documents, committed. The agent can then be told "read `docs/05-backend-schema-document.md` §6.1".

---

## 1. Phases at a glance

| Phase | Name | Outcome | Est. |
|---|---|---|---|
| **0** | Foundations | Monorepo, API skeleton, DB, auth, authz | 7–10 days |
| **1** | Catalogue & admin inventory | The owner can load 300 products | 7–9 days |
| **2** | Manual ordering | A customer can order by tapping and pay COD | 7–9 days |
| **3** | Payments (UPI QR) | Online payment + admin verification works | 3–4 days |
| **4** | Delivery app | Orders get assigned, delivered, cash collected | 4–5 days |
| **5** | ⭐ Voice ordering | The flagship feature | 7–10 days |
| **6** | Invoices & reports | Invoices auto-generate; the owner sees his day | 3–4 days |
| **7** | Polish, i18n, offline, hardening | Ship-ready | 5–7 days |
| **8** | Data load & pilot | Real catalogue, 10 real customers | 1–2 weeks |
| **9** | Launch | Play Store + App Store | 1–2 weeks (review time) |

**Deliberate sequencing note:** voice comes *after* manual ordering, not before. Voice is the differentiator, but it is a *layer on top of* a working cart. Building it first means debugging speech recognition against a cart that doesn't exist yet. Resist the temptation.

**The catalogue data (Phase 8) is on the critical path and is not a coding task.** Start it in parallel from week 1. If 300 products with Kannada names and aliases are not ready, voice cannot be tested, and the launch slips. This is the most commonly underestimated part of this project.

---

## PHASE 0 — Foundations

### T0.1 — Monorepo + API skeleton
> **Prompt:** "Create a pnpm monorepo with `apps/api`, `apps/mobile` and `packages/shared`, exactly as in `docs/02-technical-requirements-document.md` §3. In `apps/api`, scaffold a Fastify 5 server on Node 22 with TypeScript strict mode: Zod validation via `fastify-type-provider-zod`, Pino logging with a request id, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` (Redis-backed), a global `errorHandler` that maps an `AppError` to `{ error: { code, message } }`, `GET /health` and `GET /ready`, Swagger generated from the Zod schemas, and `config/env.ts` that validates `process.env` with Zod and **crashes at boot on a missing variable**. Add `docker-compose.yml` with Postgres 16 and Redis 7 for local dev. In `packages/shared`, set up the Zod schema + error-code exports that both apps will import."

**Done when:** `pnpm dev` boots the API against Docker Postgres, `/health` returns 200, `/docs` renders Swagger, and deleting an env var crashes the process with a clear message.

### T0.1b — Mobile scaffold
> **Prompt:** "Create the Expo (SDK 52) app in `apps/mobile` with TypeScript strict mode and expo-router v4. Set up NativeWind v4 with the design tokens from `docs/04-ui-ux-design-brief.md` §2 mapped into `tailwind.config.js` (colours `enamel`, `brass`, `paper`, `ruled`, `ink`, `fresh`, `chilli`, `turmeric`; the type scale as `fontSize` entries). Set up NativeWind v4 with the design tokens from `docs/04-ui-ux-design-brief.md` §2 mapped into `tailwind.config.js` (colours `enamel`, `brass`, `paper`, `ruled`, `ink`, `fresh`, `chilli`, `turmeric`; the type scale as `fontSize` entries). Configure the Anek and IBM Plex Mono fonts via expo-font. Set up route groups `(auth)`, `(customer)`, `(delivery)`, `(admin)`. Create `src/lib/api.ts`: a typed fetch client that attaches the JWT, parses every response with the Zod schema from `packages/shared`, refreshes the access token on a 401 exactly once, and surfaces `error.code` (never `error.message`) to callers. Add ESLint, Prettier, and absolute imports via `@/`."

**Done when:** the app boots on a device, fonts render Kannada correctly, `pnpm typecheck` passes across the whole workspace, and the app can call `GET /health`.

### T0.2 — Database + Prisma
> **Prompt:** "Implement `docs/05-backend-schema-document.md` sections 2, 3 and 4 as Prisma migrations. Write `schema.prisma` to mirror the SQL exactly — same table names, columns, types, enums. Use `Decimal @db.Decimal(10,2)` for money and `Decimal @db.Decimal(10,3)` for stock and quantity; **never `Float`**. Add the things Prisma cannot express as raw SQL migrations, per §9: the `pg_trgm` and `unaccent` extensions, the GIN trigram indexes, the partial unique indexes (`one_default_address`, `one_active_assignment`, `one_default_variant`), the `v_voice_catalogue` view, and the `set_updated_at` trigger. Do not add tables that are not in the doc. Do not rename columns."

**Done when:** `prisma migrate dev` runs clean from an empty database, `prisma migrate diff` reports no drift, and the generated client compiles.

### T0.3 — Auth (OTP + rotating JWTs)
> **Prompt:** "Implement `authService` and `otpService` per TRD §5.2 and schema §3.1: `POST /auth/otp/request` (rate limited 5/hour/phone, 20/hour/IP in Redis; the code is **hashed** before storage, expires in 5 minutes, max 3 attempts), `POST /auth/otp/verify` → access token (15 min) + rotating refresh token (30 days), `POST /auth/refresh` (rotation; **reuse of a revoked token revokes the entire family**), `POST /auth/logout`. Wrap the SMS send behind an `SmsProvider` interface with an MSG91 implementation and a console-logging dev implementation. Add the `authenticate` middleware that verifies the JWT and sets `req.actor`, and the `authorize(...roles)` guard. In dev only (`NODE_ENV !== 'production'`), accept a fixed OTP `000000`."

**Done when:** three phone numbers with three different roles get three different JWTs, a refresh rotates correctly, and replaying an old refresh token kills the session family.

### T0.4 — Order service (the concurrency gate)
> **Prompt:** "Implement `orderService.placeOrder()` and `orderService.updateStatus()` exactly as specified in TRD §6.1–6.2 and schema doc §6. Then write integration tests against a **real Postgres via Testcontainers** (not a mock) proving: (a) an order for more stock than exists throws `OUT_OF_STOCK` and changes nothing; (b) **two concurrent `placeOrder` calls for the last unit result in exactly one success and one `OUT_OF_STOCK`, with stock landing at exactly 0**; (c) a backwards status transition throws `INVALID_TRANSITION`; (d) a replayed `Idempotency-Key` is a no-op that returns the original response; (e) cancelling an order restores stock and writes a compensating `inventory_movement`; (f) after any `placeOrder`, `stock == sum(inventory_movements.delta)`."

**Done when:** all six pass. **Do not start Phase 1 until (b) passes.** It is the single most important correctness property in the system, and with a hand-written backend nothing else will catch it for you.

### T0.5 — Role routing in the app
> **Prompt:** "Build `(auth)/login`, `(auth)/otp`, `(auth)/onboarding` per `docs/03-app-flow-document.md` §1 against the real API. Store the refresh token in `expo-secure-store` (**not AsyncStorage**) and the access token in memory. Add a root layout gate that routes to `(customer)`, `(delivery)` or `(admin)` based on the role in `/me`. Add i18next with kn/hi/en and a language picker on first launch."

**Done when:** three test numbers land on three different home screens, and the session survives a force-quit.

### T0.6 — ⭐ The authorization test suite (release gate)
> **Prompt:** "Create `apps/api/tests/authz/` and implement **every** assertion listed in `docs/02-technical-requirements-document.md` §9.2, using four real authenticated clients (customer A, customer B, delivery D, admin). Wire it into CI as a required check."

**Done when:** every hostile attempt fails with 404 or 403, never with data. **This suite is now the thing standing between your customers and each other — RLS is not there any more. Treat a failure here as a production incident, not a test failure.**

**From here on, every new endpoint ships with an authz test. No exceptions.**

---

## PHASE 1 — Catalogue & admin inventory

*Each task below is now **two** pieces of work: the API endpoints (routes → services → repositories, with Zod schemas in `packages/shared`) and the mobile screens. Build the API first and test it with the Swagger UI or curl before touching the UI. Debugging a broken screen against a broken endpoint is twice the work.*

| Task | Prompt summary | Done when |
|---|---|---|
| T1.1 | Admin inventory list (A05) with tabs All / Low stock / Out of stock, per app-flow §6 and the design brief. Realtime-backed. | List renders 300 seeded products, tabs filter correctly |
| T1.2 | Product add/edit screen (A06) with kn/hi/en names, category, variants (pack, SKU, MRP, cost, price, stock, threshold), image upload to `product-images`. | A new product created in the app appears in the DB with all three names |
| T1.3 | ⭐ **Alias editor** on A06 — chip input, "What do customers call this?", writes to `product_aliases`. Give this screen visual prominence; it is not a settings afterthought. | Adding an alias makes the product findable by that alias in search |
| T1.4 | Stock adjust sheet (A07): Stock in / Stock out / Correction, each writing an `inventory_movement` via `adjust_stock()`. | Stock changes, movement row appears, invariant `stock == sum(movements)` holds |
| T1.5 | CSV import (A08) with PapaParse: columns `name_en,name_kn,name_hi,category,brand,pack_size,unit,pack_label,mrp,price,cost,stock,aliases(pipe-separated)`. Preview the parse, show row-level errors, then commit. | A 300-row CSV imports with a clear error report for bad rows |
| T1.6 | Customer catalogue: home categories, category listing (C04), product detail (C05), search (C06) using `GET /search` (pg_trgm over names + aliases). | Searching "ಅಕ್ಕಿ", "akki", "chawal" and "rice" all find rice |

---

## PHASE 2 — Manual ordering (COD)

| Task | Prompt summary | Done when |
|---|---|---|
| T2.1 | Cart: Zustand + server-synced `carts`/`cart_items`. Add/remove/step. Survives app restart. | Cart persists across a force-quit and across devices |
| T2.2 | Checkout (C08): address picker, delivery slot, payment method, bill summary. Enforce the delivery radius and the COD limit **client-side for UX and server-side for truth**. | Bill matches the server's computed total exactly |
| T2.3 | Wire `place_order()`. Handle every error code from schema §6.1 with a specific, human message. | Ordering the last bag of rice twice from two phones → one success, one clear "out of stock" |
| T2.4 | Success screen (C10) + My orders (C11) + order detail with the live status timeline (C12), subscribed to Realtime. | Admin changes status → the customer's timeline updates within 2 s with no refresh |
| T2.5 | Admin order board (A01) with live tabs, sound alert on new order, and order detail (A02) with Confirm / Packed / Cancel. | A new order makes the owner's phone make a noise he cannot ignore |
| T2.6 | Realtime + push: the Socket.IO gateway with server-decided rooms (TRD §7) and the `sendPush` BullMQ job hitting the Expo Push API. Implement the full matrix in PRD §5.10. | Each event reaches the right role and **nobody else** — verify by connecting as customer B and confirming A's order events never arrive |

---

## PHASE 3 — Payments

| Task | Prompt summary | Done when |
|---|---|---|
| T3.1 | Admin settings (A14): UPI VPA + QR image upload to the `shop-assets/` R2 prefix via a presigned PUT, with a live preview of exactly what the customer will see. | The owner can change the QR from his phone, and it changes on C09 |
| T3.2 | UPI payment screen (C09) per design brief §4.4: QR hero, amount, UPI ID with copy, GPay/PhonePe/Paytm deep links (TRD §6.2) filtered by `Linking.canOpenURL`, UTR field with 12-digit validation, optional screenshot upload. | Tapping GPay opens GPay with the amount and the order reference pre-filled |
| T3.3 | "I have paid" → creates a `payments` row with `pending_verification`. Order sits in `payment_pending_verification`. | Customer sees "usually confirmed within 15 minutes" |
| T3.4 | Admin pending payments queue (A04) with Verify / Reject, wired to `POST /admin/payments/:id/verify`. Badge count. 10-minute reminder cron. | Verify → the order becomes `confirmed` and the customer gets a push |
| T3.5 | Reject path + "Pay cash instead" fallback on C09. the `expireUnpaidOrders` BullMQ job restores stock after 60 min. | Rejecting a payment gives the customer a working way forward, and stock isn't lost |

> **Isolate all of this behind the `PaymentProvider` interface (TRD §6.1).** Phase 2 of the business will swap in Razorpay, and it must be a one-module change.

---

## PHASE 4 — Delivery app

| Task | Prompt summary | Done when |
|---|---|---|
| T4.1 | Staff management (A11): admin adds a delivery person by phone number, which sets `users.role = 'delivery'`. | The new number logs in and lands on D01, not C01 |
| T4.2 | Assign delivery (A03) via `POST /admin/orders/:id/assign`, with reassignment (the partial unique index enforces one active assignment). | The assigned delivery user gets a push and sees the order |
| T4.3 | D01 My deliveries + the **amount-to-collect banner** (design brief §4.3). Get this right: COD vs PAID must be unmistakable at a glance. | Show it to someone for 1 second and ask "how much cash?" — they must be right |
| T4.4 | D02 detail: item checklist, [Picked up] → [Delivered], one-tap Call and Navigate (Google Maps intent with the address pin). | Navigate opens Google Maps at the right pin |
| T4.5 | D03 collect payment: confirm cash amount, allow a different amount with a mandatory note, optional proof photo. Wired to `POST /delivery/orders/:id/collect-cod` with an `Idempotency-Key`. | A COD delivery creates a `collected` payment row |
| T4.6 | ⭐ **Offline queue** (TRD §8): durable mutation queue; each queued mutation's uuid is sent as the `Idempotency-Key` header; drains in order on reconnect, "⏳ will sync" badge, never duplicates. | **Test: put the phone in airplane mode, tap Delivered, kill the app, reopen, restore network → the status syncs exactly once.** This is a release gate. |
| T4.7 | D04 end-of-day: deliveries done, cash in hand. Admin marks cash received. | The delivery boy's cash-in-hand resets to ₹0 when the owner confirms |

---

## PHASE 5 — ⭐ Voice ordering

**Do this phase in the stated order. Each step is independently testable — do not skip to the end.**

### T5.1 — Audio capture
> **Prompt:** "Implement the mic button on the customer home (C01) per design brief §3: 96 dp brass-ringed circle, breathing idle animation, and a listening overlay (C02) with a live amplitude waveform. Record with expo-audio at 16 kHz mono AAC, max 30 s, auto-stop after 2 s of silence. Handle mic permission denial with the copy in app-flow §2 — it must never dead-end. Upload to the `voice-notes` bucket."

**Done when:** you can record, see the waveform react to your voice, and find the file in Storage.

### T5.2 — Speech to text
> **Prompt:** "Create `POST /api/v1/voice/orders` (multipart, 20 MB limit, 45 s timeout, rate limited 30/hour/user) and `voice.service.ts`. Step 1 only: stream the audio to R2, send it to Sarvam AI Saarika with auto language detection across kn-IN/hi-IN/en-IN, and return the raw transcript. Implement the `SttProvider` interface from TRD §4.2 with a Google Cloud STT v2 (chirp) fallback that triggers on error or a 6-second timeout. Log transcript, provider, confidence and latency to `voice_sessions`."

**Done when:** speaking "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಮತ್ತು ಒಂದು ಲೀಟರ್ ಎಣ್ಣೆ" returns a correct Kannada transcript. **Test with 20 real utterances across all three languages, including code-mixed ("do kilo rice and ondu packet sugar"), before moving on.** Write them down; this is your regression suite.

### T5.3 — Transcript → structured items
> **Prompt:** "Extend `voice.service.ts`: after STT, load the voice catalogue (Redis, key `voice:catalogue`, TTL 300 s, built from `v_voice_catalogue` on a miss), call the Anthropic Messages API (`claude-sonnet-4-6`) through the `LlmProvider` interface with the system prompt in `docs/02-technical-requirements-document.md` §4.3 verbatim, and validate the response against the `VoiceOrderResult` Zod schema in §4.4 from `packages/shared`. Never trust the model's JSON without validation — if it fails, retry once, then fall back to pure fuzzy matching on the raw transcript."

**Done when:** the 20 test utterances produce correct `matched` / `ambiguous` / `unmatched` arrays. Measure it: **target ≥ 85% of items matched correctly.**

### T5.4 — Fuzzy fallback matching
> **Prompt:** "For every item the LLM returns as unmatched, call `catalogueRepository.searchVariants()` (TRD §4.5, raw pg_trgm query). If the top score is ≥ 0.5, promote it to `matched` with that confidence. If between 0.35 and 0.5, promote it to `ambiguous` with its top 4 candidates. Below 0.35, keep it unmatched and record the spoken words in `voice_sessions.unmatched_terms`."

**Done when:** "sabbu" finds Soap even when it isn't in the alias table yet.

### T5.5 — ⭐ The confirmation screen (C03)
> **Prompt:** "Build C03 exactly as specified in `docs/03-app-flow-document.md` §2 and `docs/04-ui-ux-design-brief.md` §4.2. Three sections: Found / Which one did you mean? / Not found. Every found item shows the `🎙 heard \"…\"` pill with the customer's own words — this is mandatory. Quantity steppers, remove, ambiguity choosers. A [🎤 Say more] button that appends to the list. A [Place order] button that is **the only way an order is created**. Out-of-stock items are flagged with an in-stock alternative from the same category. Add TTS read-back via expo-speech in the active language."

**Done when:** you can speak an order, see your own words next to what the system understood, fix one item, and place the order — all in under 60 seconds.

### T5.6 — The quality loop (A09)
> **Prompt:** "Build the admin Voice Quality screen: build `GET /admin/voice/unmatched` returning `voice_sessions.unmatched_terms` from the last 30 days grouped by term with counts, and the screen that consumes it. Each row has [Search product] → [Add as alias]. Adding writes to `product_aliases` with `source = 'learned'` and **busts the `voice:catalogue` Redis key** so the next order sees it immediately."

**Done when:** an unmatched word can be turned into a working alias in two taps, and the next voice order finds it.

---

## PHASE 6 — Invoices & reports

| Task | Done when |
|---|---|
| T6.1 | The `generateInvoice` BullMQ job renders a PDF (`@react-pdf/renderer`, server-side) with the shop header, customer, line items with snapshot prices, totals, and payment status; uploads it to the private `invoices/` R2 prefix; enqueued on `delivered`. `GET /invoices/:id/pdf` returns a 5-minute presigned URL. | A delivered order produces a correct PDF within 10 s |
| T6.2 | Invoice number is financial-year aware (`KSS/2026-27/0042`) and gapless. | Sequential across 50 orders, no duplicates |
| T6.3 | Customer invoice list (C13) + download + WhatsApp share. | Sharing opens WhatsApp with the PDF attached |
| T6.4 | Admin daily summary (A12): orders, revenue, cash vs UPI, top items, out-of-stock events. | The numbers reconcile against the DB by hand |
| T6.5 | Date-range report + CSV export. | Exported CSV opens in Excel with correct totals |
| T6.6 | Optional GST fields (settings toggle → CGST/SGST split on the invoice). | Toggling GST on changes the invoice layout correctly |

---

## PHASE 7 — Hardening

- [ ] **Every string localised.** Grep the codebase for quoted English text in JSX. Zero results.
- [ ] **Kannada-first pass:** open every screen in Kannada and fix every clipped button and overflowing label. Then Hindi. English last.
- [ ] All five states (loading / empty / error / offline / success) on **every** screen — design brief §7.
- [ ] Sentry wired, with the user's role as a tag.
- [ ] Test on a real low-end Android phone. Cold start ≤ 3 s.
- [ ] Font scaling at 130% — no clipping.
- [ ] Bundle secret scan: `grep -rE "sk-|api_key|SECRET" apps/mobile/dist/` → zero results. The app should hold no secret at all now. **Release gate.**
- [ ] Rate limits live and tested: voice 30/h/user, OTP 5/h/phone, global 100/min/IP. The voice endpoint costs real money per call.
- [ ] The **authz suite (T0.6)** passes against the production configuration. **Release gate.**
- [ ] `prisma migrate diff` reports zero drift between `schema.prisma` and the migrations.
- [ ] Pino redaction verified: no JWT, OTP, full phone number or UTR appears in any log line.
- [ ] Two API instances behind a load balancer; kill one and confirm Socket.IO still works (Redis adapter).
- [ ] **A Postgres restore from backup has actually been performed once.** An untested backup is not a backup.
- [ ] Privacy policy page (required by both stores, and required because you record audio).

---

## PHASE 8 — Data load & pilot

1. **Catalogue** — 300 products × (3 names + 4 aliases + price + stock + image). Do this in a spreadsheet with the owner and someone who speaks Kannada natively. **Budget 3–5 days of real human time.** Import via T1.5.
2. **Native Kannada copy review** — every string in `locales/kn.json` read and corrected by a native speaker. Machine-translated Kannada will lose you exactly the customers this app exists for.
3. **Pilot with 10 regular customers** for two weeks. Instrument: voice accuracy, orders completed, where people drop off.
4. **The metric that decides everything:** what % of voice orders were placed without the customer editing an item? If it's below 70%, the alias table needs more work — not the code.

---

## PHASE 9 — Launch

- [ ] Google Play: privacy policy, data safety form (declare **audio recording** and **location**), microphone permission justification, screenshots in Kannada and English.
- [ ] Apple App Store: same, plus `NSMicrophoneUsageDescription` and `NSLocationWhenInUseUsageDescription` strings written in plain language.
- [ ] EAS Build + EAS Update configured so the owner's bug reports can be fixed the same day without a store review.
- [ ] A printed QR code + poster **in the shop** — this, not digital marketing, is how the first 100 customers will install it.

---

## 2. Risk register for the build

| Risk | Watch for | Response |
|---|---|---|
| Voice accuracy stalls below 85% | Phase 5 test suite | It is almost always the alias table, not the model. Add aliases before touching prompts. |
| The catalogue never gets entered | Phase 8 slipping | Start it in week 1, in parallel. Treat it as a hard dependency, not a chore. |
| The agent invents tables/columns not in the schema doc | `prisma migrate diff` in CI | Reject any drift from `docs/05`. |
| **A repository method forgets to scope by actor** | Code review + the authz suite | This is now the top security risk in the project. RLS is not there to save you. Every PR that touches `repositories/` gets read line by line. |
| Manual UPI verification annoys the owner | Pilot feedback | If he's verifying more than ~15/day, move Razorpay up the roadmap. |
| Delivery boy's app loses a delivery | Any single occurrence | T4.6 is a release gate for a reason. Do not ship without the airplane-mode test passing. |
| Scope creep (khata/credit, subscriptions, tracking map) | "Can we just also…" | Write it on the v1.1 list. Ship v1. |

---

## 3. What to build next (v1.1 shortlist, in priority order)
1. **Monthly khata / credit balance** — the single most-requested feature in Indian kirana, and the shop probably already runs one informally.
2. **Repeat / subscription orders** — "my usual monthly list", one tap.
3. **Razorpay UPI** for automatic payment reconciliation.
4. **Live delivery tracking on a map** for the customer.
5. **WhatsApp order notifications** (many customers won't enable push).
6. **Barcode scanning** for admin stock-in.
