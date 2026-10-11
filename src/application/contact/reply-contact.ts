import type { ContactMessage } from '../../domain/model/contact-message.js';
import type { ContactRepository } from '../../domain/ports/contact-repository.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';

export interface ReplyContactInput {
  id: string;
  reply: string;
  /** Operator (WORKER/ADMIN) recording the answer. */
  repliedBy: string;
}

export interface ReplyContactDeps {
  contacts: ContactRepository;
}

/**
 * Records an operator reply on a contact message and marks it RESOLVED.
 * There is no email transport, so this stores the reply text alongside the
 * message; re-answering an already-resolved message is a 409.
 */
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
