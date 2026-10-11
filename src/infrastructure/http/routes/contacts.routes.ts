import { Router } from 'express';
import { z } from 'zod';

import type { AppContainer } from '../../../container.js';
import { parseOrThrow, parseUuidParam } from '../validation.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { toAdminContactMessageDto } from '../dto.js';

// Bandeja del operador para contactos: solo ADMIN/WORKER pueden leer o responder; las respuestas persisten.
export const replyContactSchema = z.object({
  reply: z
    .string({ message: 'Se requiere una respuesta' })
    .trim()
    .min(1, 'Se requiere una respuesta')
    .max(2000, 'La respuesta no puede superar 2000 caracteres'),
});

export type ReplyContactBody = z.infer<typeof replyContactSchema>;

export function createContactsRouter(container: AppContainer): Router {
  const router = Router();
  router.use(requireAuth(container.tokenService), requireRole('ADMIN', 'WORKER'));

  router.get('/', async (_req, res) => {
    const messages = await container.useCases.listContacts.execute();
    res.json({ items: messages.map(toAdminContactMessageDto) });
  });

  router.post('/:id/reply', async (req, res) => {
    const messageId = parseUuidParam(req.params.id, 'contact message id');
    const { reply } = parseOrThrow(replyContactSchema, req.body);
    const message = await container.useCases.replyContact.execute({
      id: messageId,
      reply,
      repliedBy: req.auth!.userId,
    });
    res.json(toAdminContactMessageDto(message));
  });

  return router;
}
