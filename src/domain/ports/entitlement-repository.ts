import type { Entitlement, EntitlementCreateInput } from '../model/index.js';

export interface EntitlementRepository {
  findByUser(userId: string): Promise<Entitlement[]>;
  findByUserAndProduct(userId: string, productId: string): Promise<Entitlement | null>;
  /** Ids of the products a user already owns (used to block double-purchase
   * and to render the "you own this" state). */
  findOwnedProductIds(userId: string): Promise<string[]>;
  createMany(input: EntitlementCreateInput[]): Promise<Entitlement[]>;
}
