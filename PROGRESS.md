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
| T0.6 | Authz suite (`tests/authz/`) — 4 real clients via `app.inject`, TRD §9.2 assertions (10 pass, 4 `it.todo` for unbuilt endpoints). Release gate. |

Backend Phase 0 complete except T0.5 (needs mobile). Git: initial commit `a5a3fd8`.

## Next

**T0.5 — Role routing in the app** (`06-implementation-plan.md`): build `(auth)/login`,
`(auth)/otp`, `(auth)/onboarding` against the real API; refresh token in
`expo-secure-store`, access token in memory (already wired in `src/lib/tokens.ts`);
root layout gate routes to `(customer)/(delivery)/(admin)` by role from `/me`;
i18next kn/hi/en + language picker on first launch.
Done when: 3 test numbers → 3 home screens, session survives force-quit.

Then Phase 1 (catalogue + admin inventory), Phase 2 (manual ordering), etc.

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
