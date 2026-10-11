import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { UserRole } from '../../../domain/model/enums.js';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors/index.js';

/**
 * Must run after `requireAuth`. Restricts a route to the given roles; the
 * backend re-checks the role on every request — frontend guards are UX only.
 * A wrong token never reaches the use case.
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError('Missing bearer token'));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError(`Role required: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
