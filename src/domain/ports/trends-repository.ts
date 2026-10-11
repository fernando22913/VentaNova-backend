import type { TrendReport } from '../model/trends.js';

// Puerto de solo lectura para estadísticas agregadas sobre pedidos pagados; la capa de aplicación nunca ve un pedido ni comprador en bruto.
export interface TrendsRepository {
  getReport(): Promise<TrendReport>;
}