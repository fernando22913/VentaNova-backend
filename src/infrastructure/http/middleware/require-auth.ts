import type { NextFunction, Request, Response } from 'express';

import type { TokenService } from '../../../domain/ports/token-service.js';
import { UnauthorizedError } from '../../../domain/errors/index.js';

// Middleware de auth con Bearer: reverifica firma y rol en cada petición (blueprint §10); asigna `req.auth`.
export function requireAuth(tokenService: TokenService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      next(new UnauthorizedError('Missing bearer token'));
      return;
    }

    try {
      const payload = await tokenService.verify(header.slice('Bearer '.length));
      req.auth = { userId: payload.sub, role: payload.role };
      next();
    } catch (error) {
      next(
        error instanceof UnauthorizedError
          ? error
          : new UnauthorizedError('Invalid or expired token'),
      );
    }
  };
}
