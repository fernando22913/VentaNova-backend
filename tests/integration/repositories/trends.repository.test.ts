import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeCategory, makeProduct, makeUser, repositories } from '../helpers/factories.js';

function utcTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mediodía UTC de hoy, a salvo de desfases de límite de día de la sesión de la DB.
function middayUtcToday(): Date {
  return new Date(`${utcTodayKey()}T12:00:00.000Z`);
}

describe('TrendsRepository (Drizzle)', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  it('returns a zeroed report when there are no paid orders', async () => {
    const report = await repos.trends.getReport();

    expect(report.totals).toEqual({
      revenueCents: 0,
      paidOrders: 0,
      unitsSold: 0,
      averageOrderCents: 0,
    });
    expect(report.sales).toHaveLength(30);
    expect(report.bestSellers).toEqual([]);
  });

  it('aggregates totals and best sellers from paid orders only', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const game = await makeProduct(repos, category.id, {
      slug: 'racer',
      title: 'Racer',
      priceCents: 2000,
    });
    const dlc = await makeProduct(repos, category.id, {
      slug: 'skin',
      title: 'Skin',
      priceCents: 500,
    });

    await repos.orders.create({
      userId: user.id,
      totalCents: 4500,
      items: [
        { productId: game.id, titleSnapshot: 'Racer', unitPriceCents: 2000, quantity: 2 },
        { productId: dlc.id, titleSnapshot: 'Skin', unitPriceCents: 500, quantity: 1 },
      ],
    });
    const paid = await repos.orders.create({
      userId: user.id,
      totalCents: 4500,
      items: [
        { productId: game.id, titleSnapshot: 'Racer', unitPriceCents: 2000, quantity: 2 },
        { productId: dlc.id, titleSnapshot: 'Skin', unitPriceCents: 500, quantity: 1 },
      ],
    });
    await repos.orders.transitionStatus(paid.id, 'PENDING', 'PAID', middayUtcToday());

    const report = await repos.trends.getReport();

    expect(report.totals).toEqual({
      revenueCents: 4500,
      paidOrders: 1,
      unitsSold: 3,
      averageOrderCents: 4500,
    });

    expect(report.bestSellers).toHaveLength(2);
    expect(report.bestSellers[0]).toMatchObject({
      slug: 'racer',
      title: 'Racer',
      unitsSold: 2,
      revenueCents: 4000,
    });
    expect(report.bestSellers[1]).toMatchObject({
      slug: 'skin',
      unitsSold: 1,
      revenueCents: 500,
    });

    const today = report.sales.find((point) => point.date === utcTodayKey());
    expect(today).toBeDefined();
    expect(today?.revenueCents).toBe(4500);
    expect(today?.units).toBe(3);
  });

  it('ranks best sellers by quantity and limits to the top five', async () => {
    const user = await makeUser(repos);
    const category = await makeCategory(repos);
    const products = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        makeProduct(repos, category.id, {
          slug: `prod-${index}`,
          title: `Product ${index}`,
          priceCents: 100,
        }),
      ),
    );

    // Da a product[0] más unidades que al resto para que el ranking sea determinista.
    const paid = await repos.orders.create({
      userId: user.id,
      totalCents: 300,
      items: [
        { productId: products[0]!.id, titleSnapshot: 'P0', unitPriceCents: 100, quantity: 3 },
        { productId: products[1]!.id, titleSnapshot: 'P1', unitPriceCents: 100, quantity: 2 },
        { productId: products[2]!.id, titleSnapshot: 'P2', unitPriceCents: 100, quantity: 1 },
        { productId: products[3]!.id, titleSnapshot: 'P3', unitPriceCents: 100, quantity: 1 },
        { productId: products[4]!.id, titleSnapshot: 'P4', unitPriceCents: 100, quantity: 1 },
        { productId: products[5]!.id, titleSnapshot: 'P5', unitPriceCents: 100, quantity: 1 },
      ],
    });
    await repos.orders.transitionStatus(paid.id, 'PENDING', 'PAID', middayUtcToday());

    const report = await repos.trends.getReport();

    expect(report.bestSellers.map((seller) => seller.unitsSold)).toEqual([3, 2, 1, 1, 1]);
    expect(report.bestSellers.map((seller) => seller.slug)[0]).toBe('prod-0');
    expect(report.bestSellers).toHaveLength(5);
  });
});