import { ValidationError } from '../errors/index.js';
import type { Order } from '../model/order.js';
import type { EntitlementCreateInput } from '../model/entitlement.js';
import type { LicenseKeyGenerator } from './license-key.js';

// Fulfillment: order → entitlements (invariante #3); cada item de un pedido PAID recibe una license key, y solo los pedidos PAID se cumplen.
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
