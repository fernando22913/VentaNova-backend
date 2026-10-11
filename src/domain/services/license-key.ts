import { randomBytes } from 'node:crypto';

import { ValidationError } from '../errors/index.js';

// License key simulada con formato `BM-XXXXX-XXXXX-XXXXX` (invariante #6); se guarda legible pero se genera con aleatoriedad cripto.

const PATTERN = /^BM-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I/O/0/1 — menos confuso
const GROUPS = 3;
const GROUP_LENGTH = 5;

export class LicenseKey {
  constructor(readonly value: string) {
    if (!PATTERN.test(value)) {
      throw new ValidationError(`Invalid license key format: "${value}"`);
    }
  }

  static parse(value: string): LicenseKey {
    return new LicenseKey(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: LicenseKey): boolean {
    return this.value === other.value;
  }
}

export class LicenseKeyGenerator {
  generate(): LicenseKey {
    const bytes = randomBytes(GROUPS * GROUP_LENGTH);
    const groups: string[] = [];
    for (let i = 0; i < GROUPS; i++) {
      let group = '';
      for (let j = 0; j < GROUP_LENGTH; j++) {
        group += ALPHABET[bytes[i * GROUP_LENGTH + j]! % ALPHABET.length];
      }
      groups.push(group);
    }
    return new LicenseKey(`BM-${groups.join('-')}`);
  }
}

export function isLicenseKey(value: string): boolean {
  return PATTERN.test(value);
}
