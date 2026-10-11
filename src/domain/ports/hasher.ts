// Puerto Hasher — hashing de contraseñas intercambiable (argon2id en producción); solo los adaptadores conocen los algoritmos.
export interface Hasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
