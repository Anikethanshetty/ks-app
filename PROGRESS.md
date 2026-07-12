# Build Progress — KSS Home Delivery App

Handoff notes for continuing the build (in Claude Code CLI or elsewhere).
Source of truth for the spec: `project-requirments/files/` (PRD, TRD, app-flow,
UI/UX brief, backend-schema, implementation-plan). Build order = implementation-plan.

## Done

| Task | What |
|---|---|
| T0.1 | API skeleton — Fastify 5, Zod type-provider, Pino (secret redaction), helmet, cors, Redis rate-limit, `AppError`→`{error:{code,message}}`, `/health`, `/ready`, Swagger `/docs`, `config/env.ts` (Zod, crashes on missing var). |
| T0.1b | Mobile scaffold — Expo SDK 52, expo-router v4, NativeWind (design-brief tokens), Anek (kn/hi) + IBM Plex Mono fonts, route groups `(auth)/(customer)/(delivery)/(admin)`, typed `src/lib/api.ts` (JWT + Zod parse + 401 refresh-once + `error.code`). |
| T0.2 | Prisma — 24 tables mirroring `05-backend-schema-document.md`, `Decimal(10,2)` money / `Decimal(10,3)` stock (no float), GIN trigram indexes, partial unique indexes, `v_voice_catalogue` view, `set_updated_at` trigger, sequences. Migrations clean from empty DB, no drift. `seed.ts` (13 categories, shop_settings, admin, 3 dev users). |
| T0.3 | Auth — OTP (bcrypt hash, Redis 5/h-phone + 20/h-IP, dev code `000000`), rotating JWTs (opaque refresh + sha256+pepper storage, family revoke on reuse), `authenticate`/`authorize` middleware, self-contained HS256 access token (15 min), `GET/PATCH /me`. |
| T0.4 | Order service — `placeOrder` (one txn: `FOR UPDATE OF v` sorted, server prices, price/name snapshots, stock decrement + `sale` movements, cart clear, voice link, Redis idempotency) + `updateStatus` (transition table, role gate, `client_mutation_id` idempotency, stock restore on cancel/return) + `cancel`. 6 Testcontainers properties pass incl. **last-unit concurrency release gate**. |
| T0.6 | Authz suite (`tests/authz/`) — 4 real clients via `app.inject`, all 11 TRD §9.2 assertions covered (11 pass, 4 `it.todo` for unbuilt endpoints: invoices, collect-cod, `/admin/*`, payment-proof — fill in as those endpoints land). Added the missing backward/skip-ahead transition check (D role-permitted status, invalid from current state → 400 `INVALID_TRANSITION`, distinct from the role-gate 403). Wired into CI (`.github/workflows/ci.yml`): typecheck + full API test suite (Testcontainers, incl. authz) as a required check on every PR/push to main. Release gate. |
| T0.5 | Role routing in app — `SessionProvider` (`src/lib/session.tsx`) bootstraps language + user (restores via SecureStore refresh → `/me` auto-refresh on cold-start 401), root-layout route guard (`app/_layout.tsx`) routes: no language → picker, signed-out → login, no `fullName` → onboarding, else role home. Real screens `(auth)/{language,login,otp,onboarding}` against the live API; shared `components/ui.tsx` + `LanguagePicker`. i18next kn/hi/en (`src/i18n/`, device-locale default) + first-launch picker persisted in AsyncStorage. Sign-out wired into the 3 role homes. **Verified**: `rtk tsc` clean, `expo export --platform ios` bundles the full graph clean. |
| T1.1 | Admin inventory list (A05) — `GET /admin/inventory?tab=all\|low_stock\|out_of_stock&page&pageSize`, raw-SQL repository (Prisma can't compare `stock` to `low_stock_threshold` columns directly) + tab counts, admin-only. `(admin)/index.tsx`: tabbed list via `useInfiniteQuery`, 15s poll standing in for realtime until the Socket.IO gateway lands (T2.6). Added `@tanstack/react-query` + `QueryClientProvider` to the mobile stack (first data screen). Dev-only 300-variant synthetic catalogue in `seed.ts` (guarded `NODE_ENV !== production`, real catalogue is Phase 8 via CSV import T1.5) — verified end-to-end with curl (300/20/10 across all/low/out tabs). New `/admin/*` authz tests fill in the T0.6 `it.todo`. **Not verified**: actual on-device/simulator render (only `expo export --platform web` bundle + typecheck) — no login flow driven in a browser/emulator this session. |

Backend Phase 0 complete. **Phase 0 done** (T0.1–T0.6), committed (`1ba72ee`). Phase 1: T1.1 done, uncommitted.

## Next

**Phase 1 — Catalogue + admin inventory** (`06-implementation-plan.md`): T1.2
(product add/edit + kn/hi/en names), T1.3 (⭐ alias editor), T1.4 (stock
adjust sheet), T1.5 (CSV import), T1.6 (customer catalogue + search). Then
Phase 2 (manual ordering), etc.

Left for T0.5 (needs a device/emulator, not blocking): drive the 3 dev numbers
(`+919000000010/20/30`, dev OTP `000000`) → 3 home screens and confirm force-quit
restores the session. Code path verified by typecheck + native bundle; not yet run
on a device here.

## Key decisions (don't undo without reason)

- **NativeWind pinned `4.0.36`** — 4.1.x's css-interop hardcodes
  `react-native-worklets/plugin` (reanimated 4), incompatible with SDK 52's
  reanimated 3.16. Reanimated babel plugin removed from `babel.config.js`; re-add
  (with worklets) in Phase 5 mic animations.
- **pnpm `nodeLinker: hoisted`** (pnpm-workspace.yaml + `.npmrc`) — Metro cannot
  resolve pnpm's default isolated symlinks. Consequence: run per-package binaries
  via `pnpm exec <bin>` (tests use `pnpm exec prisma migrate deploy`), not
  `node_modules/.bin/<bin>`.
- **COD placeOrder writes NO payment row** — the `collected` payment row is created
  at collect-cod (Phase 4); UPI payment row at submit (Phase 3). Matches phase docs;
  avoids abusing the payment_status enum.
- **Money**: integer paise on the wire, `Decimal` in DB. Prices always from
  `product_variants.selling_price` read inside the txn. Client sends only
  `variantId` + `quantity`.
- **Every new endpoint ships with a `tests/authz/` test.** Non-negotiable.

## Environment / how to run

- **pnpm** is user-local: `export PATH="$HOME/.npm-global/bin:$PATH"`.
- **Docker** required for dev + tests: `docker compose up -d` (Postgres 16 + Redis 7).
- Node 26 installed (spec says 22 LTS; works).
- API dev: copy `apps/api/.env.example` → `.env`, then
  `pnpm --filter api prisma migrate deploy && pnpm --filter api db:seed && pnpm --filter api dev`.
- API tests (Testcontainers, needs Docker): `pnpm --filter api test`.
- Mobile: `cp apps/mobile/.env.example apps/mobile/.env`, then `pnpm --filter mobile start`.
- Typecheck all: `pnpm -r typecheck`.
- Prisma's `migrate reset` is blocked by an AI-agent guard — use a fresh throwaway
  DB + `migrate deploy` to verify clean-from-empty instead.

## Gotchas

- `rtk <cmd>` wrapper (see `CLAUDE.md`) trims tool output; for full test output run
  the binary directly (e.g. `pnpm --filter api test`).
- `pkill -f "<pattern>"` can match the running shell → exit 144; target PIDs instead.
- Background API server: launch with `nohup node --import tsx src/index.ts &`.
- `pnpm --filter mobile lint` currently errors (`Cannot find module
  eslint-config-expo/flat`) — the flat config isn't resolving under the hoisted
  linker. Typecheck (`pnpm -r typecheck`) is the working gate meanwhile.
- Verify mobile bundles with `pnpm --filter mobile exec expo export --platform ios`
  (native path). `--platform web` fails on a nativewind `global.css` cache — web
  isn't a target; ignore it.
