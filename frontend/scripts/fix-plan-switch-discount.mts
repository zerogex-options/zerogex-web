#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/fix-plan-switch-discount.mts \
//     --email <addr> [--coupon <coupon_id> | --strip-only] [--dry-run | --yes]
//
// Corrects a subscription that carried the WRONG cadence-specific coupon across
// a billing-portal plan switch. When a member switches monthly <-> annual (or
// tier), Stripe keeps the old coupon on the subscription. Our promo/founding
// coupons are cadence-specific, so e.g. the monthly promo ($20 off, repeating
// for 6 months) keeps discounting an ANNUAL invoice instead of the annual promo
// ($49 off, once). This script reconciles the subscription's discounts to what
// they SHOULD be for the plan the member is now on.
//
// It is the manual twin of the webhook's maybeReconcileDiscountOnPlanSwitch
// (app/api/webhooks/stripe/route.ts): use it to repair accounts that switched
// before that reconciliation shipped, or any account flagged by support.
//
// WHAT IT DOES
//   1. Reads the user + their live Stripe subscription (discounts expanded).
//   2. Resolves the CORRECT cadence-specific coupon for the plan the sub is now
//      on, mirroring the webhook's precedence:
//        • Founding member (and lifetime not yet applied) -> founding intro
//          coupon for the current (tier, cadence).
//        • Founding member WITH lifetime applied -> leave discounts untouched
//          (lifetime isn't cadence-specific and validly persists).
//        • Everyone else -> the ACTIVE public promo for the current
//          (tier, cadence), or none once the window has closed.
//      Override with --coupon <id> to pin an exact coupon (e.g. to honor the
//      annual promo after its public window has closed), or --strip-only to
//      remove stale coupons without granting any replacement.
//   3. Strips every coupon WE manage (promo + founding intro, any tier/cadence)
//      that isn't the correct one, and ensures the correct one is present.
//      Coupons we don't manage (founding lifetime, win-back, referral, anything
//      hand-applied) are preserved untouched.
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

const AUDIT_TYPE = 'billing_discount_reconciled_manual';

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

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
stale, cadence-mismatched coupon applied (e.g. a monthly promo riding along on an
annual invoice). Mirrors the webhook's maybeReconcileDiscountOnPlanSwitch.

By default the correct coupon is auto-resolved for the plan the subscription is
now on (founding intro or the active public promo). Options:
      --coupon <id>   Pin an exact coupon to apply instead of the auto-resolved
                      one — e.g. honor the annual promo coupon after its public
                      window has closed. The stale coupon is still stripped.
      --strip-only    Remove stale managed coupons and grant NO replacement (the
                      member renews at rack rate).

Other:
      --dry-run       Print the plan; no Stripe or DB writes.
  -y, --yes           Apply: update the Stripe subscription and write an audit row.
  -h, --help          Show this help.

Reads STRIPE_SECRET_KEY, the four STRIPE_PRICE_* ids, and the promo/founding
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

// --- Resolve the SKU + coupon maps from env (mirrors core/stripe.ts) ---------
// A raw `node --experimental-strip-types` run can't resolve the '@/core/*' path
// alias, so the price->sku and coupon lookups are inlined here from the same env
// vars the app reads. Keep these in sync with core/stripe.ts if the keys change.

const PRICE_ENV: Array<{ env: string; tier: Tier; cadence: Cadence }> = [
  { env: 'STRIPE_PRICE_BASIC_MONTHLY', tier: 'basic', cadence: 'monthly' },
  { env: 'STRIPE_PRICE_BASIC_ANNUAL', tier: 'basic', cadence: 'annual' },
  { env: 'STRIPE_PRICE_PRO_MONTHLY', tier: 'pro', cadence: 'monthly' },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', tier: 'pro', cadence: 'annual' },
];

const skuByPriceId = new Map<string, { tier: Tier; cadence: Cadence }>();
for (const p of PRICE_ENV) {
  const id = envOrLocal(p.env);
  if (id) skuByPriceId.set(id, { tier: p.tier, cadence: p.cadence });
}

function promoCouponEnvKey(tier: Tier, cadence: Cadence): string {
  if (cadence === 'monthly') {
    return tier === 'basic' ? 'STRIPE_COUPON_PROMO_BASIC_MONTHLY' : 'STRIPE_COUPON_PROMO_PRO_MONTHLY';
  }
  return tier === 'basic' ? 'STRIPE_COUPON_PROMO_BASIC_ANNUAL' : 'STRIPE_COUPON_PROMO_PRO_ANNUAL';
}

function foundingIntroCouponEnvKey(tier: Tier, cadence: Cadence): string {
  if (cadence === 'monthly') {
    return tier === 'basic' ? 'STRIPE_COUPON_FOUNDING_BASIC_INTRO' : 'STRIPE_COUPON_FOUNDING_PRO_INTRO';
  }
  return tier === 'basic'
    ? 'STRIPE_COUPON_FOUNDING_BASIC_INTRO_ANNUAL'
    : 'STRIPE_COUPON_FOUNDING_PRO_INTRO_ANNUAL';
}

function configuredPromoCouponId(tier: Tier, cadence: Cadence): string | null {
  return envOrLocal(promoCouponEnvKey(tier, cadence)) ?? null;
}
function foundingIntroCouponId(tier: Tier, cadence: Cadence): string | null {
  return envOrLocal(foundingIntroCouponEnvKey(tier, cadence)) ?? null;
}

function isPromoWindowOpen(): boolean {
  const endAt = envOrLocal('PROMO_END_AT');
  if (!endAt) return false;
  const endTs = Date.parse(endAt);
  return Number.isFinite(endTs) && endTs > Date.now();
}

// Every cadence-specific coupon the app manages (promo + founding intro), across
// all tier/cadence combos, regardless of the promo window. A coupon from this
// set that isn't the correct one for the current cadence is stale.
function managedCadenceCouponIds(): Set<string> {
  const ids = new Set<string>();
  for (const tier of ['basic', 'pro'] as Tier[]) {
    for (const cadence of ['monthly', 'annual'] as Cadence[]) {
      const promo = configuredPromoCouponId(tier, cadence);
      if (promo) ids.add(promo);
      const founding = foundingIntroCouponId(tier, cadence);
      if (founding) ids.add(founding);
    }
  }
  return ids;
}

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
const sku = skuByPriceId.get(currentPriceId) ?? null;
if (!sku) {
  console.error(
    `Error: current price ${currentPriceId} on sub ${subscription.id} doesn't map to a known SKU.`,
  );
  console.error('       Check the STRIPE_PRICE_* env vars match this Stripe account. Aborting.');
  process.exit(1);
}

// Coupon ids currently on the subscription, de-duplicated in order.
const discountsRaw = ((subscription as unknown as { discounts?: ExpandedDiscount[] }).discounts ??
  []) as ExpandedDiscount[];
const currentCouponIds: string[] = [];
const couponMeta = new Map<
  string,
  { name?: string | null; amount_off?: number | null; percent_off?: number | null; currency?: string | null; duration?: string | null; duration_in_months?: number | null }
>();
for (const d of discountsRaw) {
  // We expand ['discounts'], so each entry is a discount object carrying a
  // coupon (object when expanded, else its id). A bare-string entry would be a
  // discount id (di_...), not a coupon — skip it, we can't classify it.
  if (typeof d === 'string') continue;
  const c = d?.coupon;
  const id = typeof c === 'string' ? c : c?.id ?? null;
  if (!id || currentCouponIds.includes(id)) continue;
  currentCouponIds.push(id);
  if (c && typeof c !== 'string') couponMeta.set(id, c);
}

// --- Resolve the correct coupon for the plan the sub is NOW on ---------------

const foundingWithoutLifetime =
  !!user.founding_member_started_at && !user.founding_lifetime_applied_at;
const foundingWithLifetime =
  !!user.founding_member_started_at && !!user.founding_lifetime_applied_at;

let correctCoupon: string | null;
let resolutionNote: string;
if (cliArgs.stripOnly) {
  correctCoupon = null;
  resolutionNote = '--strip-only: no replacement coupon';
} else if (cliArgs.coupon) {
  correctCoupon = cliArgs.coupon;
  resolutionNote = `--coupon override: ${cliArgs.coupon}`;
} else if (foundingWithLifetime) {
  correctCoupon = null;
  resolutionNote = 'founding member with lifetime coupon — discounts left untouched';
} else if (foundingWithoutLifetime) {
  correctCoupon = foundingIntroCouponId(sku.tier, sku.cadence);
  resolutionNote = `founding intro for ${sku.tier}/${sku.cadence}: ${correctCoupon ?? 'not configured'}`;
} else {
  correctCoupon = isPromoWindowOpen() ? configuredPromoCouponId(sku.tier, sku.cadence) : null;
  resolutionNote = isPromoWindowOpen()
    ? `active public promo for ${sku.tier}/${sku.cadence}: ${correctCoupon ?? 'not configured'}`
    : 'public promo window closed — no replacement (use --coupon to force one)';
}

const managed = managedCadenceCouponIds();
const stale = currentCouponIds.filter((id) => managed.has(id) && id !== correctCoupon);
const correctPresent = correctCoupon != null && currentCouponIds.includes(correctCoupon);

// Rebuild: keep unmanaged coupons + the correct one, drop stale managed ones.
const keep = currentCouponIds.filter((id) => !managed.has(id) || id === correctCoupon);
if (correctCoupon && !keep.includes(correctCoupon)) keep.push(correctCoupon);

const noChange =
  stale.length === 0 &&
  (correctCoupon == null || correctPresent) &&
  keep.length === currentCouponIds.length &&
  keep.every((id) => currentCouponIds.includes(id));

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
console.log(`Correct coupon:     ${correctCoupon ?? 'none'}  [${resolutionNote}]`);
console.log(`Stale (to strip):   ${stale.length ? stale.map(couponLabel).join(', ') : 'none'}`);
console.log(`Resulting coupons:  ${keep.length ? keep.join(', ') : 'none'}`);

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
    discounts: keep.map((coupon) => ({ coupon })),
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

console.log(`\nDone. ${user.email}'s subscription ${subscription.id} now carries: ${keep.length ? keep.join(', ') : 'no coupons'}.`);
if (correctCoupon && subscription.status === 'trialing') {
  console.log('She is still trialing, so the corrected coupon applies to the first real invoice.');
}
