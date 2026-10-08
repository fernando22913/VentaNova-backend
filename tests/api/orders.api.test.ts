import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import { isLuhnValid } from '../../src/infrastructure/payment/simulated-payment.gateway.js';
import {
  getTestDatabase,
  resetDatabase,
  TEST_DATABASE_URL,
} from '../integration/helpers/test-db.js';
import { makeCategory, makeProduct, repositories } from '../integration/helpers/factories.js';
import type { Database } from '../../src/infrastructure/persistence/db.js';

const APPROVED_CARD = '4242424242424242';
const DECLINED_CARD = validLuhnEndingWith('0000');

function validLuhnEndingWith(ending: string): string {
  for (let i = 0; i < 100_000; i += 1) {
    const candidate = `4${String(i).padStart(15, '0')}`;
    if (candidate.endsWith(ending) && isLuhnValid(candidate)) return candidate;
  }
  throw new Error(`Could not build a Luhn-valid number ending with ${ending}`);
}

interface AuthBody {
  user: { id: string };
  access_token: string;
}

interface OrderBody {
  id: string;
  status: string;
  totalCents: number;
  items: { titleSnapshot: string; unitPriceCents: number; quantity: number }[];
}

interface PayBody {
  order: { status: string };
  entitlements: { productId: string; licenseKey: string }[];
}

interface LibraryBody {
  items: { licenseKey: string; product: { slug: string; assetUrl: string } }[];
}

interface ApiErrorBody {
  error: { code: string; message: string };
}

const as = <T>(body: unknown) => body as T;

describe('Commerce API (contract): order → payment → entitlement → library', () => {
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

  async function seedProduct() {
    const repos = repositories(db);
    const category = await makeCategory(repos, { slug: 'games', name: 'Games' });
    const product = await makeProduct(repos, category.id, {
      slug: 'buy-me',
      title: 'Buy Me',
      priceCents: 2999,
    });
    return { repos, product };
  }

  async function register(prefix: string): Promise<AuthBody> {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `${prefix}@test.dev`, name: 'Test', password: 'password123' });
    return as<AuthBody>(response.body);
  }

  const cardBody = (cardNumber: string) => ({
    cardName: 'Test User',
    cardNumber,
    expiry: '12/30',
    cvc: '123',
  });

  async function createOrder(token: string, productId: string, quantity: number) {
    return request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId, quantity }] });
  }

  it('creates an order, pays with an approved card, grants an entitlement and exposes it in the library', async () => {
    const { product } = await seedProduct();
    const auth = await register('happy');

    const create = await createOrder(auth.access_token, product.id, 2);
    expect(create.status).toBe(201);
    const order = as<OrderBody>(create.body);
    expect(order).toMatchObject({ status: 'PENDING', totalCents: 5998 }); // 2999×2, recomputed
    expect(order.items[0]).toMatchObject({
      titleSnapshot: 'Buy Me',
      unitPriceCents: 2999,
      quantity: 2,
    });

    const pay = await request(app)
      .post(`/api/v1/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody(APPROVED_CARD));

    expect(pay.status).toBe(200);
    const payBody = as<PayBody>(pay.body);
    expect(payBody.order.status).toBe('PAID');
    expect(payBody.entitlements).toHaveLength(1);
    expect(payBody.entitlements[0]?.productId).toBe(product.id);
    expect(payBody.entitlements[0]?.licenseKey).toMatch(/^BM-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);

    const library = await request(app)
      .get('/api/v1/library')
      .set('Authorization', `Bearer ${auth.access_token}`);
    expect(library.status).toBe(200);
    const libraryBody = as<LibraryBody>(library.body);
    expect(libraryBody.items).toHaveLength(1);
    expect(libraryBody.items[0]?.product.slug).toBe('buy-me');
    expect(libraryBody.items[0]?.licenseKey).toBe(payBody.entitlements[0]?.licenseKey);
    expect(libraryBody.items[0]?.product.assetUrl).toContain('buy-me');

    const orders = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${auth.access_token}`);
    const ordersBody = as<{ items: OrderBody[] }>(orders.body);
    expect(ordersBody.items).toHaveLength(1);
    expect(ordersBody.items[0]?.id).toBe(order.id);
  });

  it('declines a Luhn-valid card ending in 0000: order FAILED, no entitlement', async () => {
    const { product } = await seedProduct();
    const auth = await register('decline');

    const create = await createOrder(auth.access_token, product.id, 1);
    const orderId = as<OrderBody>(create.body).id;

    const pay = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody(DECLINED_CARD));

    expect(pay.status).toBe(200); // a decline is order data, not a transport error
    const payBody = as<PayBody>(pay.body);
    expect(payBody.order.status).toBe('FAILED');
    expect(payBody.entitlements).toEqual([]);

    const library = await request(app)
      .get('/api/v1/library')
      .set('Authorization', `Bearer ${auth.access_token}`);
    expect(as<LibraryBody>(library.body).items).toEqual([]);
  });

  it('rejects a card that fails Luhn with 422 at the boundary', async () => {
    const { product } = await seedProduct();
    const auth = await register('luhn');
    const create = await createOrder(auth.access_token, product.id, 1);
    const orderId = as<OrderBody>(create.body).id;

    const pay = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody('1234567890123456'));

    expect(pay.status).toBe(422);
    expect(as<ApiErrorBody>(pay.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('blocks buying a product the user already owns with 409', async () => {
    const { product } = await seedProduct();
    const auth = await register('owner');
    const create = await createOrder(auth.access_token, product.id, 1);
    const orderId = as<OrderBody>(create.body).id;
    await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody(APPROVED_CARD));

    const again = await createOrder(auth.access_token, product.id, 1);

    expect(again.status).toBe(409);
    expect(as<ApiErrorBody>(again.body).error.code).toBe('CONFLICT');
  });

  it('forbids paying or reading another user order with 403', async () => {
    const { product } = await seedProduct();
    const owner = await register('owner2');
    const intruder = await register('intruder');

    const create = await createOrder(owner.access_token, product.id, 1);
    const orderId = as<OrderBody>(create.body).id;

    const pay = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${intruder.access_token}`)
      .send(cardBody(APPROVED_CARD));
    expect(pay.status).toBe(403);

    const read = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${intruder.access_token}`);
    expect(read.status).toBe(403);
  });

  it('requires a bearer token on commerce endpoints', async () => {
    const orders = await request(app).get('/api/v1/orders');
    const library = await request(app).get('/api/v1/library');
    expect(orders.status).toBe(401);
    expect(library.status).toBe(401);
  });

  it('ignores client-supplied prices and totals — the server recomputes', async () => {
    const { product } = await seedProduct();
    const auth = await register('tamper');

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send({
        totalCents: 1,
        items: [{ productId: product.id, quantity: 1, unitPriceCents: 1, totalCents: 1 }],
      });

    const order = as<OrderBody>(response.body);
    expect(response.status).toBe(201);
    expect(order.totalCents).toBe(2999);
    expect(order.items[0]?.unitPriceCents).toBe(2999);
  });

  it('rejects a malformed order id with 422 instead of a database 500', async () => {
    const { product } = await seedProduct();
    const auth = await register('badid');
    const create = await createOrder(auth.access_token, product.id, 1);
    expect(create.status).toBe(201);

    const read = await request(app)
      .get('/api/v1/orders/not-a-uuid')
      .set('Authorization', `Bearer ${auth.access_token}`);
    expect(read.status).toBe(422);

    const pay = await request(app)
      .post('/api/v1/orders/not-a-uuid/pay')
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send(cardBody(APPROVED_CARD));
    expect(pay.status).toBe(422);
  });

  it('rejects an oversized basket with 422', async () => {
    const { product } = await seedProduct();
    const auth = await register('bulk');

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${auth.access_token}`)
      .send({
        items: Array.from({ length: 51 }, () => ({ productId: product.id, quantity: 1 })),
      });

    expect(response.status).toBe(422);
    expect(as<ApiErrorBody>(response.body).error.code).toBe('VALIDATION_ERROR');
  });
});
