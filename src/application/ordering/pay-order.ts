import type { Entitlement } from '../../domain/model/entitlement.js';
import type { Order } from '../../domain/model/order.js';
import type { OrderRepository } from '../../domain/ports/order-repository.js';
import type { PaymentGateway, CardDetails } from '../../domain/ports/payment-gateway.js';
import type { UnitOfWork } from '../../domain/ports/unit-of-work.js';
import type { FulfillmentService } from '../../domain/services/fulfillment.js';
import { assertOrderTransition } from '../../domain/model/order-status.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors/index.js';

export interface PayOrderInput {
  orderId: string;
  userId: string;
  card: CardDetails;
}

export interface PayOrderResult {
  order: Order;
  entitlements: Entitlement[];
}

export interface PayOrderDeps {
  orders: OrderRepository;
  payments: PaymentGateway;
  unitOfWork: UnitOfWork;
  fulfillment: FulfillmentService;
}

/**
 * Executes the simulated payment for a PENDING order.
 *
 * A decline is *domain data*, not an HTTP error: the order flips to FAILED and
 * stays queryable (blueprint §7). An approval flips the order to PAID and
 * grants entitlements inside one transaction, so a crash between payment
 * success and entitlement insert can never lose a purchase.
 */
export class PayOrder {
  constructor(private readonly deps: PayOrderDeps) {}

  async execute(input: PayOrderInput): Promise<PayOrderResult> {
    const order = await this.deps.orders.findById(input.orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }
    if (order.userId !== input.userId) {
      throw new ForbiddenError('This order belongs to another user');
    }
    if (order.status !== 'PENDING') {
      throw new ConflictError(`Order is already ${order.status}`);
    }

    // The order was PENDING when we read it; assert the transition up front so
    // an illegal move is rejected by the domain before we touch the gateway.
    assertOrderTransition(order.status, 'PAID');

    const payment = await this.deps.payments.charge(input.card, order.totalCents);

    if (!payment.approved) {
      // Compare-and-set from PENDING: a concurrent successful payment can never
      // be clobbered back to FAILED.
      const failed = await this.deps.orders.transitionStatus(order.id, 'PENDING', 'FAILED');
      if (!failed) throw new ConflictError('Order is no longer pending');
      return { order: failed, entitlements: [] };
    }

    const result = await this.deps.unitOfWork.run(async (tx) => {
      // Compare-and-set inside the transaction: only the first approval wins,
      // so entitlements can never be granted twice for one order.
      const paid = await tx.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
      if (!paid) throw new ConflictError('Order is no longer pending');
      const grants = await tx.entitlements.createMany(this.deps.fulfillment.fulfill(paid));
      return { order: paid, entitlements: grants };
    });

    return result;
  }
}
