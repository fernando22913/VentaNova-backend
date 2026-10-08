import { Router } from 'express';

import type { AppContainer } from '../../../container.js';
import { requireAuth } from '../middleware/require-auth.js';
import { toLibraryItemDto } from '../dto.js';

export function createLibraryRouter(container: AppContainer): Router {
  const router = Router();
  router.use(requireAuth(container.tokenService));

  router.get('/', async (req, res) => {
    const items = await container.useCases.listLibrary.execute(req.auth!.userId);
    res.json({ items: items.map((item) => toLibraryItemDto(item.entitlement, item.product)) });
  });

  return router;
}
