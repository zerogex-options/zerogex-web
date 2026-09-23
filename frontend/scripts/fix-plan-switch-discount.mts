#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/fix-plan-switch-discount.mts \
//     --email <addr> [--coupon <coupon_id> | --strip-only] [--dry-run | --yes]
//
// Corrects a subscription that carried the WRONG cadence-specific coupon across
// a billing-portal plan switch. When a member switches cadence (monthly,
// quarterly, annual) or tier, Stripe keeps the old coupon on the subscription.
// Our promo/founding/referral coupons are cadence-specific, so e.g. the monthly
// promo ($10 off for 12 months) would keep discounting a QUARTERLY invoice.
// This script reconciles the subscription's discounts to what they SHOULD be
// for the plan the member is now on.
//
// It is the manual twin of the webhook's maybeReconcileDiscountOnPlanSwitch
// (app/api/webhooks/stripe/route.ts): use it to repair accounts that switched
// before that reconciliation shipped, or any account flagged by support.
//
// WHAT IT DOES
//   1. Reads the user + their live Stripe subscription (discounts expanded).
//   2. Resolves the CORRECT coupons for the plan the sub is now on with the
//      SAME code the webhook and the in-app trial upgrade use
//      (core/switchDiscounts.ts planSwitchDiscounts), so the three can't drift:
//        • Founding member (and lifetime not yet applied) -> founding intro
//          coupon for the current (tier, cadence); left untouched when that
//          cadence has no founding rate (quarterly).
//        • Founding member WITH lifetime applied -> leave discounts untouched
//          (lifetime isn't cadence-specific and validly persists).
//        • Everyone else -> a monthly promo the member already holds stays on
//          the other monthly plan (their first 12 months, even after the
//          signup window closed); otherwise the ACTIVE public promo, or none.
//        • An unconsumed referral coupon is swapped to the new cadence's one.
//      Override with --coupon <id> to pin an exact coupon (e.g. a goodwill
//      promo after the window has closed), or --strip-only to remove stale
//      coupons without granting any replacement.
//   3. Strips every coupon WE manage (promo, retired promo, founding intro,
//      referral — any tier/cadence) that isn't correct, and ensures the correct
//      ones are present. Coupons already on the sub are kept by their existing
//      discount, so a repeating coupon's clock is not restarted. Coupons we
//      don't manage (founding lifetime, win-back, anything hand-applied) are
//      preserved untouched.
//
// A trialing member has no invoice yet, so this simply fixes the coupon before
// the first charge — no refund needed. For an ALREADY-CHARGED member whose past
// invoice was mis-discounted, fix the coupon here and comp the difference
// separately (scripts/back-credit-trial.mts or a one-off Stripe credit).
//
// Records an audit_events row (type billing_discount_reconciled_manual) per run.
// Read-only until --yes; --dry-run prints the plan with no writes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import { loadEnvLocal } from './env-local.mts';

const AUDIT_TYPE = 'billing_discount_reconciled_manual';

type Args = {
  email: string | null;
  coupon: string | null;
  stripOnly: boolean;
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
    coupon: null,
    stripOnly: false,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--coupon') args.coupon = (argv[++i] ?? '').trim() || null;
    else if (arg === '--strip-only') args.stripOnly = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (!arg.startsWith('--') && !args.email) args.email = arg.trim().toLowerCase() || null;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/fix-plan-switch-discount.mts \\
    --email <addr> [--coupon <coupon_id> | --strip-only] [--dry-run | --yes]

Reconciles one member's subscription discounts after a portal plan switch left a
stale, cadence-mismatched coupon applied (e.g. a monthly promo riding along on a
quarterly invoice). Uses the same rules as the webhook's
maybeReconcileDiscountOnPlanSwitch (core/switchDiscounts.ts).

By default the correct coupons are auto-resolved for the plan the subscription
is now on (founding intro, the member's monthly promo, or the active public
promo, plus any unconsumed referral coupon). Options:
      --coupon <id>   Pin an exact coupon to apply instead of the auto-resolved
                      one — e.g. a goodwill promo after its window has closed.
                      Stale managed coupons are still stripped.
      --strip-only    Remove stale managed coupons and grant NO replacement (the
                      member renews at rack rate).

Other:
      --dry-run       Print the plan; no Stripe or DB writes.
  -y, --yes           Apply: update the Stripe subscription and write an audit row.
  -h, --help          Show this help.

Reads STRIPE_SECRET_KEY, the STRIPE_PRICE_* ids, and the promo/founding/referral
coupon envs from env or .env.local. Set AUTH_DB_PATH to override the default DB
path (data/auth.db).`);
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

function execSqlite(dbPath: string, sql: string) {
  runSqlite(dbPath, sql);
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

if (!cliArgs.email) {
  console.error('Error: --email is required. See --help.');
  process.exit(1);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (cliArgs.coupon && cliArgs.stripOnly) {
  console.error('Error: --coupon and --strip-only are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

// --- Plan + coupon rules: the app's own modules ----------------------------
// Imported after the env is loaded: core/stripe.ts builds its price table at
// module load. Only modules with relative imports and no db/mailer reach are
// pulled in, so a plain `node --experimental-strip-types` run can load them.
loadEnvLocal(cwd);
const { priceIdToSku, getManagedCadenceCouponIds } = await import('../core/stripe.ts');
const { planSwitchDiscounts } = await import('../core/switchDiscounts.ts');
const { readAttachedDiscounts, attachedCouponIds, discountsParam, describeDiscountsParam } = await import(
  '../core/subscriptionDiscounts.ts'
);
const { getRefereeCouponId } = await import('../core/refereeCoupon.ts');
const { BILLING_CADENCES } = await import('../core/billingPlans.ts');

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

type UserRow = {
  id: string;
  email: string;
  tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  founding_member_started_at: string | null;
  founding_lifetime_applied_at: string | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, subscription_status, stripe_customer_id, stripe_subscription_id,
          stripe_price_id, founding_member_started_at, founding_lifetime_applied_at
   FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}' LIMIT 1;`,
);
const user = rows[0];
if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(1);
}
if (!user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} has no Stripe subscription (status=${user.subscription_status ?? 'none'}).`,
  );
  process.exit(1);
}

// --- Live Stripe read (source of truth for the current price + discounts) ----

const stripe = new Stripe(STRIPE_SECRET_KEY);

type ExpandedDiscount =
  | string
  | {
      coupon?: {
        id?: string;
        name?: string | null;
        amount_off?: number | null;
        percent_off?: number | null;
        currency?: string | null;
        duration?: string | null;
        duration_in_months?: number | null;
      } | string | null;
    };

let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
    expand: ['items.data.price', 'discounts'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve subscription ${user.stripe_subscription_id}: ${message}`);
  process.exit(1);
}

const item0 = subscription.items.data[0];
const currentPriceId = item0?.price?.id ?? null;
if (!currentPriceId) {
  console.error(`Error: subscription ${subscription.id} has no price on its first item. Aborting.`);
  process.exit(1);
}
const sku = priceIdToSku(currentPriceId);
if (!sku) {
  console.error(
    `Error: current price ${currentPriceId} on sub ${subscription.id} doesn't map to a known SKU.`,
  );
  console.error('       Check the STRIPE_PRICE_* env vars match this Stripe account. Aborting.');
  process.exit(1);
}

// The discounts on the subscription (expanded above), with their discount ids so
// coupons that stay are kept by reference rather than re-applied.
const attached = readAttachedDiscounts(subscription);
if (!attached) {
  console.error(`Error: could not read the discounts on ${subscription.id} (not expanded). Aborting.`);
  process.exit(1);
}
const currentCouponIds = attachedCouponIds(attached);
const discountsRaw = ((subscription as unknown as { discounts?: ExpandedDiscount[] }).discounts ??
  []) as ExpandedDiscount[];
const couponMeta = new Map<
  string,
  { name?: string | null; amount_off?: number | null; percent_off?: number | null; currency?: string | null; duration?: string | null; duration_in_months?: number | null }
>();
for (const d of discountsRaw) {
  if (typeof d === 'string') continue;
  const c = d?.coupon;
  if (c && typeof c !== 'string' && c.id) couponMeta.set(c.id, c);
}

// --- Resolve the correct coupons for the plan the sub is NOW on --------------

const foundingWithoutLifetime =
  !!user.founding_member_started_at && !user.founding_lifetime_applied_at;
const foundingWithLifetime =
  !!user.founding_member_started_at && !!user.founding_lifetime_applied_at;

// Everything the app manages: promo (current and retired), founding intro, and
// referral coupons for every cadence. Anything else is never touched.
const managed = new Set<string>([
  ...getManagedCadenceCouponIds(),
  ...BILLING_CADENCES.map((cadence) => getRefereeCouponId(cadence)).filter((id): id is string => !!id),
]);

let correct: string[] | null;
let resolutionNote: string;
if (cliArgs.stripOnly) {
  correct = [];
  resolutionNote = '--strip-only: no replacement coupon';
} else if (cliArgs.coupon) {
  correct = [cliArgs.coupon];
  resolutionNote = `--coupon override: ${cliArgs.coupon}`;
} else {
  const plan = planSwitchDiscounts({
    currentCouponIds,
    newSku: sku,
    foundingMemberStartedAt: user.founding_member_started_at,
    foundingLifetimeAppliedAt: user.founding_lifetime_applied_at,
  });
  correct = plan ? plan.correct : null;
  resolutionNote = !plan
    ? foundingWithLifetime
      ? 'founding member with lifetime coupon — discounts left untouched'
      : `founding member with no founding rate for ${sku.tier}/${sku.cadence} — discounts left untouched`
    : plan.correct.length
      ? `same rules as the webhook for ${sku.tier}/${sku.cadence}`
      : `no promo applies to ${sku.tier}/${sku.cadence} (use --coupon to force one)`;
}

const correctSet = new Set(correct ?? []);
const stale = correct ? currentCouponIds.filter((id) => managed.has(id) && !correctSet.has(id)) : [];
// Rebuild: keep unmanaged coupons + the correct ones, drop stale managed ones.
const keep = correct
  ? [...currentCouponIds.filter((id) => !managed.has(id) || correctSet.has(id)), ...(correct ?? [])]
  : currentCouponIds;
const keepUnique = [...new Set(keep)];
const param = discountsParam(keepUnique, attached);
const correctCoupon = correct && correct.length ? correct.join(', ') : null;

const noChange =
  keepUnique.length === currentCouponIds.length && keepUnique.every((id) => currentCouponIds.includes(id));

// --- Print the plan ----------------------------------------------------------

function couponLabel(id: string): string {
  const m = couponMeta.get(id);
  if (!m) return id;
  const parts: string[] = [];
  if (typeof m.amount_off === 'number') {
    const cur = (m.currency ?? 'usd').toUpperCase();
    parts.push(`${(m.amount_off / 100).toFixed(2)} ${cur} off`);
  } else if (typeof m.percent_off === 'number') {
    parts.push(`${m.percent_off}% off`);
  }
  if (m.duration === 'repeating' && m.duration_in_months) parts.push(`for ${m.duration_in_months} mo`);
  else if (m.duration) parts.push(m.duration);
  return parts.length ? `${id} (${parts.join(', ')})` : id;
}

const foundingLabel = foundingWithLifetime
  ? 'yes (lifetime applied)'
  : foundingWithoutLifetime
    ? 'yes (intro)'
    : 'no';

console.log(`Auth DB:            ${dbPath}`);
console.log(`Stripe:             ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`);
console.log(`Customer:           ${user.email} (id=${user.id})`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             ${subscription.status}`);
console.log(`Current plan:       ${sku.tier}/${sku.cadence} (price ${currentPriceId})`);
console.log(`Founding:           ${foundingLabel}`);
console.log(
  `Current discounts:  ${currentCouponIds.length ? currentCouponIds.map(couponLabel).join(', ') : 'none'}`,
);
console.log(`Correct coupons:    ${correct == null ? '(unchanged)' : correctCoupon ?? 'none'}  [${resolutionNote}]`);
console.log(`Stale (to strip):   ${stale.length ? stale.map(couponLabel).join(', ') : 'none'}`);
console.log(`Resulting coupons:  ${describeDiscountsParam(param, attached)}`);

if (subscription.status === 'active') {
  console.log('');
  console.log(
    'Note: this subscription is ACTIVE (already charged). This fixes the coupon going',
  );
  console.log(
    '      forward; if a PAST invoice was mis-discounted, comp the difference separately',
  );
  console.log('      (scripts/back-credit-trial.mts or a one-off Stripe credit).');
}

if (noChange) {
  console.log('\nNothing to do: discounts already match the correct set. No writes.');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log(
    '\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.',
  );
  process.exit(1);
}

// --- Apply -------------------------------------------------------------------

try {
  await stripe.subscriptions.update(subscription.id, {
    // Kept coupons by their existing discount (a repeating coupon's clock isn't
    // restarted), new ones by coupon, and '' to clear — stripe-node drops an
    // empty array (core/subscriptionDiscounts.ts).
    discounts: param,
    // No invoice exists during a trial; pin this so the edit can't prorate or
    // charge anything as a side effect.
    proration_behavior: 'none',
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription update failed: ${message}`);
  console.error('No DB changes were made.');
  process.exit(1);
}

const stamp = nowIso();
const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
const auditMessage =
  `Reconciled discounts on sub ${subscription.id} (${sku.tier}/${sku.cadence}): ` +
  `stripped [${stale.join(', ') || 'none'}], applied ${correctCoupon ?? 'none'} ` +
  `(${resolutionNote})`;
execSqlite(
  dbPath,
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (
     '${escapeSqlLiteral(auditId)}',
     '${escapeSqlLiteral(AUDIT_TYPE)}',
     '${escapeSqlLiteral(user.id)}',
     NULL,
     '${escapeSqlLiteral(user.email)}',
     'manual-script',
     '${escapeSqlLiteral(auditMessage)}',
     '${escapeSqlLiteral(stamp)}'
   );`,
);

console.log(`\nDone. ${user.email}'s subscription ${subscription.id} now carries: ${keepUnique.length ? keepUnique.join(', ') : 'no coupons'}.`);
if (correctCoupon && subscription.status === 'trialing') {
  console.log('The member is still trialing, so the corrected coupon applies to the first real invoice.');
}
