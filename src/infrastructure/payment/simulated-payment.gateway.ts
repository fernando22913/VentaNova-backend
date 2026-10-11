import { randomUUID } from 'node:crypto';

import type {
  CardDetails,
  PaymentGateway,
  PaymentResult,
} from '../../domain/ports/payment-gateway.js';
import { ValidationError } from '../../domain/errors/index.js';

// Gateway demo determinista (sin llamadas externas): Luhn inválido rechaza, números que acaban en 0000 se declinan, si no aprueba.
export class SimulatedPaymentGateway implements PaymentGateway {
  charge(card: CardDetails, _amountCents: number): Promise<PaymentResult> {
    const digits = card.cardNumber.replace(/\s+/g, '');

    if (!isLuhnValid(digits)) {
      return Promise.reject(new ValidationError('Card number failed Luhn validation'));
    }

    if (digits.endsWith('0000')) {
      return Promise.resolve({ approved: false, declinedReason: 'insufficient_funds' });
    }

    return Promise.resolve({ approved: true, transactionId: `sim_${randomUUID()}` });
  }
}

// Checksum Luhn para números de tarjeta (12-19 dígitos).
export function isLuhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let value = Number(digits[index]);
    if (doubleDigit) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export type { CardDetails };
