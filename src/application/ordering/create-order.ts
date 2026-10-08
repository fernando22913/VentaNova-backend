import type { Order, OrderItemCreateInput } from '../../domain/model/order.js';
import type { OrderRepository } from '../../domain/ports/order-repository.js';
import type { ProductRepository } from '../../domain/ports/product-repository.js';
import type { EntitlementRepository } from '../../domain/ports/entitlement-repository.js';
import type { Product } from '../../domain/model/product.js';
import { Money } from '../../domain/model/money.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors/index.js';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  userId: string;
  items: CreateOrderItemInput[];
}

export interface CreateOrderDeps {
  products: ProductRepository;
  orders: OrderRepository;
  entitlements: EntitlementRepository;
}

/**
 * Upper bound for `total_cents`, which is stored in a 32-bit `integer` column.
 * A malicious/huge basket must fail as a clean 422 rather than as a database
 * overflow error surfacing as a 500.
 */
const MAX_ORDER_TOTAL_CENTS = 2_147_483_647;

/**
 * Places a PENDING order. The client only sends product ids + quantities —
 * the total is recomputed here from database prices (invariant #1), titles
 * and prices are snapshotted (invariant #2), and double-purchase is rejected
 * (invariant #4). Quantity is validated by the boundary schema; duplicates in
 * the same request are rejected here.
 */
export class CreateOrder {
  constructor(private readonly deps: CreateOrderDeps) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (input.items.length === 0) {
      throw new ValidationError('Order must contain at least one item');
    }

    const productIds = new Set(input.items.map((item) => item.productId));
    if (productIds.size !== input.items.length) {
      throw new ValidationError('Order contains duplicate products');
    }

    const owned = new Set(await this.deps.entitlements.findOwnedProductIds(input.userId));
    const products = await this.loadProducts([...productIds]);

    let total = Money.zero();
    const orderItems: OrderItemCreateInput[] = [];

    for (const item of input.items) {
      const product = products.get(item.productId);
      if (!product) {
        throw new NotFoundError('Product');
      }
      if (product.status !== 'PUBLISHED') {
        throw new ConflictError(`Product "${product.title}" is not available`);
      }
      if (owned.has(product.id)) {
        throw new ConflictError(`You already own "${product.title}"`);
      }

      total = total.add(Money.fromCents(product.priceCents).multiplyBy(item.quantity));
      orderItems.push({
        productId: product.id,
        titleSnapshot: product.title,
        unitPriceCents: product.priceCents,
        quantity: item.quantity,
      });
    }

    const totalCents = total.amountInCents;
    if (totalCents > MAX_ORDER_TOTAL_CENTS) {
      throw new ValidationError('Order total is too large');
    }

    return this.deps.orders.create({
      userId: input.userId,
      totalCents,
      items: orderItems,
    });
  }

  private async loadProducts(ids: string[]): Promise<Map<string, Product>> {
    const found = await this.deps.products.findByIds(ids);
    return new Map(found.map((product) => [product.id, product]));
  }
}
