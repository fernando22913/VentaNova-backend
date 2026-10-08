import type { ProductRepository } from '../../domain/ports/product-repository.js';
import type { Product } from '../../domain/model/product.js';
import { NotFoundError } from '../../domain/errors/index.js';

export interface GetProductBySlugDeps {
  products: ProductRepository;
}

/**
 * Public product detail by slug. Only PUBLISHED products are public; a known
 *-but-unpublished slug (draft or archived) behaves like an unknown one (404)
 * rather than leaking internal catalog state.
 */
export class GetProductBySlug {
  constructor(private readonly deps: GetProductBySlugDeps) {}

  async execute(slug: string): Promise<Product> {
    const product = await this.deps.products.findBySlug(slug);
    if (!product || product.status !== 'PUBLISHED') {
      throw new NotFoundError('Product');
    }
    return product;
  }
}
