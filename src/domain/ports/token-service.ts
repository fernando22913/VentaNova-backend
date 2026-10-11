import type { UserRole } from '../model/index.js';

// Lo que pedimos al firmante que codifique. El firmante asigna iat/exp.
export interface TokenClaims {
  sub: string;
  role: UserRole;
}

// Token decodificado y verificado — iat/exp garantizados.
export interface TokenPayload extends TokenClaims {
  iat: number;
  exp: number;
}

export interface TokenService {
  sign(claims: TokenClaims): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
}
