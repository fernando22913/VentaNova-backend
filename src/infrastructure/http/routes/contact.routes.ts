import { Router } from 'express';
import { z } from 'zod';

import type { AppContainer } from '../../../container.js';
import { parseOrThrow } from '../validation.js';
import { contactRateLimiter } from '../middleware/rate-limit.js';
import { toContactMessageDto } from '../dto.js';

/**
 * Public contact submission. Fields are trimmed and bounded at the boundary so
 * garbage never reaches the database. The body parser already caps payloads at
 * 100kb and the router-level limiter bounds submissions per IP.
 */
export const createContactSchema = z.object({
  name: z
    .string({ message: 'Se requiere un nombre' })
    .trim()
    .min(1, 'Se requiere un nombre')
    .max(80, 'El nombre no puede superar 80 caracteres'),
  email: z
    .email({ message: 'El correo electrónico no es válido' })
    .trim()
    .max(254, 'El correo electrónico es demasiado largo'),
  subject: z
    .string({ message: 'Se requiere un asunto' })
    .trim()
    .min(1, 'Se requiere un asunto')
    .max(120, 'El asunto no puede superar 120 caracteres'),
  message: z
    .string({ message: 'Se requiere un mensaje' })
    .trim()
    .min(1, 'Se requiere un mensaje')
    .max(2000, 'El mensaje no puede superar 2000 caracteres'),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

export function createContactRouter(container: AppContainer): Router {
  const router = Router();

  router.post('/', contactRateLimiter, async (req, res) => {
    const input = parseOrThrow(createContactSchema, req.body);
    const message = await container.useCases.submitContact.execute(input);
    res.status(201).json(toContactMessageDto(message));
  });

  return router;
}