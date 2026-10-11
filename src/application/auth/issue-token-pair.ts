import type { User } from '../../domain/model/user.js';
import type { TokenService } from '../../domain/ports/token-service.js';
import type { RefreshTokenRepository } from '../../domain/ports/refresh-token-repository.js';
import type { RefreshTokenGenerator } from '../../domain/ports/refresh-token-generator.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'bearer';
  expiresIn: number;
}

export interface IssueTokenPairDeps {
  tokens: TokenService;
  refreshTokens: RefreshTokenRepository;
  generator: RefreshTokenGenerator;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

// Emite el par (access JWT, refresh token opaco) que usan register, login y refresh.
export class IssueTokenPair {
  constructor(private readonly deps: IssueTokenPairDeps) {}

  async execute(
    user: User,
    options: { familyId?: string; repository?: RefreshTokenRepository } = {},
  ): Promise<TokenPair> {
    const repository = options.repository ?? this.deps.refreshTokens;

    const accessToken = await this.deps.tokens.sign({ sub: user.id, role: user.role });
    const refreshToken = this.deps.generator.generate();
    const familyId = options.familyId ?? this.deps.generator.generateFamilyId();
    const expiresAt = new Date(Date.now() + this.deps.refreshTokenTtlSeconds * 1000);

    await repository.create({
      userId: user.id,
      familyId,
      tokenHash: this.deps.generator.hash(refreshToken),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'bearer',
      expiresIn: this.deps.accessTokenTtlSeconds,
    };
  }
}
