import { describe, expect, it } from 'vitest';

import {
  LicenseKey,
  LicenseKeyGenerator,
  isLicenseKey,
} from '../../../src/domain/services/license-key.js';
import { ValidationError } from '../../../src/domain/errors/index.js';

const FORMAT = /^BM-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;

describe('LicenseKey', () => {
  it('generates keys in the BM-XXXXX-XXXXX-XXXXX format (invariant #6)', () => {
    const key = new LicenseKeyGenerator().generate().toString();
    expect(FORMAT.test(key)).toBe(true);
  });

  it('parses a valid key', () => {
    const key = LicenseKey.parse('BM-AAAAA-BBBBB-CCCCC');
    expect(key.toString()).toBe('BM-AAAAA-BBBBB-CCCCC');
  });

  it('rejects malformed keys', () => {
    const bad = [
      '',
      'BM-AAAA',
      'BM-AAAAA-BBBBB-CCCC',
      'xm-AAAAA-BBBBB-CCCCC',
      'BM-aaaaa-bbbbb-ccccc',
    ];
    for (const candidate of bad) {
      expect(() => LicenseKey.parse(candidate)).toThrow(ValidationError);
    }
  });

  it('produces practically unique keys', () => {
    const generator = new LicenseKeyGenerator();
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(generator.generate().toString());
    }
    expect(seen.size).toBe(500);
  });

  it('isLicenseKey matches the format predicate', () => {
    expect(isLicenseKey('BM-12345-ABCDE-ZZZZZ')).toBe(true);
    expect(isLicenseKey('nope')).toBe(false);
  });
});
