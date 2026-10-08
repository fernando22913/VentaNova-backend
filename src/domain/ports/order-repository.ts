import type { Order, OrderCreateInput, OrderStatus } from '../model/index.js';

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  /** A user's orders, newest first. */
  findByUser(userId: string): Promise<Order[]>;
  /** All orders (admin), newest first. */
  findAll(): Promise<Order[]>;
  /** Creates the order and its items atomically. */
  create(input: OrderCreateInput): Promise<Order>;
  /**
   * Atomic compare-and-set for the order state machine: moves an order from
   * `from` to `to`, recording `paidAt` when provided. Returns null when the
   * order was not in `from` (it lost a payment race or was already settled),
   * so a concurrent request can never overwrite a terminal state.
   */
  transitionStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    paidAt?: Date | null,
  ): Promise<Order | null>;
}
