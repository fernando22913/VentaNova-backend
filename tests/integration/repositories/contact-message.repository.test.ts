import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { repositories } from '../helpers/factories.js';

describe('ContactMessageRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  it('persists a message and returns it with an id and timestamp', async () => {
    const message = await repos.contacts.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'Consulta sobre licencias',
      message: '¿Las licencias son vitalicias?',
    });

    expect(message.id).toBeTruthy();
    expect(message.createdAt).toBeInstanceOf(Date);
    expect(message).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'Consulta sobre licencias',
      message: '¿Las licencias son vitalicias?',
    });
  });

  it('round-trips the exact inbound text', async () => {
    const created = await repos.contacts.create({
      name: '  Grace Hopper  ',
      email: 'grace@example.com',
      subject: 'Soporte',
      message: 'Mensaje de prueba',
    });

    expect(created.name).toBe('  Grace Hopper  ');
    expect(created.message).toBe('Mensaje de prueba');
  });
});