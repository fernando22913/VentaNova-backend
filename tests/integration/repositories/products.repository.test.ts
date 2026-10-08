import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeCategory, makeProduct, repositories } from '../helpers/factories.js';

describe('ProductRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  it('creates a product and reads it back by id and slug', async () => {
    const category = await makeCategory(repos, { slug: 'games' });
    const product = await makeProduct(repos, category.id, {
      slug: 'neo-racer',
      title: 'Neo Racer',
    });
    const byId = await repos.products.findById(product.id);
    const bySlug = await repos.products.findBySlug('neo-racer');
    expect(byId).toMatchObject({
      title: 'Neo Racer',
      type: 'GAME',
      priceCents: 1999,
      status: 'PUBLISHED',
    });
    expect(bySlug?.id).toBe(product.id);
  });

  it('rejects negative prices via the DB check constraint', async () => {
    const category = await makeCategory(repos);
    await expect(makeProduct(repos, category.id, { priceCents: -100 })).rejects.toMatchObject({
      cause: { code: '23514' },
    });
  });

  it('returns null for an unknown slug', async () => {
    expect(await repos.products.findBySlug('missing')).toBeNull();
  });

  describe('search', () => {
    async function seedThree() {
      const games = await makeCategory(repos, { slug: 'games', name: 'Games' });
      const software = await makeCategory(repos, { slug: 'software', name: 'Software' });
      const racer = await makeProduct(repos, games.id, {
        slug: 'neo-racer',
        title: 'Neo Racer',
        status: 'PUBLISHED',
        priceCents: 3999,
        platform: 'CROSS',
        type: 'GAME',
      });
      const ember = await makeProduct(repos, games.id, {
        slug: 'emberkeep',
        title: 'Emberkeep Legacy',
        status: 'PUBLISHED',
        priceCents: 2499,
        platform: 'WINDOWS',
        type: 'GAME',
      });
      const os1 = await makeProduct(repos, software.id, {
        slug: 'os3',
        title: 'Operating System 3',
        status: 'PUBLISHED',
        priceCents: 9999,
        platform: 'LINUX',
        type: 'SOFTWARE',
      });
      const draft = await makeProduct(repos, software.id, {
        slug: 'draft-thing',
        title: 'Draft Thing',
        status: 'DRAFT',
        priceCents: 100,
        platform: 'WEB',
        type: 'SOFTWARE',
      });
      return { racer, ember, os1, draft, games, software };
    }

    it('only returns PUBLISHED products by default', async () => {
      const { draft } = await seedThree();
      const result = await repos.products.search({
        status: 'PUBLISHED',
        sort: 'title',
        page: 1,
        pageSize: 10,
      });
      expect(result.total).toBe(3);
      expect(result.items.map((p) => p.id)).not.toContain(draft.id);
    });

    it('paginates and reports the full total', async () => {
      await seedThree();
      const page1 = await repos.products.search({
        status: 'PUBLISHED',
        sort: 'title',
        page: 1,
        pageSize: 2,
      });
      const page2 = await repos.products.search({
        status: 'PUBLISHED',
        sort: 'title',
        page: 2,
        pageSize: 2,
      });
      expect(page1.total).toBe(3);
      expect(page1.items.length).toBe(2);
      expect(page2.items.length).toBe(1);
      const ids = new Set([...page1.items, ...page2.items].map((p) => p.id));
      expect(ids.size).toBe(3);
    });

    it('searches by title/summary substring (ILIKE)', async () => {
      await seedThree();
      const result = await repos.products.search({
        search: 'racer',
        status: 'PUBLISHED',
        sort: 'newest',
        page: 1,
        pageSize: 10,
      });
      expect(result.total).toBe(1);
      expect(result.items[0]?.slug).toBe('neo-racer');
    });

    it('filters by category', async () => {
      const { software } = await seedThree();
      const result = await repos.products.search({
        categoryId: software.id,
        status: 'PUBLISHED',
        sort: 'newest',
        page: 1,
        pageSize: 10,
      });
      expect(result.total).toBe(1);
      expect(result.items[0]?.slug).toBe('os3');
    });

    it('filters by platform', async () => {
      await seedThree();
      const result = await repos.products.search({
        platform: 'WINDOWS',
        status: 'PUBLISHED',
        sort: 'newest',
        page: 1,
        pageSize: 10,
      });
      expect(result.items.map((p) => p.slug)).toEqual(['emberkeep']);
    });

    it('filters within a price range', async () => {
      await seedThree();
      const result = await repos.products.search({
        minPriceCents: 3000,
        maxPriceCents: 5000,
        status: 'PUBLISHED',
        sort: 'newest',
        page: 1,
        pageSize: 10,
      });
      expect(result.items.map((p) => p.slug)).toEqual(['neo-racer']);
    });

    it('sorts by price ascending', async () => {
      await seedThree();
      const result = await repos.products.search({
        status: 'PUBLISHED',
        sort: 'price_asc',
        page: 1,
        pageSize: 10,
      });
      expect(result.items.map((p) => p.priceCents)).toEqual([2499, 3999, 9999]);
    });

    it('sorts by title', async () => {
      await seedThree();
      const result = await repos.products.search({
        status: 'PUBLISHED',
        sort: 'title',
        page: 1,
        pageSize: 10,
      });
      expect(result.items.map((p) => p.slug)).toEqual(['emberkeep', 'neo-racer', 'os3']);
    });
  });

  it('lists drafts when asked (admin)', async () => {
    const category = await makeCategory(repos);
    await makeProduct(repos, category.id, { slug: 'draft-1', status: 'DRAFT' });
    const result = await repos.products.search({
      status: 'DRAFT',
      sort: 'newest',
      page: 1,
      pageSize: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.slug).toBe('draft-1');
  });

  it('updates editable fields and bumps updatedAt', async () => {
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id, { priceCents: 1999 });
    const before = product.updatedAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await repos.products.update(product.id, {
      priceCents: 2999,
      title: 'Neo Racer Deluxe',
      coverImageUrl: null,
    });
    expect(updated?.priceCents).toBe(2999);
    expect(updated?.title).toBe('Neo Racer Deluxe');
    expect(updated?.coverImageUrl).toBeNull();
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before);
  });

  it('returns null when updating an unknown product', async () => {
    expect(
      await repos.products.update('00000000-0000-0000-0000-000000000000', { title: 'x' }),
    ).toBeNull();
  });

  it('updates status (publish/archive is a soft transition)', async () => {
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id, { slug: 'soft-delete', status: 'DRAFT' });

    const published = await repos.products.updateStatus(product.id, 'PUBLISHED');
    expect(published?.status).toBe('PUBLISHED');

    const archived = await repos.products.updateStatus(product.id, 'ARCHIVED');
    expect(archived?.status).toBe('ARCHIVED');
    // Soft delete: the row is still addressable by slug, but never listed.
    expect((await repos.products.findBySlug('soft-delete'))?.status).toBe('ARCHIVED');
    const catalog = await repos.products.search({
      status: 'PUBLISHED',
      sort: 'newest',
      page: 1,
      pageSize: 10,
    });
    expect(catalog.items.map((p) => p.slug)).not.toContain('soft-delete');
  });

  it('enforces unique slugs at the database level', async () => {
    const category = await makeCategory(repos);
    await makeProduct(repos, category.id, { slug: 'same-slug' });
    await expect(makeProduct(repos, category.id, { slug: 'same-slug' })).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });
});
