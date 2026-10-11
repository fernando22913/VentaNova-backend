import type { Order } from '../../domain/model/order.js';
import type { OrderRepository } from '../../domain/ports/order-repository.js';

export interface ListOrdersDeps {
  orders: OrderRepository;
}

// Historial de pedidos de un usuario, del más reciente al más antiguo.
export class ListOrders {
  constructor(private readonly deps: ListOrdersDeps) {}

  execute(userId: string): Promise<Order[]> {
    return this.deps.orders.findByUser(userId);
  }
}
