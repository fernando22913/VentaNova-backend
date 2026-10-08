import type { Product, ProductCreateInput } from '../../domain/model/product.js';
import type { ProductRepository } from '../../domain/ports/product-repository.js';
import type { CategoryRepository } from '../../domain/ports/category-repository.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';

export interface CreateProductDeps {
  products: ProductRepository;
  categories: CategoryRepository;
}

/** Admin: create a product (DRAFT or directly PUBLISHED). */
export class CreateProduct {
  constructor(private readonly deps: CreateProductDeps) {}

  async execute(input: ProductCreateInput): Promise<Product> {
    const existing = await this.deps.products.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`Slug "${input.slug}" is already in use`);
    }

    const category = await this.deps.categories.findById(input.categoryId);
    if (!category) {
      throw new NotFoundError('Category');
    }

    return this.deps.products.create(input);
  }
}
