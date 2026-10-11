import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';

import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';
import type { AppContainer } from '../../container.js';
import { healthRouter } from './routes/health.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createCategoriesRouter } from './routes/categories.routes.js';
import { createProductsRouter } from './routes/products.routes.js';
import { createOrdersRouter } from './routes/orders.routes.js';
import { createLibraryRouter } from './routes/library.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';
import { createContactRouter } from './routes/contact.routes.js';
import { createContactsRouter } from './routes/contacts.routes.js';
import { createTrendsRouter } from './routes/trends.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRateLimiter, catalogRateLimiter } from './middleware/rate-limit.js';
import express, { type Express } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

export function createApp(container: AppContainer): Express {
  const app = express();

  // Detrás del proxy de Render, confía en el primer salto para que req.ip (rate limiting) sea la IP real del cliente.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins }));
  app.use(compression());
  // Correlaciona cada petición: reutiliza un `x-request-id` entrante o genera un UUID y lo devuelve.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const header = req.headers['x-request-id'];
        const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRateLimiter, createAuthRouter(container));
  // Las lecturas de catálogo comparten un presupuesto por IP: búsquedas sin límite sobrecargarían la base de datos.
  app.use('/api/v1/categories', catalogRateLimiter, createCategoriesRouter(container));
  app.use('/api/v1/products', catalogRateLimiter, createProductsRouter(container));
  app.use('/api/v1/orders', createOrdersRouter(container));
  app.use('/api/v1/library', createLibraryRouter(container));
  app.use('/api/v1/admin', createAdminRouter(container));
  app.use('/api/v1/contact', createContactRouter(container));
  app.use('/api/v1/contacts', createContactsRouter(container));
  app.use('/api/v1/trends', createTrendsRouter(container));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(errorHandler);

  return app;
}
