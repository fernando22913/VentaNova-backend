import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';

import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import { contactMessages } from '../../src/infrastructure/persistence/schema.js';
import {
  getTestDatabase,
  resetDatabase,
  TEST_DATABASE_URL,
} from '../integration/helpers/test-db.js';
import type { Database } from '../../src/infrastructure/persistence/db.js';

interface ContactBody {
  id: string;
  name: string;
  subject: string;
  message: string;
}

interface ApiError {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

const as = <T>(body: unknown) => body as T;

const validPayload = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Consulta sobre licencias',
  message: '¿Las licencias son vitalicias?',
};

describe('Contact API (contract)', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const { db: database } = await getTestDatabase();
    db = database;
    app = createApp(buildContainer({ databaseUrl: TEST_DATABASE_URL }));
  });

  beforeEach(async () => {
    const { client } = await getTestDatabase();
    await resetDatabase(client);
  });

  it('persists a valid submission and returns 201 with the stored message', async () => {
    const response = await request(app).post('/api/v1/contact').send(validPayload);

    expect(response.status).toBe(201);
    const body = as<ContactBody>(response.body);
    expect(body.id).toBeTruthy();
    expect(body).toMatchObject({
      name: 'Ada Lovelace',
      subject: 'Consulta sobre licencias',
      message: '¿Las licencias son vitalicias?',
    });

    const rows = await db.select().from(contactMessages).where(eq(contactMessages.email, 'ada@example.com'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Ada Lovelace',
      subject: 'Consulta sobre licencias',
      message: '¿Las licencias son vitalicias?',
    });
  });

  it('does not require authentication for public contact', async () => {
    const response = await request(app).post('/api/v1/contact').send(validPayload);
    expect(response.status).toBe(201);
  });

  it('rejects a missing required field with 422 and field details', async () => {
    const response = await request(app).post('/api/v1/contact').send({ name: 'Ada', email: 'ada@example.com' });

    expect(response.status).toBe(422);
    const body = as<ApiError>(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.map((d) => d.path)).toEqual(
      expect.arrayContaining(['subject', 'message']),
    );
  });

  it('rejects an invalid email with 422', async () => {
    const response = await request(app)
      .post('/api/v1/contact')
      .send({ ...validPayload, email: 'not-an-email' });

    expect(response.status).toBe(422);
    expect(as<ApiError>(response.body).error.details?.[0]?.path).toBe('email');
  });

  it('rejects a blank subject (whitespace only) after trimming', async () => {
    const response = await request(app)
      .post('/api/v1/contact')
      .send({ ...validPayload, subject: '   ' });

    expect(response.status).toBe(422);
    expect(as<ApiError>(response.body).error.details?.[0]?.path).toBe('subject');
  });

  it('rejects an oversized message with 422', async () => {
    const response = await request(app)
      .post('/api/v1/contact')
      .send({ ...validPayload, message: 'x'.repeat(2001) });

    expect(response.status).toBe(422);
    expect(as<ApiError>(response.body).error.details?.[0]?.path).toBe('message');
  });

  it('rejects an oversized name with 422', async () => {
    const response = await request(app)
      .post('/api/v1/contact')
      .send({ ...validPayload, name: 'x'.repeat(81) });

    expect(response.status).toBe(422);
    expect(as<ApiError>(response.body).error.details?.[0]?.path).toBe('name');
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await request(app)
      .post('/api/v1/contact')
      .set('Content-Type', 'application/json')
      .send('{"name": "Ada",');

    expect(response.status).toBe(400);
    expect(as<ApiError>(response.body).error.code).toBe('INVALID_JSON');
  });
});