import type { RefreshTokenRepository } from '../../domain/ports/refresh-token-repository.js';
import type { RefreshTokenGenerator } from '../../domain/ports/refresh-token-generator.js';

export interface LogoutInput {
  refreshToken: string;
}

export interface LogoutDeps {
  refreshTokens: RefreshTokenRepository;
  generator: RefreshTokenGenerator;
}

// Logout en servidor: revoca toda la familia de rotación; no-op idempotente para tokens desconocidos.
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
