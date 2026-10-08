/**
 * Generates and hashes opaque refresh tokens.
 *
 * Kept as a port (like `Hasher`/`TokenService`) so the crypto adapter is the
 * only place that owns randomness and hashing, and use cases stay testable
 * with a deterministic fake.
 */
export interface RefreshTokenGenerator {
  /** A new high-entropy opaque token — only its hash is persisted. */
  generate(): string;
  /** Stable hash used for lookup without ever storing the raw token. */
  hash(token: string): string;
  /** A new rotation-family id (one per login session). */
  generateFamilyId(): string;
}
