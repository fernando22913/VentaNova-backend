import type { UserRole } from '../../domain/model/enums.js';

// Aumento de Express Request: `requireAuth` asigna `req.auth` en rutas protegidas.
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole };
    }
  }
}

// Necesario para que `declare global` se trate como aumento de módulo.
export {};
