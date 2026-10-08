import { eq } from 'drizzle-orm';

import type { Category, CategoryCreateInput } from '../../../domain/model/category.js';
import type { CategoryRepository } from '../../../domain/ports/category-repository.js';
import type { Database } from '../db.js';
import { categories } from '../schema.js';

/** Drizzle adapter for the CategoryRepository port. */
export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.db.select().from(categories).orderBy(categories.name);
    return rows.map(rowToCategory);
  }

  async findById(id: string): Promise<Category | null> {
    const [row] = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return row ? rowToCategory(row) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const [row] = await this.db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return row ? rowToCategory(row) : null;
  }

  async create(input: CategoryCreateInput): Promise<Category> {
    const [row] = await this.db
      .insert(categories)
      .values({ slug: input.slug, name: input.name })
      .returning();
    if (!row) {
      throw new Error('Inserting a category returned no row');
    }
    return rowToCategory(row);
  }
}

export function rowToCategory(row: typeof categories.$inferSelect): Category {
  return { id: row.id, slug: row.slug, name: row.name };
}
