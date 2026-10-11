import type { UserRepository } from '../../domain/ports/user-repository.js';
import type { Hasher } from '../../domain/ports/hasher.js';
import type { User } from '../../domain/model/user.js';
import type { IssueTokenPair, TokenPair } from './issue-token-pair.js';
import { UnauthorizedError } from '../../domain/errors/index.js';

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface LoginUserResult {
  user: User;
  tokens: TokenPair;
}

export interface LoginUserDeps {
  users: UserRepository;
  hasher: Hasher;
  issueTokenPair: IssueTokenPair;
}

// Hash argon2id válido fijo que se verifica para emails desconocidos para igualar el tiempo.
const TIMING_EQUALIZER_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$33C+e0VZBIWPwNBjFXEIWA$jdbDKrg0ecK0OBEWzj/h21d06Y3cQMVdVFlRGgYDioY';

// Autentica un usuario; el 401 es idéntico para email desconocido y contraseña incorrecta.
export class LoginUser {
  constructor(private readonly deps: LoginUserDeps) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.deps.users.findByEmail(email);

    if (!user) {
      // Consume el mismo trabajo argon2 que una verificación real antes de rechazar.
      await this.deps.hasher.verify(input.password, TIMING_EQUALIZER_HASH);
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordOk = await this.deps.hasher.verify(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = await this.deps.issueTokenPair.execute(user);
    return { user, tokens };
  }
}
