import { describe, expect, it, vi } from 'vitest';

import { RegisterUser } from '../../../src/application/auth/register-user.js';
import { LoginUser } from '../../../src/application/auth/login-user.js';
import { GetMe } from '../../../src/application/auth/get-me.js';
import { IssueTokenPair } from '../../../src/application/auth/issue-token-pair.js';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../../../src/domain/errors/index.js';
import {
  FakeHasher,
  FakeRefreshTokenGenerator,
  FakeTokenService,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../helpers/fakes.js';

const issueTokenPair = () =>
  new IssueTokenPair({
    tokens: new FakeTokenService(),
    refreshTokens: new InMemoryRefreshTokenRepository(),
    generator: new FakeRefreshTokenGenerator(),
    accessTokenTtlSeconds: 3600,
    refreshTokenTtlSeconds: 60 * 60 * 24 * 7,
  });

describe('RegisterUser', () => {
  const users = () => new InMemoryUserRepository();
  const make = (repo: InMemoryUserRepository) =>
    new RegisterUser({ users: repo, hasher: new FakeHasher(), issueTokenPair: issueTokenPair() });

  it('registers a customer and returns an access token + opaque refresh token', async () => {
    const repo = users();
    const result = await make(repo).execute({
      email: 'Alice@Example.com',
      name: '  Alice  ',
      password: 'password123',
    });
    expect(result.user.email).toBe('alice@example.com');
    expect(result.user.name).toBe('Alice');
    expect(result.user.role).toBe('CUSTOMER');
    expect(result.user.passwordHash).toBe('hashed:password123');
    expect(result.tokens.accessToken).toBe(`token.${result.user.id}.CUSTOMER`);
    expect(result.tokens.refreshToken.startsWith('refresh-')).toBe(true);
    expect(result.tokens.tokenType).toBe('bearer');
    expect(result.tokens.expiresIn).toBe(3600);
  });

  it('is idempotent on duplicate email — case-insensitively — with a Conflict', async () => {
    const repo = users();
    await make(repo).execute({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'password123',
    });
    await expect(
      make(repo).execute({ email: 'ALICE@example.com', name: 'Alice2', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('LoginUser', () => {
  const users = () => new InMemoryUserRepository();
  const make = (repo: InMemoryUserRepository) =>
    new LoginUser({ users: repo, hasher: new FakeHasher(), issueTokenPair: issueTokenPair() });

  async function registered(repo: InMemoryUserRepository) {
    await new RegisterUser({
      users: repo,
      hasher: new FakeHasher(),
      issueTokenPair: issueTokenPair(),
    }).execute({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'password123',
    });
  }

  it('logs in with valid credentials and issues both tokens', async () => {
    const repo = users();
    await registered(repo);
    const result = await make(repo).execute({
      email: 'ALICE@example.com',
      password: 'password123',
    });
    expect(result.user.email).toBe('alice@example.com');
    expect(result.tokens.accessToken.startsWith('token.')).toBe(true);
    expect(result.tokens.refreshToken.startsWith('refresh-')).toBe(true);
  });

  it('rejects a wrong password with the same 401 as an unknown email', async () => {
    const repo = users();
    await registered(repo);

    const wrong = make(repo).execute({ email: 'alice@example.com', password: 'wrongpass' });
    const unknown = make(repo).execute({ email: 'nobody@example.com', password: 'password123' });

    await expect(wrong).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(unknown).rejects.toBeInstanceOf(UnauthorizedError);
    const wrongMessage = await wrong.catch((e: UnauthorizedError) => e.message);
    const unknownMessage = await unknown.catch((e: UnauthorizedError) => e.message);
    expect(wrongMessage).toBe(unknownMessage);
  });

  it('still runs a password verification for unknown emails (timing equalization)', async () => {
    const repo = users();
    const hasher = new FakeHasher();
    const verify = vi.spyOn(hasher, 'verify');
    const login = new LoginUser({ users: repo, hasher, issueTokenPair: issueTokenPair() });

    await expect(
      login.execute({ email: 'ghost@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    // A dummy verify burns argon2 work so unknown-email timing matches wrong-password.
    expect(verify).toHaveBeenCalledTimes(1);
  });
});

describe('GetMe', () => {
  it('returns the user for an existing id', async () => {
    const repo = new InMemoryUserRepository();
    const user = await repo.create({
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'h',
      role: 'CUSTOMER',
    });
    const result = await new GetMe({ users: repo }).execute(user.id);
    expect(result.id).toBe(user.id);
  });

  it('throws NotFound for an unknown user', async () => {
    const repo = new InMemoryUserRepository();
    await expect(new GetMe({ users: repo }).execute('u-999')).rejects.toBeInstanceOf(NotFoundError);
  });
});
