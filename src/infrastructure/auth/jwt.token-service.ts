import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import type { TokenClaims, TokenPayload, TokenService } from '../../domain/ports/token-service.js';
import { UnauthorizedError } from '../../domain/errors/index.js';
import { isUserRole } from '../../domain/model/enums.js';

// Servicio de access token JWT HS256 (blueprint §10): tokens bearer sin estado de corta vida, junto a un refresh token rotatorio.
export class JwtTokenService implements TokenService {
  private readonly signOptions: SignOptions;

  constructor(
    private readonly secret: string,
    expiresInSeconds: number = 60 * 60, // 1 hora
  ) {
    this.signOptions = { algorithm: 'HS256', expiresIn: expiresInSeconds, issuer: 'ventanova' };
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
        issuer: 'ventanova',
        // Fija el algoritmo aceptado para que un token nunca se verifique con otro esquema.
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
