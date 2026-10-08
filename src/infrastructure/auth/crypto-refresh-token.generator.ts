import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { RefreshTokenGenerator } from '../../domain/ports/refresh-token-generator.js';

/**
 * Crypto adapter for the `RefreshTokenGenerator` port.
 *
 * Tokens are 256 bits of CSPRNG output (base64url). Because they are already
 * high-entropy, a fast SHA-256 hash is the correct choice for storage — unlike
 * passwords, there is nothing to brute-force, so argon2 would only add cost.
 */
export class CryptoRefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateFamilyId(): string {
    return randomUUID();
  }
}
