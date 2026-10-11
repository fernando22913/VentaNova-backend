import type { RequestHandler } from 'express';

import { requireRole } from './require-role.js';

// Debe ejecutarse tras `requireAuth`. Envoltorio solo para ADMIN sobre `requireRole`; el rol se revalida en el servidor.
export function requireAdmin(): RequestHandler {
  return requireRole('ADMIN');
}
