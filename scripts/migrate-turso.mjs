import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@tursodatabase/serverless/compat';

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/lib/db/migrations/0001_initial.sql'
);
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
}

const client = createClient({ url, authToken });

try {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const current = await client.execute({
    sql: 'SELECT version FROM app_schema_migrations WHERE version = ?',
    args: [1],
  });
  if (current.rows.length > 0) {
    console.log('Turso schema version 1 is already applied; no changes made.');
  } else {
    const statements = fs.readFileSync(migrationPath, 'utf8')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    const transaction = await client.transaction('write');
    try {
      for (const sql of statements) await transaction.execute({ sql });
      await transaction.execute({
        sql: 'INSERT INTO app_schema_migrations (version, applied_at) VALUES (?, ?)',
        args: [1, new Date().toISOString()],
      });

      for (const table of ['users', 'sessions', 'analyses', 'transactions', 'credit_balances']) {
        const result = await transaction.execute({ sql: `PRAGMA table_info(${table})` });
        if (result.rows.length === 0) throw new Error(`Migration did not create ${table}.`);
      }

      await transaction.commit();
      console.log('Turso schema version 1 applied and verified.');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
} finally {
  client.close();
}
