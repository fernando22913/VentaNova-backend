import { describe, expect, it } from 'vitest';

import type { Order } from '../../../src/domain/model/order.js';
import { FulfillmentService } from '../../../src/domain/services/fulfillment.js';
import { LicenseKeyGenerator, isLicenseKey } from '../../../src/domain/services/license-key.js';
import { ValidationError } from '../../../src/domain/errors/index.js';

function paidOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: 'PAID',
    totalCents: 12496,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    paidAt: new Date('2026-01-01T00:00:01.000Z'),
    items: [
      {
        id: 'oi-1',
        orderId: 'order-1',
        productId: 'p-1',
        titleSnapshot: 'Neo Tokyo Racer',
        unitPriceCents: 3999,
        quantity: 1,
      },
      {
        id: 'oi-2',
        orderId: 'order-1',
        productId: 'p-2',
        titleSnapshot: 'Emberkeep',
        unitPriceCents: 2499,
        quantity: 2,
      },
    ],
    ...overrides,
  };
}

describe('FulfillmentService', () => {
  const fulfillment = new FulfillmentService(new LicenseKeyGenerator());

  it('grants one entitlement per paid order item (invariant #3)', () => {
    const entitlements = fulfillment.fulfill(paidOrder());
    expect(entitlements).toHaveLength(2);
    expect(entitlements.map((e) => e.productId)).toEqual(['p-1', 'p-2']);
    expect(entitlements.every((e) => e.userId === 'user-1')).toBe(true);
    expect(entitlements.every((e) => e.orderId === 'order-1')).toBe(true);
  });

  it('generates a valid license key for every entitlement', () => {
    for (const entitlement of fulfillment.fulfill(paidOrder())) {
      expect(isLicenseKey(entitlement.licenseKey)).toBe(true);
      expect(entitlement.licenseKey.startsWith('BM-')).toBe(true);
    }
  });

  it('refuses to fulfill a non-PAID order', () => {
    for (const status of ['PENDING', 'FAILED', 'CANCELLED'] as const) {
      const order = paidOrder({ status });
      expect(() => fulfillment.fulfill(order)).toThrow(ValidationError);
    }
  });

  it('returns no entitlements for an empty paid order', () => {
    expect(fulfillment.fulfill(paidOrder({ items: [] }))).toEqual([]);
  });

  it('produces unique license keys across items in one order', () => {
    const keys = fulfillment.fulfill(paidOrder()).map((e) => e.licenseKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
