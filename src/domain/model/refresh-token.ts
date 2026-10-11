// Sesión de refresh-token persistida; solo guarda el hash y familyId agrupa una sesión de login para detectar reutilización.
export interface RefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface RefreshTokenCreateInput {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}
