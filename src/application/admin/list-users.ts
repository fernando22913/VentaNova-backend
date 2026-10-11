import type { User } from '../../domain/model/user.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';

export interface ListUsersDeps {
  users: UserRepository;
}

// Solo admin: todas las cuentas (los hashes de contraseña nunca se mapean a un DTO).
export class ListUsers {
  constructor(private readonly deps: ListUsersDeps) {}

  execute(): Promise<User[]> {
    return this.deps.users.findAll();
  }
}
