import type {
  ContactMessage,
  ContactMessageCreateInput,
  ContactMessageReplyInput,
} from '../model/contact-message.js';

/**
 * Persistence port for contact submissions. The public side only writes
 * (`create`); the operator inbox (`findAll`/`findById`) and the reply flow
 * (`reply`) are exercised by WORKER/ADMIN staff. Implemented by the Drizzle
 * adapter.
 */
export interface ContactRepository {
  create(input: ContactMessageCreateInput): Promise<ContactMessage>;
  findAll(): Promise<ContactMessage[]>;
  findById(id: string): Promise<ContactMessage | null>;
  reply(id: string, input: ContactMessageReplyInput): Promise<ContactMessage | null>;
}
