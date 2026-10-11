import type { ContactMessage } from '../../domain/model/contact-message.js';
import type { ContactRepository } from '../../domain/ports/contact-repository.js';

export interface ListContactsDeps {
  contacts: ContactRepository;
}

// Bandeja del personal: todos los mensajes de contacto, más recientes primero.
export class ListContacts {
  constructor(private readonly deps: ListContactsDeps) {}

  execute(): Promise<ContactMessage[]> {
    return this.deps.contacts.findAll();
  }
}
