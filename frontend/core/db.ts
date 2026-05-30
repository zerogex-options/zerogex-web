import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');

// Lazy init so that importing this module (e.g. during `next build`'s page-data
// collection, which spawns multiple worker processes) does NOT open the DB or
// run any migrations. Build workers race each other on ALTER TABLE if migrations
// run at module load. With lazy init, the DB is only opened on the first
// runtime getDb() call inside a single PM2 process — single writer, no race.
let cachedDb: DatabaseSync | null = null;

function initDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  // Defensive: if another process ever does open the same file and writes
  // concurrently, wait up to 5s for the lock instead of failing immediately.
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, provider_id),
      UNIQUE(user_id, provider),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);');

  // Stripe webhook idempotency + event ordering. `id` is Stripe's event.id
  // (globally unique) so a redelivered/retried event is a no-op. `created`
  // is the Stripe event.created unix timestamp, used to reject a stale
  // (out-of-order) subscription event that would otherwise re-promote a
  // cancelled user.
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subscription_id TEXT,
      created INTEGER NOT NULL,
      processed_at TEXT NOT NULL
    );
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_sub ON stripe_webhook_events(subscription_id, created);'
  );

  (function migrateLegacyProviderColumns() {
    const cols = (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map((c) => c.name);
    const hasLegacyProvider = cols.includes('provider');
    const hasLegacyProviderId = cols.includes('provider_id');
    if (!hasLegacyProvider && !hasLegacyProviderId) return;

    if (hasLegacyProvider && hasLegacyProviderId) {
      const legacyRows = db
        .prepare(
          `SELECT id, provider, provider_id FROM users
           WHERE provider IN ('google','apple') AND provider_id IS NOT NULL AND provider_id != ''`
        )
        .all() as Array<{ id: string; provider: string; provider_id: string }>;
      if (legacyRows.length > 0) {
        const insert = db.prepare(
          `INSERT OR IGNORE INTO user_identities (id, user_id, provider, provider_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        const now = new Date().toISOString();
        for (const r of legacyRows) {
          insert.run(`ident_${r.id}_${r.provider}`, r.id, r.provider, r.provider_id, now, now);
        }
      }
    }

    if (hasLegacyProviderId) db.exec(`ALTER TABLE users DROP COLUMN provider_id`);
    if (hasLegacyProvider) db.exec(`ALTER TABLE users DROP COLUMN provider`);
  })();

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
  ensureColumn('users', 'disclaimer_acknowledged_at', 'TEXT');
  ensureColumn('users', 'disclaimer_version_acknowledged', 'TEXT');

  // Founding-member program. `founding_eligible` is a one-time grant set via
  // scripts/seed-founders.mjs for the launch cohort; new signups default to 0
  // and cannot redeem the founding code. `founding_member_started_at` is set
  // when the user actually subscribes with the founding code, and the webhook
  // uses (now - started_at >= 12 months) to apply the lifetime 25%-off coupon
  // once. `founding_lifetime_applied_at` is the latch that prevents re-apply
  // on subsequent renewal events.
  ensureColumn('users', 'founding_eligible', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'founding_member_started_at', 'TEXT');
  ensureColumn('users', 'founding_lifetime_applied_at', 'TEXT');

  // Users who acked before versioning existed implicitly acked v1.
  db.exec(
    `UPDATE users
     SET disclaimer_version_acknowledged = 'v1'
     WHERE disclaimer_acknowledged_at IS NOT NULL
       AND disclaimer_version_acknowledged IS NULL`
  );

  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL'
  );

  return db;
}

export function getDb(): DatabaseSync {
  if (cachedDb) return cachedDb;
  cachedDb = initDb();
  return cachedDb;
}
