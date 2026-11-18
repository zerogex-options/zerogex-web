#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/setup-black-friday.mts \
//     [--dry-run | --yes | --verify] [--start-at <ISO|none>] [--end-at <ISO>] [--coupon-id <id>]
// or from the repo root: make setup-black-friday [YES=1 | VERIFY=1]
//
// The Stripe side of the Black Friday 2026 sale. The offer and its rules are
// core/blackFridaySale.ts; the operator steps are docs/black-friday-2026-runbook.md.
//
//   • THE COUPON: 50% off, repeating for 12 months, under a fixed id so a re-run
//     reuses it. One coupon serves all six plans: a repeating coupon discounts
//     every invoice in its first 12 months whatever the billing period, so that
//     is twelve monthly payments, four quarterly payments or the first annual
//     payment.
//
// It prints the .env.local lines to paste (the coupon and the window). It never
// edits .env.local, never changes or deletes an existing Stripe object, and
// never touches a customer or a subscription. Nothing is sold at the sale price
// until the lines are in .env.local, the app has restarted, and the window is
// open, so it is safe to run at any time.
//
// MODES
//   --dry-run  (default) Read-only: what --yes would create, and the lines.
//   --yes      Creates the coupon if it is missing (only when the dry run is
//              clean), then prints the lines.
//   --verify   Read-only check of the LIVE configuration in .env.local; exits 1
//              on any problem: the coupon against the advertised 50% off for 12
//              months and against every plan's product, the window, and whether
//              the sale is scheduled, open or over. Run it after pasting the
//              lines and restarting.
//
// WHY THE COUPON HAS NO redeem_by
//   The window is the clock (core/stripe.ts isBlackFridayOpen): checkout stops
//   attaching the coupon the moment BLACK_FRIDAY_END_AT passes. A redeem_by on
//   the coupon would be a second clock, and if it ran out first, every sale
//   checkout would fail until someone noticed.

import Stripe from 'stripe';

import { loadEnvLocal } from './env-local.mts';
import {
  BILLABLE_TIERS,
  BILLING_CADENCES,
  LIST_PRICE_USD,
  parseTrialPlans,
  planHasFreeTrial,
  type BillableTier,
} from '../core/billingPlans.ts';
import {
  BLACK_FRIDAY_SALE,
  formatSaleDeadline,
  isSaleWindowOpen,
  parseSaleWindow,
  salePayments,
  salePriceUsd,
} from '../core/blackFridaySale.ts';

type Mode = 'dry-run' | 'yes' | 'verify';
type Args = { mode: Mode; startAt: string; endAt: string; couponId: string; help: boolean };

// 12:00 AM on Thursday, November 19 in New York (EST is UTC-5), to the end of
// Tuesday, December 1. Opened early: the plan was Black Friday, November 27,
// until a customer asked on the 18th. The end is the last second of December
// 1, so the page reads "Ends Tuesday, December 1".
const DEFAULT_START_AT = '2026-11-19T05:00:00Z';
const DEFAULT_END_AT = '2026-12-02T04:59:59Z';

// Fixed identifier: what makes --yes idempotent.
const DEFAULT_COUPON_ID = 'ZGX_BLACK_FRIDAY_2026_50_OFF_12M';
// Customer-facing: Stripe prints a coupon's name on checkout and on invoices.
const COUPON_NAME = `Black Friday: ${BLACK_FRIDAY_SALE.percentOff}% off your first year`;

const COUPON_KEY = 'STRIPE_COUPON_BLACK_FRIDAY';
const START_KEY = 'BLACK_FRIDAY_START_AT';
const END_KEY = 'BLACK_FRIDAY_END_AT';

// Same pin as core/stripe.ts, so the objects read here have the shapes the app sees.
const STRIPE_API_VERSION = '2025-02-24.acacia';

const TIER_LABEL: Record<BillableTier, string> = { basic: 'Basic', pro: 'Pro' };

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: 'dry-run',
    startAt: DEFAULT_START_AT,
    endAt: DEFAULT_END_AT,
    couponId: DEFAULT_COUPON_ID,
    help: false,
  };
  const modes = new Set<Mode>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') modes.add('dry-run');
    else if (arg === '--yes' || arg === '-y') modes.add('yes');
    else if (arg === '--verify') modes.add('verify');
    else if (arg === '--start-at') args.startAt = (argv[++i] ?? '').trim();
    else if (arg === '--end-at') args.endAt = (argv[++i] ?? '').trim();
    else if (arg === '--coupon-id') args.couponId = (argv[++i] ?? '').trim();
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  if (modes.size > 1) {
    console.error('Error: --dry-run, --yes and --verify are mutually exclusive.');
    process.exit(1);
  }
  args.mode = [...modes][0] ?? 'dry-run';
  if (!args.couponId) {
    console.error('Error: --coupon-id needs a value.');
    process.exit(1);
  }
  if (args.startAt.toLowerCase() === 'none') args.startAt = '';
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/setup-black-friday.mts \\
    [--dry-run | --yes | --verify] [--start-at <ISO|none>] [--end-at <ISO>] [--coupon-id <id>]

Creates the Black Friday coupon (${BLACK_FRIDAY_SALE.percentOff}% off, repeating for ${BLACK_FRIDAY_SALE.months} months) and prints the
.env.local lines. Never edits .env.local or any existing Stripe object.

      --dry-run            Read-only preview (the default).
  -y, --yes                Create the coupon if it is missing, then print the lines.
      --verify             Read-only check of the live configuration; exits 1 on
                           any problem.
      --start-at <ISO>     When the sale opens (default ${DEFAULT_START_AT}, 12:00 AM
                           ET on Thursday, November 19). "none" opens it as soon
                           as the app restarts with the lines in place.
      --end-at <ISO>       When it closes (default ${DEFAULT_END_AT}, the end
                           of Tuesday, December 1 in New York).
      --coupon-id <id>     The coupon's id (default ${DEFAULT_COUPON_ID}).
  -h, --help               Show this help.

Reads STRIPE_SECRET_KEY, STRIPE_PRICE_BASIC_MONTHLY, STRIPE_PRICE_PRO_MONTHLY,
${COUPON_KEY}, ${START_KEY}, ${END_KEY}, PROMO_END_AT and BILLING_TRIAL_PLANS
from the environment or .env.local.`);
}

// ---------------------------------------------------------------------------
// Output and formatting
// ---------------------------------------------------------------------------

let problemCount = 0;
let warningCount = 0;

function heading(title: string) {
  console.log(`\n${title}`);
}
function ok(message: string) {
  console.log(`  ✓ ${message}`);
}
function plan(message: string) {
  console.log(`  + ${message}`);
}
function note(message: string) {
  console.log(`    ${message}`);
}
function warn(message: string) {
  warningCount += 1;
  console.log(`  ! ${message}`);
}
function problem(message: string) {
  problemCount += 1;
  console.log(`  ✗ ${message}`);
}

function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function newYorkTime(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(ms));
}

// The New York wall-clock time of an instant, "23:59:59".
function newYorkClock(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isMissing(err: unknown): boolean {
  const e = err as { code?: string; statusCode?: number } | null;
  return e?.code === 'resource_missing' || e?.statusCode === 404;
}

// An env value, blank counting as unset (deploy/steps/036.billing seeds KEY=).
function env(key: string): string | null {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Stripe reads and the checks every mode shares
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

loadEnvLocal();

const secretKey = env('STRIPE_SECRET_KEY');
if (!secretKey) {
  console.error('Error: STRIPE_SECRET_KEY is not set in the environment or .env.local.');
  process.exit(1);
}
const liveMode = /^(sk|rk)_live_/.test(secretKey);
const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

async function retrieveCoupon(id: string): Promise<Stripe.Coupon | null> {
  try {
    return await stripe.coupons.retrieve(id, { expand: ['applies_to'] });
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

// The product behind each tier, from its monthly price: each tier is one Stripe
// product with all its billing periods under it, so these two cover all six
// plans. A tier whose price could not be read is left out (and reported).
async function tierProducts(): Promise<Map<BillableTier, string>> {
  const out = new Map<BillableTier, string>();
  for (const tier of BILLABLE_TIERS) {
    const key = `STRIPE_PRICE_${tier.toUpperCase()}_MONTHLY`;
    const id = env(key);
    if (!id) {
      warn(`${key} is not set, so the coupon cannot be checked against the ${TIER_LABEL[tier]} product.`);
      continue;
    }
    try {
      const price = await stripe.prices.retrieve(id, { expand: ['product'] });
      const product = price.product;
      const productId = typeof product === 'string' ? product : product.id;
      const name = typeof product === 'string' ? product : product.deleted ? `${product.id} (deleted)` : product.name;
      out.set(tier, productId);
      ok(`${TIER_LABEL[tier]}: product "${name}" [${productId}]`);
    } catch (err) {
      warn(`${key}=${id} could not be read (${errorMessage(err)}), so the coupon cannot be checked against it.`);
    }
  }
  return out;
}

// Everything that must hold for this coupon to charge exactly the sale prices
// the pricing page shows, on every plan, until the window closes.
function couponFindings(
  coupon: Stripe.Coupon,
  products: Map<BillableTier, string>,
  endMs: number | null,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const want = BLACK_FRIDAY_SALE.percentOff;
  if (!coupon.valid) errors.push('is no longer valid (expired or used up), so every sale checkout would fail');
  if (coupon.percent_off == null) {
    errors.push(`takes a fixed ${usd((coupon.amount_off ?? 0) / 100)} off, but the page advertises ${want}% off`);
  } else if (coupon.percent_off !== want) {
    errors.push(`takes ${coupon.percent_off}% off, but the page advertises ${want}% off`);
  }
  if (coupon.duration !== 'repeating' || coupon.duration_in_months !== BLACK_FRIDAY_SALE.months) {
    const lasts =
      coupon.duration === 'repeating'
        ? `${coupon.duration_in_months} months`
        : coupon.duration === 'once'
          ? 'one invoice'
          : 'forever';
    errors.push(`lasts ${lasts}, but the page advertises the first ${BLACK_FRIDAY_SALE.months} months`);
  }
  if (coupon.redeem_by != null) {
    const redeemByMs = coupon.redeem_by * 1000;
    if (endMs != null && redeemByMs < endMs) {
      errors.push(
        `stops being redeemable at ${newYorkTime(redeemByMs)}, before the sale ends, so sale checkouts would fail in between`,
      );
    } else {
      warnings.push(`has a redeem-by date (${newYorkTime(redeemByMs)}). Harmless after the sale, but the window alone ends it`);
    }
  }
  if (coupon.max_redemptions != null) {
    if (coupon.times_redeemed >= coupon.max_redemptions) {
      errors.push(`is fully redeemed (${coupon.times_redeemed} of ${coupon.max_redemptions})`);
    } else {
      warnings.push(
        `is capped at ${coupon.max_redemptions} redemptions (${coupon.times_redeemed} used); sale checkouts fail once the cap is reached`,
      );
    }
  }
  const limitedTo = coupon.applies_to?.products ?? [];
  if (limitedTo.length > 0) {
    for (const [tier, productId] of products) {
      if (!limitedTo.includes(productId)) {
        errors.push(`does not apply to the ${TIER_LABEL[tier]} product (${productId}), so those plans would be charged full price`);
      }
    }
  }
  return { errors, warnings };
}

function printSalePrices() {
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      const sku = { tier, cadence };
      const payments = salePayments(sku);
      note(
        `${TIER_LABEL[tier]} ${cadence}: ${usd(LIST_PRICE_USD[tier][cadence])} → ${usd(salePriceUsd(sku))} ` +
          `for the first ${payments === 1 ? 'payment' : `${payments} payments`}`,
      );
    }
  }
}

// The window's own problems, and how the page and checkout will treat it now.
function checkWindow(startAt: string, endAt: string, label: { start: string; end: string }): number | null {
  const saleWindow = parseSaleWindow(startAt, endAt);
  if (!saleWindow) {
    if (!endAt) problem(`${label.end} is not set: the sale is off.`);
    else if (!Number.isFinite(Date.parse(endAt))) problem(`${label.end}="${endAt}" is not a valid ISO timestamp, so the sale is off.`);
    else if (startAt && !Number.isFinite(Date.parse(startAt))) {
      problem(`${label.start}="${startAt}" is not a valid ISO timestamp, so the sale is off.`);
    } else problem(`${label.start} is not before ${label.end}, so the sale is off.`);
    return null;
  }
  const now = Date.now();
  if (saleWindow.startMs != null) note(`Opens:  ${newYorkTime(saleWindow.startMs)}`);
  else note('Opens:  as soon as the app restarts with these lines (no start set)');
  note(`Closes: ${newYorkTime(saleWindow.endMs)}`);
  note(`The page says: "Ends ${formatSaleDeadline(saleWindow.endMs)}"`);
  const closesAt = newYorkClock(saleWindow.endMs);
  if (closesAt !== '23:59:59' && closesAt !== '00:00:00') {
    warn(
      `The sale closes at ${closesAt} New York time, not at the end of the day the page names. ` +
        'For the end of a day in New York in December use T04:59:59Z on the next date (EST is UTC-5).',
    );
  }
  if (saleWindow.endMs <= now) {
    warn('That end has already passed: the sale is over, and checkout sells at regular prices.');
  } else if (!isSaleWindowOpen(saleWindow, now)) {
    const hours = Math.round(((saleWindow.startMs ?? now) - now) / 3_600_000);
    ok(`Scheduled: opens in about ${hours} hour(s). Until then the page and checkout show regular prices.`);
  } else {
    ok('Open now: with the coupon set, the page shows the sale and checkout applies it.');
  }
  return saleWindow.endMs;
}

// ---------------------------------------------------------------------------
// --dry-run / --yes
// ---------------------------------------------------------------------------

async function runSetup(apply: boolean): Promise<number> {
  console.log(`setup-black-friday: ${apply ? 'CREATE' : 'dry run (read-only)'}, Stripe ${liveMode ? 'LIVE' : 'test'} mode`);

  heading('Products (from the monthly prices)');
  const products = await tierProducts();

  heading('Window');
  const endMs = checkWindow(args.startAt, args.endAt, { start: '--start-at', end: '--end-at' });

  heading(`Coupon ${args.couponId}`);
  const existing = await retrieveCoupon(args.couponId);
  let couponReady = false;
  if (existing) {
    const { errors, warnings } = couponFindings(existing, products, endMs);
    for (const message of errors) problem(`The existing coupon ${message}.`);
    for (const message of warnings) warn(`The existing coupon ${message}.`);
    if (errors.length === 0) {
      ok(`Already exists and matches: ${existing.percent_off}% off for ${existing.duration_in_months} months ("${existing.name ?? existing.id}").`);
      couponReady = true;
    } else {
      note('Stripe coupons cannot be edited. Pass --coupon-id <new id> to create a fresh one.');
    }
  } else {
    plan(
      `${apply ? 'Creating' : 'Would create'} coupon ${args.couponId}: ${BLACK_FRIDAY_SALE.percentOff}% off, repeating for ` +
        `${BLACK_FRIDAY_SALE.months} months, no product limit, no redemption cap, no redeem-by date, named "${COUPON_NAME}".`,
    );
  }

  heading('What each plan costs at the sale price');
  printSalePrices();

  if (problemCount > 0) {
    console.log(`\n${problemCount} problem(s). Nothing was created. Fix them and re-run.`);
    return 1;
  }

  if (!existing && apply) {
    const created = await stripe.coupons.create({
      id: args.couponId,
      percent_off: BLACK_FRIDAY_SALE.percentOff,
      duration: 'repeating',
      duration_in_months: BLACK_FRIDAY_SALE.months,
      name: COUPON_NAME,
      metadata: { purpose: 'black_friday_2026' },
    });
    ok(`Created coupon ${created.id}.`);
    couponReady = true;
  }

  heading('.env.local lines');
  console.log(`\n${COUPON_KEY}=${args.couponId}`);
  console.log(`${START_KEY}=${args.startAt}`);
  console.log(`${END_KEY}=${args.endAt}\n`);
  if (!couponReady) {
    note('This was a dry run and the coupon does not exist yet: run again with YES=1 to create it first.');
  } else {
    note('Paste these into frontend/.env.local, replacing any existing line for the same key, then:');
    note('  make restart                     (env is read at start-up; no rebuild needed)');
    note('  make setup-black-friday VERIFY=1 (must end "no problems")');
  }
  return 0;
}

// ---------------------------------------------------------------------------
// --verify
// ---------------------------------------------------------------------------

async function runVerify(): Promise<number> {
  console.log(`setup-black-friday: verify (read-only), Stripe ${liveMode ? 'LIVE' : 'test'} mode`);

  heading('Products (from the monthly prices)');
  const products = await tierProducts();

  heading(`Window (${START_KEY} / ${END_KEY})`);
  const endMs = checkWindow(env(START_KEY) ?? '', env(END_KEY) ?? '', { start: START_KEY, end: END_KEY });

  heading(`Coupon (${COUPON_KEY})`);
  const couponId = env(COUPON_KEY);
  if (!couponId) {
    problem(`${COUPON_KEY} is not set: the sale is off whatever the window says.`);
  } else {
    const coupon = await retrieveCoupon(couponId);
    if (!coupon) {
      problem(`${COUPON_KEY}=${couponId} does not exist in this Stripe account (${liveMode ? 'live' : 'test'} mode).`);
    } else {
      const { errors, warnings } = couponFindings(coupon, products, endMs);
      for (const message of errors) problem(`${couponId} ${message}.`);
      for (const message of warnings) warn(`${couponId} ${message}.`);
      if (errors.length === 0) {
        ok(`${couponId}: ${coupon.percent_off}% off for ${coupon.duration_in_months} months, redeemed ${coupon.times_redeemed} time(s).`);
      }
    }
  }

  heading('Other offers');
  const promoEnd = Date.parse(env('PROMO_END_AT') ?? '');
  if (Number.isFinite(promoEnd) && promoEnd > Date.now() && endMs != null && endMs > Date.now()) {
    warn(
      'The $10-off monthly promo (PROMO_END_AT) is open too. The page shows the sale in its place, but a Basic ' +
        'monthly free trial would still get the promo. Close one of them.',
    );
  } else {
    ok('No public promo is open alongside the sale.');
  }
  const trialPlans = parseTrialPlans(process.env.BILLING_TRIAL_PLANS);
  const trialing = BILLABLE_TIERS.flatMap((tier) =>
    BILLING_CADENCES.filter((cadence) => planHasFreeTrial({ tier, cadence }, trialPlans)).map(
      (cadence) => `${TIER_LABEL[tier]} ${cadence}`,
    ),
  );
  ok(
    trialing.length === 0
      ? 'No plan has a free trial: every plan sells at the sale price, paid today.'
      : `Plans with a free trial (${trialing.join(', ')}) offer the choice: the sale price paid today, or the free trial at the regular price.`,
  );

  heading('What each plan costs at the sale price');
  printSalePrices();

  console.log(
    `\n${problemCount === 0 ? 'Verify: no problems' : `Verify: ${problemCount} problem(s)`}` +
      `${warningCount > 0 ? `, ${warningCount} warning(s)` : ''}.`,
  );
  return problemCount > 0 ? 1 : 0;
}

try {
  const exitCode = args.mode === 'verify' ? await runVerify() : await runSetup(args.mode === 'yes');
  process.exit(exitCode);
} catch (err) {
  console.error(`\nError: ${errorMessage(err)}`);
  process.exit(1);
}
