#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/grant-founding-on-existing-sub.mts \
//     --email <addr> [--tier basic|pro] [--cadence monthly|annual] \
//     [--proration always_invoice|create_prorations|none] [--dry-run | --yes]
//
// Grant founding-member status to a member who ALREADY has an active
// subscription — the has-a-sub twin of scripts/activate-late-founder.mts.
//
// activate-late-founder HARD-REFUSES anyone who already has a subscription: it
// mints a fresh hosted Checkout link (the member types a new card), and a second
// live subscription on the same customer would duplicate billing (the exact
// zombie/duplicate artifact scripts/clear-zombie-customers cleans up). So it can
// only onboard a founder with NO sub. This script covers the other case: an
// existing paying member you want to comp into founding — e.g. a loyal customer
// upgrading Basic -> Pro who should get the founding rate.
//
// It converts the member's EXISTING subscription in place, in ONE Stripe update:
//   1. Swaps the subscription price to the target founding plan (default
//      pro/annual) when it differs from the current one.
//   2. Attaches the founding intro coupon for that (tier, cadence) —
//      STRIPE_COUPON_FOUNDING_*_INTRO[_ANNUAL] — REPLACING whatever coupon was on
//      the sub (e.g. a stale monthly promo).
//   3. Stamps subscription.metadata.founding='1' (+ tier/cadence/user_id).
//
// That metadata flag — NOT the coupon — is what makes the webhook
// (app/api/webhooks/stripe/route.ts) treat them as a REAL founder: on the
// resulting customer.subscription.updated it stamps founding_member_started_at,
// and ~11 months later schedules the lifetime 25%-off coupon
// (STRIPE_COUPON_FOUNDING_LIFETIME) so renewals drop to ~75% of rack, forever.
// Applying the intro coupon WITHOUT the flag would give one discounted term and
// then silently snap back to full rack rate.
//
// Because the webhook's maybeReconcileDiscountOnPlanSwitch treats a founder as
// EXCLUSIVE, it keeps the founding intro coupon this script applies and never
// strips it or stacks the public promo on top — so the conversion is stable even
// while a public promo window is open. (This is why founding sidesteps the
// coupon-reconciliation race a plain custom coupon would hit on a plan switch.)
//
// Proration (default always_invoice): an upgrade bills the prorated founding
// amount NOW — the new-term charge, minus a credit for the unused current-plan
// time, minus the founding coupon — and starts the new term today. Pass
//   --proration create_prorations  to defer the proration to the next invoice, or
//   --proration none               to change the plan with no immediate charge
//                                   (the member renews at the founding rate).
//
// Idempotent-ish: a no-op when the sub is already on the target plan, already
// carries the founding coupon, and the member is already founding. Records an
// audit_events row per run. Read-only until --yes; --dry-run prints the plan
// (with a best-effort charge preview) and writes nothing.
//
// Reads STRIPE_SECRET_KEY, the four STRIPE_PRICE_* ids and the
// STRIPE_COUPON_FOUNDING_* coupons from env or .env.local. Set AUTH_DB_PATH to
// override the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
// Type-only import: erased by --experimental-strip-types, so it adds no runtime
// dependency on node_modules (the Stripe client itself is lazy-imported below,
// after arg parsing, so --help works without deps installed).
import type Stripe from 'stripe';

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';
type Proration = 'always_invoice' | 'create_prorations' | 'none';

// Founding plan matrix, mirrored from scripts/activate-late-founder.mts. Each
// row names the Stripe price + founding intro coupon env for one (tier, cadence)
// and the intro rate it locks (label only — Stripe is the source of truth).
const PLAN_MATRIX: Array<{
  tier: Tier;
  cadence: Cadence;
  priceEnv: string;
  couponEnv: string;
  introLabel: string;
}> = [
  { tier: 'basic', cadence: 'monthly', priceEnv: 'STRIPE_PRICE_BASIC_MONTHLY', couponEnv: 'STRIPE_COUPON_FOUNDING_BASIC_INTRO', introLabel: '$12/mo' },
  { tier: 'basic', cadence: 'annual', priceEnv: 'STRIPE_PRICE_BASIC_ANNUAL', couponEnv: 'STRIPE_COUPON_FOUNDING_BASIC_INTRO_ANNUAL', introLabel: '$120/yr' },
  { tier: 'pro', cadence: 'monthly', priceEnv: 'STRIPE_PRICE_PRO_MONTHLY', couponEnv: 'STRIPE_COUPON_FOUNDING_PRO_INTRO', introLabel: '$19/mo' },
  { tier: 'pro', cadence: 'annual', priceEnv: 'STRIPE_PRICE_PRO_ANNUAL', couponEnv: 'STRIPE_COUPON_FOUNDING_PRO_INTRO_ANNUAL', introLabel: '$190/yr' },
];

const AUDIT_TYPE = 'billing_founding_granted_existing_sub';

type Args = {
  email: string | null;
  tier: Tier;
  cadence: Cadence;
  proration: Proration;
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
  // Defaults target the common case: comp a member into founding Pro annual and
  // bill the prorated founding rate now.
  const args: Args = {
    email: null,
    tier: 'pro',
    cadence: 'annual',
    proration: 'always_invoice',
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--tier') {
      const next = argv[++i];
      if (next === 'basic' || next === 'pro') args.tier = next;
      else {
        console.error(`Error: --tier must be basic|pro (got ${next ?? '<none>'}).`);
        process.exit(1);
      }
    } else if (arg === '--cadence') {
      const next = argv[++i];
      if (next === 'monthly' || next === 'annual') args.cadence = next;
      else {
        console.error(`Error: --cadence must be monthly|annual (got ${next ?? '<none>'}).`);
        process.exit(1);
      }
    } else if (arg === '--proration') {
      const next = argv[++i];
      if (next === 'always_invoice' || next === 'create_prorations' || next === 'none') args.proration = next;
      else {
        console.error(`Error: --proration must be always_invoice|create_prorations|none (got ${next ?? '<none>'}).`);
        process.exit(1);
      }
    } else if (arg === '--dry-run') args.dryRun = true;
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
  node --experimental-strip-types --no-warnings scripts/grant-founding-on-existing-sub.mts \\
    --email <addr> [--tier basic|pro] [--cadence monthly|annual] \\
    [--proration always_invoice|create_prorations|none] [--dry-run | --yes]

Converts one member's EXISTING subscription into a founding-member subscription
in place: swaps the price to the target founding plan, attaches the founding
intro coupon, and stamps metadata.founding=1 so the webhook grants founding
status and schedules the lifetime 25%-off coupon. The has-a-sub twin of
scripts/activate-late-founder.mts (which only handles members with NO sub).

Plan (defaults to pro/annual — the founding upgrade case):
      --tier basic|pro          Target tier.
      --cadence monthly|annual  Target cadence.

Charge:
      --proration always_invoice     Bill the prorated founding amount now
                                     (default) and start the new term today.
      --proration create_prorations  Defer the proration to the next invoice.
      --proration none               Change the plan with no immediate charge;
                                     renews at the founding rate.

Other:
      --dry-run   Print the plan + a best-effort charge preview; no writes.
  -y, --yes       Apply: update the Stripe subscription + write an audit row.
  -h, --help      Show this help.

Reads STRIPE_SECRET_KEY, the four STRIPE_PRICE_* ids and the
STRIPE_COUPON_FOUNDING_* coupons from env or .env.local. Set AUTH_DB_PATH to
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

function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency.toUpperCase()}`;
  }
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

// --- Resolve the target plan's price + founding coupon from env --------------

const plan = PLAN_MATRIX.find((p) => p.tier === cliArgs.tier && p.cadence === cliArgs.cadence)!;
const targetPriceId = envOrLocal(plan.priceEnv);
const foundingCouponId = envOrLocal(plan.couponEnv);
if (!targetPriceId || !foundingCouponId) {
  console.error(
    `Error: founding plan ${cliArgs.tier}/${cliArgs.cadence} is not fully configured ` +
      `(${!targetPriceId ? plan.priceEnv : ''}${!targetPriceId && !foundingCouponId ? ' + ' : ''}${!foundingCouponId ? plan.couponEnv : ''} unset).`,
  );
  console.error('       Populate the env(s) in frontend/.env.local, or choose a configured --tier/--cadence.');
  process.exit(1);
}

// Map every configured price id -> its (tier, cadence) so we can name the plan
// the sub is CURRENTLY on for the operator (mirrors core/stripe.ts SKU map).
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
  console.error('       This script converts an EXISTING sub. For a member with no sub, mint a');
  console.error('       founding checkout link with scripts/activate-late-founder.mts instead.');
  process.exit(1);
}

// --- Live Stripe read (source of truth for the current price + discounts) ----
// Lazy-imported so --help runs without node_modules; everything below needs it.
const { default: StripeClient } = await import('stripe');
const stripe = new StripeClient(STRIPE_SECRET_KEY);

type ExpandedDiscount =
  | string
  | { coupon?: { id?: string } | string | null };

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

// Only active/trialing subs can be converted — a canceled/incomplete sub has no
// live plan to swap.
if (subscription.status !== 'active' && subscription.status !== 'trialing') {
  console.error(
    `Error: subscription ${subscription.id} is '${subscription.status}', not active/trialing. Aborting.`,
  );
  process.exit(1);
}

const item0 = subscription.items.data[0];
const currentPriceId = item0?.price?.id ?? null;
if (!item0 || !currentPriceId) {
  console.error(`Error: subscription ${subscription.id} has no price on its first item. Aborting.`);
  process.exit(1);
}
const currentSku = skuByPriceId.get(currentPriceId) ?? null;
const currentPlanLabel = currentSku ? `${currentSku.tier}/${currentSku.cadence}` : 'unknown';

const customerId =
  typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

// Coupon ids currently on the sub, de-duplicated in order.
const discountsRaw = ((subscription as unknown as { discounts?: ExpandedDiscount[] }).discounts ??
  []) as ExpandedDiscount[];
const currentCouponIds: string[] = [];
for (const d of discountsRaw) {
  if (typeof d === 'string') continue;
  const c = d?.coupon;
  const id = typeof c === 'string' ? c : c?.id ?? null;
  if (id && !currentCouponIds.includes(id)) currentCouponIds.push(id);
}

const priceChanges = currentPriceId !== targetPriceId;
const couponAlreadyCorrect =
  currentCouponIds.length === 1 && currentCouponIds[0] === foundingCouponId;
const metaFoundingSet = (subscription.metadata ?? {}).founding === '1';
const alreadyFounding = !!user.founding_member_started_at;

// True when there is genuinely nothing to change: already on the target plan,
// carrying exactly the founding coupon, already flagged founding on the sub, and
// already stamped founding in the DB.
const noChange = !priceChanges && couponAlreadyCorrect && metaFoundingSet && alreadyFounding;

// Best-effort preview of the immediate charge. Stripe renamed the upcoming-
// invoice preview across versions, so try both method names and fall back to a
// rate label when neither is available or the call errors.
async function previewImmediateCharge(): Promise<string | null> {
  if (cliArgs.proration === 'none') return null;
  const invoicesApi = stripe.invoices as unknown as {
    createPreview?: (params: Record<string, unknown>) => Promise<Stripe.Invoice>;
    retrieveUpcoming?: (params: Record<string, unknown>) => Promise<Stripe.Invoice>;
  };
  const items = priceChanges ? [{ id: item0.id, price: targetPriceId }] : undefined;
  try {
    let inv: Stripe.Invoice | null = null;
    if (typeof invoicesApi.createPreview === 'function') {
      inv = await invoicesApi.createPreview({
        customer: customerId,
        subscription: subscription.id,
        subscription_details: {
          ...(items ? { items } : {}),
          proration_behavior: cliArgs.proration,
        },
        discounts: [{ coupon: foundingCouponId }],
      });
    } else if (typeof invoicesApi.retrieveUpcoming === 'function') {
      inv = await invoicesApi.retrieveUpcoming({
        customer: customerId,
        subscription: subscription.id,
        ...(items ? { subscription_items: items } : {}),
        subscription_proration_behavior: cliArgs.proration,
        coupon: foundingCouponId,
      });
    }
    if (!inv) return null;
    const minor = typeof inv.amount_due === 'number' ? inv.amount_due : inv.total;
    if (typeof minor !== 'number') return null;
    return formatMoney(minor, inv.currency ?? 'usd');
  } catch {
    return null;
  }
}

const chargePreview = await previewImmediateCharge();

// --- Print the plan ----------------------------------------------------------

console.log(`Auth DB:            ${dbPath}`);
console.log(`Stripe:             ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`);
console.log(`Member:             ${user.email} (id=${user.id})`);
console.log(`Subscription:       ${subscription.id}`);
console.log(`Status:             ${subscription.status}`);
console.log(`Current plan:       ${currentPlanLabel} (price ${currentPriceId})`);
console.log(`Current discounts:  ${currentCouponIds.length ? currentCouponIds.join(', ') : 'none'}`);
console.log(`Already founding:   ${alreadyFounding ? 'yes' : 'no'}`);
console.log('');
console.log(`Target plan:        ${cliArgs.tier}/${cliArgs.cadence} (${plan.introLabel}) — price ${targetPriceId}`);
console.log(`Founding coupon:    ${foundingCouponId}${priceChanges ? '' : ' (price unchanged — coupon/flag only)'}`);
console.log(`Proration:          ${cliArgs.proration}`);
console.log(
  `Charge now:         ${
    cliArgs.proration === 'none'
      ? 'none (renews at founding rate)'
      : chargePreview
        ? `${chargePreview} (prorated: ${plan.introLabel} rate, less credit for unused ${currentPlanLabel} time)`
        : `~${plan.introLabel} for the first term, less a credit for unused ${currentPlanLabel} time (exact amount shown after --yes)`
  }`,
);
console.log('After this term:    renews with the lifetime 25%-off founding coupon (~75% of rack), applied by the webhook ~11 months out.');

if (noChange) {
  console.log('\nNothing to do: already on the target founding plan with the founding coupon and flagged founding. No writes.');
  process.exit(0);
}

if (alreadyFounding && !metaFoundingSet) {
  console.log('\nNote: DB says this member is already founding, but the live sub lacks metadata.founding=1. Proceeding will re-assert it.');
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

// --- Apply -------------------------------------------------------------------
// Merge (don't replace) existing metadata so nothing set at checkout is dropped;
// setting `discounts` to just the founding coupon intentionally REPLACES any
// prior coupon on the sub.
const mergedMetadata: Record<string, string> = {
  ...((subscription.metadata ?? {}) as Record<string, string>),
  user_id: user.id,
  tier: cliArgs.tier,
  cadence: cliArgs.cadence,
  founding: '1',
  founding_activation: 'existing_sub',
};

let updated: Stripe.Subscription;
try {
  updated = await stripe.subscriptions.update(subscription.id, {
    ...(priceChanges ? { items: [{ id: item0.id, price: targetPriceId }] } : {}),
    discounts: [{ coupon: foundingCouponId }],
    proration_behavior: cliArgs.proration,
    // Converting to founding implies staying — clear any pending cancellation.
    cancel_at_period_end: false,
    metadata: mergedMetadata,
    expand: ['latest_invoice', 'discounts', 'items.data.price'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe subscription update failed: ${message}`);
  console.error('No DB changes were made.');
  process.exit(1);
}

// Reflect founding eligibility on the row (the webhook stamps
// founding_member_started_at itself off the metadata; founding_eligible it does
// NOT touch). Best-effort — the Stripe change above is the load-bearing action.
try {
  execSqlite(
    dbPath,
    `UPDATE users SET founding_eligible = 1, updated_at = '${escapeSqlLiteral(nowIso())}' WHERE id = '${escapeSqlLiteral(user.id)}';`,
  );
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Warning: Stripe updated, but setting founding_eligible=1 failed: ${message}`);
}

// Resulting coupon ids on the updated sub.
const updatedDiscountsRaw = ((updated as unknown as { discounts?: ExpandedDiscount[] }).discounts ??
  []) as ExpandedDiscount[];
const resultingCoupons: string[] = [];
for (const d of updatedDiscountsRaw) {
  if (typeof d === 'string') continue;
  const c = d?.coupon;
  const id = typeof c === 'string' ? c : c?.id ?? null;
  if (id && !resultingCoupons.includes(id)) resultingCoupons.push(id);
}

// Charged amount + receipt from the invoice the update generated (always_invoice /
// create_prorations). None → no immediate invoice.
const latest = updated.latest_invoice;
const invoice = latest && typeof latest !== 'string' ? (latest as Stripe.Invoice) : null;

const stamp = nowIso();
const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
const auditMessage =
  `Granted founding on existing sub ${subscription.id}: ${currentPlanLabel} -> ${cliArgs.tier}/${cliArgs.cadence} ` +
  `(price ${priceChanges ? `${currentPriceId} -> ${targetPriceId}` : currentPriceId}), ` +
  `coupon ${foundingCouponId}, metadata.founding=1, proration=${cliArgs.proration}` +
  (invoice ? `, invoice ${invoice.id} ${typeof invoice.amount_due === 'number' ? formatMoney(invoice.amount_due, invoice.currency ?? 'usd') : ''}`.trimEnd() : '');
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

console.log(`\nDone. ${user.email} converted to founding ${cliArgs.tier}/${cliArgs.cadence}.`);
console.log(`  Coupons now on sub:  ${resultingCoupons.length ? resultingCoupons.join(', ') : 'none'}`);
if (invoice) {
  if (typeof invoice.amount_due === 'number') {
    console.log(`  Charged now:         ${formatMoney(invoice.amount_due, invoice.currency ?? 'usd')} (invoice ${invoice.id})`);
  }
  if (invoice.hosted_invoice_url) console.log(`  Receipt:             ${invoice.hosted_invoice_url}`);
} else if (cliArgs.proration === 'none') {
  console.log('  Charged now:         none (renews at the founding rate).');
}
console.log(
  '\nThe webhook will stamp founding_member_started_at on the resulting subscription.updated,\n' +
    'and schedule the lifetime 25%-off coupon ~11 months out. Confirm with:\n' +
    `  make diagnose-user EMAIL=${user.email}`,
);
