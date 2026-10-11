import type { TrendReport } from '../model/trends.js';

/**
 * Read-only port for aggregated sales statistics. Implemented by the Drizzle
 * adapter with SQL aggregates over `orders` + `order_items` restricted to paid
 * orders; the application layer never sees a raw order or a buyer.
 */
export interface TrendsRepository {
  getReport(): Promise<TrendReport>;
}