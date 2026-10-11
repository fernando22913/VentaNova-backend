import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import { ArgonHasher } from '../../src/infrastructure/auth/argon.hasher.js';
import {
  getTestDatabase,
  resetDatabase,
  TEST_DATABASE_URL,
} from '../integration/helpers/test-db.js';
import { makeUser, repositories } from '../integration/helpers/factories.js';
import type { Database } from '../../src/infrastructure/persistence/db.js';

interface AuthBody {
  access_token: string;
}

interface ContactBody {
  id: string;
  email: string;
  subject: string;
  status: string;
  reply: string | null;
  repliedBy: string | null;
}

const as = <T>(body: unknown) => body as T;

const validPayload = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Consulta sobre licencias',
  message: '¿Las licencias son vitalicias?',
};

describe('Contacts inbox API (staff contract)', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let workerToken: string;
  let customerToken: string;
  let workerId: string;

  beforeAll(async () => {
    const { db: database } = await getTestDatabase();
    db = database;
    app = createApp(buildContainer({ databaseUrl: TEST_DATABASE_URL }));
  });

  beforeEach(async () => {
    const { client } = await getTestDatabase();
    await resetDatabase(client);

    const repos = repositories(db);
    const hasher = new ArgonHasher();
    await makeUser(repos, {
      email: 'admin@test.dev',
      name: 'Admin',
      role: 'ADMIN',
      passwordHash: await hasher.hash('password123'),
    });
    const worker = await makeUser(repos, {
      email: 'worker@test.dev',
      name: 'Worker',
      role: 'WORKER',
      passwordHash: await hasher.hash('password123'),
    });
    workerId = worker.id;
    await makeUser(repos, {
      email: 'customer@test.dev',
      name: 'Customer',
      role: 'CUSTOMER',
      passwordHash: await hasher.hash('password123'),
    });

    adminToken = await login('admin@test.dev');
    workerToken = await login('worker@test.dev');
    customerToken = await login('customer@test.dev');
  });

  async function login(email: string): Promise<string> {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    return as<AuthBody>(response.body).access_token;
  }

  async function submit(): Promise<ContactBody> {
    const response = await request(app).post('/api/v1/contact').send(validPayload);
    return as<ContactBody>(response.body);
  }

  it('401s guests and 403s customers', async () => {
    const anon = await request(app).get('/api/v1/contacts');
    expect(anon.status).toBe(401);

    const customer = await request(app)
      .get('/api/v1/contacts')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customer.status).toBe(403);
  });

  it('lists submissions for a WORKER', async () => {
    await submit();
    const response = await request(app)
      .get('/api/v1/contacts')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(response.status).toBe(200);
    const items = as<{ items: ContactBody[] }>(response.body).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      email: 'ada@example.com',
      subject: 'Consulta sobre licencias',
      status: 'OPEN',
      reply: null,
    });
  });

  it('records a reply and marks the message resolved', async () => {
    const message = await submit();

    const response = await request(app)
      .post(`/api/v1/contacts/${message.id}/reply`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ reply: 'Sí, las licencias son vitalicias.' });

    expect(response.status).toBe(200);
    const body = as<ContactBody>(response.body);
    expect(body.status).toBe('RESOLVED');
    expect(body.reply).toBe('Sí, las licencias son vitalicias.');
    expect(body.repliedBy).toBe(workerId);
  });

  it('409s a second reply and 404s an unknown id', async () => {
    const message = await submit();
    await request(app)
      .post(`/api/v1/contacts/${message.id}/reply`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ reply: 'primera' });

    const again = await request(app)
      .post(`/api/v1/contacts/${message.id}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reply: 'segunda' });
    expect(again.status).toBe(409);

    const missing = await request(app)
      .post('/api/v1/contacts/00000000-0000-4000-8000-000000000000/reply')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reply: 'x' });
    expect(missing.status).toBe(404);
  });

  it('422s an empty reply', async () => {
    const message = await submit();
    const response = await request(app)
      .post(`/api/v1/contacts/${message.id}/reply`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ reply: '   ' });
    expect(response.status).toBe(422);
  });
});
