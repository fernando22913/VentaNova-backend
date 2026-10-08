import { and, desc, eq } from 'drizzle-orm';

import type { Entitlement, EntitlementCreateInput } from '../../../domain/model/entitlement.js';
import type { EntitlementRepository } from '../../../domain/ports/entitlement-repository.js';
import type { Database } from '../db.js';
import { entitlements } from '../schema.js';

/** Drizzle adapter for the EntitlementRepository port. */
export class DrizzleEntitlementRepository implements EntitlementRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string): Promise<Entitlement[]> {
    const rows = await this.db
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, userId))
      .orderBy(desc(entitlements.grantedAt));
    return rows.map(rowToEntitlement);
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<Entitlement | null> {
    const [row] = await this.db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, userId), eq(entitlements.productId, productId)))
      .limit(1);
    return row ? rowToEntitlement(row) : null;
  }

  async findOwnedProductIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ productId: entitlements.productId })
      .from(entitlements)
      .where(eq(entitlements.userId, userId));
    return rows.map((row) => row.productId);
  }

  async createMany(input: EntitlementCreateInput[]): Promise<Entitlement[]> {
    if (input.length === 0) return [];
    const rows = await this.db.insert(entitlements).values(input).returning();
    return rows.map(rowToEntitlement);
  }
}

function rowToEntitlement(row: typeof entitlements.$inferSelect): Entitlement {
  return {
    id: row.id,
    userId: row.userId,
    productId: row.productId,
    orderId: row.orderId,
    licenseKey: row.licenseKey,
    grantedAt: row.grantedAt,
  };
}
