import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDatabase, resetDatabase } from '../helpers/test-db.js';
import { makeUser, repositories } from '../helpers/factories.js';

/**
 * Defense-in-depth: the application always recomputes totals from DB prices,
 * but the database itself must refuse a negative `total_cents` if that ever
 * regresses. These tests exercise the raw constraint, bypassing the adapter.
 */
describe('orders.total_cents database constraint', () => {
  let ctx: Awaited<ReturnType<typeof getTestDatabase>>;
  let repos: ReturnType<typeof repositories>;

  beforeEach(async () => {
    ctx = await getTestDatabase();
    await resetDatabase(ctx.client);
    repos = repositories(ctx.db);
  });

  it('rejects a negative total at the database level', async () => {
    const user = await makeUser(repos);
    await expect(
      ctx.client`INSERT INTO orders (user_id, total_cents) VALUES (${user.id}, -1)`,
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts zero and positive totals', async () => {
    const user = await makeUser(repos);
    await ctx.client`INSERT INTO orders (user_id, total_cents) VALUES (${user.id}, 0)`;
    await ctx.client`INSERT INTO orders (user_id, total_cents) VALUES (${user.id}, 100)`;
    const orders = await repos.orders.findByUser(user.id);
    expect(orders.map((order) => order.totalCents).sort((a, b) => a - b)).toEqual([0, 100]);
  });
});
