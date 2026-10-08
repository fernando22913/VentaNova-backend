import { hash, verify } from '@node-rs/argon2';
import type { Options } from '@node-rs/argon2';

import type { Hasher } from '../../domain/ports/hasher.js';

// Argon2id (const enum value 2 — the library's normative default; the ambient
// const enum isn't value-accessible under verbatimModuleSyntax).
const ARGON2_OPTIONS: Options = {
  algorithm: 2, // Algorithm.Argon2id
  memoryCost: 19456, // ~19 MiB — Argon2id recommended baseline
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

/** Argon2id hasher (blueprint §10): password storage uses a memory-hard KDF,
 * which protects slow-hashed passwords against GPU/ASIC brute force. */
export class ArgonHasher implements Hasher {
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  verify(plain: string, hashed: string): Promise<boolean> {
    return verify(hashed, plain);
  }
}
