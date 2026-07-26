#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/attribute-referral.mts \
//     --referee <email> --referrer <code-or-email> [--dry-run | --yes] [--reward]
//
// Manually tie a referee to a referrer AFTER an organic signup — the operator
// escape hatch for "they signed up without clicking the ?ref= link (or typing
// the code at checkout), but they really were referred."
//
// This MIRRORS the core referral logic (core/referrals.ts backAttributeReferral
// + rewardReferrerForConvertedReferee) statement-for-statement rather than
// importing it: core/referrals.ts imports its dependencies through the Next.js
// "@/core/..." path alias, which the standalone `node --experimental-strip-types`
// runner can't resolve. Every other operator script in this directory follows
// the same convention — talk to SQLite (via core/db.ts, which is alias-free and
// runs the lazy migration) and to Stripe (via the `stripe` SDK) directly. The
// SQL below is a faithful copy of the core functions so idempotency, the
// creator-partner carve-out, and the credit-vs-bank fallback behave identically
// to the automatic webhook path. The ONE intentional difference: the webhook
// sends the referrer a "you earned a free month" email; this manual tool does
// not (it's best-effort even in prod) — tell the referrer yourself if needed.
//
// TIMING MATTERS — read before using:
//   The referrer's free-month reward is granted on the referee's subscription
//   going ACTIVE (a real paid conversion, never a trial start), and only if the
//   referee's `referred_by_code` is already set at that moment. So:
//     * Attribute a referee who is still trialing / hasn't subscribed → the
//       reward fires automatically when (if) they convert. Nothing else to do.
//     * Attribute a referee who is ALREADY on a paid (active) subscription →
//       that webhook already ran while they were unattributed and will NOT
//       re-fire. The ledger row is created `pending` and would sit there
//       forever. Pass --reward to also grant the referrer's month now (credit
//       if they have an active sub, else bank it), exactly as the webhook would.
//
// Safe by construction: refuses self-referral, refuses a referee who is already
// attributed (won't re-point A→B), and is idempotent (UNIQUE referee_user_id +
// the `referred_by_code IS NULL` guard). Nothing is written unless you pass
// --yes (or confirm at the prompt); --dry-run only previews.
//
// core/db.ts reads AUTH_DB_PATH, and the referral logic reads
// REFERRAL_PROGRAM_ENABLED / CREATOR_PARTNER_PROGRAM_ENABLED / STRIPE_SECRET_KEY,
// from process.env only — it does NOT load .env.local the way Next.js does at
// boot. So we hoist .env.local into process.env BEFORE the dynamic import of
// core/db.ts (a static import would be hoisted above the env mutation by the ESM
// loader and read process.env too early).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

type Args = {
  referee: string | null;
  referrer: string | null;
  dryRun: boolean;
  yes: boolean;
  reward: boolean;
  help: boolean;
};

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    referee: null,
    referrer: null,
    dryRun: false,
    yes: false,
    reward: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--referee') args.referee = argv[++i] ?? null;
    else if (arg === '--referrer') args.referrer = argv[++i] ?? null;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--reward') args.reward = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/attribute-referral.mts \\
    --referee <email> --referrer <code-or-email> [--dry-run | --yes] [--reward]

Manually attribute an organic signup to a referrer (back-attribution).

Options:
      --referee <email>      The friend who signed up (matched case-insensitively).
      --referrer <ref>       The referrer, given as their 8-char referral code OR
                             their email. A creator partner's audience promo code
                             also resolves (when that program is enabled).
      --dry-run              Print what would happen; no writes. (With neither
                             --dry-run nor --yes, the tool confirms interactively
                             before writing.)
  -y, --yes                  Apply without the confirmation prompt.
      --reward               ALSO grant the referrer's free month now, but only
                             if the referee is already on a paid (active)
                             subscription (the webhook won't re-fire for them).
                             No-op for a referee who hasn't converted yet — their
                             reward fires automatically on conversion.
  -h, --help                 Show this help.

Reads REFERRAL_PROGRAM_ENABLED, CREATOR_PARTNER_PROGRAM_ENABLED, and (for
--reward) STRIPE_SECRET_KEY from env or .env.local. Set AUTH_DB_PATH to override
the default DB path.`);
}

function confirm(prompt: string): Promise<boolean> {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (!cliArgs.referee) {
  console.error('Error: --referee <email> is required.');
  usage();
  process.exit(1);
}
if (!cliArgs.referrer) {
  console.error('Error: --referrer <code-or-email> is required.');
  usage();
  process.exit(1);
}

// Hoist .env.local into process.env (missing keys only) so the DB layer and the
// referral logic resolve the same DB file / program flags / Stripe key the live
// app uses.
const envLocalPath = path.join(process.cwd(), '.env.local');
const envLocal = parseEnvFile(envLocalPath);
for (const [key, value] of Object.entries(envLocal)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}
console.log(`Auth DB: ${dbPath}`);

// Dynamic import AFTER the env hoist (see file header). Importing core/db.ts
// runs the lazy migration on first getDb(), so every column read below exists.
const { getDb } = await import('../core/db.ts');
const db = getDb();

// Same gate as core/referrals.ts isReferralProgramEnabled(). The core writes
// hard-gate on this and would otherwise no-op silently — refuse loudly instead.
if (process.env.REFERRAL_PROGRAM_ENABLED !== '1') {
  console.error(
    'Error: REFERRAL_PROGRAM_ENABLED is not "1" — the referral program is off, so ' +
      'attribution would be a no-op. Enable it (env or .env.local) and retry.',
  );
  process.exit(1);
}
const creatorProgramEnabled = process.env.CREATOR_PARTNER_PROGRAM_ENABLED === '1';

type UserRow = {
  id: string;
  email: string;
  referred_by_code: string | null;
  referral_code: string | null;
  partner_tier: string | null;
  referral_credit_months: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_lapsed: number | null;
  tier: string | null;
};

const USER_COLS = `id, email, referred_by_code, referral_code, partner_tier,
   referral_credit_months, stripe_customer_id, stripe_subscription_id,
   subscription_status, subscription_lapsed, tier`;

function nowIso(): string {
  return new Date().toISOString();
}

function auditLog(type: string, userId: string, email: string, message: string): void {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `audit_${crypto.randomBytes(12).toString('hex')}`,
    type,
    userId,
    null,
    email,
    'attribute-referral-script',
    message,
    nowIso(),
  );
}

// ---- Referral-code minting (mirrors core/referrals.ts mintCode /
// getOrCreateReferralCode). Drops visually ambiguous glyphs; the UNIQUE index on
// users.referral_code + this retry loop make a collision a non-event. ----------
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function mintCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function ensureReferralCode(userId: string, existing: string | null): string {
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintCode();
    try {
      db.prepare('UPDATE users SET referral_code = ?, updated_at = ? WHERE id = ?').run(
        code,
        nowIso(),
        userId,
      );
      return code;
    } catch {
      const fresh = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId) as
        | { referral_code: string | null }
        | undefined;
      if (fresh?.referral_code) return fresh.referral_code;
    }
  }
  throw new Error('Could not generate a unique referral code');
}

// ---- Attribution (mirrors core/referrals.ts backAttributeReferral) -----------
function backAttribute(refereeId: string, referrerId: string, canonicalCode: string): boolean {
  const claimed = db
    .prepare(
      `UPDATE users SET referred_by_code = ?, updated_at = ?
       WHERE id = ? AND referred_by_code IS NULL`,
    )
    .run(canonicalCode, nowIso(), refereeId) as { changes: number | bigint };
  if (Number(claimed.changes) === 0) return false;
  db.prepare(
    `INSERT OR IGNORE INTO referrals (id, referrer_user_id, referee_user_id, code, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(`ref_${crypto.randomBytes(12).toString('hex')}`, referrerId, refereeId, canonicalCode, nowIso());
  return true;
}

// ---- Reward (mirrors core/referrals.ts rewardReferrerForConvertedReferee, sans
// the best-effort reward email) ------------------------------------------------
type RewardOutcome =
  | { kind: 'none' }
  | { kind: 'credited'; amount: number; currency: string }
  | { kind: 'banked' }
  | { kind: 'error'; message: string };

// Minimal shape of the Stripe client — just the two calls the reward path
// makes. Lets us lazily `import('stripe')` only when a reward is actually fired,
// so the common attribution path needs no SDK loaded at all.
type StripeLike = {
  subscriptions: { retrieve(id: string): Promise<unknown> };
  customers: {
    createBalanceTransaction(
      customerId: string,
      params: { amount: number; currency: string; description: string },
    ): Promise<unknown>;
  };
};

type SubscriptionLike = {
  status: string;
  items?: {
    data?: Array<{
      price?: {
        unit_amount?: number | null;
        currency?: string | null;
        recurring?: { interval?: string | null; interval_count?: number | null } | null;
      } | null;
    }>;
  };
};

function monthlyValueFromSubscription(
  subscription: SubscriptionLike,
): { amount: number; currency: string } | null {
  const price = subscription.items?.data?.[0]?.price;
  const unit = price?.unit_amount;
  if (typeof unit !== 'number' || !price?.currency) return null;
  const interval = price.recurring?.interval;
  const count = price.recurring?.interval_count ?? 1;
  if (interval === 'year') {
    return { amount: Math.round(unit / (12 * count)), currency: price.currency };
  }
  return { amount: Math.round(unit / count), currency: price.currency };
}

function bankMonth(userId: string): void {
  db.prepare(
    'UPDATE users SET referral_credit_months = referral_credit_months + 1, updated_at = ? WHERE id = ?',
  ).run(nowIso(), userId);
}

async function fireReward(stripe: StripeLike | null, refereeId: string): Promise<RewardOutcome> {
  const referral = db
    .prepare(`SELECT id, referrer_user_id FROM referrals WHERE referee_user_id = ? AND status = 'pending'`)
    .get(refereeId) as { id: string; referrer_user_id: string } | undefined;
  if (!referral) return { kind: 'none' };

  // Creator partners are on the commission model — skip the free month and leave
  // the row pending for Phase 3 accrual (matches core, which returns before
  // claiming so Phase 3 can still transition the row).
  const partner = db
    .prepare('SELECT partner_tier FROM users WHERE id = ?')
    .get(referral.referrer_user_id) as { partner_tier: string | null } | undefined;
  if (partner?.partner_tier === 'creator') return { kind: 'none' };

  const claimed = db
    .prepare(
      `UPDATE referrals SET status = 'rewarded', converted_at = ?, rewarded_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(nowIso(), nowIso(), referral.id) as { changes: number | bigint };
  if (Number(claimed.changes) === 0) return { kind: 'none' };

  const referrer = db
    .prepare(
      `SELECT id, referral_credit_months, stripe_customer_id, stripe_subscription_id
       FROM users WHERE id = ?`,
    )
    .get(referral.referrer_user_id) as
    | {
        id: string;
        referral_credit_months: number | null;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
      }
    | undefined;
  if (!referrer) return { kind: 'none' };

  if (stripe && referrer.stripe_customer_id && referrer.stripe_subscription_id) {
    try {
      const sub = (await stripe.subscriptions.retrieve(
        referrer.stripe_subscription_id,
      )) as unknown as SubscriptionLike;
      if (sub.status === 'active' || sub.status === 'trialing') {
        const monthly = monthlyValueFromSubscription(sub);
        if (monthly && monthly.amount > 0) {
          await stripe.customers.createBalanceTransaction(referrer.stripe_customer_id, {
            amount: -monthly.amount,
            currency: monthly.currency,
            description: `Referral reward: 1 free month (referee ${refereeId})`,
          });
          return { kind: 'credited', amount: monthly.amount, currency: monthly.currency };
        }
      }
    } catch (err) {
      bankMonth(referrer.id);
      return { kind: 'error', message: err instanceof Error ? err.message : 'credit failed' };
    }
  }

  bankMonth(referrer.id);
  return { kind: 'banked' };
}

// ---- Resolve the referee (always by email) ------------------------------
const refereeEmail = cliArgs.referee.trim().toLowerCase();
const referee = db
  .prepare(`SELECT ${USER_COLS} FROM users WHERE lower(email) = ?`)
  .get(refereeEmail) as UserRow | undefined;
if (!referee) {
  console.error(`No user found with email: ${refereeEmail}`);
  process.exit(2);
}

// ---- Resolve the referrer (by email if it looks like one, else by code) --
const refInput = cliArgs.referrer.trim();
let referrer: UserRow | undefined;
if (refInput.includes('@')) {
  referrer = db
    .prepare(`SELECT ${USER_COLS} FROM users WHERE lower(email) = ?`)
    .get(refInput.toLowerCase()) as UserRow | undefined;
} else {
  const code = refInput.toUpperCase();
  referrer = db.prepare(`SELECT ${USER_COLS} FROM users WHERE referral_code = ?`).get(code) as
    | UserRow
    | undefined;
  if (!referrer && creatorProgramEnabled) {
    referrer = db
      .prepare(
        `SELECT ${USER_COLS} FROM users WHERE partner_audience_promo_code = ? AND partner_tier = 'creator'`,
      )
      .get(code) as UserRow | undefined;
  }
}
if (!referrer) {
  console.error(`No referrer found matching: ${refInput}`);
  console.error('Give the referrer as their 8-char referral code or their email.');
  process.exit(2);
}

// ---- Guards -------------------------------------------------------------
if (referrer.id === referee.id) {
  console.error('Error: a user cannot refer themselves (referee and referrer resolve to the same account).');
  process.exit(1);
}
if (referee.referred_by_code) {
  const existing = db
    .prepare('SELECT email FROM users WHERE referral_code = ?')
    .get(referee.referred_by_code) as { email: string } | undefined;
  console.error(
    `Error: ${referee.email} is already attributed to code ${referee.referred_by_code}` +
      (existing ? ` (${existing.email})` : '') +
      '. Attribution is one-shot and this tool will not re-point an existing referral.',
  );
  process.exit(1);
}

// ---- Referee billing state (decides the reward path) --------------------
// The reward only fires on a real paid conversion (subscription_status
// 'active'), never on 'trialing'. Mirror that so the operator sees exactly
// whether --reward is needed / meaningful.
const refereeConverted = referee.subscription_status === 'active';
let billingState: string;
if (refereeConverted) billingState = 'active (paid) — reward will NOT auto-fire';
else if (referee.subscription_status === 'trialing') billingState = 'trialing (not yet paid)';
else if (referee.subscription_lapsed) billingState = 'cancelled / lapsed';
else if (referee.stripe_subscription_id) billingState = `subscription ${referee.subscription_status ?? 'unknown'}`;
else billingState = 'no subscription yet';

// ---- Preview ------------------------------------------------------------
console.log('');
console.log(`Referee:  ${referee.email}  [${billingState}]`);
console.log(`Referrer: ${referrer.email}  (code ${referrer.referral_code ?? '— will be minted on apply —'})`);
if (referrer.partner_tier === 'creator') {
  console.log('          note: referrer is a CREATOR PARTNER — compensated via cash commission,');
  console.log('          not a free month; the ledger row stays pending for Phase 3 accrual.');
}
console.log('');
console.log('Will:');
console.log('  • stamp users.referred_by_code on the referee');
console.log("  • insert a 'pending' referrals ledger row (referrer → referee)");

const willFireReward = refereeConverted && cliArgs.reward;
if (willFireReward) {
  console.log('  • fire the referrer reward now: credit one month to their Stripe balance');
  console.log('    if they have an active sub, else bank a free month (no email is sent)');
} else if (refereeConverted && !cliArgs.reward) {
  console.log('');
  console.log('  ⚠️  Referee is ALREADY on a paid subscription. The subscription-active');
  console.log("     webhook already ran while they were unattributed, so the referrer's");
  console.log('     free month will NOT fire on its own. Re-run with --reward (REWARD=1)');
  console.log('     to grant it now.');
} else if (cliArgs.reward && !refereeConverted) {
  console.log('');
  console.log('  ℹ️  --reward given but the referee has not converted to a paid (active)');
  console.log('     subscription, so there is nothing to reward yet. Attribution will');
  console.log('     proceed; the reward fires automatically if/when they convert.');
} else {
  console.log('  • (no reward now — it fires automatically if/when the referee converts to paid)');
}
console.log('');

if (cliArgs.dryRun) {
  console.log('[dry-run] No changes written.');
  process.exit(0);
}

if (!cliArgs.yes) {
  const ok = await confirm(`Attribute ${referee.email} → ${referrer.email}? Type "y" to confirm: `);
  if (!ok) {
    console.log('Aborted.');
    process.exit(0);
  }
}

// ---- Apply --------------------------------------------------------------
const canonicalCode = ensureReferralCode(referrer.id, referrer.referral_code);
const attributed = backAttribute(referee.id, referrer.id, canonicalCode);
if (!attributed) {
  // The guards above rule out the normal reasons (self / already attributed),
  // so this is an unexpected race — surface it rather than claim success.
  console.error(
    'Error: attribution did not apply (the referee may have been attributed by ' +
      'a concurrent process between the preview and now). No changes made.',
  );
  process.exit(1);
}
auditLog(
  'referral_manual_attribution',
  referee.id,
  referee.email,
  `Manually back-attributed to referrer ${referrer.email} (code ${canonicalCode})`,
);
console.log(`✓ Attributed ${referee.email} → ${referrer.email} (code ${canonicalCode}).`);

// ---- Optional reward ----------------------------------------------------
if (refereeConverted && cliArgs.reward) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.log(
      '⚠️  STRIPE_SECRET_KEY not set — cannot issue an immediate balance credit; ' +
        'the referrer will be banked a free month instead (redeemed on their next subscribe).',
    );
  }
  // Lazily load the Stripe SDK only now that we actually need it (and only if a
  // key is configured) — the attribution path above never touches it.
  let stripe: StripeLike | null = null;
  if (stripeKey) {
    const { default: Stripe } = await import('stripe');
    stripe = new Stripe(stripeKey) as unknown as StripeLike;
  }
  const outcome = await fireReward(stripe, referee.id);
  switch (outcome.kind) {
    case 'credited':
      console.log(
        `✓ Referrer reward: credited ${formatAmount(outcome.amount, outcome.currency)} to their Stripe balance.`,
      );
      auditLog(
        'referral_manual_reward_credited',
        referrer.id,
        referrer.email,
        `Manual referral reward for referee ${referee.email}: credited ${outcome.amount} ${outcome.currency}`,
      );
      break;
    case 'banked':
      console.log('✓ Referrer reward: banked 1 free month (redeemed on their next subscribe).');
      auditLog(
        'referral_manual_reward_banked',
        referrer.id,
        referrer.email,
        `Manual referral reward for referee ${referee.email}: banked 1 free month`,
      );
      break;
    case 'none':
      console.log(
        'ℹ️  Referrer reward not applied — referrer is a creator partner (commission model) ' +
          'or the ledger row was already claimed. Ledger left as-is.',
      );
      auditLog(
        'referral_manual_reward_none',
        referrer.id,
        referrer.email,
        `Manual referral reward for referee ${referee.email}: no free-month reward (creator/none)`,
      );
      break;
    case 'error':
      console.log(
        `⚠️  Referrer reward: crediting failed (${outcome.message}); banked 1 month as a fallback.`,
      );
      auditLog(
        'referral_manual_reward_error',
        referrer.id,
        referrer.email,
        `Manual referral reward for referee ${referee.email}: credit failed (${outcome.message}); banked instead`,
      );
      break;
  }
}

console.log('Done.');
