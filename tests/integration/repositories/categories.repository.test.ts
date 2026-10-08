import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeCategory, repositories } from '../helpers/factories.js';

describe('CategoryRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  it('creates a category and reads it back', async () => {
    const created = await makeCategory(repos);
    expect(created.id).toBeTruthy();
    expect(created.slug).toBeTruthy();
    expect(created.name).toBe('A Category');
  });

  it('finds a category by slug', async () => {
    const created = await makeCategory(repos, { slug: 'racing' });
    const found = await repos.categories.findBySlug('racing');
    expect(found).toMatchObject({ id: created.id, name: 'A Category' });
  });

  it('finds a category by id', async () => {
    const created = await makeCategory(repos);
    const found = await repos.categories.findById(created.id);
    expect(found?.id).toBe(created.id);
  });

  it('returns null for an unknown slug', async () => {
    expect(await repos.categories.findBySlug('nope')).toBeNull();
  });

  it('lists all categories ordered by name', async () => {
    await makeCategory(repos, { name: 'Zulu' });
    await makeCategory(repos, { name: 'Alpha' });
    await makeCategory(repos, { name: 'Mike' });
    const all = await repos.categories.findAll();
    expect(all.map((c) => c.name)).toEqual(['Alpha', 'Mike', 'Zulu']);
  });

  it('enforces unique slugs at the database level', async () => {
    const slug = 'duplicate-slug';
    await makeCategory(repos, { slug });
    await expect(makeCategory(repos, { slug })).rejects.toMatchObject({ cause: { code: '23505' } });
  });
});
