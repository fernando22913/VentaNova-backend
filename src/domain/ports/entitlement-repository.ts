import type { Entitlement, EntitlementCreateInput } from '../model/index.js';

export interface EntitlementRepository {
  findByUser(userId: string): Promise<Entitlement[]>;
  findByUserAndProduct(userId: string, productId: string): Promise<Entitlement | null>;
  // Ids de los productos que un usuario ya posee (bloquea la doble compra y muestra el estado "ya lo tienes").
  findOwnedProductIds(userId: string): Promise<string[]>;
  createMany(input: EntitlementCreateInput[]): Promise<Entitlement[]>;
}
