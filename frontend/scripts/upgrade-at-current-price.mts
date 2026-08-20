#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/upgrade-at-current-price.mts \
//     --email <addr> [--tier pro] [--current-price <dollars>] [--coupon <id>] \
//     [--dry-run | --yes]
//
// Move ONE paying member up a tier while LEAVING THEIR BILL EXACTLY WHERE IT IS
// -- "you're paying for Basic, I'm giving you Pro at the price you already pay."
// A goodwill upgrade, not a comp: the member keeps paying, you just stop
// charging them more for the better tier. (For an actual freebie -- no
// subscription at all -- use `make comp-member`.)
//
// WHY THIS IS NOT JUST A TIER FLIP -- the tier column is not the source of
// truth. priceIdToTier() (core/stripe.ts) derives the tier from the Stripe
// PRICE, and every subscription sync recomputes it (the webhook's `nextTier`).
// Nothing reads the subscription's metadata.tier. So writing tier='pro' by hand
// holds only until the member's next renewal, which silently puts them back.
//
// The durable move works WITH that reconciler instead of against it: switch the
// subscription onto the target tier's price, then discount it back down to what
// they pay today. The webhook then grants the tier on its own -- this script
// never writes the tier column at all.
//
// What it does, in order:
//   1. Read the member's live subscription and work out what they ACTUALLY pay
//      per period, from the upcoming-invoice preview (i.e. after every discount
//      already on the sub -- not the list price). Override with --current-price
//      if the preview is unrepresentative (mid-period proration, etc.).
//   2. Resolve the target tier's price for the SAME cadence they're already on.
//   3. Mint a forever amount_off coupon for the difference, so the new price
//      lands on their existing rate to the cent. amount_off, not percent_off:
//      a percentage re-derived against a different list price drifts.
//   4. Switch the subscription item onto the target price with
//      proration_behavior='none', so the member is not charged anything today
//      and keeps the period they have already paid for. Discounts are NOT set
//      in that same update -- see below.
//   5. Wait for the webhook to sync the new tier AND for
//      maybeReconcileDiscountOnPlanSwitch to settle, then apply the hold-steady
//      coupon as the LAST write, and verify the next invoice from Stripe after
//      a settle delay.
//
// ORDERING, THE HARD-WON PART: a price switch makes the webhook run
// maybeReconcileDiscountOnPlanSwitch (app/api/webhooks/stripe/route.ts), which
// normalizes the subscription's discounts to the managed coupon for the NEW
// tier/cadence -- the public promo, or the founding intro. Applying the
// hold-steady coupon in the same update as the price switch therefore loses a
// race: the reconciler lands afterwards and the member ends up on the standard
// promo rate, not the rate they were promised. Verifying right after the switch
// reads the pre-reconcile figure and reports a success that is about to stop
// being true. So the coupon goes on LAST, after the reconciler has run, and the
// verification happens after a settle delay.
//
// Because the reconciler only fires on a real switch (a prior synced price that
// differs from the new one), the hold-steady coupon is stable once applied:
// later syncs see the same price on both sides and no-op. Switching the member's
// plan AGAIN later re-runs the reconciler and clobbers the held rate -- re-run
// this script in repair mode afterwards.
//
// REPAIR MODE: if the member is already on the target price, the switch is
// skipped and only the discount is repaired. That case requires an explicit
// --current-price, because the live preview then reflects whatever rate they are
// wrongly on -- reading it back would cement the mistake.
//
// No refund, no cancellation, no immediate charge. Sends NO email: the paid
// welcome is CAS-guarded on paid_welcome_email_sent_at, which an existing payer
// already has set, so nothing fires -- tell the member yourself.
//
// Reads STRIPE_SECRET_KEY and STRIPE_PRICE_<TIER>_<CADENCE> from env or
// .env.local. Set AUTH_DB_PATH to override the default DB path.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import { couponResultCents, holdSteadyDiscountCents } from '../core/holdRate.ts';

const AUDIT_TYPE = 'billing_tier_upgraded_at_current_price';
const VALID_TIERS = ['basic', 'pro'];
const DEFAULT_WAIT_SECONDS = 120;
const POLL_INTERVAL_MS = 3000;
// Breathing room for the webhook's discount reconciler to finish after a price
// switch, before we write the hold-steady coupon over its decision.
const RECONCILER_SETTLE_MS = 8000;
// Delay before reading the next invoice back, so a late reconcile shows up in
// our verification instead of in the member's next bill.
const VERIFY_SETTLE_MS = 8000;

type Cadence = 'monthly' | 'annual';

type Args = {
  email: string | null;
  tier: string;
  currentPrice: number | null;
  coupon: string | null;
  waitSeconds: number;
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
    tier: 'pro',
    currentPrice: null,
    coupon: null,
    waitSeconds: DEFAULT_WAIT_SECONDS,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--tier') args.tier = (argv[++i] ?? '').trim().toLowerCase();
    else if (arg === '--current-price') args.currentPrice = Number(argv[++i]);
    else if (arg === '--coupon') args.coupon = (argv[++i] ?? '').trim() || null;
    else if (arg === '--wait-seconds') args.waitSeconds = Number(argv[++i]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/upgrade-at-current-price.mts \\
    --email <addr> [--tier pro] [--current-price <dollars>] [--coupon <id>] \\
    [--dry-run | --yes]

Moves a paying member up a tier while keeping their bill exactly where it is.
Switches the subscription onto the target tier's price and discounts it back
down to what they already pay, so the Stripe webhook grants the tier itself.

Options:
      --email <addr>        Member to upgrade (required).
      --tier <tier>         Target tier: ${VALID_TIERS.join(' | ')} (default: pro).
      --current-price <n>   Override the detected rate, in dollars (e.g. 19).
                            Use when the upcoming-invoice preview isn't a
                            representative full period.
      --coupon <id>         Reuse an existing Stripe coupon instead of minting
                            one. Must be duration=forever and land on the
                            intended rate; the script verifies the resulting
                            amount before writing.
      --wait-seconds <n>    How long to wait for the webhook to sync the tier
                            (default: ${DEFAULT_WAIT_SECONDS}).
      --dry-run             Print the plan; no Stripe or DB writes.
  -y, --yes                 Apply.
  -h, --help                Show this help.

No refund, no cancellation, no charge today (proration_behavior=none). Sends NO
email. Reads STRIPE_SECRET_KEY and STRIPE_PRICE_<TIER>_<CADENCE> from env or
.env.local; set AUTH_DB_PATH to override the default DB path (data/auth.db).`);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
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
if (!VALID_TIERS.includes(cliArgs.tier)) {
  console.error(`Error: invalid --tier "${cliArgs.tier}". Expected one of: ${VALID_TIERS.join(', ')}.`);
  process.exit(1);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (cliArgs.currentPrice !== null && (!Number.isFinite(cliArgs.currentPrice) || cliArgs.currentPrice < 0)) {
  console.error('Error: --current-price must be a non-negative number of dollars.');
  process.exit(1);
}
if (!Number.isFinite(cliArgs.waitSeconds) || cliArgs.waitSeconds < 0) {
  console.error('Error: --wait-seconds must be a non-negative number.');
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
};

function loadUser(): UserRow {
  const rows = querySqlite<UserRow>(
    dbPath,
    `SELECT id, email, tier, subscription_status, stripe_customer_id, stripe_subscription_id
     FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email as string)}' LIMIT 1;`,
  );
  const found = rows[0];
  if (!found) {
    console.error(`Error: no user found with email ${cliArgs.email}.`);
    process.exit(1);
  }
  return found;
}

const user = loadUser();

if (!user.stripe_subscription_id) {
  console.error(`Error: ${user.email} has no Stripe subscription — there is no bill to hold steady.`);
  console.error('For a member with no subscription, an outright comp is the right tool:');
  console.error(`  make comp-member EMAIL=${user.email} TIER=${cliArgs.tier} YES=1`);
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
    expand: ['items.data.price'],
  });
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve subscription ${user.stripe_subscription_id}: ${message}`);
  process.exit(1);
}

if (subscription.status !== 'active' && subscription.status !== 'trialing') {
  console.error(
    `Error: subscription ${subscription.id} is '${subscription.status}'. Only an active or trialing sub can be moved.`,
  );
  process.exit(1);
}

const item = subscription.items?.data?.[0];
if (!item?.price) {
  console.error(`Error: subscription ${subscription.id} has no price item to switch.`);
  process.exit(1);
}
if (subscription.items.data.length > 1) {
  console.error(
    `Error: subscription ${subscription.id} has ${subscription.items.data.length} items; this script only handles a single-item sub.`,
  );
  process.exit(1);
}

const currentPrice = item.price;
const currency = currentPrice.currency ?? 'usd';
const interval = currentPrice.recurring?.interval ?? null;
if (interval !== 'month' && interval !== 'year') {
  console.error(`Error: unsupported billing interval '${interval ?? 'none'}'.`);
  process.exit(1);
}
const cadence: Cadence = interval === 'month' ? 'monthly' : 'annual';

// Target price for the SAME cadence — an upgrade must not silently move the
// member between monthly and annual billing.
const targetPriceEnvKey = `STRIPE_PRICE_${cliArgs.tier.toUpperCase()}_${cadence === 'monthly' ? 'MONTHLY' : 'ANNUAL'}`;
const targetPriceId = envOrLocal(targetPriceEnvKey);
if (!targetPriceId) {
  console.error(`Error: ${targetPriceEnvKey} is not set in env or .env.local.`);
  process.exit(1);
}
// Already on the target price: the plan switch is done (or was never needed) and
// only the discount needs putting right. This is the state a switch lands in
// when the discount reconciler has replaced the held rate with the standard promo.
const repairOnly = targetPriceId === currentPrice.id;
if (repairOnly && cliArgs.currentPrice === null) {
  console.error(`Error: ${user.email} is already on the ${cliArgs.tier} ${cadence} price (repair mode).`);
  console.error('The live preview reflects whatever rate they are currently on, so it cannot be trusted');
  console.error('as the rate to hold — reading it back would cement the wrong figure. State it explicitly:');
  console.error(`  make upgrade-at-current-price EMAIL=${user.email} CURRENT_PRICE=<dollars> YES=1`);
  process.exit(1);
}

let targetPrice: Stripe.Price;
try {
  targetPrice = await stripe.prices.retrieve(targetPriceId);
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not retrieve target price ${targetPriceId}: ${message}`);
  process.exit(1);
}
const targetListCents = targetPrice.unit_amount;
if (typeof targetListCents !== 'number') {
  console.error(`Error: target price ${targetPriceId} has no unit_amount (metered or tiered pricing is unsupported).`);
  process.exit(1);
}
if (targetPrice.currency !== currency) {
  console.error(`Error: currency mismatch — current sub is ${currency}, target price is ${targetPrice.currency}.`);
  process.exit(1);
}

// What they ACTUALLY pay per period today: the upcoming-invoice preview, which
// is net of every discount already on the subscription. The list price is the
// wrong number to hold steady — a discounted member would get a stealth rise.
let detectedCents: number | null = null;
let detectionNote = '';
try {
  const upcoming = await stripe.invoices.retrieveUpcoming({
    customer: user.stripe_customer_id as string,
    subscription: subscription.id,
  });
  detectedCents = upcoming.amount_due;
  detectionNote = 'from upcoming-invoice preview (net of discounts)';
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  detectionNote = `preview unavailable (${message})`;
}

const currentEffectiveCents =
  cliArgs.currentPrice !== null ? Math.round(cliArgs.currentPrice * 100) : detectedCents;

if (currentEffectiveCents === null) {
  console.error('Error: could not determine what this member currently pays.');
  console.error(`  ${detectionNote}`);
  console.error('Re-run with --current-price <dollars> to state it explicitly.');
  process.exit(1);
}
if (cliArgs.currentPrice !== null) {
  detectionNote = 'supplied via --current-price';
}

const discountCents = holdSteadyDiscountCents(targetListCents, currentEffectiveCents);
const existingDiscounts = (subscription.discounts ?? []) as unknown[];

console.log(`Auth DB:            ${dbPath}`);
console.log(`Member:             ${user.email} (id=${user.id})`);
console.log(`Tier (DB):          ${user.tier ?? '—'}  →  ${cliArgs.tier} (granted by the webhook, not written here)`);
console.log(`Subscription:       ${subscription.id} (${subscription.status}, ${cadence})`);
console.log(
  `Current price:      ${currentPrice.id} — list ${formatCents(currentPrice.unit_amount ?? 0, currency)}`,
);
console.log(`Currently pays:     ${formatCents(currentEffectiveCents, currency)}  [${detectionNote}]`);
console.log(`Existing discounts: ${existingDiscounts.length ? `${existingDiscounts.length} (will be REPLACED)` : 'none'}`);
console.log(`Target price:       ${targetPriceId} — list ${formatCents(targetListCents, currency)}`);

if (discountCents < 0) {
  console.error(
    `\nError: ${cliArgs.tier} lists at ${formatCents(targetListCents, currency)}, which is BELOW what they pay today ` +
      `(${formatCents(currentEffectiveCents, currency)}). Holding their rate steady would mean charging them MORE than the tier costs.`,
  );
  console.error('Switch them to the target price directly instead of using this script.');
  process.exit(1);
}

console.log(
  `Hold-steady coupon: ${
    discountCents === 0
      ? 'none needed — target list already equals their rate'
      : `${formatCents(discountCents, currency)} off, forever`
  }`,
);
console.log(`Charge today:       none (proration_behavior=none; keeps the period already paid for)`);
console.log(`Next invoice:       ${formatCents(currentEffectiveCents, currency)} — unchanged`);

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No Stripe or DB writes.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

// --- Apply -----------------------------------------------------------------

// 1. Resolve the coupon that holds the rate steady. amount_off (not percent_off)
//    so the result lands on their existing rate to the cent.
let couponId: string | null = null;
if (discountCents > 0) {
  if (cliArgs.coupon) {
    let existing: Stripe.Coupon;
    try {
      existing = await stripe.coupons.retrieve(cliArgs.coupon);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`Error: could not retrieve coupon ${cliArgs.coupon}: ${message}`);
      process.exit(1);
    }
    // Verify the supplied coupon actually lands on the intended rate before it
    // touches a live subscription — a mis-sized reuse is a silent overcharge.
    const resultCents = couponResultCents(existing, targetListCents);
    if (existing.duration !== 'forever') {
      console.error(`Error: coupon ${existing.id} has duration='${existing.duration}'; the rate must hold forever.`);
      process.exit(1);
    }
    if (resultCents === null || resultCents !== currentEffectiveCents) {
      console.error(
        `Error: coupon ${existing.id} would land on ${
          resultCents === null ? 'an indeterminate amount' : formatCents(resultCents, currency)
        }, not ${formatCents(currentEffectiveCents, currency)}.`,
      );
      process.exit(1);
    }
    couponId = existing.id;
    console.log(`\nUsing coupon ${couponId}.`);
  } else {
    try {
      const created = await stripe.coupons.create({
        amount_off: discountCents,
        currency,
        duration: 'forever',
        name: `${cliArgs.tier} at legacy rate (${formatCents(currentEffectiveCents, currency)})`,
        metadata: {
          reason: 'upgrade_at_current_price',
          user_id: user.id,
          held_rate_cents: String(currentEffectiveCents),
        },
      });
      couponId = created.id;
      console.log(`\nCreated coupon ${couponId} — ${formatCents(discountCents, currency)} off, forever.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`\nError: could not create the hold-steady coupon: ${message}`);
      console.error('No changes were made to the subscription.');
      process.exit(1);
    }
  }
}

// 2. Switch the item onto the target price. Deliberately does NOT set discounts:
//    the switch triggers the webhook's discount reconciler, which would land
//    after us and overwrite whatever we set here with the managed promo for the
//    new tier. The hold-steady coupon goes on in step 4, once that has run.
//    proration_behavior='none' means no charge today and no credit — the member
//    simply keeps the period already paid for.
if (!repairOnly) {
  try {
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: targetPriceId }],
      proration_behavior: 'none',
      metadata: { ...(subscription.metadata ?? {}), tier: cliArgs.tier, cadence },
    });
    console.log(`Subscription ${updated.id} switched to ${targetPriceId} (status '${updated.status}').`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`\nError: subscription update failed: ${message}`);
    if (couponId && !cliArgs.coupon) {
      console.error(`The coupon ${couponId} was created but is unused — delete it in Stripe if you do not retry.`);
    }
    console.error('The subscription is unchanged; the member is still on their old plan.');
    process.exit(1);
  }

  // 3. Wait for the webhook to grant the tier. We never write the tier column —
  //    letting the reconciler own it is what makes this survive renewals.
  const deadline = Date.now() + cliArgs.waitSeconds * 1000;
  let synced = false;
  process.stdout.write(`Waiting up to ${cliArgs.waitSeconds}s for the webhook to grant '${cliArgs.tier}'`);
  while (Date.now() < deadline) {
    if (loadUser().tier === cliArgs.tier) {
      synced = true;
      break;
    }
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
  process.stdout.write('\n');
  if (!synced) {
    console.error(`\nThe price switch landed but the row still reads '${loadUser().tier ?? '—'}'.`);
    console.error('Not applying the hold-steady coupon while the webhook is behind — it would race the');
    console.error('discount reconciler. Once the tier syncs, repair the rate with:');
    console.error(
      `  make upgrade-at-current-price EMAIL=${user.email} TIER=${cliArgs.tier} CURRENT_PRICE=${(currentEffectiveCents / 100).toFixed(2)} YES=1`,
    );
    process.exit(1);
  }

  // Give the discount reconciler its turn. It runs in the same webhook pass as
  // the tier sync, so it is typically already done; the extra settle covers a
  // slower delivery. Applying our coupon before it runs is precisely the race
  // that silently puts the member on the standard promo rate instead.
  console.log(`Letting the discount reconciler settle (${Math.round(RECONCILER_SETTLE_MS / 1000)}s)...`);
  await sleep(RECONCILER_SETTLE_MS);
}

// 4. Apply the hold-steady coupon as the LAST write, replacing whatever the
//    reconciler decided. Any pre-existing coupon was sized against a different
//    list price, so this replaces rather than stacks.
async function applyHoldCoupon(): Promise<void> {
  await stripe.subscriptions.update(subscription.id, {
    discounts: couponId ? [{ coupon: couponId }] : [],
  });
}

try {
  await applyHoldCoupon();
  console.log(
    couponId
      ? `Applied hold-steady coupon ${couponId} (replacing any reconciled discount).`
      : 'Cleared discounts — target list already equals their rate.',
  );
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: could not apply the hold-steady discount: ${message}`);
  console.error(`The member is on ${cliArgs.tier} but NOT at the intended rate. Fix this in Stripe now.`);
  process.exit(1);
}

// 5. Verify from Stripe AFTER a settle delay, so anything landing behind us
//    shows up here rather than in the member's next invoice. One retry, because
//    a late reconciler pass is recoverable; a second miss is not something to
//    paper over.
async function previewCents(): Promise<number | null> {
  try {
    const preview = await stripe.invoices.retrieveUpcoming({
      customer: user.stripe_customer_id as string,
      subscription: subscription.id,
    });
    return preview.amount_due;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Warning: could not preview the next invoice (${message}).`);
    return null;
  }
}

await sleep(VERIFY_SETTLE_MS);
let finalCents = await previewCents();
if (finalCents !== null && finalCents !== currentEffectiveCents) {
  console.error(
    `Next invoice reads ${formatCents(finalCents, currency)}, expected ${formatCents(currentEffectiveCents, currency)} — something reconciled behind us. Re-applying once...`,
  );
  try {
    await applyHoldCoupon();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Re-apply failed: ${message}`);
  }
  await sleep(VERIFY_SETTLE_MS);
  finalCents = await previewCents();
}

const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
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
     '${escapeSqlLiteral(
       `${repairOnly ? 'Repaired held rate' : `Moved to ${cliArgs.tier} (${cadence}) on price ${targetPriceId}`}` +
         `, rate held at ${formatCents(currentEffectiveCents, currency)}` +
         `${couponId ? ` via coupon ${couponId}` : ''}` +
         `${finalCents !== null ? `; next invoice ${formatCents(finalCents, currency)}` : ''}`,
     )}',
     '${escapeSqlLiteral(nowIso())}'
   );`,
);

if (finalCents === null) {
  console.error('\nCould not confirm the next invoice from Stripe. VERIFY THE AMOUNT BY HAND before telling the member.');
  process.exit(1);
}
if (finalCents !== currentEffectiveCents) {
  console.error(
    `\nFAILED: next invoice is ${formatCents(finalCents, currency)}, not ${formatCents(currentEffectiveCents, currency)}.`,
  );
  console.error('The member would be charged the wrong amount. Fix the discount in Stripe before telling them anything.');
  process.exit(1);
}

const tierNow = loadUser().tier;
console.log(
  `\nDone. ${user.email} is on '${tierNow}', next invoice ${formatCents(finalCents, currency)} / ${cadence === 'monthly' ? 'month' : 'year'} — verified after settle.`,
);
console.log('No charge today, no refund, no cancellation. Sends no email — tell the member yourself.');
