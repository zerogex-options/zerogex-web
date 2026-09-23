#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/setup-billing-portal.mts \
//     [--config-id bpc_...] [--proration <behavior>] \
//     [--trial-update-behavior <continue_trial|end_trial>] [--dry-run | --yes]
//
// Provisions (or updates) the Stripe **customer billing portal configuration**
// so members can self-serve the things our help docs and trial emails already
// promise — switch cadence (monthly ↔ annual), change tier (Basic ↔ Pro),
// cancel, update the card, and view invoices.
//
// WHY THIS EXISTS
//   The portal's feature set is NOT controlled by our code — it lives in a
//   Stripe-hosted "portal configuration" object. app/api/billing/portal/route.ts
//   only *pins* one by id when STRIPE_PORTAL_CONFIG_ID is set; otherwise the
//   session falls back to Stripe's account-level DEFAULT configuration. That
//   default ships with subscription_update (plan switching) OFF, so the portal
//   renders only Payment methods / Billing info / Invoice history — no
//   "Update plan", no "Cancel plan". Members literally cannot switch monthly →
//   annual from it, which contradicts content/help/platform/billing.md and the
//   "cancel anytime in the billing portal" copy in core/mailer.ts.
//
//   This script builds a configuration with the full feature set enabled and
//   every cadence's price listed under each tier, then prints the resulting
//   bpc_... id to wire into STRIPE_PORTAL_CONFIG_ID (see core/stripe.ts
//   getPortalConfigId + deploy/steps/036.billing).
//
//   The feature set here should MIRROR the account default config in the Stripe
//   Dashboard (Settings → Billing → Customer portal): a switch during a trial
//   ends the trial, prorations deferred to period end, downgrades scheduled at
//   period end, promotion-code entry OFF. Keep the two in sync if you change
//   either — the Dashboard default governs whenever STRIPE_PORTAL_CONFIG_ID is
//   unset.
//
// WHAT IT ENABLES
//   • subscription_update  — allowed update: price. products = every tier's
//     monthly, quarterly (when configured) and annual price, grouped by their
//     Stripe product, so a member can move between any of them (cadence swap
//     and tier swap both).
//   • subscription_cancel  — at period end (matches our "keep access until the
//     end of the billing period" policy in content/help/platform/billing.md).
//   • payment_method_update, invoice_history, customer_update (address/name/
//     email/tax id — the last so automatic_tax has an address to work from,
//     consistent with the checkout route's customer_update: address/name auto).
//   Promotion-code entry is intentionally NOT enabled: checkout applies discounts
//   server-side and disallows stacking, so letting members type a code in the
//   portal would reopen that. Honoring a member's existing founding/promo rate
//   across a cadence switch is handled server-side in the webhook instead.
//
// PRORATION (paying members; a trial member's switch is governed by the trial
// behavior below)
//   --proration create_prorations (default): matches the Dashboard's "Prorate
//     charges and credits" + "Invoice prorations at the end of the billing
//     period". Proration credit/charge line items are created and applied to the
//     member's NEXT invoice rather than charged on the spot.
//   --proration always_invoice: same proration, but invoiced IMMEDIATELY at the
//     time of the switch (the Dashboard's "Invoice prorations immediately").
//   --proration none: no proration; the new price simply applies going forward.
//
// TRIAL BEHAVIOR ON SWITCH
//   --trial-update-behavior end_trial (default): a member switching plan during
//     a free trial ends the trial and is charged the new plan now. Since only
//     Basic monthly has a trial (core/billingPlans.ts), this is what stops the
//     portal being a way to get a free trial of Pro or of a quarterly/annual
//     plan — those are paid up front under the 7-day money-back guarantee. (The
//     pricing page's own switch does the same in-app, with a confirm step.)
//     Downgrades are unaffected: they are scheduled at period end regardless.
//   --trial-update-behavior continue_trial: keep an active free trial on a
//     switch — no charge until the trial ends, then billed at the new price. The
//     pre-October-2026 behaviour; only right if every plan trials again
//     (BILLING_TRIAL_PLANS).
//   The field is newer (Stripe API 2025-09-30) than the version the app pins.
//   If Stripe rejects it, the script writes everything else anyway (the plan
//   list matters more) and says to set the behavior in the Dashboard instead;
//   Stripe's own default there is to end the trial, which is what we want.
//
// DOWNGRADES
//   Switching to a cheaper plan or a shorter interval (annual → monthly) is
//   scheduled at period end via schedule_at_period_end, so the member keeps what
//   they paid for until the period ends (matches billing.md). Stripe notes this
//   relies on subscription schedules, which it creates automatically — our sync
//   only reacts to the eventual customer.subscription.updated at period end.
//
// SAFE BY DEFAULT
//   Reads STRIPE_SECRET_KEY + the four STRIPE_PRICE_* ids from env or
//   .env.local. Prints the full plan and writes nothing without --yes.
//   --dry-run previews with no Stripe call beyond read-only price lookups.
//   Re-runnable: pass --config-id (or set STRIPE_PORTAL_CONFIG_ID) to UPDATE an
//   existing configuration in place instead of creating a new one.
//
// NOTE ON is_default: Stripe only lets you set the is_default flag at creation
// time, not via update. This script does not flip it — pinning the id via
// STRIPE_PORTAL_CONFIG_ID is the auditable, env-driven path the app already
// supports (see the comment in core/stripe.ts getPortalConfigId). If you'd
// rather manage the portal entirely from the Dashboard, leave
// STRIPE_PORTAL_CONFIG_ID empty and the account default config governs.

import fs from 'node:fs';
import path from 'node:path';

import Stripe from 'stripe';

type ProrationBehavior = 'create_prorations' | 'always_invoice' | 'none';
type TrialUpdateBehavior = 'continue_trial' | 'end_trial';

type Args = {
  configId: string | null;
  proration: ProrationBehavior;
  trialBehavior: TrialUpdateBehavior;
  privacyUrl: string | null;
  termsUrl: string | null;
  headline: string | null;
  apiVersion: string | null;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

// The SKUs the portal must be able to move between. Order is display-only
// (dry-run print); grouping into Stripe products happens by the live product id.
// Monthly and annual are required; quarterly is included when its price ids are
// set (it is optional in the app until configured — core/stripe.ts).
const PRICE_ENV_KEYS = [
  { env: 'STRIPE_PRICE_BASIC_MONTHLY', label: 'Basic / monthly', optional: false },
  { env: 'STRIPE_PRICE_BASIC_QUARTERLY', label: 'Basic / quarterly', optional: true },
  { env: 'STRIPE_PRICE_BASIC_ANNUAL', label: 'Basic / annual', optional: false },
  { env: 'STRIPE_PRICE_PRO_MONTHLY', label: 'Pro / monthly', optional: false },
  { env: 'STRIPE_PRICE_PRO_QUARTERLY', label: 'Pro / quarterly', optional: true },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', label: 'Pro / annual', optional: false },
] as const;

const PRORATION_VALUES: ProrationBehavior[] = ['create_prorations', 'always_invoice', 'none'];
const TRIAL_BEHAVIOR_VALUES: TrialUpdateBehavior[] = ['continue_trial', 'end_trial'];

// trial_update_behavior is a recent Stripe field. By DEFAULT we do NOT pin an
// API version — the client uses the account's default version (exactly like the
// rest of the app via core/stripe.ts getStripe), which for any modern account
// already supports the field. Pinning an explicit dated version is opt-in via
// --api-version, because some accounts reject an arbitrary version string with
// "Invalid Stripe API version" (and that error fires on the very first read,
// before the config write). After the write we verify trial_update_behavior
// actually took effect, so a too-old default version can't silently no-op it.

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
    configId: null,
    proration: 'create_prorations',
    trialBehavior: 'end_trial',
    privacyUrl: null,
    termsUrl: null,
    headline: null,
    apiVersion: null,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--config-id') args.configId = (argv[++i] ?? '').trim() || null;
    else if (arg === '--proration') {
      const v = (argv[++i] ?? '').trim() as ProrationBehavior;
      if (!PRORATION_VALUES.includes(v)) {
        console.error(`Error: --proration must be one of ${PRORATION_VALUES.join(', ')}.`);
        process.exit(1);
      }
      args.proration = v;
    } else if (arg === '--trial-update-behavior') {
      const v = (argv[++i] ?? '').trim() as TrialUpdateBehavior;
      if (!TRIAL_BEHAVIOR_VALUES.includes(v)) {
        console.error(
          `Error: --trial-update-behavior must be one of ${TRIAL_BEHAVIOR_VALUES.join(', ')}.`,
        );
        process.exit(1);
      }
      args.trialBehavior = v;
    } else if (arg === '--privacy-url') args.privacyUrl = (argv[++i] ?? '').trim() || null;
    else if (arg === '--terms-url') args.termsUrl = (argv[++i] ?? '').trim() || null;
    else if (arg === '--headline') args.headline = (argv[++i] ?? '').trim() || null;
    else if (arg === '--api-version') args.apiVersion = (argv[++i] ?? '').trim() || null;
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
  node --experimental-strip-types --no-warnings scripts/setup-billing-portal.mts \\
    [--config-id bpc_...] [--proration <behavior>] \\
    [--trial-update-behavior <continue_trial|end_trial>] [--dry-run | --yes]

Creates or updates the Stripe customer billing portal configuration so members
can switch cadence (monthly <-> annual), change tier, cancel, update payment
method, and view invoices. Mirrors the account default config in the Dashboard.

Options:
      --config-id bpc_...   Update this existing configuration in place. Defaults
                            to STRIPE_PORTAL_CONFIG_ID from env/.env.local; if
                            neither is set, a NEW configuration is created and
                            its id is printed for you to wire into the env.
      --proration <b>       Proration for subscription updates: create_prorations
                            (default; prorations on next invoice), always_invoice
                            (invoice immediately), or none.
      --trial-update-behavior <b>
                            end_trial (default; a switch during the free trial
                            ends it and charges the new plan now — only Basic
                            monthly trials) or continue_trial (keep the trial on
                            a switch; only right if every plan trials again).
      --privacy-url <url>   Override the portal's privacy policy URL
                            (default: <NEXT_PUBLIC_APP_URL>/privacy).
      --terms-url <url>     Override the portal's terms of service URL
                            (default: <NEXT_PUBLIC_APP_URL>/terms).
      --headline <text>     Optional portal headline text.
      --api-version <v>     Pin this Stripe API version for the config write only.
                            Default: your account's default version (recommended).
                            Use only if the write reports that trial_update_behavior
                            wasn't applied because your default version is too old.
      --dry-run             Resolve prices + print the plan; no config write.
  -y, --yes                 Apply: create/update the portal configuration.
  -h, --help                Show this help.

Reads STRIPE_SECRET_KEY, STRIPE_PRICE_BASIC_MONTHLY, STRIPE_PRICE_BASIC_ANNUAL,
STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL (required), the two
STRIPE_PRICE_*_QUARTERLY ids (included when set) and NEXT_PUBLIC_APP_URL from
env or .env.local.`);
}

// ---------------------------------------------------------------------------

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
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

// Resolve the price ids up front so a missing one fails loud and early, before
// we touch Stripe. Monthly and annual are required for each tier; quarterly is
// listed only when BOTH tiers have it (a one-tier quarterly would let the portal
// offer a plan the pricing page does not).
const missing: string[] = [];
const quarterlyConfigured =
  !!envOrLocal('STRIPE_PRICE_BASIC_QUARTERLY') && !!envOrLocal('STRIPE_PRICE_PRO_QUARTERLY');
const priceInputs = PRICE_ENV_KEYS.filter(({ optional }) => !optional || quarterlyConfigured).map(
  ({ env, label }) => {
    const id = envOrLocal(env);
    if (!id) missing.push(env);
    return { env, label, id: id ?? null };
  },
);
if (!quarterlyConfigured) {
  console.log('Note: quarterly prices are not configured (both STRIPE_PRICE_*_QUARTERLY needed); leaving quarterly out of the portal.');
}
if (missing.length > 0) {
  console.error(`Error: missing required price id(s) in env or .env.local:\n  ${missing.join('\n  ')}`);
  console.error('These are the same keys deploy/steps/036.billing seeds. Fill them in first.');
  process.exit(1);
}

const appUrl = envOrLocal('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
const privacyUrl = cliArgs.privacyUrl ?? `${appUrl.replace(/\/+$/, '')}/privacy`;
const termsUrl = cliArgs.termsUrl ?? `${appUrl.replace(/\/+$/, '')}/terms`;

// Which configuration to update in place, if any. --config-id wins over the env.
const targetConfigId = cliArgs.configId ?? envOrLocal('STRIPE_PORTAL_CONFIG_ID') ?? null;

// By default use the account's default API version (no pin), same as the app.
// Only pin when --api-version is given (cast through unknown: the pinned SDK's
// apiVersion union may predate the requested version string).
const stripe = cliArgs.apiVersion
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: cliArgs.apiVersion } as unknown as Stripe.StripeConfig)
  : new Stripe(STRIPE_SECRET_KEY);

// Resolve each price -> its Stripe product, so we can build the
// subscription_update.products[] list (one entry per product, all its allowed
// prices under it). Grouping by the live product id is robust whether the two
// cadences live on one product per tier or on separate products.
type ResolvedPrice = {
  env: string;
  label: string;
  priceId: string;
  productId: string;
  productName: string;
  productActive: boolean;
  interval: string | null;
  active: boolean;
};

const resolved: ResolvedPrice[] = [];
for (const p of priceInputs) {
  const priceId = p.id as string;
  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`Error: could not retrieve price ${priceId} (${p.env}): ${message}`);
    process.exit(1);
  }
  const product = price.product;
  if (typeof product === 'string' || !product || product.deleted) {
    console.error(
      `Error: price ${priceId} (${p.env}) has no resolvable product (got ${
        typeof product === 'string' ? product : 'deleted/none'
      }).`,
    );
    process.exit(1);
  }
  resolved.push({
    env: p.env,
    label: p.label,
    priceId,
    productId: product.id,
    productName: product.name ?? product.id,
    productActive: product.active !== false,
    interval: price.recurring
      ? price.recurring.interval_count > 1
        ? `every ${price.recurring.interval_count} ${price.recurring.interval}s`
        : price.recurring.interval
      : null,
    active: price.active,
  });
}

// Group prices by product for subscription_update.products.
const byProduct = new Map<string, { product: string; name: string; active: boolean; prices: string[] }>();
for (const r of resolved) {
  const entry = byProduct.get(r.productId) ?? {
    product: r.productId,
    name: r.productName,
    active: r.productActive,
    prices: [],
  };
  if (!entry.prices.includes(r.priceId)) entry.prices.push(r.priceId);
  byProduct.set(r.productId, entry);
}
const productEntries = [...byProduct.values()];

// Stripe rejects archived (inactive) prices/products in a portal config. Surface
// them clearly rather than letting the API throw an opaque error.
const inactivePrices = resolved.filter((r) => !r.active);
const inactiveProducts = productEntries.filter((e) => !e.active);
if (inactivePrices.length > 0 || inactiveProducts.length > 0) {
  console.error('Error: the portal config cannot reference archived prices/products:');
  for (const r of inactivePrices) console.error(`  • price ${r.priceId} (${r.env}) is archived`);
  for (const e of inactiveProducts) console.error(`  • product ${e.product} (${e.name}) is archived`);
  console.error('Un-archive them in the Stripe dashboard, or point the env at active ids.');
  process.exit(1);
}

// --- Print the resolved plan -----------------------------------------------

console.log(`Stripe:             ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'} (API ${cliArgs.apiVersion ?? 'account default'})`);
console.log(`App URL:            ${appUrl}`);
console.log(`Privacy / Terms:    ${privacyUrl}  |  ${termsUrl}`);
console.log(`Proration:          ${cliArgs.proration}`);
console.log(`Trial on switch:    ${cliArgs.trialBehavior}`);
console.log(`Downgrades:         scheduled at period end (cheaper plan + shorter interval)`);
console.log(`Promotion codes:    off (discounts stay server-side)`);
console.log(
  `Target config:      ${targetConfigId ? `UPDATE ${targetConfigId}` : 'CREATE new configuration'}`,
);
console.log('\nPrices the portal will allow switching between:');
for (const r of resolved) {
  console.log(
    `  • ${r.label.padEnd(16)} ${r.priceId}  (${r.interval ?? 'one-time'}, product ${r.productName})`,
  );
}
console.log('\nsubscription_update.products (grouped by product):');
for (const e of productEntries) {
  console.log(`  • ${e.name} [${e.product}]: ${e.prices.join(', ')}`);
}

// --- Build the configuration params ----------------------------------------

// trial_update_behavior isn't in the pinned SDK's types (added API 2025-09-30);
// cast through unknown so the extra field is sent on the wire.
const subscriptionUpdate = {
  enabled: true,
  default_allowed_updates: ['price'],
  proration_behavior: cliArgs.proration,
  products: productEntries.map((e) => ({ product: e.product, prices: e.prices })),
  // Downgrades wait for period end: cheaper plan => decreasing_item_amount;
  // a shorter period (annual -> quarterly -> monthly) => shortening_interval.
  schedule_at_period_end: {
    conditions: [{ type: 'decreasing_item_amount' }, { type: 'shortening_interval' }],
  },
  trial_update_behavior: cliArgs.trialBehavior,
} as unknown as Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate;

const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
  subscription_update: subscriptionUpdate,
  subscription_cancel: {
    enabled: true,
    mode: 'at_period_end',
    proration_behavior: 'none',
  },
  payment_method_update: { enabled: true },
  invoice_history: { enabled: true },
  customer_update: {
    enabled: true,
    allowed_updates: ['address', 'name', 'email', 'tax_id'],
  },
};

const businessProfile: Stripe.BillingPortal.ConfigurationCreateParams.BusinessProfile = {
  privacy_policy_url: privacyUrl,
  terms_of_service_url: termsUrl,
  ...(cliArgs.headline ? { headline: cliArgs.headline } : {}),
};

if (cliArgs.dryRun) {
  console.log('\n[dry-run] Resolved features:');
  console.log(JSON.stringify(features, null, 2));
  console.log('\n[dry-run] No configuration was created or updated.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log(
    '\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.',
  );
  process.exit(1);
}

// --- Apply -----------------------------------------------------------------

// Stripe silently ignores request params its version doesn't understand, so a
// too-old default API version would drop trial_update_behavior and leave the
// portal still ending trials on a switch — a silent failure. Read the field back
// off the returned config and shout if it didn't stick.
function verifyTrialBehavior(config: Stripe.BillingPortal.Configuration) {
  const echoed = (
    config.features?.subscription_update as unknown as { trial_update_behavior?: string } | undefined
  )?.trial_update_behavior;
  if (echoed === cliArgs.trialBehavior) {
    console.log(`Verified: trial_update_behavior=${echoed} took effect.`);
    return;
  }
  console.error(
    `\nWARNING: trial_update_behavior did not take effect (asked for ${cliArgs.trialBehavior}, got ${echoed ?? 'undefined'}).`,
  );
  console.error('Your account default API version is likely too old for this field. Either:');
  console.error('  • re-run with --api-version <a version your account supports> (see Stripe');
  console.error('    Dashboard → Developers → API version), or');
  console.error('  • set it in the Dashboard: Settings → Billing → Customer portal →');
  console.error('    "when a customer changes plans during a trial".');
  console.error(`Until then, a mid-trial plan switch will not follow ${cliArgs.trialBehavior}.`);
}

// Some API versions reject trial_update_behavior outright ("Received unknown
// parameter") instead of ignoring it. Plan switching (the quarterly prices
// included) must not be held hostage to that one field: retry the write without
// it, and say how to set the trial behavior in the Dashboard instead.
function isRejectedTrialBehavior(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return /trial_update_behavior/.test(message) && /unknown parameter/i.test(message);
}

async function writeConfig(
  withTrialBehavior: boolean,
): Promise<{ config: Stripe.BillingPortal.Configuration; created: boolean }> {
  const params = {
    features: withTrialBehavior
      ? features
      : {
          ...features,
          subscription_update: (() => {
            const { trial_update_behavior: _omitted, ...rest } = subscriptionUpdate as unknown as Record<string, unknown>;
            void _omitted;
            return rest as unknown as Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate;
          })(),
        },
    business_profile: businessProfile,
  };
  if (targetConfigId) {
    return { config: await stripe.billingPortal.configurations.update(targetConfigId, params), created: false };
  }
  return { config: await stripe.billingPortal.configurations.create(params), created: true };
}

try {
  let result: { config: Stripe.BillingPortal.Configuration; created: boolean };
  try {
    result = await writeConfig(true);
  } catch (err) {
    if (!isRejectedTrialBehavior(err)) throw err;
    console.error(`\nNote: Stripe rejected trial_update_behavior (${err instanceof Error ? err.message : 'unknown parameter'}).`);
    console.error('Writing the rest of the configuration without it.');
    result = await writeConfig(false);
  }
  const { config, created } = result;
  if (!created) {
    console.log(`\nDone. Updated portal configuration ${config.id}.`);
    console.log('Plan switching, cancel, payment-method and invoice features are now enabled on it.');
    verifyTrialBehavior(config);
    if (envOrLocal('STRIPE_PORTAL_CONFIG_ID') !== config.id) {
      console.log(`\nMake sure STRIPE_PORTAL_CONFIG_ID=${config.id} is set in .env.local, then: make restart`);
    }
  } else {
    console.log(`\nDone. Created portal configuration ${config.id}.`);
    verifyTrialBehavior(config);
    console.log('\nNext steps to make the portal use it:');
    console.log(`  1. Set this in frontend/.env.local:`);
    console.log(`       STRIPE_PORTAL_CONFIG_ID=${config.id}`);
    console.log(`  2. Restart so the value is picked up:`);
    console.log(`       make restart`);
    console.log(
      '\n(Without STRIPE_PORTAL_CONFIG_ID pinned, the portal keeps using Stripe\'s',
    );
    console.log("account-level default configuration, which you manage in the Dashboard.)");
  }
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe portal configuration write failed: ${message}`);
  process.exit(1);
}
