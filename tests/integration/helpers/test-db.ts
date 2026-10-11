import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from '../../../src/infrastructure/persistence/schema.js';
import type { Database } from '../../../src/infrastructure/persistence/db.js';

// Helper compartido de integración: asegura ventanova_test, migra una vez y devuelve una DB limpia.

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ventanova:ventanova_dev_password@localhost:5432/ventanova_test';

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

// Vacía todas las tablas; el orden respeta las dependencias FK.
export async function resetDatabase(client: postgres.Sql): Promise<void> {
  await client.unsafe(
    'TRUNCATE TABLE refresh_tokens, entitlements, order_items, orders, products, categories, users, contact_messages RESTART IDENTITY CASCADE',
  );
}

async function ensureDatabaseExists(): Promise<void> {
  // CREATE DATABASE no se puede parametrizar; la URL de test controlada garantiza un nombre seguro.
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
