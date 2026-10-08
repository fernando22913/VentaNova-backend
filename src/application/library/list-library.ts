import type { Entitlement } from '../../domain/model/entitlement.js';
import type { Product } from '../../domain/model/product.js';
import type { EntitlementRepository } from '../../domain/ports/entitlement-repository.js';
import type { ProductRepository } from '../../domain/ports/product-repository.js';

export interface LibraryItem {
  entitlement: Entitlement;
  product: Product;
}

export interface ListLibraryDeps {
  entitlements: EntitlementRepository;
  products: ProductRepository;
}

/** The user's owned products: entitlement + current product (for download URL).
 * Products that were archived or removed still appear via the entitlement —
 * orders keep working from snapshots; the download lives on the product. */
export class ListLibrary {
  constructor(private readonly deps: ListLibraryDeps) {}

  async execute(userId: string): Promise<LibraryItem[]> {
    const entitlements = await this.deps.entitlements.findByUser(userId);
    if (entitlements.length === 0) return [];

    const productIds = [...new Set(entitlements.map((entry) => entry.productId))];
    const products = new Map(
      (await this.deps.products.findByIds(productIds)).map((product) => [product.id, product]),
    );

    return entitlements
      .map((entitlement) => {
        const product = products.get(entitlement.productId);
        return product ? { entitlement, product } : null;
      })
      .filter((item): item is LibraryItem => item !== null);
  }
}
