import type { RefreshToken, RefreshTokenCreateInput } from '../model/refresh-token.js';

// Puerto de persistencia para sesiones de refresh-token; solo se guarda el hash, nunca el token en claro.
export interface RefreshTokenRepository {
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  create(input: RefreshTokenCreateInput): Promise<RefreshToken>;
  // Revocación compare-and-set; devuelve false si ya estaba revocado (perdió la carrera de rotación).
  revoke(id: string, revokedAt: Date): Promise<boolean>;
  // Revoca todos los tokens aún activos de una familia de rotación (detección de reutilización y logout); devuelve el conteo.
  revokeFamily(familyId: string, revokedAt: Date): Promise<number>;
}
