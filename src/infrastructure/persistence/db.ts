import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js/driver';

import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  client: postgres.Sql;
}

// Una conexión postgres.js por URL de base de datos; `prepare: false` es necesario para el migrador.
export function createDb(databaseUrl: string): DbHandle {
  const client = postgres(databaseUrl, { max: 10, prepare: false });
  const db = drizzle(client, { schema });
  return { db, client };
}
