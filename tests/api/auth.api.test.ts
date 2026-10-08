import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import type { AppContainer } from '../../src/container.js';
import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import {
  getTestDatabase,
  resetDatabase,
  TEST_DATABASE_URL,
} from '../integration/helpers/test-db.js';

interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

interface AuthBody {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    passwordHash?: string;
    createdAt: string;
  };
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

const as = <T>(body: unknown) => body as T;

describe('Auth API (contract)', () => {
  let container: AppContainer;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await getTestDatabase();
    container = buildContainer({ databaseUrl: TEST_DATABASE_URL });
    app = createApp(container);
  });

  beforeEach(async () => {
    const { client } = await getTestDatabase();
    await resetDatabase(client);
  });

  const register = (body: unknown) =>
    request(app)
      .post('/api/v1/auth/register')
      .send(body as object);

  const login = (body: unknown) =>
    request(app)
      .post('/api/v1/auth/login')
      .send(body as object);

  const refresh = (body: unknown) =>
    request(app)
      .post('/api/v1/auth/refresh')
      .send(body as object);

  const logout = (body: unknown) =>
    request(app)
      .post('/api/v1/auth/logout')
      .send(body as object);

  async function registeredUser(email = 'customer@test.dev'): Promise<AuthBody> {
    const response = await register({ email, name: 'Customer', password: 'password123' });
    return as<AuthBody>(response.body);
  }

  it('POST /auth/register → 201 with user (no passwordHash), access + refresh tokens', async () => {
    const response = await register({
      email: 'Customer@Test.dev',
      name: 'Customer',
      password: 'password123',
    });

    const body = as<AuthBody>(response.body);
    expect(response.status).toBe(201);
    expect(body.user).toMatchObject({
      email: 'customer@test.dev',
      name: 'Customer',
      role: 'CUSTOMER',
    });
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.token_type).toBe('bearer');
    expect(body.expires_in).toBe(3600);
    expect(body.access_token.split('.')).toHaveLength(3);
    // Opaque refresh token — not a JWT.
    expect(body.refresh_token).not.toContain('.');
    expect(body.refresh_token).not.toBe(body.access_token);
    // No internal hash is ever exposed.
    expect(response.body).not.toHaveProperty('refresh_token_hash');
    expect(response.body).not.toHaveProperty('token_hash');
  });

  it('issues an access token with exactly a 1-hour lifetime', async () => {
    const body = await registeredUser();
    const claims = jwt.decode(body.access_token) as { iat: number; exp: number; sub: string };
    expect(claims.exp - claims.iat).toBe(3600);
    expect(claims.sub).toBe(body.user.id);
  });

  it('POST /auth/register → 409 on duplicate (case-insensitive)', async () => {
    await registeredUser('dup@test.dev');
    const response = await register({
      email: 'DUP@test.dev',
      name: 'B',
      password: 'password123',
    });
    expect(response.status).toBe(409);
    expect(as<ApiErrorBody>(response.body).error.code).toBe('CONFLICT');
  });

  it('POST /auth/register → 422 with field details on invalid input', async () => {
    const response = await register({ email: 'not-an-email', name: '', password: 'short' });
    const body = as<ApiErrorBody>(response.body);
    expect(response.status).toBe(422);
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'email' }),
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'password' }),
      ]),
    );
  });

  it('POST /auth/login → 200 with both tokens for valid credentials', async () => {
    await registeredUser('login@test.dev');
    const response = await login({ email: 'LOGIN@test.dev', password: 'password123' });
    const body = as<AuthBody>(response.body);
    expect(response.status).toBe(200);
    expect(body.user.email).toBe('login@test.dev');
    expect(body.access_token.split('.')).toHaveLength(3);
    expect(body.refresh_token).not.toContain('.');
    expect(body.expires_in).toBe(3600);
  });

  it('POST /auth/login → 401 for wrong password and unknown email (same message)', async () => {
    await registeredUser('login@test.dev');
    const wrong = await login({ email: 'login@test.dev', password: 'nope' });
    const unknown = await login({ email: 'ghost@test.dev', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(as<ApiErrorBody>(wrong.body).error.message).toBe(
      as<ApiErrorBody>(unknown.body).error.message,
    );
  });

  it('ignores a client-supplied role on register (no privilege escalation)', async () => {
    const response = await register({
      email: 'sneaky@test.dev',
      name: 'Sneaky',
      password: 'password123',
      role: 'ADMIN',
    });
    expect(response.status).toBe(201);
    expect(as<AuthBody>(response.body).user.role).toBe('CUSTOMER');
  });

  it('POST /auth/register → 400 on malformed JSON and 413 on an oversized body', async () => {
    const malformed = await request(app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken"');
    expect(malformed.status).toBe(400);
    expect(as<ApiErrorBody>(malformed.body).error.code).toBe('INVALID_JSON');

    const huge = await register({
      email: 'big@test.dev',
      name: 'x'.repeat(200_000),
      password: 'password123',
    });
    expect(huge.status).toBe(413);
  });

  describe('GET /auth/me', () => {
    it('→ 200 with the current user using the access token', async () => {
      const body = await registeredUser('me@test.dev');
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${body.access_token}`);
      expect(response.status).toBe(200);
      expect(as<{ user: { email: string } }>(response.body).user.email).toBe('me@test.dev');
    });

    it('→ 401 without a token, with garbage, or with a forged token', async () => {
      const noToken = await request(app).get('/api/v1/auth/me');
      const garbage = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not.a.jwt');
      const forged = jwt.sign({ sub: 'attacker', role: 'ADMIN' }, 'not-the-real-secret', {
        algorithm: 'HS256',
        issuer: 'bytemarket',
        expiresIn: 3600,
      });
      const forgedResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forged}`);
      expect(noToken.status).toBe(401);
      expect(garbage.status).toBe(401);
      expect(forgedResponse.status).toBe(401);
    });

    it('→ 401 when a refresh token is used as an access token', async () => {
      const body = await registeredUser('wrongcred@test.dev');
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${body.refresh_token}`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates into a new pair and the old refresh token is rejected', async () => {
      const body = await registeredUser('rotate@test.dev');

      const rotated = await refresh({ refresh_token: body.refresh_token });
      expect(rotated.status).toBe(200);
      const next = as<AuthBody>(rotated.body);
      // Access tokens are deterministic within the same second (same claims);
      // the opaque refresh token is always new.
      expect(next.refresh_token).not.toBe(body.refresh_token);
      expect(next.user.role).toBe('CUSTOMER');

      // New access token works.
      const me = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${next.access_token}`);
      expect(me.status).toBe(200);

      // Old refresh token is no longer valid.
      const replay = await refresh({ refresh_token: body.refresh_token });
      expect(replay.status).toBe(401);
    });

    it('detects reuse of a rotated token and revokes the family', async () => {
      const body = await registeredUser('reuse@test.dev');
      const rotated = await refresh({ refresh_token: body.refresh_token });
      const next = as<AuthBody>(rotated.body);

      const reuse = await refresh({ refresh_token: body.refresh_token });
      expect(reuse.status).toBe(401);

      // The descendant token is revoked too, so theft cannot continue.
      const revoked = await refresh({ refresh_token: next.refresh_token });
      expect(revoked.status).toBe(401);
    });

    it('→ 401 for unknown, expired or revoked tokens (no oracle)', async () => {
      const unknown = await refresh({ refresh_token: 'unknown-token-value' });
      expect(unknown.status).toBe(401);
      expect(as<ApiErrorBody>(unknown.body).error.code).toBe('UNAUTHORIZED');

      const body = await registeredUser('revoked@test.dev');
      await logout({ refresh_token: body.refresh_token });
      const revoked = await refresh({ refresh_token: body.refresh_token });
      expect(revoked.status).toBe(401);
    });

    it('→ 422 when the body is missing/empty, and rejects an access token', async () => {
      const missing = await request(app).post('/api/v1/auth/refresh').send({});
      expect(missing.status).toBe(422);

      const body = await registeredUser('asrefresh@test.dev');
      const withAccess = await refresh({ refresh_token: body.access_token });
      expect(withAccess.status).toBe(401);
    });

    it('ignores client-supplied role/admin/userId fields', async () => {
      const body = await registeredUser('noroletest@test.dev');
      const response = await refresh({
        refresh_token: body.refresh_token,
        role: 'ADMIN',
        admin: true,
        userId: 'attacker-controlled',
      });
      expect(response.status).toBe(200);
      const rotated = as<AuthBody>(response.body);
      expect(rotated.user.role).toBe('CUSTOMER');
      expect(rotated.user.id).toBe(body.user.id);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session, is idempotent, and never deletes the user', async () => {
      const body = await registeredUser('logout@test.dev');

      const first = await logout({ refresh_token: body.refresh_token });
      expect(first.status).toBe(204);

      const second = await logout({ refresh_token: body.refresh_token });
      expect(second.status).toBe(204);

      const afterLogout = await refresh({ refresh_token: body.refresh_token });
      expect(afterLogout.status).toBe(401);

      // The account still exists: a fresh login still works.
      const relogin = await login({ email: 'logout@test.dev', password: 'password123' });
      expect(relogin.status).toBe(200);
    });

    it('always returns 204, even for an unknown token', async () => {
      const response = await logout({ refresh_token: 'unknown-token-value' });
      expect(response.status).toBe(204);
    });
  });
});
