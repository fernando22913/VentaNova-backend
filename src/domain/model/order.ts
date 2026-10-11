import type { OrderStatus } from './enums.js';

// Pedido de venta de un usuario; totalCents se calcula en el servidor desde los precios de la BD y los items son instantáneas embebidas.
export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  paidAt: Date | null;
  items: OrderItem[];
}

// Línea de pedido; title y price se capturan al comprar (invariante #2), así ediciones posteriores nunca mutan el historial.
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  titleSnapshot: string;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderCreateInput {
  userId: string;
  totalCents: number;
  items: OrderItemCreateInput[];
}

export interface OrderItemCreateInput {
  productId: string;
  titleSnapshot: string;
  unitPriceCents: number;
  quantity: number;
}
