import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js/driver';

import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  client: postgres.Sql;
}

/**
 * One postgres.js connection per database URL. `prepare: false` is required
 * for the postgres-js migrator and keeps parameterized queries on a single
 * statement cache; the driver still parameterizes every query, so SQL
 * injection stays off the table (NFR1).
 */
export function createDb(databaseUrl: string): DbHandle {
  const client = postgres(databaseUrl, { max: 10, prepare: false });
  const db = drizzle(client, { schema });
  return { db, client };
}
