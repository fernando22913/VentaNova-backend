import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildContainer } from '../src/container.js';
import { createApp } from '../src/infrastructure/http/app.js';

const container = buildContainer();

describe('health endpoint', () => {
  it('GET /api/v1/health returns 200 with service metadata', async () => {
    const response = await request(createApp(container)).get('/api/v1/health');
    const body = response.body as { status: string; service: string; timestamp: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', service: 'bytemarket-api' });
    expect(typeof body.timestamp).toBe('string');
  });

  it('unknown routes return the standard error envelope', async () => {
    const response = await request(createApp(container)).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
});

describe('request correlation', () => {
  it('reuses an inbound x-request-id and echoes it back', async () => {
    const response = await request(createApp(container))
      .get('/api/v1/health')
      .set('x-request-id', 'inbound-request-id');

    expect(response.headers['x-request-id']).toBe('inbound-request-id');
  });

  it('generates a request id when none is supplied', async () => {
    const response = await request(createApp(container)).get('/api/v1/health');

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
