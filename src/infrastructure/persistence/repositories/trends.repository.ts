import { eq, sql } from 'drizzle-orm';

import type { TrendReport, TrendTotals, TrendPoint, BestSeller } from '../../../domain/model/trends.js';
import type { TrendsRepository } from '../../../domain/ports/trends-repository.js';
import type { Database } from '../db.js';
import { orderItems, orders, products } from '../schema.js';

const DAYS = 30;
const BEST_SELLER_LIMIT = 5;

function asInt(value: unknown): number {
  // Los agregados llegan como cadenas bigint/numeric desde postgres.js, así que se convierten defensivamente aquí.
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Adaptador Drizzle para el puerto TrendsRepository: proyección de solo lectura sobre órdenes PAID con sumas separadas de ingresos/unidades.
export class DrizzleTrendsRepository implements TrendsRepository {
  constructor(private readonly db: Database) {}

  async getReport(): Promise<TrendReport> {
    const [ordersRow] = await this.db
      .select({
        paidOrders: sql<number>`COUNT(*)`,
        revenueCents: sql<number>`COALESCE(SUM(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(eq(orders.status, 'PAID'))
      .limit(1);

    const [unitsRow] = await this.db
      .select({
        unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.status, 'PAID'))
      .limit(1);

    const revenueByDay = await this.revenueByDay();
    const unitsByDay = await this.unitsByDay();

    const totals: TrendTotals = {
      revenueCents: asInt(ordersRow?.revenueCents ?? 0),
      paidOrders: asInt(ordersRow?.paidOrders ?? 0),
      unitsSold: asInt(unitsRow?.unitsSold ?? 0),
      averageOrderCents: 0,
    };
    totals.averageOrderCents = totals.paidOrders > 0 ? Math.floor(totals.revenueCents / totals.paidOrders) : 0;

    const bestSellers = await this.bestSellers();

    return {
      totals,
      sales: buildDailySeries(revenueByDay, unitsByDay),
      bestSellers,
    };
  }

  private async revenueByDay(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(${orders.paidAt}, 'YYYY-MM-DD')`,
        revenueCents: sql<number>`COALESCE(SUM(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(eq(orders.status, 'PAID'))
      .groupBy(sql`to_char(${orders.paidAt}, 'YYYY-MM-DD')`);
    return new Map(rows.map((row) => [row.date, asInt(row.revenueCents)]));
  }

  private async unitsByDay(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(${orders.paidAt}, 'YYYY-MM-DD')`,
        units: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.status, 'PAID'))
      .groupBy(sql`to_char(${orders.paidAt}, 'YYYY-MM-DD')`);
    return new Map(rows.map((row) => [row.date, asInt(row.units)]));
  }

  private async bestSellers(): Promise<BestSeller[]> {
    const rows = await this.db
      .select({
        slug: products.slug,
        title: products.title,
        unitsSold: sql<number>`SUM(${orderItems.quantity})`,
        revenueCents: sql<number>`SUM(${orderItems.quantity} * ${orderItems.unitPriceCents})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orders.status, 'PAID'))
      .groupBy(products.id, products.slug, products.title)
      .orderBy(sql`SUM(${orderItems.quantity}) DESC`, sql`SUM(${orderItems.quantity} * ${orderItems.unitPriceCents}) DESC`)
      .limit(BEST_SELLER_LIMIT);
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      unitsSold: asInt(row.unitsSold),
      revenueCents: asInt(row.revenueCents),
    }));
  }
}

// Fusiona los dos mapas por día en una serie contigua de 30 días de más antiguo a más nuevo, incluyendo días vacíos (fechas UTC).
function buildDailySeries(revenue: Map<string, number>, units: Map<string, number>): TrendPoint[] {
  const points: TrendPoint[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = toDateKey(day);
    points.push({
      date: key,
      revenueCents: revenue.get(key) ?? 0,
      units: units.get(key) ?? 0,
    });
  }
  return points;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}