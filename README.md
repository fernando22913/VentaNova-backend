# VentaNova — Backend

Express 5 + TypeScript API for the VentaNova digital storefront, backed by PostgreSQL
via Drizzle ORM. Hexagonal architecture: `domain/` imports nothing, `application/` imports
only `domain/`, `infrastructure/` implements `domain` ports, and `src/container.ts` is the
single composition root.

## Requirements

- Node.js 24 LTS (`engines: >=24`)
- PostgreSQL 17 (local via Docker or a remote URL)

## Install dependencies

```bash
npm ci
```

## Local PostgreSQL

A compose file is included for local development. Copy the env template first, then start
the database:

```bash
cp .env.example .env
npm run db:up      # docker compose up -d
```

The compose variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`)
are read from `.env`; the app's `DATABASE_URL` must point at the same instance. `npm run
db:down` and `npm run db:logs` manage the container.

## Run locally

Apply migrations and seed, then start the dev server (`tsx watch`, listens on `PORT`):

```bash
npm run db:migrate
npm run db:seed     # requires ADMIN_EMAIL / ADMIN_PASSWORD in .env
npm run dev
```

Optional: populate the Tendencias view with demo paid orders — a demo customer
with 38 `PAID` orders spread across the last 30 days. It clears only that
customer's own orders, so it is safe to re-run:

```bash
npm run db:seed:sales
```

`.env` is loaded automatically only when `NODE_ENV=development` (via `process.loadEnvFile`).
Run all backend scripts from this repository root.

## Build

```bash
npm run build      # tsc -> dist/
npm start          # node dist/main.js (production)
```

## Tests

The runner is **vitest**. Suites have dedicated scripts:

```bash
npm run test:unit         # in-memory fakes, no DB/HTTP
npm run test:integration  # needs PostgreSQL (creates ventanova_test)
npm run test:api          # supertest contract tests, needs PostgreSQL
npm test                  # all three (also needs PostgreSQL)
```

A single file: `npx vitest run tests/unit/config/duration.test.ts`. Integration tests share
one `ventanova_test` database and auto-create/migrate it from `TEST_DATABASE_URL`.

Checks: `npm run lint` (ESLint), `npm run typecheck` (`tsc --noEmit`).

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` enables trust-proxy and strict config checks |
| `PORT` | no | `3000` | HTTP port (Render injects this in production) |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `CORS_ORIGIN` | **yes** | — | Allowed browser origin(s), comma-separated |
| `JWT_SECRET` | **yes** | — | Access-token signing secret, ≥16 chars |
| `ADMIN_EMAIL` | seed only | — | Initial admin email |
| `ADMIN_PASSWORD` | seed only | — | Initial admin password, ≥8 chars |
| `ACCESS_TOKEN_EXPIRES_IN` | no | `1h` | Access-token lifetime (`s`/`m`/`h`/`d`) |
| `REFRESH_TOKEN_EXPIRES_IN` | no | `7d` | Refresh-token lifetime (`s`/`m`/`h`/`d`) |
| `TEST_DATABASE_URL` | tests only | local fallback | Database used by integration tests |

A malformed or missing required variable makes the process exit at boot. In production a
placeholder `JWT_SECRET` is rejected.

## Public endpoints

### `GET /api/v1/trends`

Aggregated sales statistics derived **only** from `PAID` orders. Public and unauthenticated;
returns a coarse report — no customer, order, or item-level detail:

```json
{
  "totals": {
    "revenueCents": 44980,
    "paidOrders": 12,
    "unitsSold": 31,
    "averageOrderCents": 3748
  },
  "sales": [
    { "date": "2026-09-09", "revenueCents": 2999, "units": 2 }
  ],
  "bestSellers": [
    { "slug": "neo-tokyo-racer", "title": "Neo Tokyo Racer", "unitsSold": 8, "revenueCents": 31992 }
  ]
}
```

- `sales` is a contiguous 30-day series (UTC dates, oldest first); days with no sales are `0`.
- `bestSellers` is the top 5 products by units sold.
- With no paid orders the response is zeroed (`totals` all `0`, `sales` full of zeros,
  `bestSellers` empty) — the frontend shows an "insufficient data" state.
- Rate-limited 300/15 min per IP.

### `POST /api/v1/contact`

Public contact form submission. The message is **validated and persisted** to the
`contact_messages` table — there is **no email delivery integration**, so nothing is emailed
and the success response only confirms the message was received and stored.

Body (`application/json`):

| Field | Type | Rules |
|---|---|---|
| `name` | string | trimmed, required, ≤ 80 chars |
| `email` | string | required, valid email, ≤ 254 chars |
| `subject` | string | trimmed, required, ≤ 120 chars |
| `message` | string | trimmed, required, ≤ 2000 chars |

Responses:

- **201** — persisted message: `{ id, name, subject, message, createdAt }`.
- **400** — malformed JSON (`INVALID_JSON`).
- **422** — validation failure with `error.details[]` field messages.
- **429** — rate limited (10 / 15 min per IP).

The `contact_messages` table (database migration `drizzle/0002_freezing_viper.sql`) stores
`id`, `name`, `email` (citext), `subject`, `message`, `created_at`. No new environment
variables are required.

## Render deployment

`render.yaml` (repo root) is a Blueprint that provisions the web service **and** a managed
PostgreSQL database. This repository **is** the backend, so the service builds from the
repository root. Key settings:

- **Build command:** `npm ci --include=dev && npm run build` (dev deps are needed for `tsc`
  even though `NODE_ENV=production`).
- **Release command:** `npm run db:migrate:prod && npm run db:seed:prod` — compiled runners
  apply the committed SQL in `./drizzle` and seed idempotently before boot.
- **Start command:** `npm start` (`node dist/main.js`).
- **Health check:** `/api/v1/health`.

### How `DATABASE_URL` is provided by Render

`render.yaml` declares `DATABASE_URL` with `fromDatabase: { name: ventanova-db, property:
connectionString }`, so Render injects the managed PostgreSQL connection string at runtime.
Nothing in the code hardcodes a host or `localhost`.

### Secrets to configure in the Render dashboard

- `JWT_SECRET` — generated by Render (`generateValue: true`).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — entered as secrets (`sync: false`); the seed fails the
  release if either is missing, so no default admin is ever shipped.
- `CORS_ORIGIN` — set to the deployed frontend origin (e.g. `https://ventanova.netlify.app`).

`PORT` is injected by Render automatically — do not set it manually. Never commit real
secrets; only `.env.example` (placeholders) is versioned.
