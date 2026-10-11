import { hash, verify } from '@node-rs/argon2';
import type { Options } from '@node-rs/argon2';

import type { Hasher } from '../../domain/ports/hasher.js';

// Valor 2 del const enum Argon2id: predeterminado de la librería, no accesible con verbatimModuleSyntax.
const ARGON2_OPTIONS: Options = {
  algorithm: 2, // Algorithm.Argon2id
  memoryCost: 19456, // ~19 MiB — línea base recomendada de Argon2id
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

// Hasher Argon2id (blueprint §10): KDF con uso intensivo de memoria protege contraseñas contra fuerza bruta GPU/ASIC.
export class ArgonHasher implements Hasher {
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  verify(plain: string, hashed: string): Promise<boolean> {
    return verify(hashed, plain);
  }
}
