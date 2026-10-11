import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';
import { createDb } from './db.js';

// Ejecuta las migraciones SQL confirmadas contra la base de datos configurada (nunca db:push).
export async function runMigrations(databaseUrl = env.DATABASE_URL): Promise<void> {
  const { db, client } = createDb(databaseUrl);
  await migrate(db, { migrationsFolder: './drizzle' });
  await client.end();
  logger.info('Migrations applied');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
}
