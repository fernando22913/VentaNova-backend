import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from '../../../src/infrastructure/persistence/schema.js';
import type { Database } from '../../../src/infrastructure/persistence/db.js';

/**
 * Shared helper for integration tests. Ensures the dedicated `bytemarket_test`
 * database exists, applies the committed migrations once per run, and hands
 * out a clean (truncated) database per test.
 */

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://bytemarket:bytemarket_dev_password@localhost:5432/bytemarket_test';

const testDatabaseName = getDatabaseName(TEST_DATABASE_URL);
const adminUrl = TEST_DATABASE_URL.replace(/\/[^/]*$/, '/postgres');

let handle: { db: Database; client: postgres.Sql } | null = null;

export async function getTestDatabase(): Promise<{ db: Database; client: postgres.Sql }> {
  if (handle) return handle;

  await ensureDatabaseExists();

  const client = postgres(TEST_DATABASE_URL, { prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });

  handle = { db, client };
  return handle;
}

/** Empties every table; the app-layer order intentionally mirrors FK deps. */
export async function resetDatabase(client: postgres.Sql): Promise<void> {
  await client.unsafe(
    'TRUNCATE TABLE refresh_tokens, entitlements, order_items, orders, products, categories, users RESTART IDENTITY CASCADE',
  );
}

async function ensureDatabaseExists(): Promise<void> {
  // CREATE DATABASE cannot be parameterized; the name is derived from a
  // controlled test URL, so a safe identifier is guaranteed.
  if (!/^[a-z_][a-z0-9_]*$/.test(testDatabaseName)) {
    throw new Error(`Unsafe test database name: "${testDatabaseName}"`);
  }

  const admin = postgres(adminUrl, { onnotice: () => {}, max: 1 });
  try {
    const existing = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${testDatabaseName}
    `;
    if (existing.length === 0) {
      await admin.unsafe(`CREATE DATABASE ${testDatabaseName}`);
    }
  } finally {
    await admin.end();
  }
}

function getDatabaseName(connectionUrl: string): string {
  return decodeURIComponent(new URL(connectionUrl).pathname.slice(1));
}
