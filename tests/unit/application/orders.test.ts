import { describe, expect, it } from 'vitest';

import { CreateOrder } from '../../../src/application/ordering/create-order.js';
import { PayOrder } from '../../../src/application/ordering/pay-order.js';
import { ListOrders } from '../../../src/application/ordering/list-orders.js';
import { GetOrder } from '../../../src/application/ordering/get-order.js';
import { ListLibrary } from '../../../src/application/library/list-library.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../src/domain/errors/index.js';
import type { Product } from '../../../src/domain/model/product.js';
import { FulfillmentService } from '../../../src/domain/services/fulfillment.js';
import { LicenseKeyGenerator, isLicenseKey } from '../../../src/domain/services/license-key.js';
import type { Order } from '../../../src/domain/model/order.js';
import {
  FakePaymentGateway,
  FakeUnitOfWork,
  InMemoryEntitlementRepository,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryRefreshTokenRepository,
} from '../helpers/fakes.js';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? 'p-1',
    slug: overrides.slug ?? 'neo-racer',
    title: overrides.title ?? 'Neo Racer',
    summary: 'Summary.',
    description: 'Description.',
    type: overrides.type ?? 'GAME',
    platform: overrides.platform ?? 'CROSS',
    categoryId: 'c-1',
    priceCents: overrides.priceCents ?? 3999,
    status: overrides.status ?? 'PUBLISHED',
    coverImageUrl: null,
    assetUrl: 'https://cdn.example.com/down.zip',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function context(products: Product[] = [makeProduct()]) {
  const productRepo = new InMemoryProductRepository();
  productRepo.seed(...products);
  const entitlements = new InMemoryEntitlementRepository();
  const orders = new InMemoryOrderRepository();
  return { productRepo, entitlements, orders };
}

describe('CreateOrder', () => {
  it('recomputes the total from DB prices and snapshots title/price', async () => {
    const ctx = context([
      makeProduct({ id: 'p-1', priceCents: 1999 }),
      makeProduct({ id: 'p-2', priceCents: 500 }),
    ]);
    const createOrder = new CreateOrder({
      products: ctx.productRepo,
      orders: ctx.orders,
      entitlements: ctx.entitlements,
    });

    const order = await createOrder.execute({
      userId: 'u-1',
      items: [
        { productId: 'p-1', quantity: 2 },
        { productId: 'p-2', quantity: 1 },
      ],
    });

    expect(order.status).toBe('PENDING');
    expect(order.totalCents).toBe(4498); // 1999×2 + 500 — never from the client
    expect(order.items).toEqual([
      expect.objectContaining({ titleSnapshot: 'Neo Racer', unitPriceCents: 1999, quantity: 2 }),
      expect.objectContaining({ titleSnapshot: 'Neo Racer', unitPriceCents: 500, quantity: 1 }),
    ]);
  });

  it('rejects an owned product (double purchase) with a Conflict', async () => {
    const ctx = context();
    await ctx.entitlements.createMany([
      { userId: 'u-1', productId: 'p-1', orderId: 'o-x', licenseKey: 'BM-AAAAA-BBBBB-CCCCC' },
    ]);
    const createOrder = new CreateOrder({
      products: ctx.productRepo,
      orders: ctx.orders,
      entitlements: ctx.entitlements,
    });

    await expect(
      createOrder.execute({ userId: 'u-1', items: [{ productId: 'p-1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects unpublished products', async () => {
    const ctx = context([makeProduct({ id: 'p-1', status: 'ARCHIVED' })]);
    const createOrder = new CreateOrder({
      products: ctx.productRepo,
      orders: ctx.orders,
      entitlements: ctx.entitlements,
    });
    await expect(
      createOrder.execute({ userId: 'u-1', items: [{ productId: 'p-1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFound when a product does not exist', async () => {
    const ctx = context([]);
    const createOrder = new CreateOrder({
      products: ctx.productRepo,
      orders: ctx.orders,
      entitlements: ctx.entitlements,
    });
    await expect(
      createOrder.execute({ userId: 'u-1', items: [{ productId: 'missing', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a total that would overflow the 32-bit total_cents column', async () => {
    const ctx = context([makeProduct({ id: 'p-1', priceCents: 99_999_999 })]);
    const createOrder = new CreateOrder({
      products: ctx.productRepo,
      orders: ctx.orders,
      entitlements: ctx.entitlements,
    });

    await expect(
      createOrder.execute({ userId: 'u-1', items: [{ productId: 'p-1', quantity: 99 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('validates empty and duplicate line items', async () => {
    const ctx = context([makeProduct({ id: 'p-1' }), makeProduct({ id: 'p-2' })]);
    const createOrder = new CreateOrder({
      products: ctx.productRepo,
      orders: ctx.orders,
      entitlements: ctx.entitlements,
    });
    await expect(createOrder.execute({ userId: 'u-1', items: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      createOrder.execute({
        userId: 'u-1',
        items: [
          { productId: 'p-1', quantity: 1 },
          { productId: 'p-1', quantity: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('PayOrder', () => {
  function wire(ctx: ReturnType<typeof context>, gateway: FakePaymentGateway) {
    const orders = ctx.orders;
    const entitlements = ctx.entitlements;
    return new PayOrder({
      orders,
      payments: gateway,
      unitOfWork: new FakeUnitOfWork({
        orders,
        entitlements,
        refreshTokens: new InMemoryRefreshTokenRepository(),
      }),
      fulfillment: new FulfillmentService(new LicenseKeyGenerator()),
    });
  }

  async function pendingOrder(ctx: ReturnType<typeof context>, userId = 'u-1'): Promise<Order> {
    return ctx.orders.create({
      userId,
      totalCents: 3999,
      items: [{ productId: 'p-1', titleSnapshot: 'Neo Racer', unitPriceCents: 3999, quantity: 1 }],
    });
  }

  const card = { cardName: 'Alice', cardNumber: '4242424242424242', expiry: '12/30', cvc: '123' };

  it('approves: order PAID + entitlements with valid license keys, atomically reported', async () => {
    const ctx = context();
    const order = await pendingOrder(ctx);
    const payOrder = wire(ctx, new FakePaymentGateway());

    const result = await payOrder.execute({ orderId: order.id, userId: 'u-1', card });

    expect(result.order.status).toBe('PAID');
    expect(result.order.paidAt).not.toBeNull();
    expect(result.entitlements).toHaveLength(1);
    expect(result.entitlements[0]?.productId).toBe('p-1');
    expect(isLicenseKey(result.entitlements[0]?.licenseKey ?? '')).toBe(true);
    const stored = await ctx.entitlements.findByUserAndProduct('u-1', 'p-1');
    expect(stored?.orderId).toBe(order.id);
  });

  it('declines: order FAILED and NO entitlements are granted', async () => {
    const ctx = context();
    const order = await pendingOrder(ctx);
    const gateway = new FakePaymentGateway();
    gateway.approve = false;
    const payOrder = wire(ctx, gateway);

    const result = await payOrder.execute({ orderId: order.id, userId: 'u-1', card });

    expect(result.order.status).toBe('FAILED');
    expect(result.entitlements).toEqual([]);
    expect(await ctx.entitlements.findByUserAndProduct('u-1', 'p-1')).toBeNull();
  });

  it('forbids paying another user order', async () => {
    const ctx = context();
    const order = await pendingOrder(ctx, 'u-owner');
    const payOrder = wire(ctx, new FakePaymentGateway());

    await expect(
      payOrder.execute({ orderId: order.id, userId: 'u-intruder', card }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await ctx.orders.findById(order.id))?.status).toBe('PENDING');
  });

  it('conflicts on an already-settled order', async () => {
    const ctx = context();
    const order = await pendingOrder(ctx);
    await ctx.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
    const payOrder = wire(ctx, new FakePaymentGateway());

    await expect(
      payOrder.execute({ orderId: order.id, userId: 'u-1', card }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('404s an unknown order', async () => {
    const ctx = context();
    const payOrder = wire(ctx, new FakePaymentGateway());
    await expect(
      payOrder.execute({ orderId: 'o-999', userId: 'u-1', card }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does not fulfill when a concurrent request settles the order first', async () => {
    const ctx = context();
    const order = await pendingOrder(ctx);
    const racingGateway = {
      async charge() {
        // Another request pays the order between our read and our write.
        await ctx.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
        return { approved: true as const, transactionId: 'tx-race' };
      },
    };
    const payOrder = new PayOrder({
      orders: ctx.orders,
      payments: racingGateway,
      unitOfWork: new FakeUnitOfWork({
        orders: ctx.orders,
        entitlements: ctx.entitlements,
        refreshTokens: new InMemoryRefreshTokenRepository(),
      }),
      fulfillment: new FulfillmentService(new LicenseKeyGenerator()),
    });

    await expect(
      payOrder.execute({ orderId: order.id, userId: 'u-1', card }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await ctx.entitlements.findByUserAndProduct('u-1', 'p-1')).toBeNull();
  });

  it('a decline cannot revert an order another request already paid', async () => {
    const ctx = context();
    const order = await pendingOrder(ctx);
    const racingGateway = {
      async charge() {
        await ctx.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
        return { approved: false as const, declinedReason: 'insufficient_funds' };
      },
    };
    const payOrder = new PayOrder({
      orders: ctx.orders,
      payments: racingGateway,
      unitOfWork: new FakeUnitOfWork({
        orders: ctx.orders,
        entitlements: ctx.entitlements,
        refreshTokens: new InMemoryRefreshTokenRepository(),
      }),
      fulfillment: new FulfillmentService(new LicenseKeyGenerator()),
    });

    await expect(
      payOrder.execute({ orderId: order.id, userId: 'u-1', card }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await ctx.orders.findById(order.id))?.status).toBe('PAID');
  });
});

describe('ListOrders / GetOrder', () => {
  it('lists only the user orders, newest first', async () => {
    const ctx = context();
    const a = await ctx.orders.create({
      userId: 'u-1',
      totalCents: 100,
      items: [{ productId: 'p-1', titleSnapshot: 'T', unitPriceCents: 100, quantity: 1 }],
    });
    const b = await ctx.orders.create({
      userId: 'u-1',
      totalCents: 200,
      items: [{ productId: 'p-1', titleSnapshot: 'T', unitPriceCents: 200, quantity: 1 }],
    });
    await ctx.orders.create({
      userId: 'u-2',
      totalCents: 300,
      items: [{ productId: 'p-1', titleSnapshot: 'T', unitPriceCents: 300, quantity: 1 }],
    });

    const orders = await new ListOrders({ orders: ctx.orders }).execute('u-1');
    expect(orders.map((order) => order.id)).toEqual([b.id, a.id]);
  });

  it('GetOrder scopes to the owner', async () => {
    const ctx = context();
    const order = await ctx.orders.create({
      userId: 'u-1',
      totalCents: 100,
      items: [{ productId: 'p-1', titleSnapshot: 'T', unitPriceCents: 100, quantity: 1 }],
    });
    expect((await new GetOrder({ orders: ctx.orders }).execute(order.id, 'u-1')).id).toBe(order.id);
    await expect(
      new GetOrder({ orders: ctx.orders }).execute(order.id, 'u-2'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      new GetOrder({ orders: ctx.orders }).execute('o-999', 'u-1'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ListLibrary', () => {
  it('joins entitlements with their products for the download', async () => {
    const ctx = context([
      makeProduct({ id: 'p-1', title: 'Neo Racer' }),
      makeProduct({ id: 'p-2', title: 'Emberkeep' }),
    ]);
    await ctx.entitlements.createMany([
      { userId: 'u-1', productId: 'p-1', orderId: 'o-1', licenseKey: 'BM-AAAAA-BBBBB-CCCCC' },
      { userId: 'u-1', productId: 'p-2', orderId: 'o-1', licenseKey: 'BM-AAAAA-BBBBB-CCCDD' },
    ]);

    const items = await new ListLibrary({
      entitlements: ctx.entitlements,
      products: ctx.productRepo,
    }).execute('u-1');

    expect(items).toHaveLength(2);
    expect(items[0]?.product.title).toBe('Neo Racer');
    expect(items[0]?.entitlement.licenseKey).toMatch(/^BM-/);
  });

  it('drops entitlements whose product no longer exists', async () => {
    const ctx = context([]);
    await ctx.entitlements.createMany([
      { userId: 'u-1', productId: 'ghost', orderId: 'o-1', licenseKey: 'BM-AAAAA-BBBBB-CCCCC' },
    ]);

    const items = await new ListLibrary({
      entitlements: ctx.entitlements,
      products: ctx.productRepo,
    }).execute('u-1');
    expect(items).toEqual([]);
  });
});
