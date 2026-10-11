import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import {
  getTestDatabase,
  resetDatabase,
  TEST_DATABASE_URL,
} from '../integration/helpers/test-db.js';
import { makeCategory, makeProduct, repositories } from '../integration/helpers/factories.js';
import type { Database } from '../../src/infrastructure/persistence/db.js';

const APPROVED_CARD = '4242424242424242';

const as = <T>(body: unknown) => body as T;

interface AuthBody {
  access_token: string;
}

interface OrderBody {
  id: string;
}

interface TrendPoint {
  date: string;
  revenueCents: number;
  units: number;
}

interface TrendBody {
  totals: { revenueCents: number; paidOrders: number; unitsSold: number; averageOrderCents: number };
  sales: TrendPoint[];
  bestSellers: { slug: string; title: string; unitsSold: number; revenueCents: number }[];
}

const cardBody = () => ({
  cardName: 'Test User',
  cardNumber: APPROVED_CARD,
  expiry: '12/30',
  cvc: '123',
});

describe('Trends API (contract)', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const { db: database } = await getTestDatabase();
    db = database;
    app = createApp(buildContainer({ databaseUrl: TEST_DATABASE_URL }));
  });

  beforeEach(async () => {
    const { client } = await getTestDatabase();
    await resetDatabase(client);
  });

  async function register(prefix: string): Promise<AuthBody> {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `${prefix}@test.dev`, name: 'Test', password: 'password123' });
    return as<AuthBody>(response.body);
  }

  async function seedPublishedProduct(priceCents: number, slug: string) {
    const repos = repositories(db);
    const category = await makeCategory(repos, { slug: 'games', name: 'Games' });
    return makeProduct(repos, category.id, { slug, title: 'Trend Game', priceCents });
  }

  it('is public and returns a zeroed report on an empty database', async () => {
    const response = await request(app).get('/api/v1/trends');

    expect(response.status).toBe(200);
    const body = as<TrendBody>(response.body);
    expect(body.totals).toEqual({
      revenueCents: 0,
      paidOrders: 0,
      unitsSold: 0,
      averageOrderCents: 0,
    });
    expect(body.sales).toHaveLength(30);
    expect(body.bestSellers).toEqual([]);
  });

  it('aggregates a paid order into totals and best sellers without auth', async () => {
    const product = await seedPublishedProduct(2500, 'trend-game');
    const auth = await register('trend');

    const create = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send({ items: [{ productId: product.id, quantity: 2 }] });
    const order = as<OrderBody>(create.body);

    const pay = await request(app)
      .post(`/api/v1/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody());
    expect(pay.status).toBe(200);

    const response = await request(app).get('/api/v1/trends');
    expect(response.status).toBe(200);
    const body = as<TrendBody>(response.body);

    expect(body.totals).toEqual({
      revenueCents: 5000,
      paidOrders: 1,
      unitsSold: 2,
      averageOrderCents: 5000,
    });

    expect(body.bestSellers).toHaveLength(1);
    expect(body.bestSellers[0]).toMatchObject({
      slug: 'trend-game',
      title: 'Trend Game',
      unitsSold: 2,
      revenueCents: 5000,
    });
  });

  it('never leaks failed or pending orders into the report', async () => {
    const product = await seedPublishedProduct(1000, 'failed-game');
    const auth = await register('trend2');

    // El pedido aprobado se incluye.
    const good = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    await request(app)
      .post(`/api/v1/orders/${as<OrderBody>(good.body).id}/pay`)
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody());

    // El pedido pendiente se excluye.
    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send({ items: [{ productId: product.id, quantity: 5 }] });

    const body = as<TrendBody>((await request(app).get('/api/v1/trends')).body);
    expect(body.totals.paidOrders).toBe(1);
    expect(body.totals.revenueCents).toBe(1000);
    expect(body.totals.unitsSold).toBe(1);
  });

  it('exposes only aggregate statistics — no user or order identifiers', async () => {
    const product = await seedPublishedProduct(1000, 'shape-game');
    const auth = await register('trend3');
    const create = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    await request(app)
      .post(`/api/v1/orders/${as<OrderBody>(create.body).id}/pay`)
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody());

    const response = await request(app).get('/api/v1/trends');
    const body = as<TrendBody>(response.body);
    const keys = Object.keys(body).sort();
    expect(keys).toEqual(['bestSellers', 'sales', 'totals']);

    expect(Object.keys(body.totals).sort()).toEqual([
      'averageOrderCents',
      'paidOrders',
      'revenueCents',
      'unitsSold',
    ]);
    expect(Object.keys(body.bestSellers[0]!).sort()).toEqual([
      'revenueCents',
      'slug',
      'title',
      'unitsSold',
    ]);
  });
});