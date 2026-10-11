// Puerto de pasarela de pago — el ejemplo hexagonal (ADR-08) con implementaciones intercambiables; los datos de tarjeta nunca se persisten.
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
