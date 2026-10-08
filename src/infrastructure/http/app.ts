import type { Request, Response } from 'express';

import { env } from '../../config/env.js';
import type { AppContainer } from '../../container.js';
import { healthRouter } from './routes/health.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createCategoriesRouter } from './routes/categories.routes.js';
import { createProductsRouter } from './routes/products.routes.js';
import { createOrdersRouter } from './routes/orders.routes.js';
import { createLibraryRouter } from './routes/library.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRateLimiter, catalogRateLimiter } from './middleware/rate-limit.js';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

export function createApp(container: AppContainer): Express {
  const app = express();

  // Behind Render's proxy, trust the first hop so req.ip (rate limiting) is the
  // real client address rather than the load balancer.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRateLimiter, createAuthRouter(container));
  // Catalog reads share one IP-keyed budget: product search runs ILIKE scans,
  // so unbounded requests are the cheapest way to load the database.
  app.use('/api/v1/categories', catalogRateLimiter, createCategoriesRouter(container));
  app.use('/api/v1/products', catalogRateLimiter, createProductsRouter(container));
  app.use('/api/v1/orders', createOrdersRouter(container));
  app.use('/api/v1/library', createLibraryRouter(container));
  app.use('/api/v1/admin', createAdminRouter(container));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(errorHandler);

  return app;
}
