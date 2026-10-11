import type { ContactMessage } from '../../domain/model/contact-message.js';
import type { ContactRepository } from '../../domain/ports/contact-repository.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';

export interface ReplyContactInput {
  id: string;
  reply: string;
  // Operador (WORKER/ADMIN) que registra la respuesta.
  repliedBy: string;
}

export interface ReplyContactDeps {
  contacts: ContactRepository;
}

// Registra la respuesta de un operador y marca el contacto como RESOLVED; re-responder da 409.
export class ReplyContact {
  constructor(private readonly deps: ReplyContactDeps) {}

  async execute(input: ReplyContactInput): Promise<ContactMessage> {
    const existing = await this.deps.contacts.findById(input.id);
    if (!existing) {
      throw new NotFoundError('Contact message');
    }
    if (existing.status === 'RESOLVED') {
      throw new ConflictError('Contact message is already answered');
    }

    const updated = await this.deps.contacts.reply(input.id, {
      reply: input.reply,
      repliedBy: input.repliedBy,
    });
    if (!updated) {
      throw new NotFoundError('Contact message');
    }
    return updated;
  }
}
