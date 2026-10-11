import type { UserRepository } from '../../domain/ports/user-repository.js';
import type { User } from '../../domain/model/user.js';
import { NotFoundError } from '../../domain/errors/index.js';

export interface GetMeDeps {
  users: UserRepository;
}

// Usuario actual a partir del subject del token autenticado.
export class GetMe {
  constructor(private readonly deps: GetMeDeps) {}

  async execute(userId: string): Promise<User> {
    const user = await this.deps.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }
}
