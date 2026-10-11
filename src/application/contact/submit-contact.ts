import type { ContactMessage, ContactMessageCreateInput } from '../../domain/model/contact-message.js';
import type { ContactRepository } from '../../domain/ports/contact-repository.js';

export interface SubmitContactDeps {
  contacts: ContactRepository;
}

export class SubmitContact {
  constructor(private readonly deps: SubmitContactDeps) {}

  /**
   * Persists a validated contact submission. Resolves only once the row is
   * committed — a caller can treat a returned message as «stored», never
   * «emailed» (there is no email transport).
   */
  execute(input: ContactMessageCreateInput): Promise<ContactMessage> {
    return this.deps.contacts.create(input);
  }
}