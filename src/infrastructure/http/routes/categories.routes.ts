import { Router } from 'express';

import type { AppContainer } from '../../../container.js';
import { toCategoryDto } from '../dto.js';

export function createCategoriesRouter(container: AppContainer): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const categories = await container.useCases.listCategories.execute();
    res.json({ items: categories.map(toCategoryDto) });
  });

  return router;
}
