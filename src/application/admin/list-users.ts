import type { User } from '../../domain/model/user.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';

export interface ListUsersDeps {
  users: UserRepository;
}

/** Admin-only: every account (password hashes are never mapped to a DTO). */
export class ListUsers {
  constructor(private readonly deps: ListUsersDeps) {}

  execute(): Promise<User[]> {
    return this.deps.users.findAll();
  }
}
