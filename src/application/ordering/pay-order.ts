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

// Pago simulado de un pedido PENDING: rechazo -> FAILED (dato de dominio), aprobación -> PAID + entitlements en una transacción.
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

    // El pedido era PENDING al leerlo; valida la transición antes de tocar la pasarela.
    assertOrderTransition(order.status, 'PAID');

    const payment = await this.deps.payments.charge(input.card, order.totalCents);

    if (!payment.approved) {
      // Compare-and-set desde PENDING para que un pago concurrente no sobrescriba FAILED.
      const failed = await this.deps.orders.transitionStatus(order.id, 'PENDING', 'FAILED');
      if (!failed) throw new ConflictError('Order is no longer pending');
      return { order: failed, entitlements: [] };
    }

    const result = await this.deps.unitOfWork.run(async (tx) => {
      // Compare-and-set dentro de la transacción: solo la primera aprobación otorga entitlements.
      const paid = await tx.orders.transitionStatus(order.id, 'PENDING', 'PAID', new Date());
      if (!paid) throw new ConflictError('Order is no longer pending');
      const grants = await tx.entitlements.createMany(this.deps.fulfillment.fulfill(paid));
      return { order: paid, entitlements: grants };
    });

    return result;
  }
}
