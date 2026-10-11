import type { ContactMessage, ContactMessageCreateInput } from '../model/contact-message.js';

/**
 * Persistence port for contact submissions. The only write is `create`; there
 * is deliberately no read/update surface yet (an operator inbox can add one
 * later). Implemented by the Drizzle adapter.
 */
export interface ContactRepository {
  create(input: ContactMessageCreateInput): Promise<ContactMessage>;
}