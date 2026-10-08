import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';

import { JwtTokenService } from '../../../src/infrastructure/auth/jwt.token-service.js';
import { UnauthorizedError } from '../../../src/domain/errors/index.js';

const SECRET = 'unit_test_secret_at_least_16_chars';
const service = (ttl = 3600) => new JwtTokenService(SECRET, ttl);

describe('JwtTokenService (access tokens)', () => {
  it('signs and verifies a valid access token with sub/role/iat/exp', async () => {
    const token = await service().sign({ sub: 'u-1', role: 'CUSTOMER' });
    const payload = await service().verify(token);
    expect(payload).toMatchObject({ sub: 'u-1', role: 'CUSTOMER' });
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('defaults the access-token lifetime to 1 hour', async () => {
    const token = await new JwtTokenService(SECRET).sign({ sub: 'u-1', role: 'CUSTOMER' });
    const payload = await service().verify(token);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('rejects a tampered token', async () => {
    const token = await service().sign({ sub: 'u-1', role: 'CUSTOMER' });
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    await expect(service().verify(tampered)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign({ sub: 'attacker', role: 'ADMIN' }, 'a-completely-different-secret', {
      algorithm: 'HS256',
      issuer: 'bytemarket',
      expiresIn: 3600,
    });
    await expect(service().verify(forged)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token with the wrong issuer', async () => {
    const forged = jwt.sign({ sub: 'u-1', role: 'ADMIN' }, SECRET, {
      algorithm: 'HS256',
      issuer: 'somewhere-else',
      expiresIn: 3600,
    });
    await expect(service().verify(forged)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token signed with a different algorithm even if the secret matches', async () => {
    const forged = jwt.sign({ sub: 'u-1', role: 'ADMIN' }, SECRET, {
      algorithm: 'HS384',
      issuer: 'bytemarket',
      expiresIn: 3600,
    });
    await expect(service().verify(forged)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an expired token', async () => {
    const expired = await service(-1).sign({ sub: 'u-1', role: 'CUSTOMER' });
    await expect(service().verify(expired)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an unknown role claim', async () => {
    const forged = jwt.sign({ sub: 'u-1', role: 'SUPERADMIN' }, SECRET, {
      algorithm: 'HS256',
      issuer: 'bytemarket',
      expiresIn: 3600,
    });
    await expect(service().verify(forged)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token that carries no expiry', async () => {
    const noExp = jwt.sign({ sub: 'u-1', role: 'CUSTOMER' }, SECRET, {
      algorithm: 'HS256',
      issuer: 'bytemarket',
    });
    await expect(service().verify(noExp)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an opaque refresh token (it is not a JWT)', async () => {
    await expect(service().verify('opaque-refresh-token-value')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
