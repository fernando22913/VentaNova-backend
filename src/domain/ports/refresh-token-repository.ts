import type { RefreshToken, RefreshTokenCreateInput } from '../model/refresh-token.js';

/**
 * Persistence port for refresh-token sessions. Only the token *hash* is ever
 * stored; the raw token never reaches the database (blueprint §10).
 */
export interface RefreshTokenRepository {
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  create(input: RefreshTokenCreateInput): Promise<RefreshToken>;
  /**
   * Compare-and-set revoke: moves an active token to revoked and returns true;
   * returns false when it was already revoked (lost a rotation race).
   */
  revoke(id: string, revokedAt: Date): Promise<boolean>;
  /**
   * Revoke every still-active token in a rotation family (used for reuse
   * detection and logout). Returns the number of tokens revoked.
   */
  revokeFamily(familyId: string, revokedAt: Date): Promise<number>;
}
