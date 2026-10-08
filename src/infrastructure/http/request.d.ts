import type { UserRole } from '../../domain/model/user.js';

/**
 * Express Request augmentation: `req.auth` is set by `requireAuth` for
 * protected routes. `requireAdmin` (Phase 6) additionally checks the role.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole };
    }
  }
}

// Required so the `declare global` block is treated as a module augmentation.
export {};
