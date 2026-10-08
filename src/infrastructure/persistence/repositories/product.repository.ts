import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import type {
  Product,
  ProductCreateInput,
  ProductUpdateInput,
} from '../../../domain/model/product.js';
import type { ProductStatus } from '../../../domain/model/enums.js';
import type {
  PagedResult,
  ProductRepository,
  ProductSearchCriteria,
} from '../../../domain/ports/product-repository.js';
import type { Database } from '../db.js';
import { products } from '../schema.js';

/** Drizzle adapter for the ProductRepository port, including the criteria
 * search endpoint. ILIKE is honest at catalog scale (blueprint §5); a pg_trgm
 * GIN index on `title` is the documented scale-up path. */
export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Product | null> {
    const [row] = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    return row ? rowToProduct(row) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const [row] = await this.db.select().from(products).where(eq(products.slug, slug)).limit(1);
    return row ? rowToProduct(row) : null;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(products).where(inArray(products.id, ids));
    return rows.map(rowToProduct);
  }

  async search(criteria: ProductSearchCriteria): Promise<PagedResult<Product>> {
    const conditions: SQL[] = [];

    if (criteria.status) {
      conditions.push(eq(products.status, criteria.status));
    }
    if (criteria.search) {
      const term = `%${criteria.search}%`;
      conditions.push(or(ilike(products.title, term), ilike(products.summary, term))!);
    }
    if (criteria.categoryId) {
      conditions.push(eq(products.categoryId, criteria.categoryId));
    }
    if (criteria.platform) {
      conditions.push(eq(products.platform, criteria.platform));
    }
    if (criteria.minPriceCents !== undefined) {
      conditions.push(gte(products.priceCents, criteria.minPriceCents));
    }
    if (criteria.maxPriceCents !== undefined) {
      conditions.push(lte(products.priceCents, criteria.maxPriceCents));
    }

    const where = and(...conditions);

    const [countRow] = await this.db.select({ total: count() }).from(products).where(where);
    const total = countRow?.total ?? 0;

    const rows = await this.db
      .select()
      .from(products)
      .where(where)
      .orderBy(...orderByFor(criteria.sort))
      .limit(criteria.pageSize)
      .offset((criteria.page - 1) * criteria.pageSize);

    return {
      items: rows.map(rowToProduct),
      page: criteria.page,
      pageSize: criteria.pageSize,
      total,
    };
  }

  async create(input: ProductCreateInput): Promise<Product> {
    const [row] = await this.db
      .insert(products)
      .values({
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        description: input.description,
        type: input.type,
        platform: input.platform,
        categoryId: input.categoryId,
        priceCents: input.priceCents,
        status: input.status,
        coverImageUrl: input.coverImageUrl,
        assetUrl: input.assetUrl,
      })
      .returning();
    if (!row) {
      throw new Error('Inserting a product returned no row');
    }
    return rowToProduct(row);
  }

  async update(id: string, changes: ProductUpdateInput): Promise<Product | null> {
    const updateValues: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    if (changes.slug !== undefined) updateValues.slug = changes.slug;
    if (changes.title !== undefined) updateValues.title = changes.title;
    if (changes.summary !== undefined) updateValues.summary = changes.summary;
    if (changes.description !== undefined) updateValues.description = changes.description;
    if (changes.type !== undefined) updateValues.type = changes.type;
    if (changes.platform !== undefined) updateValues.platform = changes.platform;
    if (changes.categoryId !== undefined) updateValues.categoryId = changes.categoryId;
    if (changes.priceCents !== undefined) updateValues.priceCents = changes.priceCents;
    if (changes.coverImageUrl !== undefined) updateValues.coverImageUrl = changes.coverImageUrl;
    if (changes.assetUrl !== undefined) updateValues.assetUrl = changes.assetUrl;

    const [row] = await this.db
      .update(products)
      .set(updateValues)
      .where(eq(products.id, id))
      .returning();
    return row ? rowToProduct(row) : null;
  }

  async updateStatus(id: string, status: ProductStatus): Promise<Product | null> {
    const [row] = await this.db
      .update(products)
      .set({ status, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return row ? rowToProduct(row) : null;
  }
}

function orderByFor(sort: ProductSearchCriteria['sort']) {
  switch (sort) {
    case 'price_asc':
      return [asc(products.priceCents), asc(products.createdAt)];
    case 'price_desc':
      return [desc(products.priceCents), desc(products.createdAt)];
    case 'title':
      return [asc(products.title), asc(products.createdAt)];
    case 'newest':
    default:
      return [desc(products.createdAt), desc(products.id)];
  }
}

export function rowToProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    type: row.type,
    platform: row.platform,
    categoryId: row.categoryId,
    priceCents: row.priceCents,
    status: row.status,
    coverImageUrl: row.coverImageUrl,
    assetUrl: row.assetUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
