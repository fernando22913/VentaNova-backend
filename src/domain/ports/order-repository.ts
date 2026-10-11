import type { Order, OrderCreateInput, OrderStatus } from '../model/index.js';

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  // Pedidos de un usuario, del más reciente al más antiguo.
  findByUser(userId: string): Promise<Order[]>;
  // Todos los pedidos (admin), del más reciente al más antiguo.
  findAll(): Promise<Order[]>;
  // Crea el pedido y sus items de forma atómica.
  create(input: OrderCreateInput): Promise<Order>;
  // Transición compare-and-set atómica; devuelve null si el pedido no estaba en `from`, así los estados terminales nunca se sobrescriben.
  transitionStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    paidAt?: Date | null,
  ): Promise<Order | null>;
}
