import { beforeEach, describe, expect, it } from 'vitest';

import { LicenseKeyGenerator } from '../../../src/domain/services/license-key.js';
import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeCategory, makeProduct, makeUser, repositories } from '../helpers/factories.js';

describe('EntitlementRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;
  const keys = new LicenseKeyGenerator();

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  async function seedGrant() {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id);
    const order = await repos.orders.create({
      userId: user.id,
      totalCents: product.priceCents,
      items: [
        {
          productId: product.id,
          titleSnapshot: product.title,
          unitPriceCents: product.priceCents,
          quantity: 1,
        },
      ],
    });
    const created = await repos.entitlements.createMany([
      {
        userId: user.id,
        productId: product.id,
        orderId: order.id,
        licenseKey: keys.generate().toString(),
      },
    ]);
    return { user, product, order, created };
  }

  it('grants entitlements and reads them back', async () => {
    const { created } = await seedGrant();
    const fromDb = await repos.entitlements.findByUser(created[0]!.userId);
    expect(fromDb).toHaveLength(1);
    expect(fromDb[0]?.licenseKey).toBe(created[0]?.licenseKey);
    expect(fromDb[0]?.grantedAt).toBeInstanceOf(Date);
  });

  it('finds an entitlement by user and product', async () => {
    const { user, product } = await seedGrant();
    const found = await repos.entitlements.findByUserAndProduct(user.id, product.id);
    expect(found?.productId).toBe(product.id);
    expect(await repos.entitlements.findByUserAndProduct(user.id, product.id)).not.toBeNull();
    expect(
      await repos.entitlements.findByUserAndProduct(
        user.id,
        '00000000-0000-0000-0000-000000000000',
      ),
    ).toBeNull();
  });

  it('reports owned product ids (blocks double-purchase in the app)', async () => {
    const { user, product, created } = await seedGrant();
    const second = await makeProduct(repos, product.categoryId, {
      slug: 'second-product',
      priceCents: 500,
    });
    const order = await repos.orders.create({
      userId: user.id,
      totalCents: 500,
      items: [
        { productId: second.id, titleSnapshot: second.title, unitPriceCents: 500, quantity: 1 },
      ],
    });
    await repos.entitlements.createMany([
      {
        userId: user.id,
        productId: second.id,
        orderId: order.id,
        licenseKey: keys.generate().toString(),
      },
    ]);

    const owned = await repos.entitlements.findOwnedProductIds(user.id);
    expect(owned).toEqual(expect.arrayContaining([product.id, second.id]));
    expect(owned).toContain(created[0]!.productId);
  });

  it('enforces one entitlement per (user, product) — the concurrency-proof invariant #4', async () => {
    const { user, product, order } = await seedGrant();
    await expect(
      repos.entitlements.createMany([
        {
          userId: user.id,
          productId: product.id,
          orderId: order.id,
          licenseKey: keys.generate().toString(),
        },
      ]),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('enforces unique license keys', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const product = await makeProduct(repos, category.id);
    const order = await repos.orders.create({
      userId: user.id,
      totalCents: product.priceCents,
      items: [
        {
          productId: product.id,
          titleSnapshot: product.title,
          unitPriceCents: product.priceCents,
          quantity: 1,
        },
      ],
    });
    const key = keys.generate().toString();
    await repos.entitlements.createMany([
      { userId: user.id, productId: product.id, orderId: order.id, licenseKey: key },
    ]);

    await expect(
      repos.entitlements.createMany([
        { userId: user.id, productId: product.id, orderId: order.id, licenseKey: key },
      ]),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });
});
