/**
 * Hasher port — swappable password hashing (argon2id in production).
 * The core never sees plaintext passwords in persistence; adapters that
 * implement Hasher are the only place hashing algorithms live.
 */
export interface Hasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
