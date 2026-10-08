import type { Order } from '../../domain/model/order.js';
import type { OrderRepository } from '../../domain/ports/order-repository.js';

export interface ListAllOrdersDeps {
  orders: OrderRepository;
}

/** Admin: every order across all users, newest first. */
export class ListAllOrders {
  constructor(private readonly deps: ListAllOrdersDeps) {}

  execute(): Promise<Order[]> {
    return this.deps.orders.findAll();
  }
}
