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

/**
 * A fixed, valid argon2id hash verified when the email is unknown. Running a
 * real verification (against a throwaway hash) keeps the response time of
 * "unknown email" indistinguishable from "wrong password", closing the timing
 * side-channel that would otherwise let an attacker enumerate accounts.
 */
const TIMING_EQUALIZER_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$33C+e0VZBIWPwNBjFXEIWA$jdbDKrg0ecK0OBEWzj/h21d06Y3cQMVdVFlRGgYDioY';

/**
 * Authenticate a user. The 401 message is identical for "unknown email" and
 * "wrong password" so the endpoint never reveals which accounts exist.
 */
export class LoginUser {
  constructor(private readonly deps: LoginUserDeps) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.deps.users.findByEmail(email);

    if (!user) {
      // Burn the same argon2 work as a real check before rejecting.
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
