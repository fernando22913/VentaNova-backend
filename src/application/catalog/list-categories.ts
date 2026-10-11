import type { CategoryRepository } from '../../domain/ports/category-repository.js';
import type { Category } from '../../domain/model/category.js';

export interface ListCategoriesDeps {
  categories: CategoryRepository;
}

// Todas las categorías — pocas, estables, cacheables.
export class ListCategories {
  constructor(private readonly deps: ListCategoriesDeps) {}

  execute(): Promise<Category[]> {
    return this.deps.categories.findAll();
  }
}
