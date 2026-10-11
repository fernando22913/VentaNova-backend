import type { Order } from '../../domain/model/order.js';
import type { OrderRepository } from '../../domain/ports/order-repository.js';

export interface ListAllOrdersDeps {
  orders: OrderRepository;
}

// Admin: todos los pedidos de todos los usuarios, más recientes primero.
export class ListAllOrders {
  constructor(private readonly deps: ListAllOrdersDeps) {}

  execute(): Promise<Order[]> {
    return this.deps.orders.findAll();
  }
}
