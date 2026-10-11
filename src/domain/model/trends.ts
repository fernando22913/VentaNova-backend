/**
 * Aggregated, public sales statistics derived exclusively from paid orders.
 *
 * Deliberately coarse: totals, a per-day series and a best-seller list. No
 * order-level or customer-level detail is ever exposed — the repository joins
 * only against `orders` (status `PAID`) and `order_items` and projects nothing
 * that identifies a buyer.
 */

/** Gross revenue and order/unit volumes across all paid orders. */
export interface TrendTotals {
  /** Sum of `orders.total_cents` for paid orders (integer cents). */
  revenueCents: number;
  /** Number of paid orders. */
  paidOrders: number;
  /** Total quantity of items sold across paid orders. */
  unitsSold: number;
  /** revenueCents / paidOrders (0 when there are no paid orders). */
  averageOrderCents: number;
}

/** One per-day bucket of the last-N-days series. */
export interface TrendPoint {
  /** ISO date (yyyy-mm-dd) of the bucket, in UTC. */
  date: string;
  revenueCents: number;
  units: number;
}

/** A best-selling product, ranked by quantity sold. */
export interface BestSeller {
  /** Product slug for deep linking to the catalog. */
  slug: string;
  title: string;
  unitsSold: number;
  revenueCents: number;
}

/** Everything the public Trends endpoint returns. */
export interface TrendReport {
  totals: TrendTotals;
  /** Past 30 days including empty days, oldest first. */
  sales: TrendPoint[];
  /** Top 5 products by units sold. */
  bestSellers: BestSeller[];
}