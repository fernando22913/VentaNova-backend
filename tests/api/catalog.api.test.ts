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

interface PagedBody<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

interface PublicProductBody {
  slug: string;
  categoryId: string;
  priceCents: number;
  assetUrl?: string;
  description?: string;
}

const as = <T>(body: unknown) => body as T;

describe('Catalog API (contract)', () => {
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

  async function seedCatalog() {
    const repos = repositories(db);
    const games = await makeCategory(repos, { slug: 'games', name: 'Games' });
    const software = await makeCategory(repos, { slug: 'software', name: 'Software' });
    await makeProduct(repos, games.id, {
      slug: 'neo-racer',
      title: 'Neo Racer',
      priceCents: 3999,
      platform: 'CROSS',
    });
    await makeProduct(repos, games.id, {
      slug: 'emberkeep',
      title: 'Emberkeep',
      priceCents: 2499,
      platform: 'WINDOWS',
    });
    await makeProduct(repos, software.id, {
      slug: 'dashpixel',
      title: 'Dashpixel',
      priceCents: 14999,
      platform: 'WEB',
    });
    await makeProduct(repos, games.id, {
      slug: 'hidden-draft',
      title: 'Hidden Draft',
      status: 'DRAFT',
    });
    return { games, software };
  }

  it('GET /categories → { items: [...] } of public categories', async () => {
    await seedCatalog();
    const response = await request(app).get('/api/v1/categories');

    const body = as<{ items: { slug: string; name: string }[] }>(response.body);
    expect(response.status).toBe(200);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'games', name: 'Games' }),
        expect.objectContaining({ slug: 'software', name: 'Software' }),
      ]),
    );
  });

  it('GET /products → paginated envelope that never leaks assetUrl', async () => {
    await seedCatalog();
    const response = await request(app).get('/api/v1/products');

    const body = as<PagedBody<PublicProductBody>>(response.body);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ page: 1, pageSize: 12, total: 3 });
    expect(body.items).toHaveLength(3);
    expect(body.items[0]).not.toHaveProperty('assetUrl');
    expect(body.items[0]).not.toHaveProperty('status');
    expect(body.items.every((p) => typeof p.categoryId === 'string')).toBe(true);
  });

  it('GET /products honors search, category, platform, price and sort', async () => {
    await seedCatalog();

    const search = await request(app).get('/api/v1/products').query({ search: 'dash' });
    const searchBody = as<PagedBody<PublicProductBody>>(search.body);
    expect(searchBody.total).toBe(1);
    expect(searchBody.items[0]?.slug).toBe('dashpixel');

    const byCategory = await request(app).get('/api/v1/products').query({ category: 'software' });
    expect(as<PagedBody<PublicProductBody>>(byCategory.body).items.map((p) => p.slug)).toEqual([
      'dashpixel',
    ]);

    const byPlatform = await request(app)
      .get('/api/v1/products')
      .query({ platform: 'WINDOWS', sort: 'price_asc' });
    expect(as<PagedBody<PublicProductBody>>(byPlatform.body).items.map((p) => p.slug)).toEqual([
      'emberkeep',
    ]);

    const byPrice = await request(app)
      .get('/api/v1/products')
      .query({ minPrice: 3000, maxPrice: 5000 });
    expect(as<PagedBody<PublicProductBody>>(byPrice.body).items.map((p) => p.slug)).toEqual([
      'neo-racer',
    ]);
  });

  it('GET /products paginates', async () => {
    await seedCatalog();
    const page1 = await request(app).get('/api/v1/products').query({ pageSize: 2, page: 1 });
    const page2 = await request(app).get('/api/v1/products').query({ pageSize: 2, page: 2 });

    const first = as<PagedBody<PublicProductBody>>(page1.body);
    const second = as<PagedBody<PublicProductBody>>(page2.body);
    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(first.total).toBe(3);
    expect(first.page).toBe(1);
    expect(second.page).toBe(2);
  });

  it('never lists DRAFT products publicly', async () => {
    await seedCatalog();
    const response = await request(app).get('/api/v1/products');
    expect(as<PagedBody<PublicProductBody>>(response.body).items.map((p) => p.slug)).not.toContain(
      'hidden-draft',
    );
  });

  it('GET /products?page=abc → 422 with field details', async () => {
    const response = await request(app).get('/api/v1/products').query({ page: 'abc' });
    const body = as<ApiErrorBody>(response.body);
    expect(response.status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.[0]).toMatchObject({ path: 'page' });
  });

  it('GET /products/:slug → detail without the gated assetUrl (paywall)', async () => {
    await seedCatalog();
    const response = await request(app).get('/api/v1/products/neo-racer');

    expect(response.status).toBe(200);
    const detail = as<PublicProductBody>(response.body);
    expect(detail.slug).toBe('neo-racer');
    expect(detail.description).toBe('A longer test description.');
    expect(detail.priceCents).toBe(3999);
    // The download URL is entitlement-scoped and must never be public.
    expect(detail).not.toHaveProperty('assetUrl');
  });

  it('GET /products/:slug → 404 for unknown or unpublished slugs', async () => {
    await seedCatalog();
    const unknown = await request(app).get('/api/v1/products/no-such-product');
    const draft = await request(app).get('/api/v1/products/hidden-draft');

    expect(unknown.status).toBe(404);
    expect(as<ApiErrorBody>(unknown.body).error.code).toBe('NOT_FOUND');
    expect(draft.status).toBe(404);
  });

  it('404 envelope on an unknown route', async () => {
    const response = await request(app).get('/api/v1/definitely-not-here');
    expect(response.status).toBe(404);
    const body = as<ApiErrorBody>(response.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBeTypeOf('string');
  });
});
