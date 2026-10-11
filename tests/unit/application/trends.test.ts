import { describe, expect, it } from 'vitest';

import { GetTrends } from '../../../src/application/trends/get-trends.js';
import type { TrendReport } from '../../../src/domain/model/trends.js';
import { FakeTrendsRepository } from '../helpers/fakes.js';

const report: TrendReport = {
  totals: { revenueCents: 19990, paidOrders: 3, unitsSold: 7, averageOrderCents: 6663 },
  sales: [{ date: '2026-01-01', revenueCents: 9990, units: 3 }],
  bestSellers: [{ slug: 'neo-tokyo-racer', title: 'Neo Tokyo Racer', unitsSold: 4, revenueCents: 15996 }],
};

describe('GetTrends', () => {
  it('returns the aggregated report from the repository', async () => {
    const trends = new FakeTrendsRepository();
    trends.report = report;

    const result = await new GetTrends({ trends }).execute();

    expect(result).toEqual(report);
  });
});