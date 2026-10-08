import type { TransactionRepositories, UnitOfWork } from '../../domain/ports/unit-of-work.js';
import type { Database } from './db.js';
import { DrizzleEntitlementRepository } from './repositories/entitlement.repository.js';
import { DrizzleOrderRepository } from './repositories/order.repository.js';
import { DrizzleRefreshTokenRepository } from './repositories/refresh-token.repository.js';

/**
 * Drizzle UnitOfWork adapter. `db.transaction()` gives us a transaction-scoped
 * handle; the callback receives repositories bound to that exact handle, so
 * order status + entitlements commit (or roll back) as one atomic unit.
 *
 * The tx handle is structurally identical to a database handle for our
 * purposes (both expose the same query builders); the cast is contained to
 * this adapter on purpose — it is the seam where transactions are materialized.
 */
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  async run<T>(work: (tx: TransactionRepositories) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      const repositories: TransactionRepositories = {
        orders: new DrizzleOrderRepository(txDb),
        entitlements: new DrizzleEntitlementRepository(txDb),
        refreshTokens: new DrizzleRefreshTokenRepository(txDb),
      };
      return work(repositories);
    });
  }
}
