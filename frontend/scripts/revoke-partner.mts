#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/revoke-partner.mts \
//     --email <email> [--keep-stripe-promo] (--dry-run | --yes)
//
// Inverse of grant-partner-pro.mts: cleanly winds down a Creator Partner.
//
// What gets cleared (DB):
//   - partner_tier              -> NULL    (no new audience-coupon attribution
//                                           at checkout; Phase 3 commission
//                                           accrual gates on this column)
//   - partner_audience_promo_code -> NULL  (the typeable string is freed; a
//                                           future grant can reuse it)
//   - partner_audience_coupon_id  -> NULL  (back to the global env coupon)
//   - partner_pro_grant_expires_at -> NULL (no more grant; the daily expiry
//                                           timer skips them on next sweep)
//   - partner_activated_at        -> NULL  (audit reset)
//   - partner_disclosure_url      -> NULL  (audit reset)
//   - partner_commission_bps      -> 3000  (column is NOT NULL; reset to default)
//   - partner_commission_window_months -> 12  (same)
//   - tier 'pro' -> 'public'  ONLY if no active Stripe sub. Mirrors
//                             expire-partner-grants.mjs: we don't fight the
//                             webhook for paying users.
//
// What is KEPT on purpose:
//   - referral_code              The referrals ledger references it as a join
//                                key; clearing would orphan historical rows.
//   - partner_commissions ledger Accrued financial records; do not delete
//                                even if the rate is reset. Operator can
//                                refund/mark-paid manually as needed.
//
// What happens on Stripe:
//   - The partner's audience promotion_code (the one created by grant-
//     partner-pro.mts) is deactivated (`active: false`) so the typeable
//     code stops working in Stripe's checkout for new buyers. Stripe doesn't
//     support deleting promotion codes, but deactivation removes them from
//     the typeable set and lets the same `code` string be re-issued later
//     under a fresh promotion_code. Pass --keep-stripe-promo to skip this
//     step (e.g. you'll handle Stripe manually).
//
// Audit:
//   - One `partner_revoked` row in audit_events for traceability.
//
// Read-only by default; --yes required to write.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const DEFAULT_COMMISSION_BPS = 3000;
const DEFAULT_WINDOW_MONTHS = 12;

type Args = {
  email: string | null;
  keepStripePromo: boolean;
  dryRun: boolean;
  yes: boolean;
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
    email: null,
    keepStripePromo: false,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--keep-stripe-promo') args.keepStripePromo = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/revoke-partner.mts \\
    --email <email> [--keep-stripe-promo] (--dry-run | --yes)

Winds down a Creator Partner: clears the partner_* state on the user row,
deactivates the Stripe promotion_code, downgrades tier 'pro' -> 'public'
if and only if the user has no active paying subscription, and keeps the
referral_code + commission ledger so any already-accrued payouts survive.

Options:
  -e, --email <email>          Target partner's account email. Required.
      --keep-stripe-promo      Skip the Stripe promotion_code deactivation
                               (leaves the typeable code working at Stripe
                               checkout). Default behavior deactivates it.
      --dry-run                Preview changes without writing.
  -y, --yes                    Apply the changes.
  -h, --help                   Show this help.

Idempotent: re-running on an already-revoked user exits cleanly with
"nothing to do" rather than scrambling state.

Requires sqlite3 CLI and STRIPE_SECRET_KEY in env or frontend/.env.local.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

function execSqlite(dbPath: string, sql: string): void {
  runSqlite(dbPath, sql);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.email) {
  console.error('Error: --email is required.');
  usage();
  process.exit(1);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (!cliArgs.dryRun && !cliArgs.yes) {
  console.error('Error: pass --dry-run or --yes.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

// Pre-flight column check (matches the other partner scripts).
const userCols = new Set(
  querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
const requiredCols = [
  'partner_tier',
  'partner_audience_promo_code',
  'partner_audience_coupon_id',
  'partner_pro_grant_expires_at',
];
const missingCols = requiredCols.filter((c) => !userCols.has(c));
if (missingCols.length > 0) {
  console.error(`Error: required users columns are missing: ${missingCols.join(', ')}`);
  console.error('The auth DB schema migration has not run against this database file.');
  console.error('Fix: cd ~/zerogex-web && make migrate');
  process.exit(4);
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY && !cliArgs.keepStripePromo) {
  console.error('Error: STRIPE_SECRET_KEY is not set.');
  console.error('Either pass --keep-stripe-promo to skip Stripe-side cleanup, or configure');
  console.error('STRIPE_SECRET_KEY (env or frontend/.env.local) so we can deactivate the');
  console.error("partner's audience promotion_code in Stripe.");
  process.exit(1);
}

const email = cliArgs.email.trim().toLowerCase();
type UserRow = {
  id: string;
  email: string;
  tier: string;
  partner_tier: string | null;
  partner_pro_grant_expires_at: string | null;
  partner_activated_at: string | null;
  partner_audience_promo_code: string | null;
  partner_audience_coupon_id: string | null;
  partner_disclosure_url: string | null;
  partner_commission_bps: number;
  partner_commission_window_months: number;
  referral_code: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
};
const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, partner_tier, partner_pro_grant_expires_at,
          partner_activated_at, partner_audience_promo_code, partner_audience_coupon_id,
          partner_disclosure_url, partner_commission_bps, partner_commission_window_months,
          referral_code, stripe_subscription_id, subscription_status
   FROM users WHERE email = '${escapeSqlLiteral(email)}';`,
);
if (rows.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(2);
}
const user = rows[0];

// Idempotency: a clean exit is the right answer when there's nothing to
// undo. Distinguishes a true no-op from an error so the operator can
// confidently re-run the script after a partial failure.
const hasAnyPartnerState =
  user.partner_tier === 'creator' ||
  user.partner_audience_promo_code != null ||
  user.partner_audience_coupon_id != null ||
  user.partner_pro_grant_expires_at != null ||
  user.partner_activated_at != null ||
  user.partner_disclosure_url != null;
if (!hasAnyPartnerState) {
  console.log(`User ${user.email} has no partner state to clear. Nothing to do.`);
  process.exit(0);
}

// Resolve the audience coupon ID to scope the Stripe promo lookup. The
// user's per-creator override wins if set; otherwise we look on the
// global env coupon. If neither is available we skip the Stripe step
// (and log it) — the DB-side cleanup still proceeds.
const audienceCouponId =
  user.partner_audience_coupon_id || envOrLocal('STRIPE_COUPON_PARTNER_AUDIENCE') || null;

const isActivelyPaying =
  user.stripe_subscription_id != null &&
  (user.subscription_status === 'active' || user.subscription_status === 'trialing');
const tierWillDowngrade = user.tier === 'pro' && !isActivelyPaying;

console.log(`Auth DB:        ${dbPath}`);
console.log(`User:           ${user.email} (id=${user.id})`);
console.log(`Current tier:   ${user.tier}`);
console.log(`Current state:  partner_tier=${user.partner_tier ?? 'NULL'}`);
console.log(`                promo_code=${user.partner_audience_promo_code ?? 'NULL'}`);
console.log(`                custom_coupon=${user.partner_audience_coupon_id ?? 'NULL (uses global)'}`);
console.log(`                grant_expires=${user.partner_pro_grant_expires_at ?? 'NULL'}`);
console.log(`                activated_at=${user.partner_activated_at ?? 'NULL'}`);
console.log(`                commission_bps=${user.partner_commission_bps}`);
console.log(`                commission_window_months=${user.partner_commission_window_months}`);
console.log(`                referral_code=${user.referral_code ?? 'NULL'} (will be KEPT)`);
if (user.stripe_subscription_id) {
  console.log(
    `                stripe_sub=${user.stripe_subscription_id} status=${user.subscription_status}`,
  );
}

const planned: string[] = [];
if (user.partner_tier === 'creator') planned.push(`partner_tier 'creator' -> NULL`);
if (user.partner_audience_promo_code) {
  planned.push(`partner_audience_promo_code '${user.partner_audience_promo_code}' -> NULL`);
}
if (user.partner_audience_coupon_id) {
  planned.push(`partner_audience_coupon_id '${user.partner_audience_coupon_id}' -> NULL`);
}
if (user.partner_pro_grant_expires_at) {
  planned.push(`partner_pro_grant_expires_at -> NULL`);
}
if (user.partner_activated_at) planned.push(`partner_activated_at -> NULL`);
if (user.partner_disclosure_url) planned.push(`partner_disclosure_url -> NULL`);
if (user.partner_commission_bps !== DEFAULT_COMMISSION_BPS) {
  planned.push(`partner_commission_bps ${user.partner_commission_bps} -> ${DEFAULT_COMMISSION_BPS}`);
}
if (user.partner_commission_window_months !== DEFAULT_WINDOW_MONTHS) {
  planned.push(
    `partner_commission_window_months ${user.partner_commission_window_months} -> ${DEFAULT_WINDOW_MONTHS}`,
  );
}
if (tierWillDowngrade) {
  planned.push(`tier 'pro' -> 'public'   (no active Stripe sub)`);
} else if (user.tier === 'pro' && isActivelyPaying) {
  planned.push(`tier kept at 'pro' (active Stripe sub — webhook owns this)`);
}
planned.push(`KEEP referral_code (referrals ledger references it as join key)`);
planned.push(`KEEP partner_commissions ledger rows (accrued financial records)`);
if (!cliArgs.keepStripePromo && user.partner_audience_promo_code && audienceCouponId) {
  planned.push(
    `Stripe promotion_code '${user.partner_audience_promo_code}' on coupon ${audienceCouponId} -> deactivate`,
  );
} else if (cliArgs.keepStripePromo) {
  planned.push(`Stripe promotion_code SKIPPED (--keep-stripe-promo)`);
} else if (!audienceCouponId) {
  planned.push(`Stripe promotion_code SKIPPED (no audience coupon configured)`);
}

console.log('\nPlanned changes:');
for (const p of planned) console.log(`  - ${p}`);

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}

const nowIso = new Date().toISOString();

// DB updates: do them BEFORE the Stripe call so a Stripe failure leaves us
// in a recoverable state (re-running the script sees the cleared DB and
// only retries the Stripe side, mirroring the grant-partner-pro ordering).
const setClauses = [
  `partner_tier = NULL`,
  `partner_audience_promo_code = NULL`,
  `partner_audience_coupon_id = NULL`,
  `partner_pro_grant_expires_at = NULL`,
  `partner_activated_at = NULL`,
  `partner_disclosure_url = NULL`,
  `partner_commission_bps = ${DEFAULT_COMMISSION_BPS}`,
  `partner_commission_window_months = ${DEFAULT_WINDOW_MONTHS}`,
  `updated_at = '${escapeSqlLiteral(nowIso)}'`,
];
if (tierWillDowngrade) setClauses.push(`tier = 'public'`);

execSqlite(
  dbPath,
  `UPDATE users SET ${setClauses.join(', ')} WHERE id = '${escapeSqlLiteral(user.id)}';`,
);

// Stripe-side deactivation. Defensive lookup: filter the active promo
// codes by (coupon, code) AND match metadata.partner_user_id, so we never
// deactivate someone else's code that happens to share a string.
let stripeResult = 'skipped';
if (!cliArgs.keepStripePromo && user.partner_audience_promo_code && audienceCouponId) {
  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY!);
    const list = await stripe.promotionCodes.list({
      coupon: audienceCouponId,
      code: user.partner_audience_promo_code,
      active: true,
      limit: 10,
    });
    const match = list.data.find((p) => p.metadata?.partner_user_id === user.id);
    if (match) {
      await stripe.promotionCodes.update(match.id, { active: false });
      stripeResult = `deactivated ${match.id}`;
    } else if (list.data.length > 0) {
      // Code string exists but metadata doesn't match — safer to leave it.
      stripeResult = `skipped: found ${list.data.length} matching code(s) but none owned by user.id ${user.id}`;
    } else {
      stripeResult = `skipped: no active Stripe promotion_code found`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown Stripe error';
    console.warn(`\nWARNING: Stripe deactivation failed: ${message}`);
    console.warn('  DB changes were applied. Manually deactivate in Stripe Dashboard:');
    console.warn(
      `  Coupons -> ${audienceCouponId} -> Promotion codes -> ${user.partner_audience_promo_code} -> deactivate`,
    );
    stripeResult = `error: ${message}`;
  }
} else if (cliArgs.keepStripePromo) {
  stripeResult = 'skipped (--keep-stripe-promo)';
} else if (!audienceCouponId) {
  stripeResult = 'skipped (no audience coupon configured)';
}

const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
execSqlite(
  dbPath,
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (
     '${escapeSqlLiteral(auditId)}',
     'partner_revoked',
     '${escapeSqlLiteral(user.id)}',
     NULL,
     '${escapeSqlLiteral(user.email)}',
     'revoke-partner-script',
     '${escapeSqlLiteral(`partner cleared; stripe_promo=${stripeResult}; tier=${tierWillDowngrade ? 'pro->public' : user.tier}`)}',
     '${escapeSqlLiteral(nowIso)}'
   );`,
);

console.log('\nRevoked.');
console.log(`  Stripe promo:       ${stripeResult}`);
if (tierWillDowngrade) {
  console.log(`  Tier:               pro -> public`);
}
console.log(
  `  Kept (historical):  referral_code, partner_commissions ledger rows (accrued payouts)`,
);
console.log('');
console.log(
  'Phase 3 commission accrual gates on partner_tier=\'creator\', so no new commissions',
);
console.log(
  'will accrue for this user. Accrued-but-unpaid ledger rows remain payable per the original',
);
console.log('deal — review and mark paid (or reversed) through the Phase 4 payout flow.');
