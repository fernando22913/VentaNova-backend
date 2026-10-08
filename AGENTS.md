# AGENTS.md

VentaNova **backend** — Express/TypeScript + PostgreSQL (Drizzle ORM). This repository is
the API only; the Angular frontend is a separate repo/service. `README.md` is the prose
source of truth; this file only captures things easy to get wrong.

## Layout & commands

Single npm project at the repository root.

- `npm run dev` (:3000) · `npm run build` · `npm start` (`node dist/main.js`)
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:coverage` (V8, needs Postgres)
- Local DB: `npm run db:up` / `db:down` / `db:logs`, `npm run db:migrate`, `npm run db:seed`

Backend suites: `test:unit` (in-memory, no DB), `test:integration` and `test:api`
(supertest contract tests — **both need Postgres up**), or a single file:
`npx vitest run tests/unit/x.test.ts`. `npm test` runs all three, so it needs Postgres too.

Verification order (matches CI): `lint` -> `typecheck` -> `test` -> `build`.

## Hexagonal architecture

Dependency rule is enforced by convention, not tooling: `domain/` imports nothing,
`application/` imports only `domain/`, `infrastructure/` implements `domain` ports.
`src/container.ts` is the **only** composition root — wire new adapters/use cases there and
nowhere else.

ESM + `NodeNext`: **relative imports must end in `.js`** even in `.ts` files.
`verbatimModuleSyntax` is on and ESLint enforces `consistent-type-imports` — type-only
imports must use `import type`. Strict flags include `exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess`.

Env loading (`src/config/env.ts`): `.env` is read via `process.loadEnvFile` only when
`NODE_ENV=development`, relative to cwd — run backend scripts from the repository root. Zod
validates and the process `exit(1)`s on bad config. `drizzle.config.ts` also loads `.env`
itself. `ADMIN_EMAIL` / `ADMIN_PASSWORD` are optional for the API but required by the seed,
which throws if either is missing. Token lifetimes are `ACCESS_TOKEN_EXPIRES_IN` (default
`1h`) and `REFRESH_TOKEN_EXPIRES_IN` (default `7d`) — compact durations parsed by
`src/config/duration.ts`.

## Database

Schema: `src/infrastructure/persistence/schema.ts`. Migrations are **committed SQL** in
`drizzle/`, applied with `db:migrate` (runtime migrator used on deploy). Never use
`db:push`. To change schema: `npm run db:generate`, then **hand-review the generated SQL** —
drizzle-kit 0.31 omits `CREATE TYPE` for `pgEnum` when a table uses the third-arg callback
(indexes/checks), and the `citext` extension must be authored manually. The generated meta
journal stays the source of truth.

`db:seed` is idempotent and password-preserving: 4 categories, 23 products, and one ADMIN
created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. It fails fast if either is unset and never
overwrites an existing admin's password.

## Tests

- Vitest config sets `NODE_ENV=test`, which **disables rate limiting**; the rate-limit test
  builds enabled limiters from the exported option constants (`AUTH_RATE_LIMIT`,
  `ORDERS_CREATE_RATE_LIMIT`, `CATALOG_RATE_LIMIT`, …).
- Integration tests share one `bytemarket_test` DB, so `fileParallelism: false`. The helper
  (`tests/integration/helpers/test-db.ts`) auto-creates and migrates it from
  `TEST_DATABASE_URL`; requires Postgres up. `tests/api/` are supertest contract tests and
  the source of truth for request/response shapes.
- Unit tests run against in-memory fakes (`tests/unit/helpers/fakes.ts`), no DB/HTTP.
- Coverage is V8 via `test:coverage`; `vitest.config.ts` excludes the entrypoint and the
  one-shot CLI scripts (`main.ts`, `run-migrations.ts`, `seed.ts`) since no suite reaches them.

## Logging & observability

- Structured logging is Pino (`src/infrastructure/logging/logger.ts`): JSON in production,
  `pino-pretty` in development, `silent` under `NODE_ENV=test`. Runtime code logs through the
  `logger` — never `console.*`. Verbosity is `LOG_LEVEL`.
- Every request is correlated by `pino-http`: an inbound `x-request-id` is reused, otherwise a
  UUID is generated, echoed on the response and attached to logs/errors via `req.id`.
  Authorization/cookie headers are redacted. `compression()` is enabled in `app.ts`.

## Conventions & gotchas

- Prettier is repo-configured (singleQuote, printWidth 100, trailingComma all) but is **not**
  a CI gate.
- Boundary Zod schemas live in the route modules and are exported alongside `z.infer` types.
  Full-row Drizzle `select()`s are intentional where the domain mapper consumes every column;
  `entitlement`/aggregate queries already project only the needed columns.
- API is under `/api/v1`; errors use the envelope `{ error: { code, message } }`, validation
  failures are `422` with field `details`. Auth is a short-lived Bearer **access** JWT
  (`requireAuth`/`requireAdmin`) paired with an opaque, SHA-256-hashed, rotating **refresh**
  token stored in `refresh_tokens`; `POST /auth/refresh` rotates and `POST /auth/logout`
  revokes the family.
- Simulated payments: `4242 4242 4242 4242` approves; any Luhn-valid number ending in `0000`
  declines; card data is never persisted.

## Deploy (Render)

`render.yaml` is the Blueprint (web service + managed PostgreSQL). Build:
`npm ci --include=dev && npm run build`; release: `npm run db:migrate:prod && npm run
db:seed:prod`; start: `npm start`; health: `/api/v1/health`. `DATABASE_URL` is injected by
Render from the managed database; `JWT_SECRET` is generated; `ADMIN_EMAIL`/`ADMIN_PASSWORD`
are dashboard secrets. `PORT` is injected by Render — never set it.
