import type { ProductRepository } from '../../domain/ports/product-repository.js';
import type { Product } from '../../domain/model/product.js';
import { NotFoundError } from '../../domain/errors/index.js';

export interface GetProductBySlugDeps {
  products: ProductRepository;
}

// Detalle público de producto por slug; solo los productos PUBLISHED son visibles (si no 404).
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
