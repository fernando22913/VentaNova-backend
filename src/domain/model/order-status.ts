import { ValidationError } from '../errors/index.js';
import type { OrderStatus } from './enums.js';

/**
 * The order lifecycle as an explicit transition table (blueprint invariant:
 * "the state machine has no illegal transitions").
 *
 * PENDING → PAID | FAILED | CANCELLED. Once settled, an order is terminal;
 * a PAID order can never revert, and a FAILED order can never be paid — the
 * caller retries by creating a new order.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Assert a legal transition or throw a domain ValidationError. */
export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new ValidationError(`Illegal order status transition: ${from} → ${to}`);
  }
}
