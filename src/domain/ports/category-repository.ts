import type { Category, CategoryCreateInput } from '../model/index.js';

export interface CategoryRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  create(input: CategoryCreateInput): Promise<Category>;
}
