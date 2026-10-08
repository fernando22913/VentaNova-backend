import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeCategory, makeProduct, makeUser, repositories } from '../helpers/factories.js';

describe('OrderRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  async function seedOrder() {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const pinApple = await makeProduct(repos, category.id, {
      slug: 'pinapple',
      title: 'Pinapple',
      priceCents: 1999,
    });
    const stick6 = await makeProduct(repos, category.id, {
      slug: 'sticky6',
      title: 'Sticky6',
      priceCents: 499,
    });
    const order = await repos.orders.create({
      userId: user.id,
      totalCents: 2997, // 1999 + 499×2 — server-recomputed in the real use case
      items: [
        { productId: pinApple.id, titleSnapshot: 'Pinapple', unitPriceCents: 1999, quantity: 1 },
        { productId: stick6.id, titleSnapshot: 'Sticky6', unitPriceCents: 499, quantity: 2 },
      ],
    });
    return { user, order, pinApple, stick6 };
  }

  it('creates an order with items and re-reads them with a join', async () => {
    const { user, order } = await seedOrder();
    expect(order.id).toBeTruthy();
    expect(order.userId).toBe(user.id);
    expect(order.status).toBe('PENDING');
    expect(order.totalCents).toBe(2997);
    expect(order.paidAt).toBeNull();
    expect(order.items).toHaveLength(2);
  });

  it('snapshots the title and unit price on order items (invariant #2)', async () => {
    const { order, pinApple } = await seedOrder();
    const loaded = await repos.orders.findById(order.id);
    const line = loaded?.items.find((item) => item.productId === pinApple.id);
    expect(line).toMatchObject({ titleSnapshot: 'Pinapple', unitPriceCents: 1999, quantity: 1 });
  });

  it('lists a user orders newest-first', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id, { priceCents: 500 });
    const first = await repos.orders.create({
      userId: user.id,
      totalCents: 500,
      items: [{ productId: product.id, titleSnapshot: 'T', unitPriceCents: 500, quantity: 1 }],
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repos.orders.create({
      userId: user.id,
      totalCents: 500,
      items: [{ productId: product.id, titleSnapshot: 'T', unitPriceCents: 500, quantity: 1 }],
    });
    const orders = await repos.orders.findByUser(user.id);
    expect(orders.map((o) => o.id)).toEqual([second.id, first.id]);
  });

  it('lists all orders for admin (across users)', async () => {
    await seedOrder();
    const secondUser = await makeUser(repos, { email: 'other@bytemarket.dev' });
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id, { priceCents: 100 });
    await repos.orders.create({
      userId: secondUser.id,
      totalCents: 100,
      items: [{ productId: product.id, titleSnapshot: 'T', unitPriceCents: 100, quantity: 1 }],
    });
    const all = await repos.orders.findAll();
    expect(all).toHaveLength(2);
  });

  it('transitions an order to PAID and records paidAt', async () => {
    const { order } = await seedOrder();
    const paid = await repos.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
    expect(paid?.status).toBe('PAID');
    expect(paid?.paidAt).toBeInstanceOf(Date);
    expect(paid?.items).toHaveLength(2);
  });

  it('does not transition a settled order (compare-and-set returns null)', async () => {
    const { order } = await seedOrder();
    await repos.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());

    // A second attempt from the stale PENDING state must not overwrite PAID.
    expect(await repos.orders.transitionStatus(order.id, 'PENDING', 'FAILED')).toBeNull();
    expect((await repos.orders.findById(order.id))?.status).toBe('PAID');
  });

  it('does not leave an orphan order when an item insert fails', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id);

    await expect(
      repos.orders.create({
        userId: user.id,
        totalCents: 400,
        items: [
          { productId: product.id, titleSnapshot: 'T', unitPriceCents: 200, quantity: 1 },
          {
            productId: '00000000-0000-0000-0000-000000000000',
            titleSnapshot: 'Ghost',
            unitPriceCents: 200,
            quantity: 1,
          },
        ],
      }),
    ).rejects.toBeDefined();

    expect(await repos.orders.findAll()).toHaveLength(0);
  });

  it('prevents the same product appearing twice in one order (unique order/product)', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id);
    await expect(
      repos.orders.create({
        userId: user.id,
        totalCents: 400,
        items: [
          { productId: product.id, titleSnapshot: 'T', unitPriceCents: 200, quantity: 1 },
          { productId: product.id, titleSnapshot: 'T', unitPriceCents: 200, quantity: 1 },
        ],
      }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('rejects non-positive quantity via the DB check constraint', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id);
    await expect(
      repos.orders.create({
        userId: user.id,
        totalCents: 0,
        items: [{ productId: product.id, titleSnapshot: 'T', unitPriceCents: 0, quantity: 0 }],
      }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });
});
