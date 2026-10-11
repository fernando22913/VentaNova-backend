import { Router } from 'express';

import type { AppContainer } from '../../../container.js';
import { trendsRateLimiter } from '../middleware/rate-limit.js';
import { toTrendReportDto } from '../dto.js';

/**
 * Public, read-only sales trends. The report is a coarse aggregation of paid
 * orders — no customer, order, or item-level detail is ever exposed.
 */
export function createTrendsRouter(container: AppContainer): Router {
  const router = Router();

  router.get('/', trendsRateLimiter, async (_req, res) => {
    const report = await container.useCases.getTrends.execute();
    res.json(toTrendReportDto(report));
  });

  return router;
}