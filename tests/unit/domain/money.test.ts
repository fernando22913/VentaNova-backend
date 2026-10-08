import { describe, expect, it } from 'vitest';

import { Money } from '../../../src/domain/model/money.js';
import { ValidationError } from '../../../src/domain/errors/index.js';

describe('Money', () => {
  it('stores integer cents and exposes them', () => {
    const money = Money.fromCents(3999);
    expect(money.amountInCents).toBe(3999);
  });

  it('rejects negative amounts', () => {
    expect(() => Money.fromCents(-1)).toThrow(ValidationError);
  });

  it('rejects non-integer amounts (floats never touch money)', () => {
    expect(() => Money.fromCents(19.99)).toThrow(ValidationError);
    expect(() => Money.fromCents(Number.NaN)).toThrow(ValidationError);
    expect(() => Money.fromCents(Number.POSITIVE_INFINITY)).toThrow(ValidationError);
  });

  it('adds immutably', () => {
    const a = Money.fromCents(100);
    const b = Money.fromCents(250);
    expect(a.add(b).amountInCents).toBe(350);
    expect(a.amountInCents).toBe(100);
    expect(b.amountInCents).toBe(250);
  });

  it('multiplies by an integer quantity', () => {
    expect(Money.fromCents(1999).multiplyBy(3).amountInCents).toBe(5997);
  });

  it('rejects multiplication by non-positive quantities', () => {
    const money = Money.fromCents(100);
    expect(() => money.multiplyBy(0)).toThrow(ValidationError);
    expect(() => money.multiplyBy(-1)).toThrow(ValidationError);
    expect(() => money.multiplyBy(1.5)).toThrow(ValidationError);
  });

  it('compares for equality and zero', () => {
    expect(Money.fromCents(100).equals(Money.fromCents(100))).toBe(true);
    expect(Money.fromCents(100).equals(Money.fromCents(101))).toBe(false);
    expect(Money.zero().equals(Money.fromCents(0))).toBe(true);
  });

  it('recomputes an order total from DB prices (invariant #1)', () => {
    const line = Money.fromCents(1999).multiplyBy(2);
    const total = line.add(Money.fromCents(500));
    expect(total.amountInCents).toBe(4498);
  });
});
