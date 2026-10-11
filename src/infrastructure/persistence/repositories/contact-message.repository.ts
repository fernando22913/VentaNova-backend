import type { ContactMessage, ContactMessageCreateInput } from '../../../domain/model/contact-message.js';
import type { ContactRepository } from '../../../domain/ports/contact-repository.js';
import type { Database } from '../db.js';
import { contactMessages } from '../schema.js';

/** Drizzle adapter for the ContactRepository port. */
export class DrizzleContactRepository implements ContactRepository {
  constructor(private readonly db: Database) {}

  async create(input: ContactMessageCreateInput): Promise<ContactMessage> {
    const [row] = await this.db
      .insert(contactMessages)
      .values({
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
      })
      .returning();
    if (!row) {
      throw new Error('Inserting a contact message returned no row');
    }
    return rowToContactMessage(row);
  }
}

function rowToContactMessage(row: typeof contactMessages.$inferSelect): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    createdAt: row.createdAt,
  };
}