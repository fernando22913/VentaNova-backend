import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { Order, OrderCreateInput, OrderItem } from '../../../domain/model/order.js';
import type { OrderStatus } from '../../../domain/model/enums.js';
import type { OrderRepository } from '../../../domain/ports/order-repository.js';
import type { Database } from '../db.js';
import { orderItems, orders } from '../schema.js';

/** Drizzle adapter for the OrderRepository port. Loads order + items with one
 * join; writes order + items atomically (the insert inside a transaction when
 * used through the UnitOfWork). */
export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Order | null> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) return null;
    const items = await this.findItems(id);
    return orderFromParts(row, items);
  }

  async findByUser(userId: string): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt), desc(orders.id));
    return this.attachItems(rows);
  }

  async findAll(): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt), desc(orders.id));
    return this.attachItems(rows);
  }

  async create(input: OrderCreateInput): Promise<Order> {
    // One transaction so a failed line insert can never leave an orphan order.
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(orders)
        .values({ userId: input.userId, totalCents: input.totalCents })
        .returning();
      if (!row) {
        throw new Error('Inserting an order returned no row');
      }

      const inserted = await tx
        .insert(orderItems)
        .values(
          input.items.map((item) => ({
            orderId: row.id,
            productId: item.productId,
            titleSnapshot: item.titleSnapshot,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
          })),
        )
        .returning();

      return orderFromParts(row, inserted.map(rowToOrderItem));
    });
  }

  async transitionStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    paidAt?: Date | null,
  ): Promise<Order | null> {
    const setValues: Partial<typeof orders.$inferInsert> = { status: to };
    if (paidAt !== undefined) setValues.paidAt = paidAt;
    // The `status = from` predicate makes this a compare-and-set: a row that
    // another request already advanced is left untouched and yields null.
    const [row] = await this.db
      .update(orders)
      .set(setValues)
      .where(and(eq(orders.id, id), eq(orders.status, from)))
      .returning();
    if (!row) return null;
    const items = await this.findItems(id);
    return orderFromParts(row, items);
  }

  private async attachItems(rows: (typeof orders.$inferSelect)[]): Promise<Order[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const items = await this.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids))
      .orderBy(asc(orderItems.id));
    const byOrder = new Map<string, OrderItem[]>();
    for (const item of items) {
      const list = byOrder.get(item.orderId) ?? [];
      list.push(rowToOrderItem(item));
      byOrder.set(item.orderId, list);
    }
    return rows.map((row) => orderFromParts(row, byOrder.get(row.id) ?? []));
  }

  private async findItems(orderId: string): Promise<OrderItem[]> {
    const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    return items.map(rowToOrderItem);
  }
}

function orderFromParts(row: typeof orders.$inferSelect, items: OrderItem[]): Order {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    totalCents: row.totalCents,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    items,
  };
}

function rowToOrderItem(row: typeof orderItems.$inferSelect): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    titleSnapshot: row.titleSnapshot,
    unitPriceCents: row.unitPriceCents,
    quantity: row.quantity,
  };
}
