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

// Límite superior de total_cents (columna de 32 bits); carritos enormes dan 422, no 500.
const MAX_ORDER_TOTAL_CENTS = 2_147_483_647;

// Crea un pedido PENDING: recalcula el total con precios de la BD, guarda precio/título y rechaza la compra duplicada.
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
