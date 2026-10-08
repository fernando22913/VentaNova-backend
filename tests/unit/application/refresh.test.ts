import { describe, expect, it } from 'vitest';

import { IssueTokenPair } from '../../../src/application/auth/issue-token-pair.js';
import { RefreshSession } from '../../../src/application/auth/refresh-session.js';
import { Logout } from '../../../src/application/auth/logout.js';
import { UnauthorizedError } from '../../../src/domain/errors/index.js';
import {
  FakeRefreshTokenGenerator,
  FakeTokenService,
  FakeUnitOfWork,
  InMemoryEntitlementRepository,
  InMemoryOrderRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../helpers/fakes.js';

const WEEK_SECONDS = 60 * 60 * 24 * 7;

function wire() {
  const users = new InMemoryUserRepository();
  const tokens = new FakeTokenService();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const generator = new FakeRefreshTokenGenerator();
  const unitOfWork = new FakeUnitOfWork({
    orders: new InMemoryOrderRepository(),
    entitlements: new InMemoryEntitlementRepository(),
    refreshTokens,
  });
  const issueTokenPair = new IssueTokenPair({
    tokens,
    refreshTokens,
    generator,
    accessTokenTtlSeconds: 3600,
    refreshTokenTtlSeconds: WEEK_SECONDS,
  });
  return {
    users,
    tokens,
    refreshTokens,
    generator,
    issueTokenPair,
    refreshSession: new RefreshSession({
      users,
      refreshTokens,
      generator,
      issueTokenPair,
      unitOfWork,
    }),
    logout: new Logout({ refreshTokens, generator }),
  };
}

async function session(role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
  const w = wire();
  const user = await w.users.create({
    email: `${role.toLowerCase()}@bytemarket.dev`,
    name: 'Test User',
    passwordHash: 'hashed:x',
    role,
  });
  const pair = await w.issueTokenPair.execute(user);
  return { w, user, pair };
}

describe('RefreshSession', () => {
  it('rotates a valid refresh token into a new access + refresh pair', async () => {
    const { w, user, pair } = await session();

    const rotated = await w.refreshSession.execute({ refreshToken: pair.refreshToken });

    expect(rotated.user.id).toBe(user.id);
    expect(rotated.tokens.accessToken).toBe(`token.${user.id}.CUSTOMER`);
    expect(rotated.tokens.refreshToken).not.toBe(pair.refreshToken);
    expect(rotated.tokens.expiresIn).toBe(3600);
  });

  it('stores only the hash of the refresh token, never the raw value', async () => {
    const { w, pair } = await session();
    const record = await w.refreshTokens.findByHash(w.generator.hash(pair.refreshToken));
    expect(record).not.toBeNull();
    expect(record?.tokenHash).toBe(`hash:${pair.refreshToken}`);
    expect(record?.tokenHash).not.toBe(pair.refreshToken);
  });

  it('creates the rotated token in the same family', async () => {
    const { w, pair } = await session();
    const original = await w.refreshTokens.findByHash(w.generator.hash(pair.refreshToken));
    const rotated = await w.refreshSession.execute({ refreshToken: pair.refreshToken });
    const next = await w.refreshTokens.findByHash(w.generator.hash(rotated.tokens.refreshToken));
    expect(next?.familyId).toBe(original?.familyId);
  });

  it('rejects an unknown refresh token with 401', async () => {
    const { w } = await session();
    await expect(
      w.refreshSession.execute({ refreshToken: 'never-issued' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an expired refresh token with 401', async () => {
    const { w, user } = await session();
    await w.refreshTokens.create({
      userId: user.id,
      familyId: w.generator.generateFamilyId(),
      tokenHash: w.generator.hash('expired-token'),
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      w.refreshSession.execute({ refreshToken: 'expired-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a revoked refresh token and issues nothing', async () => {
    const { w, pair } = await session();
    await w.logout.execute({ refreshToken: pair.refreshToken });
    await expect(
      w.refreshSession.execute({ refreshToken: pair.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const { w, pair } = await session();
    const rotated = await w.refreshSession.execute({ refreshToken: pair.refreshToken });

    // Replaying the old token is rejected…
    await expect(
      w.refreshSession.execute({ refreshToken: pair.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    // …and the still-valid descendant is revoked too (theft containment).
    await expect(
      w.refreshSession.execute({ refreshToken: rotated.tokens.refreshToken }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('does not accept an access token as a refresh token', async () => {
    const { w, pair } = await session();
    await expect(
      w.refreshSession.execute({ refreshToken: pair.accessToken }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('derives the role from the database user, never from the request', async () => {
    const { w, pair } = await session('ADMIN');
    const rotated = await w.refreshSession.execute({ refreshToken: pair.refreshToken });
    expect(rotated.tokens.accessToken.endsWith('.ADMIN')).toBe(true);
    expect(rotated.user.role).toBe('ADMIN');
  });

  it('keeps sessions isolated per user', async () => {
    const w = wire();
    const alice = await w.users.create({
      email: 'alice@bytemarket.dev',
      name: 'Alice',
      passwordHash: 'h',
      role: 'CUSTOMER',
    });
    const bob = await w.users.create({
      email: 'bob@bytemarket.dev',
      name: 'Bob',
      passwordHash: 'h',
      role: 'CUSTOMER',
    });
    const alicePair = await w.issueTokenPair.execute(alice);
    const bobPair = await w.issueTokenPair.execute(bob);

    const rotatedAlice = await w.refreshSession.execute({
      refreshToken: alicePair.refreshToken,
    });
    expect(rotatedAlice.user.id).toBe(alice.id);

    // B's session is untouched by A's rotation.
    const rotatedBob = await w.refreshSession.execute({ refreshToken: bobPair.refreshToken });
    expect(rotatedBob.user.id).toBe(bob.id);
  });
});

describe('Logout', () => {
  it('revokes the session so the refresh token no longer works', async () => {
    const { w, pair } = await session();
    await w.logout.execute({ refreshToken: pair.refreshToken });
    const record = await w.refreshTokens.findByHash(w.generator.hash(pair.refreshToken));
    expect(record?.revokedAt).not.toBeNull();
  });

  it('is idempotent and ignores unknown tokens', async () => {
    const { w, pair } = await session();
    await w.logout.execute({ refreshToken: pair.refreshToken });
    await expect(w.logout.execute({ refreshToken: pair.refreshToken })).resolves.toBeUndefined();
    await expect(w.logout.execute({ refreshToken: 'never-issued' })).resolves.toBeUndefined();
  });
});
