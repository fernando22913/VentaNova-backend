import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '../../../config/env.js';

// Rate limiting (blueprint §10) para superficies propensas al abuso; desactivado en tests, activo en dev/prod.
export interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  // Override para tests que necesitan que el limiter aplique de verdad.
  enabled?: boolean;
}

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const enabled = options.enabled ?? env.NODE_ENV !== 'test';
  if (!enabled) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
      });
    },
  });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// 30 / 15 min — fuerza bruta de credenciales.
export const AUTH_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 30 };
// 30 / 15 min — adivinanza de tarjeta en un pedido pendiente.
export const PAYMENT_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 30 };
// 60 / 15 min — creación de pedidos; frena el crecimiento ilimitado de filas PENDING.
export const ORDERS_CREATE_RATE_LIMIT: RateLimiterOptions = {
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
};
// 300 / 15 min — generoso para no interrumpir la navegación normal del catálogo.
export const CATALOG_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 300 };
// 10 / 15 min — una persona escribiendo un mensaje de contacto; frena el spam de la bandeja.
export const CONTACT_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 10 };
// 300 / 15 min — lectura agregada; mismo presupuesto generoso que el catálogo.
export const TRENDS_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 300 };

export const authRateLimiter = createRateLimiter(AUTH_RATE_LIMIT);
export const paymentRateLimiter = createRateLimiter(PAYMENT_RATE_LIMIT);
export const ordersCreateRateLimiter = createRateLimiter(ORDERS_CREATE_RATE_LIMIT);
export const catalogRateLimiter = createRateLimiter(CATALOG_RATE_LIMIT);
export const contactRateLimiter = createRateLimiter(CONTACT_RATE_LIMIT);
export const trendsRateLimiter = createRateLimiter(TRENDS_RATE_LIMIT);
