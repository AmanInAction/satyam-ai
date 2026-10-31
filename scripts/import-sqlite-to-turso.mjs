import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@tursodatabase/serverless/compat';
import fs from 'node:fs';
import path from 'node:path';

const sourceIndex = process.argv.indexOf('--source');
const sourcePath = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : undefined;
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!sourcePath) throw new Error('Pass the SQLite file explicitly with --source <path>.');
if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
}
if (!fs.existsSync(sourcePath)) throw new Error(`SQLite source file not found: ${sourcePath}`);

const source = new DatabaseSync(path.resolve(sourcePath), { readOnly: true });
const client = createClient({ url, authToken });
const tableSpecs = [
  { name: 'users', primary: 'id', unique: ['email'] },
  { name: 'sessions', primary: 'token', unique: [] },
  { name: 'analyses', primary: 'id', unique: [] },
  { name: 'transactions', primary: 'id', unique: ['idempotency_key'] },
  { name: 'credit_balances', primary: 'user_id', unique: [] },
  { name: 'anonymous_credit_migrations', primary: 'anonymous_user_id', unique: [] },
  { name: 'telegram_link_codes', primary: 'code_hash', unique: [] },
  { name: 'telegram_accounts', primary: 'chat_id', unique: ['user_id'] },
];

const sourceTables = new Set(source.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table'"
).all().map((row) => row.name));
for (const required of ['users', 'sessions', 'analyses', 'transactions']) {
  if (!sourceTables.has(required)) throw new Error(`SQLite source is missing required table ${required}.`);
}

const tables = new Map();
for (const spec of tableSpecs) {
  if (!sourceTables.has(spec.name)) continue;
  const columns = source.prepare(`PRAGMA table_info(${spec.name})`).all().map((row) => row.name);
  tables.set(spec.name, {
    ...spec,
    columns,
    rows: source.prepare(`SELECT * FROM ${spec.name}`).all(),
  });
}

const users = tables.get('users');
const transactions = tables.get('transactions');
const txsByUser = new Map();
for (const tx of transactions.rows) {
  const entries = txsByUser.get(tx.user_id) || [];
  entries.push(tx);
  txsByUser.set(tx.user_id, entries);
}

if (!users.columns.includes('credits_available') ||
    !users.columns.includes('has_received_free_grant')) {
  for (const user of users.rows) {
    const history = txsByUser.get(user.id) || [];
    history.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    if (!users.columns.includes('credits_available')) {
      user.credits_available = Number(history.at(-1)?.balance_after || 0);
    }
    if (!users.columns.includes('has_received_free_grant')) {
      user.has_received_free_grant = history.some((tx) => tx.type === 'initial_grant') ? 1 : 0;
    }
  }
  if (!users.columns.includes('credits_available')) users.columns.push('credits_available');
  if (!users.columns.includes('has_received_free_grant')) users.columns.push('has_received_free_grant');
}

if (!tables.has('credit_balances')) {
  const balances = new Map();
  for (const tx of transactions.rows) {
    const current = balances.get(tx.user_id);
    if (!current || String(tx.created_at) >= String(current.updated_at)) {
      balances.set(tx.user_id, {
        user_id: tx.user_id,
        balance: Number(tx.balance_after),
        has_received_free_grant: (txsByUser.get(tx.user_id) || [])
          .some((entry) => entry.type === 'initial_grant') ? 1 : 0,
        updated_at: tx.created_at,
      });
    }
  }
  for (const user of users.rows) {
    if (!balances.has(user.id)) {
      balances.set(user.id, {
        user_id: user.id,
        balance: Number(user.credits_available || 0),
        has_received_free_grant: Number(user.has_received_free_grant || 0),
        updated_at: user.updated_at,
      });
    }
  }
  tables.set('credit_balances', {
    ...tableSpecs.find((spec) => spec.name === 'credit_balances'),
    columns: ['user_id', 'balance', 'has_received_free_grant', 'updated_at'],
    rows: [...balances.values()],
  });
}

const compareValue = (left, right) => {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left == null && right == null;
  }
  return String(left) === String(right);
};
const sameRow = (expected, actual, columns) =>
  columns.every((column) => compareValue(expected[column], actual[column]));

try {
  const version = await client.execute({
    sql: 'SELECT version FROM app_schema_migrations WHERE version = ?',
    args: [1],
  });
  if (version.rows.length === 0) {
    throw new Error('Apply the Turso schema first with `npm run db:migrate:turso`.');
  }

  const transaction = await client.transaction('write');
  const counts = {};
  try {
    for (const spec of tableSpecs) {
      const table = tables.get(spec.name);
      if (!table) continue;
      let inserted = 0;
      let alreadyPresent = 0;

      for (const row of table.rows) {
        const columns = table.columns.filter((column) => Object.hasOwn(row, column));
        const rowValues = columns.map((column) => row[column] ?? null);
        const uniqueKeys = [spec.primary, ...spec.unique]
          .filter((key) => columns.includes(key) && row[key] != null);
        let existing;

        for (const key of uniqueKeys) {
          const result = await transaction.execute({
            sql: `SELECT * FROM ${spec.name} WHERE ${key} = ? LIMIT 1`,
            args: [row[key]],
          });
          if (result.rows.length > 0) {
            existing = result.rows[0];
            break;
          }
        }

        if (existing) {
          if (!sameRow(row, existing, columns)) {
            throw new Error(
              `Conflicting ${spec.name} record for ${spec.primary}=${String(row[spec.primary])}; import aborted without overwriting data.`
            );
          }
          alreadyPresent++;
          continue;
        }

        await transaction.execute({
          sql: `INSERT INTO ${spec.name} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          args: rowValues,
        });
        inserted++;
      }
      counts[spec.name] = { inserted, alreadyPresent };
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  for (const [table, count] of Object.entries(counts)) {
    console.log(`${table}: ${count.inserted} inserted, ${count.alreadyPresent} already identical`);
  }
  console.log('SQLite import committed. No conflicting remote records were overwritten.');
} finally {
  source.close();
  client.close();
}
