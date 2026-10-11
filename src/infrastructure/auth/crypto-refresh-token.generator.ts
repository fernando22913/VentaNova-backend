import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { RefreshTokenGenerator } from '../../domain/ports/refresh-token-generator.js';

// Adaptador cripto para el puerto RefreshTokenGenerator: tokens de alta entropía, SHA-256 basta.
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
