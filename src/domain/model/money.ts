import { ValidationError } from '../errors/index.js';

// Objeto de valor Money: solo céntimos enteros positivos; los floats nunca tocan el dinero.
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

  // Suma inmutable de dos Money.
  add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  // La cantidad debe ser un entero positivo; el resultado sigue siendo céntimos enteros.
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
