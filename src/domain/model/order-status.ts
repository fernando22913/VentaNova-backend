import { ValidationError } from '../errors/index.js';
import type { OrderStatus } from './enums.js';

// Tabla de transiciones del ciclo de vida del pedido: PENDING → PAID | FAILED | CANCELLED; los pedidos liquidados son terminales.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// Verifica una transición legal o lanza un ValidationError de dominio.
export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new ValidationError(`Illegal order status transition: ${from} → ${to}`);
  }
}
