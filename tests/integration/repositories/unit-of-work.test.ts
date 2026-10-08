import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { DrizzleUnitOfWork } from '../../../src/infrastructure/persistence/unit-of-work.js';
import { LicenseKeyGenerator } from '../../../src/domain/services/license-key.js';
import {
  orders,
  entitlements,
  orderItems,
} from '../../../src/infrastructure/persistence/schema.js';
import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeCategory, makeProduct, makeUser, repositories } from '../helpers/factories.js';

describe('UnitOfWork (Drizzle transaction boundary)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;
  let uow: DrizzleUnitOfWork;
  const keys = new LicenseKeyGenerator();

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
    uow = new DrizzleUnitOfWork(ctx.db);
  });

  it('commits order status + entitlements as one atomic unit', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id, { priceCents: 3999 });
    const order = await repos.orders.create({
      userId: user.id,
      totalCents: 3999,
      items: [
        { productId: product.id, titleSnapshot: product.title, unitPriceCents: 3999, quantity: 1 },
      ],
    });

    const patchedOrder = await uow.run(async (tx) => {
      const paid = await tx.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
      await tx.entitlements.createMany([
        {
          userId: user.id,
          productId: product.id,
          orderId: order.id,
          licenseKey: keys.generate().toString(),
        },
      ]);
      return paid;
    });

    expect(patchedOrder?.status).toBe('PAID');
    const [dbOrder] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    const grants = await ctx.db.select().from(entitlements);
    expect(dbOrder?.status).toBe('PAID');
    expect(grants).toHaveLength(1);
  });

  it('rolls back every write when the work function throws', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id, { priceCents: 3999 });
    const order = await repos.orders.create({
      userId: user.id,
      totalCents: 3999,
      items: [
        { productId: product.id, titleSnapshot: product.title, unitPriceCents: 3999, quantity: 1 },
      ],
    });

    await expect(
      uow.run(async (tx) => {
        await tx.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
        await tx.entitlements.createMany([
          {
            userId: user.id,
            productId: product.id,
            orderId: order.id,
            licenseKey: keys.generate().toString(),
          },
        ]);
        throw new Error('boom after grant');
      }),
    ).rejects.toThrow('boom after grant');

    const [dbOrder] = await ctx.db.select().from(orders).where(eq(orders.id, order.id));
    const grants = await ctx.db.select().from(entitlements);
    expect(dbOrder?.status).toBe('PENDING');
    expect(grants).toHaveLength(0);
  });

  it('does not leak writes across failed and successful units', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id, { priceCents: 100 });
    const order = await repos.orders.create({
      userId: user.id,
      totalCents: 100,
      items: [
        { productId: product.id, titleSnapshot: product.title, unitPriceCents: 100, quantity: 1 },
      ],
    });

    // A failed attempt must not leave order_items behind.
    await expect(
      uow.run(async (tx) => {
        await tx.orders.create({
          userId: user.id,
          totalCents: 100,
          items: [
            {
              productId: product.id,
              titleSnapshot: product.title,
              unitPriceCents: 100,
              quantity: 1,
            },
          ],
        });
        throw new Error('roll it back');
      }),
    ).rejects.toThrow('roll it back');

    const allOrders = await ctx.db.select().from(orders);
    const allItems = await ctx.db.select().from(orderItems);
    expect(allOrders).toHaveLength(1);
    expect(allItems).toHaveLength(1);
    void order;
  });
});
