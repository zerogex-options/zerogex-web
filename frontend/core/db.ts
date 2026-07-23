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

  // Referral-ledger attribution metadata, added for the Ambassador Program but
  // populated for every row so the same ledger serves all three partner types.
  //   partner_type          - the referrer's category AT attribution time
  //                           ('referral' | 'ambassador' | 'creator'). Snapshotted
  //                           so a later tier change doesn't rewrite history.
  //   first_touch_at        - when the referral link was first clicked (from the
  //                           zgx_ref_ts cookie); NULL for organic/legacy rows.
  //   attribution_expires_at- first_touch_at + the partner's attribution window;
  //                           the deterministic bound the ambassador path enforces.
  //   subscription_id /     - Stripe identifiers stamped at conversion, so the
  //   customer_id             admin attribution view can be reconciled to Stripe
  //                           without exposing them to end users.
  ensureColumn('referrals', 'partner_type', "TEXT NOT NULL DEFAULT 'referral'");
  ensureColumn('referrals', 'first_touch_at', 'TEXT');
  ensureColumn('referrals', 'attribution_expires_at', 'TEXT');
  ensureColumn('referrals', 'subscription_id', 'TEXT');
  ensureColumn('referrals', 'customer_id', 'TEXT');

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

  // ZeroGEX Ambassador Program. The THIRD partner category, layered onto the
  // exact same plumbing as the creator program above — an ambassador is a user
  // with partner_tier='ambassador' and a referral_code, whose referees accrue
  // into the shared partner_commissions ledger. The columns below carry the
  // ambassador-specific terms that the creator program doesn't need. All are
  // per-user overridable; defaults come from core/ambassadorConfig.ts at invite
  // time. Creators are unaffected: their partner_tier stays 'creator' and these
  // columns stay at their defaults / NULL for them.
  //
  //   partner_status          - invited | active | paused | inactive | rejected.
  //   partner_designation      - optional label, e.g. 'Founding Ambassador'.
  //   partner_reward_preference- 'cash' (20%) or 'account_credit' (25%). Applied
  //                              PROSPECTIVELY: accrual snapshots the rate, so a
  //                              later change never rewrites earned rewards.
  //   partner_credit_bps       - account-credit rate (2500 = 25%); the cash rate
  //                              reuses the existing partner_commission_bps.
  //   partner_attribution_window_days - click->registration attribution window.
  //   partner_holding_period_days     - hold before a commission is payable.
  //   partner_pilot_started_at/_ends_at - pilot window; expiry flips the account
  //                              to 'inactive' for NEW referrals but preserves
  //                              all prior earned rewards.
  //   partner_early_access     - 0/1; gates early-feature access when enabled.
  //   partner_notes            - internal admin notes (never shown to the user).
  //   partner_invited_at / _accepted_at / _deactivated_at - lifecycle stamps.
  //   partner_terms_version    - the terms revision the ambassador accepted.
  if (ensureColumn('users', 'partner_status', 'TEXT')) {
    // Backfill: existing creator partners are already live, so mark them active
    // under the new status vocabulary. Ambassadors are always created with an
    // explicit status by the invite flow, so this only touches legacy creators.
    db.exec(
      `UPDATE users SET partner_status = 'active'
       WHERE partner_tier = 'creator' AND partner_activated_at IS NOT NULL`,
    );
  }
  ensureColumn('users', 'partner_designation', 'TEXT');
  ensureColumn('users', 'partner_reward_preference', "TEXT NOT NULL DEFAULT 'cash'");
  ensureColumn('users', 'partner_credit_bps', 'INTEGER NOT NULL DEFAULT 2500');
  ensureColumn('users', 'partner_attribution_window_days', 'INTEGER NOT NULL DEFAULT 60');
  ensureColumn('users', 'partner_holding_period_days', 'INTEGER NOT NULL DEFAULT 30');
  ensureColumn('users', 'partner_pilot_started_at', 'TEXT');
  ensureColumn('users', 'partner_pilot_ends_at', 'TEXT');
  ensureColumn('users', 'partner_early_access', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'partner_notes', 'TEXT');
  ensureColumn('users', 'partner_invited_at', 'TEXT');
  ensureColumn('users', 'partner_accepted_at', 'TEXT');
  ensureColumn('users', 'partner_deactivated_at', 'TEXT');
  ensureColumn('users', 'partner_terms_version', 'TEXT');

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

  // Ambassador Program extension of the shared partner_commissions ledger. The
  // creator program writes rows with the original columns and status walks
  // 'accrued' -> 'paid'/'reversed'; ambassador rows are tagged
  // partner_type='ambassador' and carry the richer lifecycle below, so the two
  // never collide. Every existing row is a creator row, which is exactly what
  // the partner_type default backfills.
  //   partner_type    - 'creator' | 'ambassador'. Default 'creator' backfills
  //                     every pre-existing row correctly.
  //   reward_type     - 'cash' | 'account_credit', snapshotted at accrual so a
  //                     later reward-preference change never rewrites this row.
  //   commission_bps  - the rate used to compute commission_amount, snapshotted.
  //   excluded_amount - eligible revenue we deliberately did NOT pay on (tax,
  //                     already-refunded slice, etc.); audit/reporting only.
  //   hold_release_at - when the holding period elapses. NULL for creator rows
  //                     (no hold), so their behavior is unchanged.
  //   credited_at     - when an account-credit reward was applied to Stripe.
  //   reversal_reason - free-text reason on a reversal/adjustment row.
  //   updated_at      - last mutation, for the admin ledger + audit.
  ensureColumn('partner_commissions', 'partner_type', "TEXT NOT NULL DEFAULT 'creator'");
  ensureColumn('partner_commissions', 'reward_type', "TEXT NOT NULL DEFAULT 'cash'");
  ensureColumn('partner_commissions', 'commission_bps', 'INTEGER');
  ensureColumn('partner_commissions', 'excluded_amount', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('partner_commissions', 'hold_release_at', 'TEXT');
  ensureColumn('partner_commissions', 'credited_at', 'TEXT');
  ensureColumn('partner_commissions', 'reversal_reason', 'TEXT');
  ensureColumn('partner_commissions', 'updated_at', 'TEXT');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_partner_commissions_referee ON partner_commissions(referee_user_id);',
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_partner_commissions_type_status ON partner_commissions(partner_type, status);',
  );

  // Aggregate referral-link visit counter, keyed by the partner's referral_code.
  // Bumped by the rate-limited public /api/ambassador/visit beacon (validated
  // server-side so it can only ever increment a real ambassador's counter), read
  // by the ambassador dashboard + admin analytics for the visit->registration
  // funnel. Deliberately a single aggregate row per code (not one row per hit) —
  // this is a coarse funnel metric for a pilot, not per-visitor analytics, so it
  // stores no IP/device/user data.
  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_link_visits (
      code TEXT PRIMARY KEY,
      visits INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
  `);

  // One-time stamp marking that the "first paid subscription" welcome email
  // was delivered. After it is set, subsequent paid checkouts (re-subscribes
  // after a cancel) trigger a "welcome back" email instead, and pure upgrades
  // (basic → premium with no intervening cancel) trigger nothing.
  ensureColumn('users', 'paid_welcome_email_sent_at', 'TEXT');

  // One-time in-app "Welcome to Pro" onboarding modal (announces self-service
  // API-key generation). NULL = not yet shown; set to the ISO timestamp the
  // first time the member sees/dismisses it, so it greets a new Pro subscriber
  // exactly once — on their first landing back after the Stripe checkout
  // redirect. Backfilled to "already seen" for everyone who ALREADY holds a
  // subscription the boot this column is born, so the popup only reaches
  // members who subscribe to Pro *after* this ships, never the existing paid
  // base on their next visit. Gated on ensureColumn's "just added" return so
  // the backfill runs exactly once (same pattern as email_verified_at above).
  if (ensureColumn('users', 'pro_welcome_seen_at', 'TEXT')) {
    db.prepare(
      `UPDATE users SET pro_welcome_seen_at = ? WHERE stripe_subscription_id IS NOT NULL`,
    ).run(new Date().toISOString());
  }

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

  // One-shot latch for the SECOND-touch reactivation email sent ~3 weeks after
  // the verified-never-paid nudge above, to the same "signed up, never paid"
  // cohort who ignored that first nudge (see scripts/send-reactivation.mts).
  // This is the inactive-signup analogue of the churned win-back: the first
  // touch pitched the standard 7-day trial and didn't land, so this one changes
  // the offer — an EXTENDED free trial (REACTIVATION_TRIAL_DAYS, granted
  // server-side at app/api/billing/checkout/route.ts for a ?reactivate=1
  // arrival). NULL = eligible; set to the ISO timestamp on send. Never cleared:
  // one extra founder touch is deliberate — a third would be nagging, and this
  // send honors marketing_unsubscribed_at (below) so opt-outs are excluded.
  ensureColumn('users', 'reactivation_email_sent_at', 'TEXT');

  // One-shot latch for the "finish verifying to unlock your free trial" nudge
  // sent ~2h after signup to users who registered but never clicked the
  // verification link (see scripts/send-verify-reminders.mts). NULL =
  // eligible, set to the ISO timestamp on send. Never cleared: a single
  // reminder is deliberate — these addresses never confirmed, so nagging a
  // second time risks bouncing into a cold/typo'd mailbox and hurting the
  // sending domain's reputation. The one-shot verified-never-paid nudge takes
  // over once (if) they verify.
  ensureColumn('users', 'verify_reminder_email_sent_at', 'TEXT');

  // Marketing-email opt-out. NULL = opted in; set to the ISO timestamp when the
  // user unsubscribes via app/unsubscribe/route.ts (the footer link / one-click
  // header on product-update emails). Honored by scripts/send-product-update.mts,
  // which excludes any user with a non-NULL value. Does not affect essential
  // account/billing/transactional email.
  ensureColumn('users', 'marketing_unsubscribed_at', 'TEXT');

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

  // Idempotency latch for the ~1-month-after-churn win-back email sent by
  // scripts/send-winback.mts (the "here's what you've missed, come back at a
  // discount" pitch to the churned cohort). NULL = eligible; set to the ISO
  // timestamp on send. Distinct from cancel_ack above: that fires the instant
  // a customer clicks Cancel (still has access); this fires ~30 days after the
  // subscription actually lapsed. Cleared back to NULL on the welcome-back
  // transition (subscription_lapsed 1 → 0) in the Stripe webhook so a customer
  // who returns and later churns a second time can receive a fresh win-back.
  ensureColumn('users', 'winback_email_sent_at', 'TEXT');

  // Re-armable latch for the payment-recovered confirmation email — the bookend
  // to the payment-failed nudge. 0 = nothing pending; the Stripe webhook sets it
  // to 1 when a subscription enters `past_due` (a real renewal failure that drops
  // the member to 'public'), and CAS-consumes it back to 0 (firing the email) on
  // the next sync that lands back on `active`. Because the flag is the memory of
  // "a failure happened," the email fires only on an actual recovery, never on an
  // ordinary active→active renewal, and it re-arms for a future failure. Also
  // cleared on customer.subscription.deleted so an exhausted-then-resubscribed
  // account gets welcome-back, not a spurious recovery note.
  ensureColumn('users', 'payment_recovery_pending', 'INTEGER NOT NULL DEFAULT 0');

  // Soft-delete marker for self-service account deletion (see
  // app/api/account/delete/route.ts + the /account danger zone). NULL = active;
  // set to the ISO timestamp when the member deletes their account. We keep the
  // row (not a hard DELETE) so churn/records stay intact, but a non-NULL value
  // makes the account invisible to every auth path — getUserByEmail and the
  // session JOIN in core/serverAuth.ts filter it out, so the member can no
  // longer log in (local or OAuth) and all live sessions are severed. Also
  // excluded from the win-back cohort and any other outbound email.
  ensureColumn('users', 'deleted_at', 'TEXT');

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

  // First-party per-page engagement analytics. One row per page *visit*,
  // written by the client beacon (components/PageAnalytics.tsx) via
  // /api/analytics/page-view and aggregated for the admin dashboard by
  // core/pageAnalytics.ts. This is deliberately raw (one row per visit) rather
  // than pre-bucketed so the admin view can compute exact COUNT(DISTINCT
  // user_id) "unique logged-in users" over any window; core/pageAnalytics.ts
  // prunes rows past the retention horizon to bound growth.
  //
  //   visit_id    client-generated per visit. UNIQUE so the two-phase beacon
  //               (enter INSERT, exit UPDATE) correlates, and so a retried/
  //               duplicated beacon is idempotent.
  //   path        the normalized Next.js route TEMPLATE (e.g.
  //               /scorecard/[symbol]/[date]), not the concrete URL — see
  //               core/pageAnalyticsPaths.ts.
  //   user_id     the logged-in user, or NULL for an anonymous visit. Plain
  //               TEXT with no FK (mirrors audit_events) so an analytics row
  //               never blocks on referential integrity and survives as
  //               history; "unique users logged in" counts non-NULL ids.
  //   tier        the user's tier at visit time, denormalized for cheap
  //               segment breakdowns without a users join.
  //   duration_ms visible/active time on the page, filled in by the exit
  //               beacon (0 until then).
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_view_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      user_id TEXT,
      tier TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_page_view_events_path_created ON page_view_events(path, created_at);'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_page_view_events_created ON page_view_events(created_at);'
  );

  // Optional, user-supplied X (formerly Twitter) handle, surfaced as a
  // contact/social field in Account settings. Deliberately NOT collected at
  // signup — a user opts in later from the Social Media section. Stored
  // normalized WITHOUT the leading '@' (see setUserXHandle in core/serverAuth),
  // NULL when unset. Unverified — treat as a display/contact hint, never as an
  // identity or auth signal.
  ensureColumn('users', 'x_handle', 'TEXT');

  return db;
}

export function getDb(): DatabaseSync {
  if (cachedDb) return cachedDb;
  cachedDb = initDb();
  return cachedDb;
}
