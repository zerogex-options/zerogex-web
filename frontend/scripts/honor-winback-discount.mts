#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/honor-winback-discount.mts \
//     --email <addr> [--coupon <coupon_id> | --create-coupon [--percent N]] \
//     [--keep-cancellation] [--dry-run | --yes]
//
// Honors the evergreen win-back "reply 'discount'" offer for ONE member by hand
// — the manual twin of the automated ?winback=1 checkout path. Use it when a
// member replies "discount" to the ~1-month win-back email (or the cancellation
// note) and you want to keep them on their EXISTING subscription, with no
// re-subscribe and no re-entered card. It does two things atomically:
//
//   1. STACKS a "25% off for one year" coupon on top of whatever discounts are
//      already on the subscription. It never strips or replaces an existing
//      coupon (a public promo, a referral bonus, anything hand-applied) — the
//      new coupon is ADDED so both ride the next invoice. This is deliberately
//      the opposite of scripts/fix-plan-switch-discount.mts, which RECONCILES
//      (strips stale cadence-specific coupons). Here we are granting, not fixing.
//
//   2. Clears cancel_at_period_end (unless --keep-cancellation) so the offer
//      actually retains them: a trialing sub converts to paid at trial_end
//      instead of ending; an active sub renews instead of cancelling. The card
//      already on file is charged — no re-subscribe. (Mirrors set-cancellation
//      --off, including clearing cancel_ack_email_sent_at so a future re-cancel
//      can re-send the acknowledgement.)
//
// The coupon to stack is resolved in this order:
//   --coupon <id>                         pin an exact, already-created coupon.
//   STRIPE_COUPON_WINBACK_<TIER>_<CADENCE> the standing win-back coupon for the
//                                         member's plan (by design this IS the
//                                         "25% off first year" coupon — reuse it
//                                         rather than minting duplicates).
//   --create-coupon                       create-or-reuse a deterministic
//                                         "<percent>% off, 1 year" coupon for the
//                                         member's cadence (annual: duration=once;
//                                         monthly: repeating, 12 months).
// With none of the above the script refuses and tells you how to configure one.
//
// Whatever it resolves, it inspects the coupon's real percent_off/duration and
// WARNS (without blocking) if they don't match "<percent>% off for one year" for
// the member's cadence — so a mis-created coupon can't silently apply the wrong
// rate. The win-back coupon family is intentionally NOT in the webhook's managed
// cadence set (core/stripe.ts getManagedCadenceCouponIds), so a coupon applied
// here persists across a later plan switch instead of being reconciled away.
//
// Stripe stacks multiple discounts SEQUENTIALLY (each applies to the amount left
// after the previous one), so e.g. a 20% promo + this 25% ≈ 40% off, not 45%.
// The plan output shows the resulting stack so the effective rate is visible.
//
// Only operates on a subscription Stripe reports as 'trialing' or 'active'.
// Idempotent: if the coupon is already applied it isn't added twice, and an
// already-cleared cancellation is left alone. Records an audit_events row
// (type billing_winback_discount_honored) per run. Read-only until --yes;
// --dry-run prints the plan with no writes. Sends NO email — reply to the
// member yourself so the charge at period end is expected.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const AUDIT_TYPE = 'billing_winback_discount_honored';

// The rate the "coupon does not match what you promised" warning checks
// against. It has to track WINBACK_DISCOUNT_LABEL, which is what the win-back
// emails and the /pricing welcome-back banner actually offer: once that moved
// to 50%, a hardcoded 25% here fired the warning on every correct run, which is
// how a warning stops being read. Falls back to 25 when the label is unset or
// says nothing numeric; --percent still overrides either way.
//
// Read at module load rather than through envValue() below, because parseArgs
// needs it and runs before envLocal exists. parseEnvFile is a hoisted function
// declaration, so calling it up here is fine.
function defaultWinbackPercent(): number {
  const label =
    process.env.WINBACK_DISCOUNT_LABEL ||
    parseEnvFile(path.join(process.cwd(), '.env.local')).WINBACK_DISCOUNT_LABEL ||
    '';
  const matched = label.trim().match(/^(\d{1,2})\s*%/);
  const percent = matched ? Number(matched[1]) : Number.NaN;
  return Number.isInteger(percent) && percent >= 1 && percent <= 99 ? percent : 25;
}
const DEFAULT_PERCENT = defaultWinbackPercent();

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

type Args = {
  email: string | null;
  coupon: string | null;
  createCoupon: boolean;
  percent: number;
  keepCancellation: boolean;
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
    createCoupon: false,
    percent: DEFAULT_PERCENT,
    keepCancellation: false,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--coupon') args.coupon = (argv[++i] ?? '').trim() || null;
    else if (arg === '--create-coupon') args.createCoupon = true;
    else if (arg === '--percent') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isInteger(value) || value <= 0 || value >= 100) {
        console.error(`Error: --percent expects an integer in 1..99, got "${argv[i]}".`);
        process.exit(1);
      }
      args.percent = value;
    } else if (arg === '--keep-cancellation') args.keepCancellation = true;
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
  node --experimental-strip-types --no-warnings scripts/honor-winback-discount.mts \\
    --email <addr> [--coupon <coupon_id> | --create-coupon [--percent N]] \\
    [--keep-cancellation] [--dry-run | --yes]

Honors the manual win-back "reply 'discount'" offer for one member: STACKS a
"<percent>% off for one year" coupon on top of any discounts already on their
subscription, and (by default) stops a scheduled cancellation so the sub
converts (trial) or renews (active) on the card already on file — no
re-subscribe. Existing coupons are preserved, never stripped.

Coupon resolution (first match wins):
      --coupon <id>       Pin an exact, already-created coupon to stack.
      (env)               STRIPE_COUPON_WINBACK_<TIER>_<CADENCE> for the member's
                          plan — the standing win-back coupon (reuse it).
      --create-coupon     Create-or-reuse a deterministic "<percent>% off, 1 yr"
                          coupon for the member's cadence (annual: once; monthly:
                          repeating 12 months). --percent sets the rate (default ${DEFAULT_PERCENT}).

Other:
      --keep-cancellation Do NOT clear cancel_at_period_end (just pre-load the
                          coupon; leave the member's cancel decision intact).
      --dry-run           Print the plan; no Stripe or DB writes.
  -y, --yes               Apply: update Stripe, mirror the row, write an audit row.
  -h, --help              Show this help.

Only operates on a trialing/active subscription. Idempotent. Sends NO email.

Reads STRIPE_SECRET_KEY, the four STRIPE_PRICE_* ids, and the
STRIPE_COUPON_WINBACK_* coupon envs from env or .env.local. Set AUTH_DB_PATH to
override the default DB path (data/auth.db).`);
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

// Mirror core/stripe.ts getCurrentPeriodEndUnix without importing it (that
// module pulls the '@/core/auth' path alias a raw strip-types run can't
// resolve). On a trial this equals trial_end. Item-level first (2024+ API),
// then the legacy sub-level.
function currentPeriodEndUnix(subscription: Stripe.Subscription): number | null {
  const item = subscription.items?.data?.[0];
  const itemValue = (item as unknown as { current_period_end?: number } | undefined)
    ?.current_period_end;
  if (typeof itemValue === 'number') return itemValue;
  const subValue = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof subValue === 'number') return subValue;
  return null;
}

type CouponShape = {
  id?: string;
  name?: string | null;
  amount_off?: number | null;
  percent_off?: number | null;
  currency?: string | null;
  duration?: string | null;
  duration_in_months?: number | null;
};

function describeCoupon(c: CouponShape | undefined, fallbackId: string): string {
  if (!c) return fallbackId;
  const parts: string[] = [];
  if (typeof c.amount_off === 'number') {
    const cur = (c.currency ?? 'usd').toUpperCase();
    parts.push(`${(c.amount_off / 100).toFixed(2)} ${cur} off`);
  } else if (typeof c.percent_off === 'number') {
    parts.push(`${c.percent_off}% off`);
  }
  if (c.duration === 'repeating' && c.duration_in_months) {
    parts.push(`${c.duration_in_months} mo`);
  } else if (c.duration) {
    parts.push(c.duration);
  }
  const id = c.id ?? fallbackId;
  return parts.length ? `${id} (${parts.join(', ')})` : id;
}

// What "<percent>% off for one year" looks like as a coupon for each cadence:
//   annual  -> one annual invoice covers the year  => duration=once
//   monthly -> twelve monthly invoices             => repeating, 12 months
function expectedDurationLabel(cadence: Cadence): string {
  return cadence === 'annual' ? 'once' : 'repeating for 12 months';
}

function couponMatchesOneYear(c: CouponShape, cadence: Cadence, percent: number): boolean {
  if (c.percent_off !== percent) return false;
  if (cadence === 'annual') return c.duration === 'once';
  return c.duration === 'repeating' && c.duration_in_months === 12;
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
if (cliArgs.coupon && cliArgs.createCoupon) {
  console.error('Error: --coupon and --create-coupon are mutually exclusive.');
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

// --- Resolve the SKU + winback coupon maps from env (mirrors core/stripe.ts) --
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

function winbackCouponEnvKey(tier: Tier, cadence: Cadence): string {
  if (cadence === 'monthly') {
    return tier === 'basic'
      ? 'STRIPE_COUPON_WINBACK_BASIC_MONTHLY'
      : 'STRIPE_COUPON_WINBACK_PRO_MONTHLY';
  }
  return tier === 'basic'
    ? 'STRIPE_COUPON_WINBACK_BASIC_ANNUAL'
    : 'STRIPE_COUPON_WINBACK_PRO_ANNUAL';
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
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: number | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, subscription_status, stripe_customer_id, stripe_subscription_id,
          cancel_at_period_end
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

// --- Live Stripe read (source of truth for status, price + discounts) --------

const stripe = new Stripe(STRIPE_SECRET_KEY);

type ExpandedDiscount =
  | string
  | {
      coupon?: CouponShape | string | null;
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

if (subscription.status !== 'trialing' && subscription.status !== 'active') {
  console.error(
    `Error: Stripe reports subscription ${subscription.id} as '${subscription.status}', not trialing/active. ` +
      'A lapsed/canceled member must re-subscribe (win-back checkout link) instead. Aborting.',
  );
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

// Coupon ids currently on the subscription, de-duplicated in order, with meta
// for labelling. These are ALL preserved — we stack, never strip.
const discountsRaw = ((subscription as unknown as { discounts?: ExpandedDiscount[] }).discounts ??
  []) as ExpandedDiscount[];
const currentCouponIds: string[] = [];
const couponMeta = new Map<string, CouponShape>();
for (const d of discountsRaw) {
  if (typeof d === 'string') continue; // a bare discount id (di_...), not a coupon — skip
  const c = d?.coupon;
  const id = typeof c === 'string' ? c : c?.id ?? null;
  if (!id || currentCouponIds.includes(id)) continue;
  currentCouponIds.push(id);
  if (c && typeof c !== 'string') couponMeta.set(id, c);
}

// --- Resolve (or create) the coupon to STACK ---------------------------------

const unitAmount = (item0?.price as unknown as { unit_amount?: number | null } | undefined)
  ?.unit_amount;
const priceCurrency = (item0?.price as unknown as { currency?: string } | undefined)?.currency ??
  'usd';

async function retrieveCoupon(id: string): Promise<CouponShape | null> {
  try {
    const c = (await stripe.coupons.retrieve(id)) as unknown as CouponShape;
    return c;
  } catch {
    return null;
  }
}

// Create-or-reuse a deterministic "<percent>% off, 1 year" coupon for the
// member's cadence. Stable id so repeat runs reuse the same Stripe object.
async function createOrReuseOneYearCoupon(cadence: Cadence, percent: number): Promise<CouponShape> {
  const id = `winback-${percent}pct-1yr-${cadence}`;
  const existing = await retrieveCoupon(id);
  if (existing) return existing;
  const base: Stripe.CouponCreateParams = {
    id,
    percent_off: percent,
    name: `Win-back ${percent}% off (1 year)`,
    metadata: { source: 'honor-winback-discount', cadence },
    ...(cadence === 'annual'
      ? { duration: 'once' }
      : { duration: 'repeating', duration_in_months: 12 }),
  };
  try {
    return (await stripe.coupons.create(base)) as unknown as CouponShape;
  } catch (err) {
    // Race / prior partial run: coupon id already taken — reuse it.
    const code = (err as { code?: string } | undefined)?.code;
    if (code === 'resource_already_exists') {
      const c = await retrieveCoupon(id);
      if (c) return c;
    }
    throw err;
  }
}

let addCouponId: string | null = null;
let addCouponMeta: CouponShape | null = null;
let resolutionNote = '';

if (cliArgs.coupon) {
  addCouponId = cliArgs.coupon;
  addCouponMeta = await retrieveCoupon(cliArgs.coupon);
  if (!addCouponMeta) {
    console.error(`Error: coupon ${cliArgs.coupon} not found on this Stripe account. Aborting.`);
    process.exit(1);
  }
  resolutionNote = `--coupon override`;
} else {
  const envKey = winbackCouponEnvKey(sku.tier, sku.cadence);
  const envCoupon = envOrLocal(envKey) ?? null;
  if (envCoupon) {
    addCouponId = envCoupon;
    addCouponMeta = await retrieveCoupon(envCoupon);
    if (!addCouponMeta) {
      console.error(
        `Error: ${envKey}=${envCoupon} is set but that coupon doesn't exist on this Stripe account. Aborting.`,
      );
      process.exit(1);
    }
    resolutionNote = `${envKey}`;
  } else if (cliArgs.createCoupon) {
    if (cliArgs.dryRun) {
      // Don't mint a Stripe object during a preview. Describe what --yes would create.
      resolutionNote = `--create-coupon (would create winback-${cliArgs.percent}pct-1yr-${sku.cadence})`;
      addCouponId = `winback-${cliArgs.percent}pct-1yr-${sku.cadence}`;
      addCouponMeta = {
        id: addCouponId,
        percent_off: cliArgs.percent,
        duration: sku.cadence === 'annual' ? 'once' : 'repeating',
        duration_in_months: sku.cadence === 'annual' ? null : 12,
      };
    } else {
      addCouponMeta = await createOrReuseOneYearCoupon(sku.cadence, cliArgs.percent);
      addCouponId = addCouponMeta.id ?? `winback-${cliArgs.percent}pct-1yr-${sku.cadence}`;
      resolutionNote = `--create-coupon (${addCouponId})`;
    }
  } else {
    console.error(
      `Error: no coupon to apply. ${envKey} is not set for ${sku.tier}/${sku.cadence}.\n` +
        `       Fix one of:\n` +
        `         • pass --coupon <coupon_id> to pin an existing coupon, or\n` +
        `         • pass --create-coupon to mint a ${cliArgs.percent}% off / 1-year coupon, or\n` +
        `         • create the coupon in Stripe and set ${envKey} in .env.local\n` +
        `           (annual: percent_off=${cliArgs.percent} duration=once; ` +
        `monthly: percent_off=${cliArgs.percent} duration=repeating duration_in_months=12).`,
    );
    process.exit(1);
  }
}

// Sanity-check the resolved coupon against "<percent>% off for one year" for the
// member's cadence. Warn but don't block — the operator may intend something else.
const matchesOffer = addCouponMeta
  ? couponMatchesOneYear(addCouponMeta, sku.cadence, cliArgs.percent)
  : false;

// Idempotency: already stacked?
const alreadyPresent = addCouponId != null && currentCouponIds.includes(addCouponId);

// Resulting stack = every existing coupon preserved + the new one (if absent).
const resultingCouponIds = [...currentCouponIds];
if (addCouponId && !alreadyPresent) resultingCouponIds.push(addCouponId);

// Cancellation change.
const isCancelling = subscription.cancel_at_period_end === true;
const willClearCancel = isCancelling && !cliArgs.keepCancellation;

const noChange = alreadyPresent && !willClearCancel;

// --- Print the plan ----------------------------------------------------------

const periodEndUnix = currentPeriodEndUnix(subscription);
const periodEndIso = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
const isTrial = subscription.status === 'trialing';
const listPrice =
  typeof unitAmount === 'number'
    ? `${(unitAmount / 100).toFixed(2)} ${priceCurrency.toUpperCase()}`
    : 'unknown';

console.log(`Auth DB:            ${dbPath}`);
console.log(
  `Stripe:             ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`,
);
console.log(`Customer:           ${user.email} (id=${user.id})`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             ${subscription.status} (${isTrial ? 'trial ends' : 'renews'} ${periodEndIso ?? '—'})`);
console.log(`Plan:               ${sku.tier}/${sku.cadence} — list ${listPrice} (price ${currentPriceId})`);
console.log(
  `Current discounts:  ${
    currentCouponIds.length
      ? currentCouponIds.map((id) => describeCoupon(couponMeta.get(id), id)).join(', ')
      : 'none'
  }`,
);
console.log(
  `Coupon to stack:    ${describeCoupon(addCouponMeta ?? undefined, addCouponId ?? '?')}  [${resolutionNote}]`,
);
console.log(
  `Resulting stack:    ${resultingCouponIds
    .map((id) => describeCoupon(couponMeta.get(id) ?? (id === addCouponId ? addCouponMeta ?? undefined : undefined), id))
    .join(', ')}`,
);
console.log(
  `cancel_at_period_end: ${isCancelling ? 'true' : 'false'}${
    willClearCancel ? '  →  false (will convert/renew)' : cliArgs.keepCancellation && isCancelling ? '  (kept — --keep-cancellation)' : ''
  }`,
);

if (!matchesOffer) {
  console.log('');
  console.log(
    `WARNING: the resolved coupon is not exactly ${cliArgs.percent}% off, ${expectedDurationLabel(sku.cadence)} ` +
      `for a ${sku.cadence} plan.`,
  );
  console.log(
    '         It will still be applied as-is — double-check it matches what you promised the member.',
  );
}

if (currentCouponIds.length > 0 && !alreadyPresent) {
  console.log('');
  console.log(
    'Note: Stripe stacks discounts sequentially (each applies to the amount left',
  );
  console.log(
    '      after the previous one), so the effective rate compounds rather than sums.',
  );
}

// Plain-English consequence of clearing the cancellation.
if (willClearCancel) {
  const at = periodEndIso ?? 'period end';
  console.log('');
  console.log(
    isTrial
      ? `Effect: at ${at} Stripe will CHARGE the card on file (Stripe computes the exact\n` +
          `        amount after the stacked discounts) and convert the trial to paid.`
      : `Effect: the subscription will RENEW at ${at} at the stacked-discount rate.`,
  );
}

if (noChange) {
  console.log('');
  console.log(
    `Nothing to do: ${addCouponId} is already applied${
      isCancelling ? ' and --keep-cancellation was passed' : ' and the sub is not cancelling'
    }. No writes.`,
  );
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  if (cliArgs.createCoupon && !envOrLocal(winbackCouponEnvKey(sku.tier, sku.cadence)) && !cliArgs.coupon) {
    console.log('          (--yes would create-or-reuse the coupon shown above before applying.)');
  }
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
    discounts: resultingCouponIds.map((coupon) => ({ coupon })),
    ...(willClearCancel ? { cancel_at_period_end: false } : {}),
    // A discount add must never prorate or charge anything mid-period; the
    // stacked discounts apply to the next (conversion/renewal) invoice only.
    proration_behavior: 'none',
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription update failed: ${message}`);
  console.error('No DB changes were made.');
  process.exit(1);
}

const stamp = nowIso();

// Mirror the cancellation flag if we cleared it, matching set-cancellation.mts
// and the webhook reactivation branch (also clear cancel_ack_email_sent_at so a
// future re-cancel can re-fire the acknowledgement). The webhook reconciles to
// the same values later (idempotent).
if (willClearCancel) {
  execSqlite(
    dbPath,
    `UPDATE users SET
       cancel_at_period_end = 0,
       cancel_ack_email_sent_at = NULL,
       updated_at = '${escapeSqlLiteral(stamp)}'
     WHERE id = '${escapeSqlLiteral(user.id)}';`,
  );
}

const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
const auditMessage =
  `Honored win-back discount on sub ${subscription.id} (${sku.tier}/${sku.cadence}): ` +
  `stacked ${addCouponId} on [${currentCouponIds.join(', ') || 'none'}]` +
  `${willClearCancel ? ', cleared cancel_at_period_end' : ''} (${resolutionNote})`;
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

console.log(
  `\nDone. ${user.email}'s subscription ${subscription.id} now carries: ${resultingCouponIds.join(', ')}.`,
);
if (willClearCancel) {
  const at = periodEndIso ?? 'period end';
  console.log(
    isTrial
      ? `The cancellation is cleared — at ${at} the trial converts and the card on file is charged at the stacked rate.`
      : `The cancellation is cleared — the sub renews at ${at} at the stacked rate.`,
  );
  console.log('Reply to the member so the charge at period end is expected (this script sent no email).');
}

// Best-effort: show the real next charge after the stacked discounts, so the
// applied rate is concrete. A sub with nothing upcoming (still cancelling under
// --keep-cancellation) has no preview — skip it rather than crash. Mirrors the
// upcoming-invoice read in scripts/diagnose-user.mts.
if (user.stripe_customer_id) {
  try {
    const upcoming = await stripe.invoices.retrieveUpcoming({
      customer: user.stripe_customer_id,
      subscription: subscription.id,
    });
    console.log(
      `Next charge (after all discounts): ${(upcoming.amount_due / 100).toFixed(2)} ${upcoming.currency.toUpperCase()}.`,
    );
  } catch {
    // No upcoming invoice preview available — not an error.
  }
}
