import { describe, expect, it } from 'vitest';

import { SubmitContact } from '../../../src/application/contact/submit-contact.js';
import { ListContacts } from '../../../src/application/contact/list-contacts.js';
import { ReplyContact } from '../../../src/application/contact/reply-contact.js';
import { ConflictError, NotFoundError } from '../../../src/domain/errors/index.js';
import { InMemoryContactRepository } from '../helpers/fakes.js';

describe('SubmitContact', () => {
  it('persists the message and returns the stored row', async () => {
    const contacts = new InMemoryContactRepository();
    const submit = new SubmitContact({ contacts });

    const message = await submit.execute({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'Consulta sobre licencias',
      message: '¿Las licencias son vitalicias?',
    });

    expect(message).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'Consulta sobre licencias',
      message: '¿Las licencias son vitalicias?',
    });
    expect(message.id).toBeTruthy();
    expect(contacts.rows).toHaveLength(1);
    expect(contacts.rows[0]?.id).toBe(message.id);
  });

  it('stores every submission sequentially', async () => {
    const contacts = new InMemoryContactRepository();
    const submit = new SubmitContact({ contacts });

    await submit.execute({ name: 'A', email: 'a@example.com', subject: 'S1', message: 'M1' });
    await submit.execute({ name: 'B', email: 'b@example.com', subject: 'S2', message: 'M2' });

    expect(contacts.rows.map((row) => row.subject)).toEqual(['S1', 'S2']);
  });
});

describe('ListContacts / ReplyContact', () => {
  async function seed(contacts: InMemoryContactRepository) {
    const submit = new SubmitContact({ contacts });
    return submit.execute({
      name: 'Ada',
      email: 'ada@example.com',
      subject: 'Consulta',
      message: '¿Vitalicia?',
    });
  }

  it('lists submissions newest first and replies once', async () => {
    const contacts = new InMemoryContactRepository();
    const first = await seed(contacts);
    await new ListContacts({ contacts }).execute();
    expect(contacts.rows).toHaveLength(1);

    const reply = new ReplyContact({ contacts });
    const answered = await reply.execute({ id: first.id, reply: 'Sí, vitalicia.', repliedBy: 'u-1' });
    expect(answered.status).toBe('RESOLVED');
    expect(answered.reply).toBe('Sí, vitalicia.');
    expect(answered.repliedBy).toBe('u-1');
  });

  it('rejects an unknown id (404) and a second reply (409)', async () => {
    const contacts = new InMemoryContactRepository();
    const message = await seed(contacts);
    const reply = new ReplyContact({ contacts });

    await expect(
      reply.execute({ id: 'missing', reply: 'x', repliedBy: 'u-1' }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await reply.execute({ id: message.id, reply: 'primera', repliedBy: 'u-1' });
    await expect(
      reply.execute({ id: message.id, reply: 'segunda', repliedBy: 'u-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});