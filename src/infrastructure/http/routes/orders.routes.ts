import { Router } from 'express';
import { z } from 'zod';

import type { AppContainer } from '../../../container.js';
import { parseOrThrow, parseUuidParam } from '../validation.js';
import { requireAuth } from '../middleware/require-auth.js';
import { ordersCreateRateLimiter, paymentRateLimiter } from '../middleware/rate-limit.js';
import { toOrderDto, toPayResult } from '../dto.js';
import { isLuhnValid } from '../../payment/simulated-payment.gateway.js';

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid({ message: 'Invalid product id' }),
        quantity: z.coerce.number().int().min(1).max(99),
      }),
    )
    .min(1, 'Order must contain at least one item')
    .max(50, 'Order cannot contain more than 50 items'),
});

const cardSchema = z.object({
  cardName: z.string().trim().min(1).max(80),
  cardNumber: z
    .string()
    .trim()
    .min(13)
    .max(19)
    .refine((value) => isLuhnValid(value.replace(/\s/g, '')), 'Card number failed Luhn validation'),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be MM/YY'),
  cvc: z
    .string()
    .trim()
    .regex(/^\d{3,4}$/, 'Invalid CVC'),
});

export function createOrdersRouter(container: AppContainer): Router {
  const router = Router();
  router.use(requireAuth(container.tokenService));

  router.post('/', ordersCreateRateLimiter, async (req, res) => {
    const input = parseOrThrow(createOrderSchema, req.body);
    const order = await container.useCases.createOrder.execute({
      userId: req.auth!.userId,
      items: input.items,
    });
    res.status(201).json(toOrderDto(order));
  });

  router.post('/:id/pay', paymentRateLimiter, async (req, res) => {
    const orderId = parseUuidParam(req.params.id, 'order id');
    const card = parseOrThrow(cardSchema, req.body);
    const result = await container.useCases.payOrder.execute({
      orderId,
      userId: req.auth!.userId,
      card,
    });
    res.json(toPayResult(result.order, result.entitlements));
  });

  router.get('/', async (req, res) => {
    const orders = await container.useCases.listOrders.execute(req.auth!.userId);
    res.json({ items: orders.map(toOrderDto) });
  });

  router.get('/:id', async (req, res) => {
    const orderId = parseUuidParam(req.params.id, 'order id');
    const order = await container.useCases.getOrder.execute(orderId, req.auth!.userId);
    res.json(toOrderDto(order));
  });

  return router;
}
