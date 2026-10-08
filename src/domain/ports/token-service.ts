import type { UserRole } from '../model/index.js';

/** Whatever we ask the signer to encode. The signer allocates iat/exp. */
export interface TokenClaims {
  sub: string;
  role: UserRole;
}

/** The decoded, verified token — iat/exp guaranteed present. */
export interface TokenPayload extends TokenClaims {
  iat: number;
  exp: number;
}

export interface TokenService {
  sign(claims: TokenClaims): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
}
