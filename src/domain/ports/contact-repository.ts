import type {
  ContactMessage,
  ContactMessageCreateInput,
  ContactMessageReplyInput,
} from '../model/contact-message.js';

// Puerto de persistencia para mensajes de contacto; el lado público escribe mientras WORKER/ADMIN leen y responden.
export interface ContactRepository {
  create(input: ContactMessageCreateInput): Promise<ContactMessage>;
  findAll(): Promise<ContactMessage[]>;
  findById(id: string): Promise<ContactMessage | null>;
  reply(id: string, input: ContactMessageReplyInput): Promise<ContactMessage | null>;
}
