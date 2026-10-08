import { and, eq, isNull } from 'drizzle-orm';

import type {
  RefreshToken,
  RefreshTokenCreateInput,
} from '../../../domain/model/refresh-token.js';
import type { RefreshTokenRepository } from '../../../domain/ports/refresh-token-repository.js';
import type { Database } from '../db.js';
import { refreshTokens } from '../schema.js';

/** Drizzle adapter for the RefreshTokenRepository port (stores hashes only). */
export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Database) {}

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? rowToRefreshToken(row) : null;
  }

  async create(input: RefreshTokenCreateInput): Promise<RefreshToken> {
    const [row] = await this.db
      .insert(refreshTokens)
      .values({
        userId: input.userId,
        familyId: input.familyId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) {
      throw new Error('Inserting a refresh token returned no row');
    }
    return rowToRefreshToken(row);
  }

  async revoke(id: string, revokedAt: Date): Promise<boolean> {
    const rows = await this.db
      .update(refreshTokens)
      .set({ revokedAt })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length > 0;
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<number> {
    const rows = await this.db
      .update(refreshTokens)
      .set({ revokedAt })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length;
  }
}

function rowToRefreshToken(row: typeof refreshTokens.$inferSelect): RefreshToken {
  return {
    id: row.id,
    userId: row.userId,
    familyId: row.familyId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}
