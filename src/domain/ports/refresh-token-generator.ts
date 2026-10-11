// Puerto para generar y hashear refresh tokens opacos; mantiene la aleatoriedad/hash en el adaptador cripto.
export interface RefreshTokenGenerator {
  // Un nuevo token opaco de alta entropía — solo se persiste su hash.
  generate(): string;
  // Hash estable para búsquedas sin guardar nunca el token en claro.
  hash(token: string): string;
  // Un nuevo id de familia de rotación (uno por sesión de login).
  generateFamilyId(): string;
}
