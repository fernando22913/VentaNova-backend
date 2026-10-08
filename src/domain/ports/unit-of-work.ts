import type { OrderRepository } from './order-repository.js';
import type { EntitlementRepository } from './entitlement-repository.js';
import type { RefreshTokenRepository } from './refresh-token-repository.js';

/**
 * Unit of Work — the transaction boundary port (blueprint §6, "the one hard
 * hexagonal problem").
 *
 * Use cases receive a `UnitOfWork` instead of emitting SQL or knowing about
 * Drizzle. `run(fn)` executes `fn` inside one database transaction and the
 * callback receives transaction-scoped repositories, so every write is
 * atomic: an order flipping to PAID and its entitlements are created all or
 * nothing. The Drizzle adapter implements this with `db.transaction()`.
 */
export interface TransactionRepositories {
  orders: OrderRepository;
  entitlements: EntitlementRepository;
  refreshTokens: RefreshTokenRepository;
}

export interface UnitOfWork {
  run<T>(work: (tx: TransactionRepositories) => Promise<T>): Promise<T>;
}
