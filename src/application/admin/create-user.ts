import type { User } from '../../domain/model/user.js';
import type { UserRole } from '../../domain/model/enums.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';
import type { Hasher } from '../../domain/ports/hasher.js';
import { ConflictError } from '../../domain/errors/index.js';

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface CreateUserDeps {
  users: UserRepository;
  hasher: Hasher;
}

/**
 * Admin-only: provision an account (typically a WORKER) with an operator
 * password. Unlike registration, the role here is trusted because the caller
 * is an authenticated admin — the route enforces that before this runs.
 */
export class CreateUser {
  constructor(private readonly deps: CreateUserDeps) {}

  async execute(input: CreateUserInput): Promise<User> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.deps.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await this.deps.hasher.hash(input.password);
    return this.deps.users.create({
      email,
      name: input.name.trim(),
      passwordHash,
      role: input.role,
    });
  }
}
