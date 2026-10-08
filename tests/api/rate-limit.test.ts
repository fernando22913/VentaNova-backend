import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import {
  AUTH_RATE_LIMIT,
  CATALOG_RATE_LIMIT,
  ORDERS_CREATE_RATE_LIMIT,
  PAYMENT_RATE_LIMIT,
  createRateLimiter,
  type RateLimiterOptions,
} from '../../src/infrastructure/http/middleware/rate-limit.js';

function appWith(path: string, options: RateLimiterOptions) {
  const app = express();
  app.use(path, createRateLimiter(options));
  app.all(path, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate limiter middleware', () => {
  function appWithLimit(limit: number) {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, limit, enabled: true }));
    app.get('/', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('allows requests under the limit and blocks the rest with the 429 envelope', async () => {
    const app = appWithLimit(2);

    const first = await request(app).get('/');
    const second = await request(app).get('/');
    const third = await request(app).get('/');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    });
  });

  it('is a passthrough when disabled (tests)', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, limit: 0, enabled: false }));
    app.get('/', (_req, res) => res.json({ ok: true }));
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });

  it('is disabled by default under NODE_ENV=test, so the suite is never rate limited', async () => {
    const app = express();
    // No `enabled` override → falls back to NODE_ENV !== 'test'.
    app.use(createRateLimiter({ windowMs: 60_000, limit: 0 }));
    app.get('/', (_req, res) => res.json({ ok: true }));
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });
});

describe('configured rate limits', () => {
  it('keeps the existing auth and payment limits', () => {
    expect(AUTH_RATE_LIMIT.limit).toBe(30);
    expect(PAYMENT_RATE_LIMIT.limit).toBe(30);
  });

  it('limits order creation and catalog reads', () => {
    expect(ORDERS_CREATE_RATE_LIMIT.limit).toBe(60);
    expect(CATALOG_RATE_LIMIT.limit).toBe(300);
  });

  it('applies the order-creation limit on POST /api/v1/orders', async () => {
    const app = appWith('/api/v1/orders', {
      ...ORDERS_CREATE_RATE_LIMIT,
      limit: 2,
      enabled: true,
    });
    expect((await request(app).post('/api/v1/orders')).status).toBe(200);
    expect((await request(app).post('/api/v1/orders')).status).toBe(200);
    expect((await request(app).post('/api/v1/orders')).status).toBe(429);
  });

  it('applies the catalog limit on GET /api/v1/products', async () => {
    const app = appWith('/api/v1/products', { ...CATALOG_RATE_LIMIT, limit: 2, enabled: true });
    expect((await request(app).get('/api/v1/products')).status).toBe(200);
    expect((await request(app).get('/api/v1/products')).status).toBe(200);
    expect((await request(app).get('/api/v1/products')).status).toBe(429);
  });

  it('applies the catalog limit on GET /api/v1/categories', async () => {
    const app = appWith('/api/v1/categories', { ...CATALOG_RATE_LIMIT, limit: 2, enabled: true });
    expect((await request(app).get('/api/v1/categories')).status).toBe(200);
    expect((await request(app).get('/api/v1/categories')).status).toBe(200);
    expect((await request(app).get('/api/v1/categories')).status).toBe(429);
  });
});
