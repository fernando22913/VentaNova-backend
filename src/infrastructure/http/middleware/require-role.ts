import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { UserRole } from '../../../domain/model/enums.js';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors/index.js';

// Debe ejecutarse tras `requireAuth`. Restringe una ruta a los roles dados; el rol se revalida en el servidor.
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
