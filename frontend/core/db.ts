import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    provider TEXT NOT NULL,
    provider_id TEXT,
    tier TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_secret TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_rotated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    user_id TEXT,
    actor_user_id TEXT,
    email TEXT,
    ip TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function ensureColumn(table: string, column: string, definition: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!existing.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('users', 'stripe_customer_id', 'TEXT');
ensureColumn('users', 'stripe_subscription_id', 'TEXT');
ensureColumn('users', 'stripe_price_id', 'TEXT');
ensureColumn('users', 'subscription_status', 'TEXT');
ensureColumn('users', 'current_period_end', 'TEXT');
ensureColumn('users', 'cancel_at_period_end', 'INTEGER NOT NULL DEFAULT 0');

db.exec(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL'
);

export function getDb() {
  return db;
}
