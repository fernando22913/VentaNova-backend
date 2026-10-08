import type { RefreshTokenRepository } from '../../domain/ports/refresh-token-repository.js';
import type { RefreshTokenGenerator } from '../../domain/ports/refresh-token-generator.js';

export interface LogoutInput {
  refreshToken: string;
}

export interface LogoutDeps {
  refreshTokens: RefreshTokenRepository;
  generator: RefreshTokenGenerator;
}

/**
 * Server-side logout: revoke the session that owns the presented refresh
 * token (the whole rotation family). Idempotent — an unknown or already
 * revoked token is a no-op success, so it never leaks whether the token
 * existed. It never touches the user or any other data.
 */
export class Logout {
  constructor(private readonly deps: LogoutDeps) {}

  async execute(input: LogoutInput): Promise<void> {
    const record = await this.deps.refreshTokens.findByHash(
      this.deps.generator.hash(input.refreshToken),
    );
    if (record) {
      await this.deps.refreshTokens.revokeFamily(record.familyId, new Date());
    }
  }
}
