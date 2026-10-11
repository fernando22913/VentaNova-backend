import type { RequestHandler } from 'express';

import { requireRole } from './require-role.js';

/**
 * Must run after `requireAuth`. Convenience wrapper around `requireRole` for
 * the admin-only surfaces. The role is re-checked server-side on every request
 * — the frontend `adminGuard` is only UX.
 */
export function requireAdmin(): RequestHandler {
  return requireRole('ADMIN');
}
