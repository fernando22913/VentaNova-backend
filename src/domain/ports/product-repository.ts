import type {
  Product,
  ProductCreateInput,
  ProductUpdateInput,
  ProductStatus,
} from '../model/index.js';
import type { ProductPlatform } from '../model/index.js';

// Objeto de criterios de búsqueda (no un DSL de consulta); el adaptador decide cómo, manteniendo Drizzle/SQL fuera de los casos de uso (ADR-14).
export interface ProductSearchCriteria {
  search?: string;
  categoryId?: string;
  platform?: ProductPlatform;
  minPriceCents?: number;
  maxPriceCents?: number;
  // Opcional para que el admin liste cualquier estado; el catálogo público siempre lo fija a PUBLISHED.
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
  // Lectura en lote para armar la biblioteca (entitlements → products).
  findByIds(ids: string[]): Promise<Product[]>;
  search(criteria: ProductSearchCriteria): Promise<PagedResult<Product>>;
  create(input: ProductCreateInput): Promise<Product>;
  update(id: string, changes: ProductUpdateInput): Promise<Product | null>;
  updateStatus(id: string, status: ProductStatus): Promise<Product | null>;
}
