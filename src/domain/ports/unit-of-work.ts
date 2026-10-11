import type { OrderRepository } from './order-repository.js';
import type { EntitlementRepository } from './entitlement-repository.js';
import type { RefreshTokenRepository } from './refresh-token-repository.js';

// Unit of Work — puerto de frontera transaccional (§6); run(fn) ejecuta dentro de una transacción de BD con repos con alcance, así las escrituras son atómicas.
export interface TransactionRepositories {
  orders: OrderRepository;
  entitlements: EntitlementRepository;
  refreshTokens: RefreshTokenRepository;
}

export interface UnitOfWork {
  run<T>(work: (tx: TransactionRepositories) => Promise<T>): Promise<T>;
}
