import type { User } from '../../domain/model/user.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';
import type { RefreshTokenRepository } from '../../domain/ports/refresh-token-repository.js';
import type { RefreshTokenGenerator } from '../../domain/ports/refresh-token-generator.js';
import type { UnitOfWork } from '../../domain/ports/unit-of-work.js';
import type { IssueTokenPair, TokenPair } from './issue-token-pair.js';
import { UnauthorizedError } from '../../domain/errors/index.js';

export interface RefreshSessionInput {
  refreshToken: string;
}

export interface RefreshSessionResult {
  user: User;
  tokens: TokenPair;
}

export interface RefreshSessionDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  generator: RefreshTokenGenerator;
  issueTokenPair: IssueTokenPair;
  unitOfWork: UnitOfWork;
}

// Rota una sesión refresh en una transacción; reusar un token revocado revoca toda la familia.
export class RefreshSession {
  constructor(private readonly deps: RefreshSessionDeps) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionResult> {
    const now = new Date();
    const record = await this.deps.refreshTokens.findByHash(
      this.deps.generator.hash(input.refreshToken),
    );

    // Ausente, revocado o expirado colapsan al mismo 401 (sin oracle).
    if (!record) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (record.revokedAt) {
      await this.deps.refreshTokens.revokeFamily(record.familyId, now);
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (record.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await this.deps.users.findById(record.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const outcome = await this.deps.unitOfWork.run(async (tx) => {
      // Compare-and-set: solo una rotación concurrente puede revocar este token.
      const revoked = await tx.refreshTokens.revoke(record.id, now);
      if (!revoked) return { rotated: false as const };

      const tokens = await this.deps.issueTokenPair.execute(user, {
        familyId: record.familyId,
        repository: tx.refreshTokens,
      });
      return { rotated: true as const, tokens };
    });

    if (!outcome.rotated) {
      // Perdió la carrera con una rotación concurrente → se trata como reuso.
      await this.deps.refreshTokens.revokeFamily(record.familyId, now);
      throw new UnauthorizedError('Invalid refresh token');
    }

    return { user, tokens: outcome.tokens };
  }
}
