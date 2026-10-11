import type { UserRepository } from '../../domain/ports/user-repository.js';
import type { Hasher } from '../../domain/ports/hasher.js';
import type { User } from '../../domain/model/user.js';
import type { IssueTokenPair, TokenPair } from './issue-token-pair.js';
import { ConflictError } from '../../domain/errors/index.js';

export interface RegisterUserInput {
  email: string;
  name: string;
  password: string;
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
}

export interface RegisterUserDeps {
  users: UserRepository;
  hasher: Hasher;
  issueTokenPair: IssueTokenPair;
}

// Registra un cliente con email normalizado; el rol nunca se confía, siempre CUSTOMER.
export class RegisterUser {
  constructor(private readonly deps: RegisterUserDeps) {}

  async execute(input: RegisterUserInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.deps.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await this.deps.hasher.hash(input.password);
    const user = await this.deps.users.create({
      email,
      name: input.name.trim(),
      passwordHash,
      role: 'CUSTOMER',
    });

    const tokens = await this.deps.issueTokenPair.execute(user);
    return { user, tokens };
  }
}
