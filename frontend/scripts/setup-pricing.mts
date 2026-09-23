#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/setup-pricing.mts \
//     [--dry-run | --yes | --verify] [--promo-end-at <ISO timestamp>] [--coupon-id <id>]
// or from the repo root: make setup-pricing [YES=1 | VERIFY=1]
//
// The Stripe side of the October 2026 pricing (catalogue and policy in
// core/billingPlans.ts):
//
//   • QUARTERLY PRICES on the existing Basic and Pro products (the products the
//     monthly prices belong to): $75 and $115 every 3 months, with the monthly
//     price's tax behavior so automatic tax treats every billing period alike.
//   • THE PROMO COUPON: $10 off, repeating for 12 months. One coupon serves both
//     monthly plans (Basic $39 → $29, Pro $59 → $49). Checkout attaches it while
//     PROMO_END_AT is in the future.
//
// It prints the exact .env.local lines to paste. It never edits .env.local,
// never changes, archives or deletes an existing Stripe object, and never
// touches a customer, a subscription or the billing portal. Nothing it creates
// is sold until its id is in .env.local and the app restarts, so it is safe to
// run at any time.
//
// MODES
//   --dry-run  (default) Read-only. Finds the products and anything already
//              created, and prints what --yes would do.
//   --yes      Creates what is missing (only when the dry run is clean), then
//              prints the env lines. Idempotent: the prices carry lookup keys
//              and the coupon a fixed id, so a re-run reuses them.
//   --verify   Read-only. Checks the LIVE configuration from .env.local and
//              exits 1 on any problem: every configured price against the list
//              price the pricing page shows, the promo coupons against the
//              advertised $10 off for 12 months, the promo window, the trial
//              policy, and the billing portal (which must offer every plan and
//              nothing the app cannot map to a tier). Run it after every change
//              to billing env.
//
// ROLLOUT ORDER (docs: content/help/platform/billing.md is the member-facing
// side; this is the operator side)
//   1. make setup-pricing            review the dry run
//   2. make setup-pricing YES=1      create; paste the printed lines into .env.local
//   3. make restart                  the app reads them at start-up (no rebuild)
//   4. make setup-billing-portal YES=1
//                                    so the portal offers the quarterly plans.
//                                    AFTER the restart: the webhook maps a
//                                    subscription's price to a tier through the
//                                    same env, so a portal switch to a price the
//                                    running app does not know would drop that
//                                    member to public access.
//   5. make setup-pricing VERIFY=1   must end "no problems"
//
// WHY THE COUPON HAS NO redeem_by
//   PROMO_END_AT is the deadline (core/stripe.ts isPromoWindowOpen): checkout
//   stops attaching the coupon the moment it passes. A redeem_by on the coupon
//   would be a second clock. If it ran out first, every monthly checkout would
//   fail until someone noticed. After the window it would also break a promo
//   member's plan switch whenever Stripe is asked to re-apply the coupon
//   (core/planSwitch.ts pickSwitchPromoCoupon keeps the promo on a move between
//   the monthly plans for the member's 12 months).

import Stripe from 'stripe';

import { loadEnvLocal } from './env-local.mts';
import {
  BILLABLE_TIERS,
  BILLING_CADENCES,
  CADENCE_MONTHS,
  LIST_PRICE_USD,
  MONTHLY_PROMO,
  isPromoAdvertised,
  parseTrialPlans,
  planHasFreeTrial,
  promoPriceUsd,
  type BillableTier,
  type Sku,
} from '../core/billingPlans.ts';

type Mode = 'dry-run' | 'yes' | 'verify';
type Args = { mode: Mode; promoEndAt: string; couponId: string; help: boolean };

// The end of October 1, 2026 in New York (EDT is UTC-4): the promo is for
// signups "by Oct 1". The pricing page words it "October 1, 2026" because
// core/stripe.ts getActivePromoDeadlineLabel formats in America/New_York. Do
// not use 2026-10-02T04:00:00Z: that instant is already October 2 in New York,
// and the page would say so.
const DEFAULT_PROMO_END_AT = '2026-10-02T03:59:59Z';

// Fixed identifiers are what make --yes idempotent.
const DEFAULT_PROMO_COUPON_ID = 'ZGX_MONTHLY_10_OFF_12M';
// Customer-facing: Stripe prints a coupon's name on checkout and on invoices.
const PROMO_COUPON_NAME = `$${MONTHLY_PROMO.amountOffUsd} off your first ${MONTHLY_PROMO.months} months`;
const quarterlyLookupKey = (tier: BillableTier) => `zgx_${tier}_quarterly`;

// Same pin as core/stripe.ts, so the objects read here have the shapes the app sees.
const STRIPE_API_VERSION = '2025-02-24.acacia';
// Billing-portal reads only: trial_update_behavior is returned from 2025-09-30.
const PORTAL_READ_API_VERSION = '2025-09-30.clover';

const TIER_LABEL: Record<BillableTier, string> = { basic: 'Basic', pro: 'Pro' };

function parseArgs(argv: string[]): Args {
  const args: Args = { mode: 'dry-run', promoEndAt: DEFAULT_PROMO_END_AT, couponId: DEFAULT_PROMO_COUPON_ID, help: false };
  const modes = new Set<Mode>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') modes.add('dry-run');
    else if (arg === '--yes' || arg === '-y') modes.add('yes');
    else if (arg === '--verify') modes.add('verify');
    else if (arg === '--promo-end-at') args.promoEndAt = (argv[++i] ?? '').trim();
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
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/setup-pricing.mts \\
    [--dry-run | --yes | --verify] [--promo-end-at <ISO>] [--coupon-id <id>]

Creates the quarterly Stripe prices (Basic ${formatMinor(LIST_PRICE_USD.basic.quarterly * 100)} / Pro ${formatMinor(LIST_PRICE_USD.pro.quarterly * 100)} every 3 months, on the
existing products) and the monthly promo coupon (${formatMinor(MONTHLY_PROMO.amountOffUsd * 100)} off for ${MONTHLY_PROMO.months} months), then
prints the .env.local lines. Never edits .env.local or any existing Stripe object.

      --dry-run            Read-only preview (the default).
  -y, --yes                Create what is missing, then print the env lines.
      --verify             Read-only check of the live configuration; exits 1 on
                           any problem.
      --promo-end-at <ISO> The PROMO_END_AT to print (default ${DEFAULT_PROMO_END_AT},
                           the end of October 1, 2026 in New York).
      --coupon-id <id>     The promo coupon's id (default ${DEFAULT_PROMO_COUPON_ID}).
  -h, --help               Show this help.

Reads STRIPE_SECRET_KEY, the STRIPE_PRICE_* and STRIPE_COUPON_* keys, PROMO_END_AT,
BILLING_TRIAL_PLANS and STRIPE_PORTAL_CONFIG_ID from the environment or .env.local.`);
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

function formatMinor(minor: number | null | undefined, currency: string | null | undefined = 'usd'): string {
  if (minor == null) return 'no fixed amount';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(
    minor / 100,
  );
}

function everyMonthsLabel(months: number): string {
  if (months === 1) return 'every month';
  if (months === 12) return 'every year';
  return `every ${months} months`;
}

// The months one invoice of this price covers, or null for a non-monthly unit.
function priceMonths(price: Stripe.Price): number | null {
  const recurring = price.recurring;
  if (!recurring) return null;
  if (recurring.interval === 'month') return recurring.interval_count;
  if (recurring.interval === 'year') return recurring.interval_count * 12;
  return null;
}

function describeRecurring(price: Stripe.Price): string {
  const recurring = price.recurring;
  if (!recurring) return 'once (not recurring)';
  const months = priceMonths(price);
  if (months != null) return everyMonthsLabel(months);
  return `every ${recurring.interval_count} ${recurring.interval}(s)`;
}

function newYorkTime(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'long',
  }).format(new Date(ms));
}

// Word for word what the pricing page shows (core/stripe.ts getActivePromoDeadlineLabel).
function pageDeadlineLabel(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
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

const priceEnvKey = (sku: Sku) => `STRIPE_PRICE_${sku.tier.toUpperCase()}_${sku.cadence.toUpperCase()}`;
const promoEnvKey = (sku: Sku) => `STRIPE_COUPON_PROMO_${sku.tier.toUpperCase()}_${sku.cadence.toUpperCase()}`;
const skuLabel = (sku: Sku) => `${TIER_LABEL[sku.tier]} ${sku.cadence}`;

// ---------------------------------------------------------------------------
// Stripe reads and the checks both modes share
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

type ProductInfo = { id: string; name: string; active: boolean };

function productOf(price: Stripe.Price): ProductInfo {
  const product = price.product;
  if (typeof product === 'string') return { id: product, name: product, active: true };
  if (product.deleted) return { id: product.id, name: `${product.id} (deleted)`, active: false };
  return { id: product.id, name: product.name || product.id, active: product.active };
}

async function retrievePrice(id: string): Promise<Stripe.Price> {
  return stripe.prices.retrieve(id, { expand: ['product'] });
}

async function retrieveCoupon(id: string): Promise<Stripe.Coupon | null> {
  try {
    return await stripe.coupons.retrieve(id, { expand: ['applies_to'] });
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

// Everything that must hold for a price to charge exactly what the pricing page
// shows for this plan. Empty means it does.
function priceMismatches(price: Stripe.Price, sku: Sku): string[] {
  const out: string[] = [];
  const expected = LIST_PRICE_USD[sku.tier][sku.cadence] * 100;
  const months = CADENCE_MONTHS[sku.cadence];
  if (!price.active) out.push('is archived, so checkout would fail');
  const product = productOf(price);
  if (!product.active) out.push(`belongs to an archived or deleted product (${product.name})`);
  if (price.currency !== 'usd') out.push(`is priced in ${price.currency.toUpperCase()}, not USD`);
  if (price.type !== 'recurring') {
    out.push('is a one-time price, not a subscription price');
  } else {
    if (priceMonths(price) !== months) {
      out.push(`bills ${describeRecurring(price)}, but the page sells it as ${everyMonthsLabel(months)}`);
    }
    if (price.recurring?.usage_type !== 'licensed') out.push('is metered, not a flat price');
  }
  if (price.billing_scheme !== 'per_unit' || price.transform_quantity) out.push('is not a simple per-unit price');
  if (price.unit_amount !== expected) {
    out.push(`charges ${formatMinor(price.unit_amount, price.currency)}, but the page shows ${formatMinor(expected)}`);
  }
  return out;
}

// Everything that must hold for a coupon to deliver the advertised monthly
// promo on both monthly plans until PROMO_END_AT.
function promoCouponFindings(
  coupon: Stripe.Coupon,
  monthlyProductIds: readonly string[],
  promoEndMs: number | null,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const wantOff = MONTHLY_PROMO.amountOffUsd * 100;
  if (!coupon.valid) errors.push('is no longer valid (expired or used up), so every checkout it is attached to would fail');
  if (coupon.percent_off != null) {
    errors.push(`takes ${coupon.percent_off}% off, but the page advertises ${formatMinor(wantOff)} off`);
  } else if (coupon.amount_off !== wantOff || (coupon.currency ?? '').toLowerCase() !== 'usd') {
    errors.push(`takes ${formatMinor(coupon.amount_off, coupon.currency)} off, but the page advertises ${formatMinor(wantOff)} off`);
  }
  if (coupon.duration !== 'repeating' || coupon.duration_in_months !== MONTHLY_PROMO.months) {
    const lasts =
      coupon.duration === 'repeating'
        ? `${coupon.duration_in_months} months`
        : coupon.duration === 'once'
          ? 'one invoice'
          : 'forever';
    errors.push(`lasts ${lasts}, but the page advertises the first ${MONTHLY_PROMO.months} months`);
  }
  if (coupon.redeem_by != null) {
    const redeemByMs = coupon.redeem_by * 1000;
    if (promoEndMs != null && redeemByMs < promoEndMs) {
      errors.push(
        `stops being redeemable at ${new Date(redeemByMs).toISOString()}, before PROMO_END_AT, so monthly checkouts would fail in between`,
      );
    } else {
      warnings.push(
        `has a redeem-by date (${new Date(redeemByMs).toISOString()}); after it, re-applying the promo on a promo member's plan switch fails. Let PROMO_END_AT alone end the offer`,
      );
    }
  }
  if (coupon.max_redemptions != null) {
    if (coupon.times_redeemed >= coupon.max_redemptions) {
      errors.push(`is fully redeemed (${coupon.times_redeemed} of ${coupon.max_redemptions})`);
    } else {
      warnings.push(
        `is capped at ${coupon.max_redemptions} redemptions (${coupon.times_redeemed} used); checkout fails once the cap is reached`,
      );
    }
  }
  const limitedTo = coupon.applies_to?.products ?? [];
  if (limitedTo.length > 0) {
    for (const productId of monthlyProductIds) {
      if (!limitedTo.includes(productId)) {
        errors.push(`does not apply to product ${productId}, so that monthly plan would be charged full price`);
      }
    }
  }
  return { errors, warnings };
}

function monthlyPromoSkus(): Sku[] {
  return BILLABLE_TIERS.flatMap((tier) =>
    BILLING_CADENCES.filter((cadence) => isPromoAdvertised({ tier, cadence })).map((cadence) => ({ tier, cadence })),
  );
}

// Promo keys for plans the page does not advertise the promo on (the retired
// annual promo). Checkout ignores them; clearing them keeps intent obvious.
function retiredPromoKeysInEnv(): string[] {
  return BILLABLE_TIERS.flatMap((tier) =>
    BILLING_CADENCES.filter((cadence) => !isPromoAdvertised({ tier, cadence })).map((cadence) =>
      promoEnvKey({ tier, cadence }),
    ),
  ).filter((key) => env(key) !== null);
}

// ---------------------------------------------------------------------------
// --dry-run / --yes: create what is missing
// ---------------------------------------------------------------------------

async function runSetup(apply: boolean): Promise<number> {
  console.log(
    `setup-pricing: ${apply ? 'CREATE' : 'dry run (read-only)'}, Stripe ${liveMode ? 'LIVE' : 'test'} mode`,
  );

  const promoEndMs = Date.parse(args.promoEndAt);
  if (!Number.isFinite(promoEndMs)) {
    console.error(`Error: --promo-end-at "${args.promoEndAt}" is not a valid ISO timestamp.`);
    return 1;
  }

  // 1. The products, from the monthly prices.
  heading('Products (from the existing monthly prices)');
  type TierBase = { productId: string; productName: string; taxBehavior: Stripe.Price.TaxBehavior | null };
  const base = new Map<BillableTier, TierBase>();
  for (const tier of BILLABLE_TIERS) {
    const sku: Sku = { tier, cadence: 'monthly' };
    const key = priceEnvKey(sku);
    const id = env(key);
    if (!id) {
      problem(`${key} is not set. It names the ${TIER_LABEL[tier]} product the quarterly price is added to.`);
      continue;
    }
    let price: Stripe.Price;
    try {
      price = await retrievePrice(id);
    } catch (err) {
      problem(`${key}=${id} could not be read: ${errorMessage(err)}`);
      continue;
    }
    const product = productOf(price);
    if (!product.active) {
      problem(`${skuLabel(sku)} price ${id} belongs to an archived or deleted product (${product.name}).`);
      continue;
    }
    if (price.currency !== 'usd') {
      problem(`${skuLabel(sku)} price ${id} is priced in ${price.currency.toUpperCase()}; the new prices are USD.`);
      continue;
    }
    base.set(tier, { productId: product.id, productName: product.name, taxBehavior: price.tax_behavior ?? null });
    ok(
      `${TIER_LABEL[tier]}: product "${product.name}" [${product.id}]; monthly price ${id} charges ` +
        `${formatMinor(price.unit_amount, price.currency)} ${describeRecurring(price)}, tax behavior ${price.tax_behavior ?? 'unset'}`,
    );
    for (const mismatch of priceMismatches(price, sku)) warn(`${skuLabel(sku)} ${mismatch}.`);
  }
  if (base.size < BILLABLE_TIERS.length) {
    console.log('\nNothing was created. Fix the problem(s) above and re-run.');
    return 1;
  }

  // 2. Quarterly prices: reuse a configured or previously created one, else create.
  heading('Quarterly prices');
  const actions: Array<() => Promise<void>> = [];
  const quarterlyIds: Partial<Record<BillableTier, string>> = {};
  for (const tier of BILLABLE_TIERS) {
    const sku: Sku = { tier, cadence: 'quarterly' };
    const tierBase = base.get(tier) as TierBase;
    const envKey = priceEnvKey(sku);
    const amount = LIST_PRICE_USD[tier].quarterly * 100;
    const label = `${TIER_LABEL[tier]} quarterly, ${formatMinor(amount)} every 3 months`;

    const configured = env(envKey);
    if (configured) {
      try {
        const price = await retrievePrice(configured);
        const mismatches = priceMismatches(price, sku);
        for (const mismatch of mismatches) problem(`${envKey}=${configured} ${mismatch}.`);
        if (mismatches.length === 0) ok(`${label}: already configured (${envKey}=${configured}).`);
        quarterlyIds[tier] = configured;
      } catch (err) {
        problem(`${envKey}=${configured} could not be read: ${errorMessage(err)}`);
      }
      continue;
    }

    const lookupKey = quarterlyLookupKey(tier);
    let found: Stripe.Price | undefined;
    try {
      found = (await stripe.prices.list({ lookup_keys: [lookupKey], expand: ['data.product'], limit: 1 })).data[0];
    } catch (err) {
      problem(`Could not look up prices with lookup key ${lookupKey}: ${errorMessage(err)}`);
      continue;
    }
    if (found) {
      const mismatches = priceMismatches(found, sku);
      const product = productOf(found);
      if (product.id !== tierBase.productId) {
        mismatches.push(`is on product "${product.name}", not "${tierBase.productName}" (the monthly price's product)`);
      }
      if (mismatches.length > 0) {
        for (const mismatch of mismatches) problem(`Existing price ${found.id} (lookup key ${lookupKey}) ${mismatch}.`);
        note('Prices cannot be edited. Archive it and remove its lookup key in the Dashboard, then re-run.');
      } else {
        ok(`${label}: found ${found.id} (lookup key ${lookupKey}); reusing it.`);
        quarterlyIds[tier] = found.id;
      }
      continue;
    }

    plan(
      `${label}: ${apply ? 'create' : 'would create'} on "${tierBase.productName}" [${tierBase.productId}], ` +
        `lookup key ${lookupKey}, tax behavior ${tierBase.taxBehavior ?? 'unset'}.`,
    );
    actions.push(async () => {
      const created = await stripe.prices.create(
        {
          product: tierBase.productId,
          currency: 'usd',
          unit_amount: amount,
          recurring: { interval: 'month', interval_count: CADENCE_MONTHS.quarterly, usage_type: 'licensed' },
          // Same tax treatment as the monthly price (checkout runs automatic tax).
          ...(tierBase.taxBehavior ? { tax_behavior: tierBase.taxBehavior } : {}),
          lookup_key: lookupKey,
          nickname: `${TIER_LABEL[tier]} quarterly`,
          metadata: { zgx_sku: `${tier}:quarterly`, zgx_created_by: 'scripts/setup-pricing.mts' },
        },
        { idempotencyKey: `zgx-setup-pricing:price:${tier}:quarterly:${tierBase.productId}:${amount}` },
      );
      const mismatches = priceMismatches(created, sku);
      if (mismatches.length > 0) throw new Error(`created ${created.id}, but it ${mismatches.join('; ')}`);
      quarterlyIds[tier] = created.id;
      ok(`Created ${label}: ${created.id}`);
    });
  }

  // 3. The promo coupon: keep matching configured coupons, else reuse/create ours.
  heading(
    `Promo coupon (${formatMinor(MONTHLY_PROMO.amountOffUsd * 100)} off the monthly plans for the first ${MONTHLY_PROMO.months} months)`,
  );
  const monthlyProductIds = [...base.values()].map((b) => b.productId);
  const promoSkus = monthlyPromoSkus();
  let keepConfigured = true;
  for (const sku of promoSkus) {
    const key = promoEnvKey(sku);
    const id = env(key);
    if (!id) {
      keepConfigured = false;
      continue;
    }
    const coupon = await retrieveCoupon(id);
    if (!coupon) {
      note(`${key}=${id} does not exist in Stripe; it will be replaced.`);
      keepConfigured = false;
      continue;
    }
    const { errors } = promoCouponFindings(coupon, monthlyProductIds, promoEndMs);
    if (errors.length > 0) {
      note(`${key}=${id} ${errors.join('; ')}. It will be replaced.`);
      keepConfigured = false;
    }
  }
  const couponIdForKeys: Record<string, string> = {};
  if (keepConfigured) {
    for (const sku of promoSkus) couponIdForKeys[promoEnvKey(sku)] = env(promoEnvKey(sku)) as string;
    ok(`Both monthly plans already name a matching coupon (${[...new Set(Object.values(couponIdForKeys))].join(', ')}).`);
  } else {
    for (const sku of promoSkus) couponIdForKeys[promoEnvKey(sku)] = args.couponId;
    let existing: Stripe.Coupon | null = null;
    let readFailed = false;
    try {
      existing = await retrieveCoupon(args.couponId);
    } catch (err) {
      readFailed = true;
      problem(`Could not read coupon ${args.couponId}: ${errorMessage(err)}`);
    }
    if (readFailed) {
      // Reported above; never plan a create on top of an unknown.
    } else if (existing) {
      const { errors, warnings } = promoCouponFindings(existing, monthlyProductIds, promoEndMs);
      for (const error of errors) problem(`Coupon ${args.couponId} ${error}.`);
      for (const warning of warnings) warn(`Coupon ${args.couponId} ${warning}.`);
      if (errors.length > 0) {
        note('Coupons cannot be edited. Delete it in the Dashboard (discounts already given are unaffected) and');
        note('re-run, or pass --coupon-id <new id>.');
      } else {
        ok(`Found coupon ${args.couponId} ("${existing.name ?? ''}"); reusing it.`);
      }
    } else {
      plan(
        `${apply ? 'Create' : 'Would create'} coupon ${args.couponId} "${PROMO_COUPON_NAME}": ` +
          `${formatMinor(MONTHLY_PROMO.amountOffUsd * 100)} off, repeating for ${MONTHLY_PROMO.months} months, no redeem-by date.`,
      );
      actions.push(async () => {
        const created = await stripe.coupons.create(
          {
            id: args.couponId,
            name: PROMO_COUPON_NAME,
            amount_off: MONTHLY_PROMO.amountOffUsd * 100,
            currency: 'usd',
            duration: 'repeating',
            duration_in_months: MONTHLY_PROMO.months,
            metadata: {
              zgx_purpose: 'public_promo_monthly',
              zgx_created_by: 'scripts/setup-pricing.mts',
            },
          },
          { idempotencyKey: `zgx-setup-pricing:coupon:${args.couponId}:${MONTHLY_PROMO.amountOffUsd}:${MONTHLY_PROMO.months}` },
        );
        const check = await retrieveCoupon(created.id);
        const errors = check ? promoCouponFindings(check, monthlyProductIds, promoEndMs).errors : ['does not exist'];
        if (errors.length > 0) throw new Error(`coupon ${created.id} ${errors.join('; ')}`);
        ok(`Created coupon ${created.id}.`);
      });
    }
  }

  // 4. The promo window.
  heading('Promo window');
  if (promoEndMs <= Date.now()) {
    problem(`${args.promoEndAt} has already passed. Pass --promo-end-at <ISO timestamp> with the new deadline.`);
  } else {
    ok(
      `PROMO_END_AT=${args.promoEndAt}: the offer closes ${newYorkTime(promoEndMs)}, and the page says ` +
        `"Offer ends ${pageDeadlineLabel(promoEndMs)}".`,
    );
  }
  const currentEnd = env('PROMO_END_AT');
  if (currentEnd && currentEnd !== args.promoEndAt) note(`(.env.local currently has PROMO_END_AT=${currentEnd})`);
  for (const sku of promoSkus) {
    note(
      `${skuLabel(sku)}: ${formatMinor(LIST_PRICE_USD[sku.tier].monthly * 100)} → ` +
        `${formatMinor((promoPriceUsd(sku) ?? 0) * 100)} a month for the first ${MONTHLY_PROMO.months} months.`,
    );
  }

  if (problemCount > 0) {
    console.log(`\n${problemCount} problem(s) above. Nothing was created. Fix them and re-run.`);
    return 1;
  }

  // 5. Create.
  if (apply && actions.length > 0) {
    heading('Creating');
    for (const action of actions) {
      try {
        await action();
      } catch (err) {
        console.log(`  ✗ ${errorMessage(err)}`);
        console.log('\nStopped. Anything created so far is reused on a re-run; fix the error and re-run.');
        return 1;
      }
    }
  }

  // 6. The env lines.
  heading(
    apply
      ? 'Put these lines in frontend/.env.local (replace any existing line for the same key):'
      : 'With --yes, these lines go into frontend/.env.local:',
  );
  const lines: string[] = [];
  for (const tier of BILLABLE_TIERS) {
    lines.push(`${priceEnvKey({ tier, cadence: 'quarterly' })}=${quarterlyIds[tier] ?? '<the new price id>'}`);
  }
  for (const [key, id] of Object.entries(couponIdForKeys)) lines.push(`${key}=${id}`);
  lines.push(`PROMO_END_AT=${args.promoEndAt}`);
  const retired = retiredPromoKeysInEnv();
  for (const key of retired) lines.push(`${key}=`);
  // Every coupon id these lines take off a promo key stays recognized as a
  // promo (core/stripe.ts getRetiredPromoCouponIds), so a member still holding
  // one has it stripped on a plan switch rather than stacked with the new promo.
  const retiredIds = new Set(
    (env('STRIPE_COUPON_PROMO_RETIRED') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
  for (const [key, id] of Object.entries(couponIdForKeys)) {
    const previous = env(key);
    if (previous && previous !== id) retiredIds.add(previous);
  }
  for (const key of retired) retiredIds.add(env(key) as string);
  for (const id of Object.values(couponIdForKeys)) retiredIds.delete(id);
  if (retiredIds.size > 0) lines.push(`STRIPE_COUPON_PROMO_RETIRED=${[...retiredIds].join(',')}`);
  console.log('');
  for (const line of lines) console.log(`    ${line}`);
  if (retired.length > 0) {
    console.log('');
    note(`The blank ${retired.length === 1 ? 'key clears a' : 'keys clear'} retired promo coupon: the promo is monthly-only now,`);
    note('and checkout already ignores it. Clearing it keeps `make setup-pricing VERIFY=1` clean.');
  }
  if (retiredIds.size > 0) {
    note('STRIPE_COUPON_PROMO_RETIRED keeps the replaced coupons recognized as promo coupons, so a member still');
    note('holding one has it swapped out on a plan switch instead of getting both. Leave it in place.');
  }

  heading('Then, in this order:');
  note('1. make restart                     the app reads these at start-up; no rebuild needed');
  note('2. make setup-billing-portal YES=1  the portal starts offering the quarterly plans. Only after');
  note('                                    the restart: a switch to a price the running app does not');
  note('                                    know would drop that member to public access.');
  note('3. make setup-pricing VERIFY=1      must end with "no problems"');
  if (!apply) console.log('\n[dry run] Nothing was created. Re-run with --yes (make setup-pricing YES=1) to create.');
  if (warningCount > 0) console.log(`\n${warningCount} warning(s) above.`);
  return 0;
}

// ---------------------------------------------------------------------------
// --verify: check the live configuration
// ---------------------------------------------------------------------------

async function runVerify(): Promise<number> {
  console.log(`setup-pricing: verify (read-only), Stripe ${liveMode ? 'LIVE' : 'test'} mode`);

  // 1. Every configured price against the list price the page shows.
  heading('Prices (what Stripe charges vs. what the pricing page shows)');
  const configuredPriceIds = new Map<string, Sku>();
  const productIdBySku = new Map<string, string>();
  const taxBehaviors = new Set<string>();
  for (const cadence of BILLING_CADENCES) {
    const configuredTiers = BILLABLE_TIERS.filter((tier) => env(priceEnvKey({ tier, cadence })));
    if (cadence === 'quarterly' && configuredTiers.length === 0) {
      warn('No quarterly prices are configured, so the pricing page hides the Quarterly option. Run make setup-pricing.');
      continue;
    }
    for (const tier of BILLABLE_TIERS) {
      const sku: Sku = { tier, cadence };
      const key = priceEnvKey(sku);
      const id = env(key);
      if (!id) {
        problem(
          cadence === 'quarterly'
            ? `${key} is not set, but the other tier's quarterly price is. The page offers a billing period only when both tiers have it.`
            : `${key} is not set: ${skuLabel(sku)} cannot be sold.`,
        );
        continue;
      }
      let price: Stripe.Price;
      try {
        price = await retrievePrice(id);
      } catch (err) {
        problem(`${key}=${id} could not be read: ${errorMessage(err)}`);
        continue;
      }
      configuredPriceIds.set(id, sku);
      const product = productOf(price);
      productIdBySku.set(`${tier}:${cadence}`, product.id);
      taxBehaviors.add(price.tax_behavior ?? 'unset');
      const mismatches = priceMismatches(price, sku);
      for (const mismatch of mismatches) problem(`${skuLabel(sku)} (${id}) ${mismatch}.`);
      if (mismatches.length === 0) {
        ok(
          `${skuLabel(sku).padEnd(15)} ${id}  ${formatMinor(price.unit_amount)} ${describeRecurring(price)}` +
            ` (product "${product.name}", tax behavior ${price.tax_behavior ?? 'unset'})`,
        );
      }
    }
  }
  for (const [priceId, sku] of configuredPriceIds) {
    const monthlyProduct = productIdBySku.get(`${sku.tier}:monthly`);
    if (sku.cadence === 'monthly' || !monthlyProduct) continue;
    if (productIdBySku.get(`${sku.tier}:${sku.cadence}`) !== monthlyProduct) {
      warn(
        `${skuLabel(sku)} (${priceId}) is on a different product than ${TIER_LABEL[sku.tier]} monthly. It works, but ` +
          'the billing portal lists it as a separate product rather than as another billing period of the same plan.',
      );
    }
  }
  if (taxBehaviors.size > 1) {
    warn(`The prices do not share one tax behavior (${[...taxBehaviors].join(', ')}), so tax may be added to some plans and included in others.`);
  }

  // 2. The promo.
  heading('Promo');
  const promoEndRaw = env('PROMO_END_AT');
  const promoEndMs = promoEndRaw ? Date.parse(promoEndRaw) : NaN;
  const promoSkus = monthlyPromoSkus();
  if (!promoEndRaw) {
    ok('PROMO_END_AT is not set: no promo is offered.');
  } else if (!Number.isFinite(promoEndMs)) {
    problem(`PROMO_END_AT="${promoEndRaw}" is not a valid ISO timestamp, so the promo is off.`);
  } else if (promoEndMs <= Date.now()) {
    ok(`PROMO_END_AT=${promoEndRaw} has passed (${newYorkTime(promoEndMs)}): the promo is closed to new signups.`);
  } else {
    const days = Math.ceil((promoEndMs - Date.now()) / 86_400_000);
    ok(
      `PROMO_END_AT=${promoEndRaw}: open for ${days} more day(s), until ${newYorkTime(promoEndMs)}. ` +
        `The page says "Offer ends ${pageDeadlineLabel(promoEndMs)}".`,
    );
  }
  const promoOpen = Number.isFinite(promoEndMs) && promoEndMs > Date.now();
  const monthlyProductIds = BILLABLE_TIERS.map((tier) => productIdBySku.get(`${tier}:monthly`)).filter(
    (id): id is string => !!id,
  );
  for (const sku of promoSkus) {
    const key = promoEnvKey(sku);
    const id = env(key);
    if (!id) {
      if (promoOpen) {
        problem(`${key} is not set. With PROMO_END_AT open, the page shows the promo only when both monthly plans have a coupon.`);
      }
      continue;
    }
    let coupon: Stripe.Coupon | null = null;
    try {
      coupon = await retrieveCoupon(id);
    } catch (err) {
      problem(`${key}=${id} could not be read: ${errorMessage(err)}`);
      continue;
    }
    if (!coupon) {
      (promoOpen ? problem : warn)(
        `${key}=${id} does not exist in Stripe${promoOpen ? `, so ${skuLabel(sku)} checkouts would fail` : ''}.`,
      );
      continue;
    }
    const { errors, warnings } = promoCouponFindings(coupon, monthlyProductIds, promoOpen ? promoEndMs : null);
    // With the window closed, checkout no longer attaches the coupon, so a shape
    // mismatch cannot mis-charge anyone new: report it without failing.
    for (const error of errors) (promoOpen ? problem : warn)(`${key}=${id} ${error}.`);
    for (const warning of warnings) warn(`${key}=${id} ${warning}.`);
    if (errors.length === 0) {
      ok(
        `${key}=${id}: ${formatMinor(coupon.amount_off, coupon.currency)} off for ${coupon.duration_in_months} months, so ` +
          `${skuLabel(sku)} is ${formatMinor((promoPriceUsd(sku) ?? 0) * 100)} a month` +
          (promoOpen ? '.' : ' (not offered while the window is closed).'),
      );
    }
  }
  for (const key of retiredPromoKeysInEnv()) {
    warn(
      `${key} is set, but the promo is monthly-only now and checkout ignores it. Blank it, and add its ` +
        'coupon id to STRIPE_COUPON_PROMO_RETIRED.',
    );
  }
  const retiredIds = (env('STRIPE_COUPON_PROMO_RETIRED') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (retiredIds.length > 0) {
    ok(`STRIPE_COUPON_PROMO_RETIRED: ${retiredIds.join(', ')} (stripped on a plan switch, never attached).`);
  }

  // 3. Every other configured coupon must at least exist and be redeemable.
  heading('Other coupons in .env.local');
  const otherCouponKeys = Object.keys(process.env)
    .filter((key) => key.startsWith('STRIPE_COUPON_') && env(key) !== null)
    .filter(
      (key) =>
        !promoSkus.some((sku) => promoEnvKey(sku) === key) &&
        !retiredPromoKeysInEnv().includes(key) &&
        key !== 'STRIPE_COUPON_PROMO_RETIRED',
    )
    .sort();
  if (otherCouponKeys.length === 0) ok('None.');
  for (const key of otherCouponKeys) {
    const id = env(key) as string;
    try {
      const coupon = await retrieveCoupon(id);
      if (!coupon) warn(`${key}=${id} does not exist in Stripe; any checkout or grant that uses it fails.`);
      else if (!coupon.valid) warn(`${key}=${id} is no longer valid (expired or used up); any checkout or grant that uses it fails.`);
      else ok(`${key}=${id} is valid.`);
    } catch (err) {
      warn(`${key}=${id} could not be read: ${errorMessage(err)}`);
    }
  }

  // 4. Trial vs. guarantee policy.
  heading('Free trial vs. money-back guarantee');
  const trialRaw = process.env.BILLING_TRIAL_PLANS ?? '';
  const trialPlans = parseTrialPlans(trialRaw);
  const allSkus = BILLABLE_TIERS.flatMap((tier) => BILLING_CADENCES.map((cadence) => ({ tier, cadence }) as Sku));
  const trialing = allSkus.filter((sku) => planHasFreeTrial(sku, trialPlans)).map(skuLabel);
  const guaranteed = allSkus.filter((sku) => !planHasFreeTrial(sku, trialPlans)).map(skuLabel);
  if (trialRaw.trim() && trialRaw.trim().toLowerCase() !== 'none') {
    const recognized = trialRaw
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .every((part) => trialPlans.has(part));
    if (!recognized) warn(`BILLING_TRIAL_PLANS="${trialRaw}" has entries it does not recognize; only the ones listed below apply.`);
  }
  ok(`Free 7-day trial: ${trialing.join(', ') || 'none'}.`);
  ok(`Paid up front with the 7-day money-back guarantee: ${guaranteed.join(', ') || 'none'}.`);
  if (!trialRaw.trim()) note('(BILLING_TRIAL_PLANS is unset: the default, Basic monthly only.)');
  if (env('BILLING_PAID_SIGNUP_DISABLED') === '1') warn('BILLING_PAID_SIGNUP_DISABLED=1: checkout is switched OFF.');

  // 5. The billing portal must offer every plan, and nothing the app cannot map.
  heading('Billing portal');
  const portalId = env('STRIPE_PORTAL_CONFIG_ID');
  let config: Stripe.BillingPortal.Configuration | null = null;
  try {
    if (portalId) {
      config = await stripe.billingPortal.configurations
        .retrieve(portalId, {}, { apiVersion: PORTAL_READ_API_VERSION })
        .catch(() => stripe.billingPortal.configurations.retrieve(portalId));
    } else {
      const list = await stripe.billingPortal.configurations
        .list({ is_default: true, limit: 1 }, { apiVersion: PORTAL_READ_API_VERSION })
        .catch(() => stripe.billingPortal.configurations.list({ is_default: true, limit: 1 }));
      config = list.data[0] ?? null;
    }
  } catch (err) {
    problem(`Could not read the billing portal configuration: ${errorMessage(err)}`);
  }
  if (config) {
    ok(`${portalId ? 'STRIPE_PORTAL_CONFIG_ID' : "Stripe's account default configuration"}: ${config.id}.`);
    const update = config.features?.subscription_update;
    if (!update?.enabled) {
      problem('Plan switching is off in the portal, but the pricing page sends paying members there to switch plans.');
    } else {
      const offered = new Set((update.products ?? []).flatMap((p) => p.prices ?? []));
      for (const [priceId, sku] of configuredPriceIds) {
        if (!offered.has(priceId)) {
          problem(`The portal does not offer ${skuLabel(sku)} (${priceId}). Run make setup-billing-portal YES=1 (after the restart).`);
        }
      }
      for (const priceId of offered) {
        if (!configuredPriceIds.has(priceId)) {
          problem(
            `The portal offers price ${priceId}, which is not in .env.local: a member who switches to it drops to ` +
              'public access. Re-run make setup-billing-portal YES=1 so the portal lists exactly the configured prices.',
          );
        }
      }
      const offersAll = [...configuredPriceIds.keys()].every((id) => offered.has(id));
      const offersOnlyThose = [...offered].every((id) => configuredPriceIds.has(id));
      if (configuredPriceIds.size > 0 && offersAll && offersOnlyThose) {
        ok(`Offers all ${configuredPriceIds.size} configured prices, and nothing else.`);
      }
      const trialBehavior = (update as unknown as { trial_update_behavior?: string }).trial_update_behavior;
      if (trialBehavior === 'end_trial') {
        ok('A plan switch during the free trial ends the trial and charges the new plan (trial_update_behavior=end_trial).');
      } else if (trialBehavior) {
        warn(
          `trial_update_behavior=${trialBehavior}: a trialing member who switches in the portal keeps the free trial on ` +
            'the new plan (a free trial of Pro or of a prepaid plan). Run make setup-billing-portal YES=1.',
        );
      } else {
        warn(
          'Could not read what a plan switch during the free trial does (the API version is too old to return it). ' +
            'Check the Dashboard: Settings → Billing → Customer portal. It should end the trial.',
        );
      }
    }
  } else if (!portalId) {
    warn('No default billing portal configuration was found.');
  }

  // 6. Who hears about refunds, and whether the emails can go out.
  heading('Emails');
  const alertKey = ['REFUND_ALERT_EMAIL', 'CANCELLATION_ALERT_EMAIL', 'SIGNUP_ALARM_EMAIL', 'FOH_REMINDER_EMAIL'].find(
    (key) => env(key),
  );
  if (alertKey) ok(`Refund alerts go to ${env(alertKey)} (${alertKey}).`);
  else warn('No refund alert address: set REFUND_ALERT_EMAIL so you hear about every money-back refund.');
  if (!env('RESEND_API_KEY') || !env('RESEND_FROM_EMAIL')) {
    warn('RESEND_API_KEY / RESEND_FROM_EMAIL are not both set: refund confirmations and renewal reminders cannot be emailed.');
  } else {
    ok('Refund confirmations and renewal reminders can be emailed (Resend is configured).');
  }

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
