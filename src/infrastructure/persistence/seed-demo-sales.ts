import { eq } from 'drizzle-orm';

import { env } from '../../config/env.js';
import { ArgonHasher } from '../auth/argon.hasher.js';
import { logger } from '../logging/logger.js';
import { createDb } from './db.js';
import { entitlements, orderItems, orders, products, users } from './schema.js';

// Seeder opcional de ventas demo: crea un cliente demo y órdenes PAID de los últimos 30 días; reejecutable, solo toca a ese cliente.

const DEMO_EMAIL = process.env.DEMO_SEED_EMAIL ?? 'cliente.demo@ventanova.dev';
const DEMO_NAME = 'Cliente Demo';
const DEMO_PASSWORD = 'demo12345';

const ORDER_COUNT = 38;
const SPREAD_DAYS = 30;
const DAY_MS = 86_400_000;

const { db, client } = createDb(env.DATABASE_URL);

// Usuario demo (buscar o crear)
const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
let userId = existing?.id;
if (!userId) {
  const passwordHash = await new ArgonHasher().hash(DEMO_PASSWORD);
  const [created] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: DEMO_NAME, passwordHash, role: 'CUSTOMER' })
    .returning();
  if (!created) throw new Error('[demo-seed] failed to create demo user');
  userId = created.id;
  logger.info({ email: DEMO_EMAIL }, 'Demo customer created');
} else {
  logger.info({ email: DEMO_EMAIL }, 'Demo customer already exists');
}

// Reinicia las ventas del propio cliente demo
await db.delete(entitlements).where(eq(entitlements.userId, userId));
await db.delete(orders).where(eq(orders.userId, userId));

// Regenera órdenes PAID repartidas por los últimos 30 días
const catalog = await db
  .select()
  .from(products)
  .where(eq(products.status, 'PUBLISHED'))
  .orderBy(products.slug);

if (catalog.length === 0) {
  throw new Error('[demo-seed] no published products — run `npm run db:seed` first');
}

const now = Date.now();
for (let i = 0; i < ORDER_COUNT; i += 1) {
  const product = catalog[i % catalog.length];
  if (!product) continue;

  const quantity = (i % 3) + 1;
  const totalCents = product.priceCents * quantity;
  const paidAt = new Date(now - (i % SPREAD_DAYS) * DAY_MS - (i % 5) * 3_600_000);

  const [order] = await db
    .insert(orders)
    .values({ userId, status: 'PAID', totalCents, createdAt: paidAt, paidAt })
    .returning();
  if (!order) throw new Error('[demo-seed] failed to create order');

  await db.insert(orderItems).values({
    orderId: order.id,
    productId: product.id,
    titleSnapshot: product.title,
    unitPriceCents: product.priceCents,
    quantity,
  });
}

logger.info(
  { orders: ORDER_COUNT, days: SPREAD_DAYS, products: catalog.length },
  'Demo sales seeded',
);

await client.end();
