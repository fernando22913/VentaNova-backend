import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '../../../domain/errors/index.js';

/**
 * Must run after `requireAuth`. The role is re-checked server-side on every
 * request — the frontend `adminGuard` is only UX. A wrong token never reaches
 * the use case.
 */
export function requireAdmin() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError('Missing bearer token'));
      return;
    }
    if (req.auth.role !== 'ADMIN') {
      next(new ForbiddenError('Admin role required'));
      return;
    }
    next();
  };
}
