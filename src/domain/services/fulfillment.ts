import { ValidationError } from '../errors/index.js';
import type { Order } from '../model/order.js';
import type { EntitlementCreateInput } from '../model/entitlement.js';
import type { LicenseKeyGenerator } from './license-key.js';

/**
 * Fulfillment: order → entitlements (domain invariant #3).
 *
 * A PAID order's items become one entitlement each, with a freshly generated
 * license key. The service is pure — it computes the entitlement writes; the
 * use case persists them inside the same transaction that flips the order to
 * PAID, so a process crash between payment and grant can never lose a
 * purchase (the transaction is all-or-nothing).
 *
 * Only PAID orders fulfill; calling this on any other status is a bug, and
 * the service refuses loudly rather than granting licenses for an unpaid order.
 */
export class FulfillmentService {
  constructor(private readonly licenseKeys: LicenseKeyGenerator) {}

  fulfill(order: Order): EntitlementCreateInput[] {
    if (order.status !== 'PAID') {
      throw new ValidationError(
        `Cannot grant entitlements for an order in status "${order.status}"; only PAID orders fulfill`,
      );
    }

    return order.items.map((item) => ({
      userId: order.userId,
      productId: item.productId,
      orderId: order.id,
      licenseKey: this.licenseKeys.generate().toString(),
    }));
  }
}
