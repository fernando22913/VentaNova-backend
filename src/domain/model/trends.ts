// Estadísticas públicas de ventas agregadas solo de pedidos pagados; no se expone detalle de pedidos ni clientes.

// Ingresos brutos y volúmenes de pedidos/unidades de todos los pedidos pagados.
export interface TrendTotals {
  // Suma de `orders.total_cents` de los pedidos pagados (céntimos enteros).
  revenueCents: number;
  // Número de pedidos pagados.
  paidOrders: number;
  // Cantidad total de items vendidos en los pedidos pagados.
  unitsSold: number;
  // revenueCents / paidOrders (0 cuando no hay pedidos pagados).
  averageOrderCents: number;
}

// Un bucket por día de la serie de los últimos N días.
export interface TrendPoint {
  // Fecha ISO (yyyy-mm-dd) del bucket, en UTC.
  date: string;
  revenueCents: number;
  units: number;
}

// Un producto más vendido, ordenado por cantidad vendida.
export interface BestSeller {
  // slug del producto para enlazar al catálogo.
  slug: string;
  title: string;
  unitsSold: number;
  revenueCents: number;
}

// Todo lo que devuelve el endpoint público de Trends.
export interface TrendReport {
  totals: TrendTotals;
  // Últimos 30 días incluyendo días vacíos, del más antiguo al más reciente.
  sales: TrendPoint[];
  // Top 5 productos por unidades vendidas.
  bestSellers: BestSeller[];
}