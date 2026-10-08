import type { CategoryRepository } from '../../domain/ports/category-repository.js';
import type { Category } from '../../domain/model/category.js';

export interface ListCategoriesDeps {
  categories: CategoryRepository;
}

/** All categories — small, stable, cacheable. */
export class ListCategories {
  constructor(private readonly deps: ListCategoriesDeps) {}

  execute(): Promise<Category[]> {
    return this.deps.categories.findAll();
  }
}
