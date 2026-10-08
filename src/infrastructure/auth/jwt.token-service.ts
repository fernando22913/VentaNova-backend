import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import type { TokenClaims, TokenPayload, TokenService } from '../../domain/ports/token-service.js';
import { UnauthorizedError } from '../../domain/errors/index.js';
import { isUserRole } from '../../domain/model/enums.js';

/**
 * JWT HS256 access-token service (blueprint §10): stateless bearer tokens with
 * `sub`, `role`, `iat`/`exp`. Access tokens are deliberately short-lived (1h by
 * default, configured via ACCESS_TOKEN_EXPIRES_IN) and are paired with a
 * separate rotating refresh token — the access token is never used to refresh.
 */
export class JwtTokenService implements TokenService {
  private readonly signOptions: SignOptions;

  constructor(
    private readonly secret: string,
    expiresInSeconds: number = 60 * 60, // 1 hour
  ) {
    this.signOptions = { algorithm: 'HS256', expiresIn: expiresInSeconds, issuer: 'bytemarket' };
  }

  sign(claims: TokenClaims): Promise<string> {
    return Promise.resolve(
      jwt.sign({ sub: claims.sub, role: claims.role }, this.secret, this.signOptions),
    );
  }

  verify(token: string): Promise<TokenPayload> {
    let payload: JwtPayload & { role?: unknown };
    try {
      payload = jwt.verify(token, this.secret, {
        issuer: 'bytemarket',
        // Pin the accepted algorithm so a token can never be verified under a
        // different scheme than the one we sign with.
        algorithms: ['HS256'],
      }) as JwtPayload & {
        role?: unknown;
      };
    } catch {
      return Promise.reject(new UnauthorizedError('Invalid or expired token'));
    }

    if (
      typeof payload.sub !== 'string' ||
      !isUserRole(payload.role) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return Promise.reject(new UnauthorizedError('Invalid or expired token'));
    }

    return Promise.resolve({
      sub: payload.sub,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    });
  }
}
