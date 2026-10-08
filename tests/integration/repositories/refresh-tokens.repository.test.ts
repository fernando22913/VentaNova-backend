import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeRefreshToken, makeUser, repositories } from '../helpers/factories.js';

describe('RefreshTokenRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  it('creates a token and finds it back by hash', async () => {
    const user = await makeUser(repos);
    const created = await makeRefreshToken(repos, user.id, { tokenHash: 'hash-abc' });

    expect(created.revokedAt).toBeNull();
    const found = await repos.refreshTokens.findByHash('hash-abc');
    expect(found).toMatchObject({ id: created.id, userId: user.id, tokenHash: 'hash-abc' });
  });

  it('enforces unique token hashes at the database level', async () => {
    const user = await makeUser(repos);
    await makeRefreshToken(repos, user.id, { tokenHash: 'hash-dup' });
    await expect(
      makeRefreshToken(repos, user.id, { tokenHash: 'hash-dup' }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('revokes with compare-and-set semantics', async () => {
    const user = await makeUser(repos);
    const token = await makeRefreshToken(repos, user.id);
    const at = new Date();

    expect(await repos.refreshTokens.revoke(token.id, at)).toBe(true);
    expect(await repos.refreshTokens.revoke(token.id, at)).toBe(false);
    expect((await repos.refreshTokens.findByHash(token.tokenHash))?.revokedAt).not.toBeNull();
  });

  it('revokes a whole family but leaves other families untouched', async () => {
    const user = await makeUser(repos);
    const family = randomUUID();
    const first = await makeRefreshToken(repos, user.id, { familyId: family });
    const second = await makeRefreshToken(repos, user.id, { familyId: family });
    const unrelated = await makeRefreshToken(repos, user.id, { familyId: randomUUID() });

    const revoked = await repos.refreshTokens.revokeFamily(family, new Date());

    expect(revoked).toBe(2);
    expect((await repos.refreshTokens.findByHash(first.tokenHash))?.revokedAt).not.toBeNull();
    expect((await repos.refreshTokens.findByHash(second.tokenHash))?.revokedAt).not.toBeNull();
    expect((await repos.refreshTokens.findByHash(unrelated.tokenHash))?.revokedAt).toBeNull();
  });

  it('persists the expiration timestamp', async () => {
    const user = await makeUser(repos);
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    const token = await makeRefreshToken(repos, user.id, { expiresAt });
    expect(token.expiresAt.toISOString()).toBe(expiresAt.toISOString());
  });
});
