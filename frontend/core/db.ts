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

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);');

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

  function ensureColumn(table: string, column: string, definition: string): boolean {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (existing.some((row) => row.name === column)) return false;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
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
  // ISO timestamp the user clicked "do not show again" on the founding-rate
  // lock-in reminder. NULL = still eligible to see the reminder once per fresh
  // login. Cleared implicitly by hasActiveSubscription becoming true (the
  // reminder is gated on the user not yet paying).
  ensureColumn('users', 'founding_lockin_dismissed_at', 'TEXT');

  // Double-sided referral program.
  //   `referral_code`         - this user's own shareable code (lazily minted
  //                             on first view of the account referral card).
  //                             UNIQUE so an inbound ?ref= resolves to exactly
  //                             one referrer.
  //   `referred_by_code`      - the code this account signed up under, captured
  //                             from the zgx_ref cookie / register body at
  //                             account creation (NULL for organic signups).
  //   `referral_credit_months`- free months OWED to this user as a referrer but
  //                             not yet cashable because they had no active
  //                             subscription at reward time. Redeemed as a
  //                             Stripe balance credit the next time they
  //                             subscribe, then reset to 0.
  ensureColumn('users', 'referral_code', 'TEXT');
  ensureColumn('users', 'referred_by_code', 'TEXT');
  ensureColumn('users', 'referral_credit_months', 'INTEGER NOT NULL DEFAULT 0');

  // Referral ledger: one row per (referrer -> referee) relationship. A user can
  // only ever be referred once (UNIQUE referee_user_id), which is the primary
  // anti-abuse latch. `status` walks pending -> rewarded; the referrer is only
  // rewarded when the referee's first invoice is actually paid (subscription
  // goes active), never at signup, so unpaid signups earn nothing.
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_user_id TEXT NOT NULL,
      referee_user_id TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      converted_at TEXT,
      rewarded_at TEXT,
      FOREIGN KEY(referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(referee_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);');
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL'
  );

  // One-time stamp marking that the "first paid subscription" welcome email
  // was delivered. After it is set, subsequent paid checkouts (re-subscribes
  // after a cancel) trigger a "welcome back" email instead, and pure upgrades
  // (basic → premium with no intervening cancel) trigger nothing.
  ensureColumn('users', 'paid_welcome_email_sent_at', 'TEXT');

  // Email verification gate. NULL = not yet verified; set to the ISO timestamp
  // at which the user proved ownership (either by clicking a verification
  // link or by completing OAuth, where the provider already attested it).
  //
  // The backfill is gated on ensureColumn's "I just added this" return so it
  // runs exactly once, the same boot the column is born. Subsequent boots
  // see the column already present and skip the block — that's what keeps a
  // genuinely-unverified row from being silently re-stamped on restart.
  // The cohort being grandfathered here is the 119 founding members + admin
  // that predate the requirement; locking them out would be a regression.
  if (ensureColumn('users', 'email_verified_at', 'TEXT')) {
    db.prepare(
      `UPDATE users SET email_verified_at = ? WHERE email_verified_at IS NULL`,
    ).run(new Date().toISOString());
  }

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
