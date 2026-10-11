import { describe, expect, it } from 'vitest';

import { SubmitContact } from '../../../src/application/contact/submit-contact.js';
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