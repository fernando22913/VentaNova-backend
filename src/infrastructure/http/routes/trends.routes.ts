import { Router } from 'express';

import type { AppContainer } from '../../../container.js';
import { trendsRateLimiter } from '../middleware/rate-limit.js';
import { toTrendReportDto } from '../dto.js';

// Tendencias de ventas públicas y de solo lectura: agregación gruesa sin detalle de cliente o artículo.
export function createTrendsRouter(container: AppContainer): Router {
  const router = Router();

  router.get('/', trendsRateLimiter, async (_req, res) => {
    const report = await container.useCases.getTrends.execute();
    res.json(toTrendReportDto(report));
  });

  return router;
}