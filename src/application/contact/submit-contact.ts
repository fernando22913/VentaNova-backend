import type { ContactMessage, ContactMessageCreateInput } from '../../domain/model/contact-message.js';
import type { ContactRepository } from '../../domain/ports/contact-repository.js';

export interface SubmitContactDeps {
  contacts: ContactRepository;
}

export class SubmitContact {
  constructor(private readonly deps: SubmitContactDeps) {}

  // Persiste un contacto validado; devuelto significa guardado, nunca enviado por email.
  execute(input: ContactMessageCreateInput): Promise<ContactMessage> {
    return this.deps.contacts.create(input);
  }
}