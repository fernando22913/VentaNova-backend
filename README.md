# VentaNova — Backend

API REST para la tienda digital VentaNova. Stack: **Express 5 + TypeScript + PostgreSQL
(Drizzle ORM)**. Autenticación con **JWT de acceso** de vida corta + **refresh token** opaco y
rotatorio. Arquitectura hexagonal: `domain/` → `application/` → `infrastructure/`, con
`src/container.ts` como único composition root.

## Requisitos

- Node.js 24+
- PostgreSQL 17 (local con Docker, o una URL remota)

## Levantar todo (rápido)

```bash
npm ci
cp .env.example .env      # edita ADMIN_EMAIL / ADMIN_PASSWORD y JWT_SECRET

npm run db:up             # levanta PostgreSQL (docker compose)
npm run db:migrate        # aplica las migraciones de ./drizzle
npm run db:seed           # 4 categorías, 23 productos y el admin inicial
npm run dev               # API en http://localhost:3000
```

Health check: `GET http://localhost:3000/api/v1/health`.

Opcional — datos de demo para la vista Tendencias (un cliente con 38 pedidos `PAID`):

```bash
npm run db:seed:sales
```

### Credenciales del admin

Se crean a partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env` en el primer `db:seed`. El
seed es **idempotente y no sobreescribe** una contraseña existente. Para cambiarla: borra el
admin (`DELETE FROM users WHERE role='ADMIN';`) y vuelve a correr `npm run db:seed`.

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (:3000, `tsx watch`) |
| `npm run build` / `npm start` | Compila a `dist/` / arranca producción |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Todos los tests (necesita PostgreSQL) |
| `npm run test:unit` | Solo unitarios (sin base de datos) |
| `npm run db:up` / `db:down` / `db:logs` | Gestión del contenedor PostgreSQL |
| `npm run db:migrate` / `db:seed` / `db:seed:sales` | Migrar / sembrar / datos demo |

## Tests

Runner **vitest**. `test:unit` corre con fakes en memoria (sin DB/HTTP); `test:integration`
y `test:api` (supertest) necesitan PostgreSQL (crean y migran `ventanova_test`):

```bash
npm run test:unit          # sin base de datos
npm run test:integration   # requiere PostgreSQL
npm run test:api           # requiere PostgreSQL
npm test                   # los tres
```

Un solo archivo: `npx vitest run tests/unit/config/duration.test.ts`.

## Roles y permisos

| Rol | Cómo se crea | Puede |
|---|---|---|
| `CUSTOMER` | Registro (botón "Crear cuenta") | Comprar, ver sus pedidos y su biblioteca |
| `WORKER` | El admin lo crea desde el panel | Responder contactos, ver pedidos, gestionar catálogo |
| `ADMIN` | `db:seed` | Todo, incluida la gestión de cuentas |

Las rutas protegidas usan `requireAuth` + `requireRole(...)`; el backend revalida el rol en
cada request (los guards del frontend son solo UX).

## Endpoints (resumen)

- **Público:** `/health`, `/auth/*`, `/products`, `/categories`, `POST /contact`, `/trends`
- **Cliente (Bearer):** `/orders`, `/library`
- **Staff (ADMIN + WORKER):** `/admin/products`, `/admin/orders`, `/contacts` (bandeja) y
  `POST /contacts/:id/reply`
- **Solo ADMIN:** `/admin/users` (listar y crear cuentas)

Los contactos se **persisten**; no hay envío de email. La respuesta de un contacto se guarda
junto al mensaje y lo marca como `RESOLVED`.

## Variables de entorno

| Variable | Requerida | Por defecto | Uso |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` activa trust-proxy y chequeos estrictos |
| `PORT` | no | `3000` | Puerto HTTP (Render lo inyecta en producción) |
| `DATABASE_URL` | **sí** | — | Cadena de conexión a PostgreSQL |
| `CORS_ORIGIN` | **sí** | — | Origen(es) permitidos, separados por coma |
| `JWT_SECRET` | **sí** | — | Secreto de firma de los access tokens (≥16) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | solo seed | — | Credenciales del admin inicial |
| `ACCESS_TOKEN_EXPIRES_IN` | no | `1h` | Vida del access token (`s`/`m`/`h`/`d`) |
| `REFRESH_TOKEN_EXPIRES_IN` | no | `7d` | Vida del refresh token |
| `TEST_DATABASE_URL` | solo tests | fallback local | Base de datos de los tests de integración |

Una variable requerida ausente o mal formada hace que el proceso salga al arrancar. En
producción se rechaza un `JWT_SECRET` de ejemplo.

## Deploy (Render)

`render.yaml` es el Blueprint (web service + PostgreSQL gestionado).

- **Build:** `npm ci --include=dev && npm run build`
- **Release:** `npm run db:migrate:prod && npm run db:seed:prod`
- **Start:** `npm start` · **Health:** `/api/v1/health`

`DATABASE_URL` la inyecta Render desde la base gestionada; `JWT_SECRET` se genera. Configura
en el dashboard `ADMIN_EMAIL` / `ADMIN_PASSWORD` (secrets) y `CORS_ORIGIN` con el origen del
frontend desplegado. **No** definas `PORT`: lo inyecta Render.
