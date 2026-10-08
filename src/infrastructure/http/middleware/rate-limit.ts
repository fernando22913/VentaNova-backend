import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '../../../config/env.js';

/**
 * Rate limiting (blueprint §10) for the surfaces worth abusing: credentials,
 * payment, order creation and the ILIKE-backed catalog search. Disabled under
 * tests so the suite can hammer endpoints freely; active in development and
 * production. Limits are deliberately generous — they stop runaway abuse, not
 * normal browsing.
 */
export interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  /** Override for tests that need the limiter actually enforcing. */
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

/** 30 / 15 min — brute-forcing credentials. */
export const AUTH_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 30 };
/** 30 / 15 min — card guessing on a pending order. */
export const PAYMENT_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 30 };
/** 60 / 15 min — order creation; stops unlimited PENDING-row growth. */
export const ORDERS_CREATE_RATE_LIMIT: RateLimiterOptions = {
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
};
/** 300 / 15 min — generous so normal catalog browsing is never interrupted. */
export const CATALOG_RATE_LIMIT: RateLimiterOptions = { windowMs: FIFTEEN_MINUTES, limit: 300 };

export const authRateLimiter = createRateLimiter(AUTH_RATE_LIMIT);
export const paymentRateLimiter = createRateLimiter(PAYMENT_RATE_LIMIT);
export const ordersCreateRateLimiter = createRateLimiter(ORDERS_CREATE_RATE_LIMIT);
export const catalogRateLimiter = createRateLimiter(CATALOG_RATE_LIMIT);
