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

/**
 * Rotate a refresh session.
 *
 * The supplied token is hashed and looked up; it must exist, be unexpired and
 * unrevoked. Rotation revokes the presented token and mints a new token in the
 * same family, inside one transaction, so a crash can never leave the session
 * both revoked and un-replaced (or double-issued).
 *
 * Reuse of an already-revoked token is treated as theft: the whole family is
 * revoked, so a stolen-and-rotated token cannot be replayed.
 */
export class RefreshSession {
  constructor(private readonly deps: RefreshSessionDeps) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionResult> {
    const now = new Date();
    const record = await this.deps.refreshTokens.findByHash(
      this.deps.generator.hash(input.refreshToken),
    );

    // Missing, revoked or expired all collapse to the same 401 (no oracle).
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
      // Compare-and-set: only one concurrent rotation can revoke this token.
      const revoked = await tx.refreshTokens.revoke(record.id, now);
      if (!revoked) return { rotated: false as const };

      const tokens = await this.deps.issueTokenPair.execute(user, {
        familyId: record.familyId,
        repository: tx.refreshTokens,
      });
      return { rotated: true as const, tokens };
    });

    if (!outcome.rotated) {
      // Lost the race with a concurrent rotation → treat as reuse.
      await this.deps.refreshTokens.revokeFamily(record.familyId, now);
      throw new UnauthorizedError('Invalid refresh token');
    }

    return { user, tokens: outcome.tokens };
  }
}
