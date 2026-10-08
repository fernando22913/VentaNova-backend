import type { OrderStatus } from './enums.js';

/**
 * A sales order. Owned by a user, made of snapshot order items.
 *
 * `totalCents` is the server-recomputed sum of unit price × quantity taken
 * from database prices at creation time — never from the client payload.
 * `items` are embedded in the order so the domain works with the whole
 * aggregate and the repository materializes them with one join.
 */
export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  paidAt: Date | null;
  items: OrderItem[];
}

/** An order line. Title and price are snapshotted at purchase time
 * (domain invariant #2): later price or title edits never mutate history. */
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
