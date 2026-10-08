import type { Product } from '../../domain/model/product.js';
import type { PagedResult, ProductRepository } from '../../domain/ports/product-repository.js';
import type { ProductSearchCriteria } from '../../domain/ports/product-repository.js';

export interface ListProductsForAdminDeps {
  products: ProductRepository;
}

/** Admin catalog listing: unlike the public search it may return every status. */
export class ListProductsForAdmin {
  constructor(private readonly deps: ListProductsForAdminDeps) {}

  execute(criteria: ProductSearchCriteria): Promise<PagedResult<Product>> {
    return this.deps.products.search(criteria);
  }
}
