import { beforeEach, describe, expect, it } from 'vitest';

import { makeUser, repositories } from '../helpers/factories.js';
import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';

describe('UserRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  it('creates a user and reads it back', async () => {
    const user = await makeUser(repos, { email: 'alice@bytemarket.dev' });
    expect(user.id).toBeTruthy();
    expect(user.email).toBe('alice@bytemarket.dev');
    expect(user.role).toBe('CUSTOMER');
  });

  it('creates an admin user', async () => {
    const admin = await makeUser(repos, { email: 'admin@bytemarket.dev', role: 'ADMIN' });
    expect(admin.role).toBe('ADMIN');
  });

  it('finds a user by email case-insensitively (citext)', async () => {
    await makeUser(repos, { email: 'Name@bytemarket.dev' });
    const found = await repos.users.findByEmail('name@BYTEMARKET.DEV');
    expect(found?.email).toBe('Name@bytemarket.dev');
  });

  it('finds by id and returns null for unknowns', async () => {
    const user = await makeUser(repos);
    expect((await repos.users.findById(user.id))?.id).toBe(user.id);
    expect(await repos.users.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('enforces unique email at the database level', async () => {
    const email = 'dup@bytemarket.dev';
    await makeUser(repos, { email });
    await expect(makeUser(repos, { email })).rejects.toMatchObject({ cause: { code: '23505' } });
  });
});
