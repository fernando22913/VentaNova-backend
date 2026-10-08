import type {
  Product,
  ProductCreateInput,
  ProductUpdateInput,
  ProductStatus,
} from '../model/index.js';
import type { ProductPlatform } from '../model/index.js';

/**
 * Search criteria passed to the repository. This is a criteria object, not a
 * query DSL: the core says *what* it wants, the adapter decides *how*. Keeps
 * Drizzle/SQL out of the use cases (blueprint ADR-14).
 */
export interface ProductSearchCriteria {
  search?: string;
  categoryId?: string;
  platform?: ProductPlatform;
  minPriceCents?: number;
  maxPriceCents?: number;
  /** Optional so the admin can list every status; the public catalog always
   * pins it to PUBLISHED. */
  status?: ProductStatus;
  sort: ProductSort;
  page: number;
  pageSize: number;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'title';

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  /** Bulk read used to assemble the library (entitlements → products). */
  findByIds(ids: string[]): Promise<Product[]>;
  search(criteria: ProductSearchCriteria): Promise<PagedResult<Product>>;
  create(input: ProductCreateInput): Promise<Product>;
  update(id: string, changes: ProductUpdateInput): Promise<Product | null>;
  updateStatus(id: string, status: ProductStatus): Promise<Product | null>;
}
