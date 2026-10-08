import { ValidationError } from '../errors/index.js';

/**
 * Money value object — positive integer cents, nothing else.
 *
 * Domain invariant #5: floats never touch money. `Money` is the only currency
 * shape the core understands; every amount that matters (product price, order
 * total, snapshot unit price) lives behind it so arithmetic cannot silently
 * introduce rounding or sign errors. The total is always recomputed server
 * side from database prices; this object is how that recomputation happens.
 */
export class Money {
  private constructor(private readonly cents: number) {}

  static fromCents(cents: number): Money {
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw new ValidationError('Money must be a non-negative safe integer number of cents');
    }
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  /** Immutable addition of two moneys. */
  add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  /** Quantity must be a positive integer; the result is still integer cents. */
  multiplyBy(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive safe integer');
    }
    return Money.fromCents(this.cents * quantity);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  get amountInCents(): number {
    return this.cents;
  }

  toString(): string {
    return `${this.cents}`;
  }
}
