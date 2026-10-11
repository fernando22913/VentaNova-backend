import { desc, eq } from 'drizzle-orm';

import type {
  ContactMessage,
  ContactMessageCreateInput,
  ContactMessageReplyInput,
} from '../../../domain/model/contact-message.js';
import type { ContactRepository } from '../../../domain/ports/contact-repository.js';
import type { Database } from '../db.js';
import { contactMessages } from '../schema.js';

// Adaptador Drizzle para el puerto ContactRepository.
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

  async findAll(): Promise<ContactMessage[]> {
    const rows = await this.db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt));
    return rows.map(rowToContactMessage);
  }

  async findById(id: string): Promise<ContactMessage | null> {
    const [row] = await this.db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, id))
      .limit(1);
    return row ? rowToContactMessage(row) : null;
  }

  async reply(id: string, input: ContactMessageReplyInput): Promise<ContactMessage | null> {
    const [row] = await this.db
      .update(contactMessages)
      .set({
        status: 'RESOLVED',
        reply: input.reply,
        repliedAt: new Date(),
        repliedBy: input.repliedBy,
      })
      .where(eq(contactMessages.id, id))
      .returning();
    return row ? rowToContactMessage(row) : null;
  }
}

function rowToContactMessage(row: typeof contactMessages.$inferSelect): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    reply: row.reply,
    repliedAt: row.repliedAt,
    repliedBy: row.repliedBy,
    createdAt: row.createdAt,
  };
}
