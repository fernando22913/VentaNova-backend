import { describe, expect, it } from 'vitest';

import { parseDurationToSeconds } from '../../../src/config/duration.js';

describe('parseDurationToSeconds', () => {
  it('parses the supported compact units', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('1h')).toBe(3600);
    expect(parseDurationToSeconds('7d')).toBe(604_800);
  });

  it('rejects malformed or non-positive durations', () => {
    expect(() => parseDurationToSeconds('1 hour')).toThrow();
    expect(() => parseDurationToSeconds('h')).toThrow();
    expect(() => parseDurationToSeconds('0h')).toThrow();
    expect(() => parseDurationToSeconds('-1h')).toThrow();
    expect(() => parseDurationToSeconds('')).toThrow();
  });
});
