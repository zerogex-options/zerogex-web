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
  // Idempotency latch for the final-call email (scripts/send-founding-final-
  // call.mts), which fires once per founding-eligible non-redeemer in the
  // last ~36h window before FOUNDING_LOCKIN_DEADLINE_ISO. NULL = never sent.
  // Deliberately a permanent one-shot — the deadline only crosses once.
  ensureColumn('users', 'founding_final_call_email_sent_at', 'TEXT');

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

  // Creator Partner Program. Layered ON TOP of the referral plumbing above —
  // every partner is still a user with a `referral_code`, and a referee whose
  // `referred_by_code` resolves to a creator gets the partner-audience coupon
  // (higher-value, repeating) instead of the standard one-shot referee coupon.
  // The differences from a standard referrer:
  //   - `partner_tier='creator'` flips the routing in resolveDiscount() and
  //     gates partner-only behaviors (commissions, dashboard, etc.).
  //   - Commissions are CASH payouts (% of the referee's invoices for the
  //     first 12 months), not Stripe account credits — accrued by the webhook
  //     into the partner_commissions ledger below.
  //   - The partner themselves gets a comped Pro grant: tier='pro' with no
  //     subscription, expiring at `partner_pro_grant_expires_at`. The expiry
  //     cron downgrades them back to 'public' if they haven't subscribed.
  //   - Optional `partner_audience_coupon_id` overrides the global
  //     STRIPE_COUPON_PARTNER_AUDIENCE for this partner specifically (e.g.
  //     a custom higher-value coupon negotiated with a top creator).
  //   - `partner_disclosure_url` records where they post the FTC affiliate
  //     disclosure (audit trail only; not enforced at checkout).
  ensureColumn('users', 'partner_tier', 'TEXT');
  ensureColumn('users', 'partner_commission_bps', 'INTEGER NOT NULL DEFAULT 3000');
  ensureColumn('users', 'partner_commission_window_months', 'INTEGER NOT NULL DEFAULT 12');
  ensureColumn('users', 'partner_audience_coupon_id', 'TEXT');
  // Human-readable audience promo code (e.g. SPYLEVELS25). Distinct from the
  // 8-char auto-minted `referral_code` and from the underlying Stripe coupon
  // id. Same string is registered with Stripe as a `promotion_code` attached
  // to `partner_audience_coupon_id` (or the global env coupon) so the
  // audience can ALSO type it in Stripe's checkout promo field. Either
  // entry path attributes back to the partner — `?ref=` matches via
  // referral_code OR this column (recordReferralSignup falls through), and
  // the webhook back-attributes promo-code-only checkouts by reading
  // promotion_code.metadata.partner_user_id.
  ensureColumn('users', 'partner_audience_promo_code', 'TEXT');
  ensureColumn('users', 'partner_disclosure_url', 'TEXT');
  ensureColumn('users', 'partner_activated_at', 'TEXT');
  ensureColumn('users', 'partner_pro_grant_expires_at', 'TEXT');

  // Partner commission ledger: one row per (creator, referee_invoice) where
  // the creator earns cash. UNIQUE(stripe_invoice_id) makes the webhook
  // accrual idempotent against redeliveries. Status walks
  // accrued -> paid (operator marks after out-of-band payout) or
  // accrued -> reversed (e.g. invoice refunded/disputed).
  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_commissions (
      id TEXT PRIMARY KEY,
      partner_user_id TEXT NOT NULL,
      referee_user_id TEXT NOT NULL,
      stripe_invoice_id TEXT NOT NULL UNIQUE,
      billed_amount INTEGER NOT NULL,
      commission_amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accrued',
      created_at TEXT NOT NULL,
      paid_at TEXT,
      payout_reference TEXT,
      FOREIGN KEY(partner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(referee_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_user_id, status);'
  );
  // Unique index on the customer-facing promo code so two partners can't
  // claim the same string. Partial index (WHERE NOT NULL) keeps it cheap
  // for the dominant cohort of standard users without a code.
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_partner_audience_promo_code ON users(partner_audience_promo_code) WHERE partner_audience_promo_code IS NOT NULL'
  );

  // One-time stamp marking that the "first paid subscription" welcome email
  // was delivered. After it is set, subsequent paid checkouts (re-subscribes
  // after a cancel) trigger a "welcome back" email instead, and pure upgrades
  // (basic → premium with no intervening cancel) trigger nothing.
  ensureColumn('users', 'paid_welcome_email_sent_at', 'TEXT');

  // Idempotency latch for the ~48h-before-trial-end reminder nudge sent by
  // scripts/send-trial-reminders.mts. NULL = eligible, set to the ISO
  // timestamp of the send once delivered. Cleared back to NULL the next
  // time the user enters a fresh 'trialing' window (i.e. signs up for a
  // second trial after a cancellation) so the nudge fires once per trial.
  ensureColumn('users', 'trial_reminder_email_sent_at', 'TEXT');

  // One-shot latch for the abandoned-checkout recovery email sent by
  // scripts/send-checkout-recovery.mts. NULL = eligible, set to the ISO
  // timestamp of the send once delivered. Deliberately never cleared: a
  // user who bails a second time after declining the first nudge does not
  // get nagged again. The recovery cron's eligibility query treats this
  // column as a permanent dedupe key for the lifetime of the account.
  ensureColumn('users', 'checkout_recovery_email_sent_at', 'TEXT');

  // One-shot latch for the founder-voice nudge sent ~2h after signup to
  // users who verified their email but never opened checkout (see
  // scripts/send-verified-never-paid.mts). NULL = eligible, set to the ISO
  // timestamp on send. Never cleared: this is the "hey, try the free trial"
  // welcome-mat email, and re-firing after any state churn would spam.
  ensureColumn('users', 'verified_never_paid_email_sent_at', 'TEXT');

  // Welcome-back vs upgrade discriminator for the Stripe webhook's welcome
  // email path. Flipped to 1 by clearSubscriptionFromUser on subscription
  // deletion, atomically cleared back to 0 by maybeSendPaidWelcomeEmail when
  // it fires the welcome-back. This lets the welcome handler tell apart
  // "customer cancelled then came back" (welcome-back) from "customer is
  // upgrading in place" (silent) via two race-safe CAS claims (on the stamp
  // and on this flag), with no dependence on any column mutated by
  // concurrent customer.subscription.* events for the same signup flow —
  // which is what caused the original race where the welcome was skipped.
  //
  // Backfill on first add: a user who's been welcomed but no longer has a
  // subscription id likely cancelled before this column existed. Mark them
  // so their next checkout fires welcome-back instead of falling through to
  // the silent-upgrade branch.
  if (ensureColumn('users', 'subscription_lapsed', 'INTEGER NOT NULL DEFAULT 0')) {
    db.exec(
      `UPDATE users SET subscription_lapsed = 1
       WHERE paid_welcome_email_sent_at IS NOT NULL
         AND stripe_subscription_id IS NULL`,
    );
  }

  // Idempotency stamp for the cancellation acknowledgement email fired when
  // Stripe flips cancel_at_period_end false → true (the "clicked Cancel"
  // moment). NULL = eligible; set to ISO on send via CAS in the webhook so
  // redeliveries can't double-fire. Cleared back to NULL on the reverse
  // transition (reactivation) so a future re-cancel can re-fire.
  ensureColumn('users', 'cancel_ack_email_sent_at', 'TEXT');

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

  // Broker affiliate attribution: one row per click on a broker CTA from a
  // public share surface (or the /brokers comparison page). Deliberately a
  // separate table from `referrals` — the domain overlap (attribution to a
  // partner) is thin, but the columns don't line up 1:1 (no referee user id
  // at click time, no reward status, opaque cookie-driven attribution_id
  // instead of a user id join key). Keeps the two revenue streams
  // independently queryable.
  //
  // `attribution_id` is the opaque UUID stored in the zgx_attr cookie set by
  // proxy.ts. It persists across sessions (2y max-age), so today's click can
  // be joined to a subscription conversion months later. `user_id` is
  // captured when the click happened inside a logged-in session — most
  // clicks will be anonymous since these are public share surfaces. `ip_hash`
  // is SHA-256(ip + ATTRIBUTION_IP_PEPPER) purely for the rate limiter and
  // downstream dedup; the raw IP never lands.
  db.exec(`
    CREATE TABLE IF NOT EXISTS broker_attribution_clicks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      clicked_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      surface        TEXT NOT NULL,
      broker_partner TEXT NOT NULL,
      path           TEXT NOT NULL,
      attribution_id TEXT NOT NULL,
      user_id        TEXT,
      session_id     TEXT,
      utm_source     TEXT,
      utm_medium     TEXT,
      utm_campaign   TEXT,
      ip_hash        TEXT,
      user_agent     TEXT
    );
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS ix_broker_attribution_clicks_broker_partner ON broker_attribution_clicks(broker_partner);'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS ix_broker_attribution_clicks_attribution_id ON broker_attribution_clicks(attribution_id);'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS ix_broker_attribution_clicks_clicked_at ON broker_attribution_clicks(clicked_at);'
  );

  return db;
}

export function getDb(): DatabaseSync {
  if (cachedDb) return cachedDb;
  cachedDb = initDb();
  return cachedDb;
}
