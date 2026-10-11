import type { TransactionRepositories, UnitOfWork } from '../../domain/ports/unit-of-work.js';
import type { Database } from './db.js';
import { DrizzleEntitlementRepository } from './repositories/entitlement.repository.js';
import { DrizzleOrderRepository } from './repositories/order.repository.js';
import { DrizzleRefreshTokenRepository } from './repositories/refresh-token.repository.js';

// Adaptador Drizzle UnitOfWork: vincula los repositorios a un handle de una transacción para que las escrituras se confirmen o reviertan juntas.
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
