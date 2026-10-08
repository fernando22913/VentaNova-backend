/**
 * A persisted refresh-token session entry.
 *
 * The raw token lives only on the client — this is the *hash* we store so a
 * database leak cannot be replayed as a credential. `familyId` groups every
 * token produced by one login session, which lets us detect reuse of an
 * already-rotated token and revoke the whole chain.
 */
export interface RefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface RefreshTokenCreateInput {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}
