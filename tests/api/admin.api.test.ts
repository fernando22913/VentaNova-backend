import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import { ArgonHasher } from '../../src/infrastructure/auth/argon.hasher.js';
import {
  getTestDatabase,
  resetDatabase,
  TEST_DATABASE_URL,
} from '../integration/helpers/test-db.js';
import {
  makeCategory,
  makeProduct,
  makeUser,
  repositories,
} from '../integration/helpers/factories.js';
import type { Database } from '../../src/infrastructure/persistence/db.js';

interface AuthBody {
  access_token: string;
}

interface ProductBody {
  id: string;
  slug: string;
  title: string;
  status: string;
  priceCents: number;
}

const as = <T>(body: unknown) => body as T;

describe('Admin API (contract)', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const { db: database } = await getTestDatabase();
    db = database;
    app = createApp(buildContainer({ databaseUrl: TEST_DATABASE_URL }));
  });

  beforeEach(async () => {
    const { client } = await getTestDatabase();
    await resetDatabase(client);

    const repos = repositories(db);
    const hasher = new ArgonHasher();
    await makeUser(repos, {
      email: 'admin@test.dev',
      name: 'Admin',
      role: 'ADMIN',
      passwordHash: await hasher.hash('password123'),
    });
    await makeUser(repos, {
      email: 'customer@test.dev',
      name: 'Customer',
      role: 'CUSTOMER',
      passwordHash: await hasher.hash('password123'),
    });

    adminToken = await login('admin@test.dev');
    customerToken = await login('customer@test.dev');
  });

  async function login(email: string): Promise<string> {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    return as<AuthBody>(response.body).access_token;
  }

  async function seedCategory() {
    return makeCategory(repositories(db), { slug: 'games', name: 'Games' });
  }

  it('rejects unauthenticated and non-admin callers (401/403)', async () => {
    const anon = await request(app).get('/api/v1/admin/products');
    expect(anon.status).toBe(401);

    const customer = await request(app)
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customer.status).toBe(403);
    expect(as<{ error: { code: string } }>(customer.body).error.code).toBe('FORBIDDEN');

    const customerWrite = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});
    expect(customerWrite.status).toBe(403);
  });

  it('creates a DRAFT product, publishes it, edits it and archives it', async () => {
    const category = await seedCategory();
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app).post('/api/v1/admin/products').set(auth).send({
      slug: 'admin-game',
      title: 'Admin Game',
      summary: 'Created by admin',
      description: 'A full description of the product.',
      type: 'GAME',
      platform: 'CROSS',
      categoryId: category.id,
      priceCents: 4550,
      coverImageUrl: null,
      assetUrl: 'https://cdn.example.com/admin-game.zip',
      status: 'DRAFT',
    });

    expect(created.status).toBe(201);
    const product = as<ProductBody>(created.body);
    expect(product).toMatchObject({ slug: 'admin-game', status: 'DRAFT', priceCents: 4550 });

    // Not visible publicly while DRAFT
    const publicDetail = await request(app).get('/api/v1/products/admin-game');
    expect(publicDetail.status).toBe(404);

    const published = await request(app)
      .patch(`/api/v1/admin/products/${product.id}/status`)
      .set(auth)
      .send({ status: 'PUBLISHED' });
    expect(published.status).toBe(200);
    expect(as<ProductBody>(published.body).status).toBe('PUBLISHED');

    const nowPublic = await request(app).get('/api/v1/products/admin-game');
    expect(nowPublic.status).toBe(200);

    const edited = await request(app)
      .patch(`/api/v1/admin/products/${product.id}`)
      .set(auth)
      .send({ title: 'Admin Game Deluxe', priceCents: 5999 });
    const editedBody = as<ProductBody>(edited.body);
    expect(editedBody.title).toBe('Admin Game Deluxe');
    expect(editedBody.priceCents).toBe(5999);

    const archived = await request(app)
      .patch(`/api/v1/admin/products/${product.id}/status`)
      .set(auth)
      .send({ status: 'ARCHIVED' });
    expect(as<ProductBody>(archived.body).status).toBe('ARCHIVED');
  });

  it('validates the create payload (422 with details)', async () => {
    const response = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'Not Kebab Case', title: '', priceCents: -5 });

    expect(response.status).toBe(422);
    expect(as<{ error: { code: string } }>(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate slug with 409', async () => {
    const category = await seedCategory();
    await makeProduct(repositories(db), category.id, { slug: 'taken-slug' });

    const response = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: 'taken-slug',
        title: 'T',
        summary: 'S',
        description: 'D',
        type: 'GAME',
        platform: 'CROSS',
        categoryId: category.id,
        priceCents: 100,
        coverImageUrl: null,
        assetUrl: 'https://cdn.example.com/x.zip',
        status: 'DRAFT',
      });

    expect(response.status).toBe(409);
  });

  it('lists every product status and all orders for admins', async () => {
    const category = await seedCategory();
    const repos = repositories(db);
    await makeProduct(repos, category.id, { slug: 'pub', status: 'PUBLISHED' });
    await makeProduct(repos, category.id, { slug: 'draft', status: 'DRAFT' });
    await makeProduct(repos, category.id, { slug: 'archived', status: 'ARCHIVED' });

    const all = await request(app)
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(as<{ total: number }>(all.body).total).toBe(3);

    const drafts = await request(app)
      .get('/api/v1/admin/products?status=DRAFT')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(as<{ items: ProductBody[] }>(drafts.body).items.map((p) => p.slug)).toEqual(['draft']);

    const orders = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(orders.status).toBe(200);
    expect(as<{ items: unknown[] }>(orders.body).items).toEqual([]);
  });
});
