import type { Order } from '../../domain/model/order.js';
import type { OrderRepository } from '../../domain/ports/order-repository.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors/index.js';

export interface GetOrderDeps {
  orders: OrderRepository;
}

// Un pedido, pero solo de su dueño (la vista de admin llega después).
export class GetOrder {
  constructor(private readonly deps: GetOrderDeps) {}

  async execute(orderId: string, userId: string): Promise<Order> {
    const order = await this.deps.orders.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }
    if (order.userId !== userId) {
      throw new ForbiddenError('This order belongs to another user');
    }
    return order;
  }
}
