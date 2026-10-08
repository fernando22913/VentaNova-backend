import { Router } from 'express';
import { z } from 'zod';

import { PRODUCT_PLATFORMS } from '../../../domain/model/enums.js';
import type { SearchProductsQuery } from '../../../application/catalog/search-products.js';
import type { AppContainer } from '../../../container.js';
import { parseOrThrow } from '../validation.js';
import { toPublicProduct, toPublicProductView } from '../dto.js';

const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'title'] as const;

const productQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  platform: z.enum([...PRODUCT_PLATFORMS]).optional(),
  minPrice: z.coerce.number().int().min(0).max(99_999_999).optional(),
  maxPrice: z.coerce.number().int().min(0).max(99_999_999).optional(),
  sort: z.enum([...PRODUCT_SORTS]).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});

export function createProductsRouter(container: AppContainer): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseOrThrow(productQuerySchema, req.query);

    const criteria: SearchProductsQuery = {
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.search) criteria.search = query.search;
    if (query.category) criteria.category = query.category;
    if (query.platform) criteria.platform = query.platform;
    if (query.minPrice !== undefined) criteria.minPriceCents = query.minPrice;
    if (query.maxPrice !== undefined) criteria.maxPriceCents = query.maxPrice;

    const result = await container.useCases.searchProducts.execute(criteria);
    res.json({
      items: result.items.map(toPublicProduct),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  });

  router.get('/:slug', async (req, res) => {
    const product = await container.useCases.getProductBySlug.execute(req.params.slug);
    res.json(toPublicProductView(product));
  });

  return router;
}
