import type { Product } from '../../domain/model/product.js';
import type { ProductStatus } from '../../domain/model/enums.js';
import type { ProductRepository } from '../../domain/ports/product-repository.js';
import { NotFoundError } from '../../domain/errors/index.js';

export interface ChangeProductStatusDeps {
  products: ProductRepository;
}

/** Admin: publish / archive / re-draft. Archive is a soft delete — orders keep
 * working from their snapshots (blueprint §7). */
export class ChangeProductStatus {
  constructor(private readonly deps: ChangeProductStatusDeps) {}

  async execute(id: string, status: ProductStatus): Promise<Product> {
    const updated = await this.deps.products.updateStatus(id, status);
    if (!updated) {
      throw new NotFoundError('Product');
    }
    return updated;
  }
}
