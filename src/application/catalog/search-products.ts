import type { PagedResult, ProductSearchCriteria } from '../../domain/ports/product-repository.js';
import type { ProductRepository } from '../../domain/ports/product-repository.js';
import type { CategoryRepository } from '../../domain/ports/category-repository.js';
import type { Product, ProductPlatform } from '../../domain/model/index.js';

export interface SearchProductsQuery {
  search?: string;
  category?: string;
  platform?: ProductPlatform;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort: ProductSearchCriteria['sort'];
  page: number;
  pageSize: number;
}

export interface SearchProductsDeps {
  products: ProductRepository;
  categories: CategoryRepository;
}

/**
 * Public catalog search. The status filter is *always* PUBLISHED regardless of
 * caller input (drafts/archived are admin territory). The public `category`
 * param is a slug, mapped to the internal id; an unknown slug yields an empty
 * page rather than an error.
 */
export class SearchProducts {
  constructor(private readonly deps: SearchProductsDeps) {}

  async execute(query: SearchProductsQuery): Promise<PagedResult<Product>> {
    const criteria: ProductSearchCriteria = {
      status: 'PUBLISHED',
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    };

    if (query.search) criteria.search = query.search;

    if (query.category) {
      const category = await this.deps.categories.findBySlug(query.category);
      if (!category) {
        return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
      }
      criteria.categoryId = category.id;
    }

    if (query.platform) criteria.platform = query.platform;
    if (query.minPriceCents !== undefined) criteria.minPriceCents = query.minPriceCents;
    if (query.maxPriceCents !== undefined) criteria.maxPriceCents = query.maxPriceCents;

    return this.deps.products.search(criteria);
  }
}
