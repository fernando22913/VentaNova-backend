/**
 * Payment gateway port — the hexagonal showcase (ADR-08).
 *
 * It will have three implementations behind one interface: an in-memory fake
 * (unit tests), the SimulatedPaymentGateway (production demo, Phase 5) and an
 * optional Stripe adapter (Phase 9). `PayOrder` never changes.
 *
 * Card details are a plain value object here and are never persisted.
 */
export interface CardDetails {
  cardName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

export type PaymentResult =
  { approved: true; transactionId: string } | { approved: false; declinedReason: string };

export interface PaymentGateway {
  charge(card: CardDetails, amountCents: number): Promise<PaymentResult>;
}
