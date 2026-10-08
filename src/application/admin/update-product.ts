import type { Product, ProductUpdateInput } from '../../domain/model/product.js';
import type { ProductRepository } from '../../domain/ports/product-repository.js';
import type { CategoryRepository } from '../../domain/ports/category-repository.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';

export interface UpdateProductDeps {
  products: ProductRepository;
  categories: CategoryRepository;
}

/** Admin: edit product fields (price edits never touch past orders — snapshot). */
export class UpdateProduct {
  constructor(private readonly deps: UpdateProductDeps) {}

  async execute(id: string, changes: ProductUpdateInput): Promise<Product> {
    const existing = await this.deps.products.findById(id);
    if (!existing) {
      throw new NotFoundError('Product');
    }

    if (changes.slug && changes.slug !== existing.slug) {
      const clash = await this.deps.products.findBySlug(changes.slug);
      if (clash) {
        throw new ConflictError(`Slug "${changes.slug}" is already in use`);
      }
    }

    if (changes.categoryId) {
      const category = await this.deps.categories.findById(changes.categoryId);
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    const updated = await this.deps.products.update(id, changes);
    if (!updated) {
      throw new NotFoundError('Product');
    }
    return updated;
  }
}
