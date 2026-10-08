import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';
import { createDb } from './db.js';

/**
 * Runs the committed SQL migrations against the configured database. Used by
 * the `db:migrate` script locally and, via the deploy release command, on
 * Render before boot — never `db:push` (blueprint §5/§12).
 */
export async function runMigrations(databaseUrl = env.DATABASE_URL): Promise<void> {
  const { db, client } = createDb(databaseUrl);
  await migrate(db, { migrationsFolder: './drizzle' });
  await client.end();
  logger.info('Migrations applied');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
}
