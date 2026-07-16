#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/setup-billing-portal.mts \
//     [--config-id bpc_...] [--proration <behavior>] [--dry-run | --yes]
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
//   both cadence prices listed under each tier, then prints the resulting
//   bpc_... id to wire into STRIPE_PORTAL_CONFIG_ID (see core/stripe.ts
//   getPortalConfigId + deploy/steps/036.billing).
//
// WHAT IT ENABLES
//   • subscription_update  — allowed update: price. products = every tier's
//     monthly + annual price, grouped by their Stripe product, so a member can
//     move between any of the four prices (cadence swap and tier swap both).
//     proration_behavior defaults to create_prorations (see --proration).
//   • subscription_cancel  — at period end (matches our "keep access until the
//     end of the billing period" policy in content/help/platform/billing.md).
//   • payment_method_update, invoice_history, customer_update (address/name/
//     email/tax id — the last so automatic_tax has an address to work from,
//     consistent with the checkout route's customer_update: address/name auto).
//
// PRORATION (monthly → annual, and tier upgrades)
//   --proration create_prorations (default): proration line items are created
//     for the change. For a cadence swap (monthly → annual) the billing
//     *interval* changes, so Stripe invoices the new annual amount immediately
//     regardless — with a credit line for the unused monthly time (this is the
//     -$34.94 "Unused time" credit pattern already visible in invoice history).
//     For a same-interval tier change (Basic → Pro monthly) the proration lands
//     on the NEXT invoice rather than an immediate charge.
//   --proration always_invoice: additionally invoices same-interval tier
//     changes immediately, matching billing.md's "billed the prorated
//     difference immediately" copy for Basic → Pro. Use this if you want tier
//     upgrades to charge on the spot too.
//   --proration none: no proration credits/charges; the new price simply
//     applies going forward.
//   A member still in the free trial is never charged by any of these — the
//   trial_end is preserved and proration amounts are $0 during a trial.
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
// supports (see the comment in core/stripe.ts getPortalConfigId).

import fs from 'node:fs';
import path from 'node:path';

import Stripe from 'stripe';

type ProrationBehavior = 'create_prorations' | 'always_invoice' | 'none';

type Args = {
  configId: string | null;
  proration: ProrationBehavior;
  privacyUrl: string | null;
  termsUrl: string | null;
  headline: string | null;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

// The four SKUs the portal must be able to move between. Order is display-only
// (dry-run print); grouping into Stripe products happens by the live product id.
const PRICE_ENV_KEYS = [
  { env: 'STRIPE_PRICE_BASIC_MONTHLY', label: 'Basic / monthly' },
  { env: 'STRIPE_PRICE_BASIC_ANNUAL', label: 'Basic / annual' },
  { env: 'STRIPE_PRICE_PRO_MONTHLY', label: 'Pro / monthly' },
  { env: 'STRIPE_PRICE_PRO_ANNUAL', label: 'Pro / annual' },
] as const;

const PRORATION_VALUES: ProrationBehavior[] = ['create_prorations', 'always_invoice', 'none'];

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
    privacyUrl: null,
    termsUrl: null,
    headline: null,
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
    } else if (arg === '--privacy-url') args.privacyUrl = (argv[++i] ?? '').trim() || null;
    else if (arg === '--terms-url') args.termsUrl = (argv[++i] ?? '').trim() || null;
    else if (arg === '--headline') args.headline = (argv[++i] ?? '').trim() || null;
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
    [--config-id bpc_...] [--proration <behavior>] [--dry-run | --yes]

Creates or updates the Stripe customer billing portal configuration so members
can switch cadence (monthly <-> annual), change tier, cancel, update payment
method, and view invoices.

Options:
      --config-id bpc_...   Update this existing configuration in place. Defaults
                            to STRIPE_PORTAL_CONFIG_ID from env/.env.local; if
                            neither is set, a NEW configuration is created and
                            its id is printed for you to wire into the env.
      --proration <b>       Proration behavior for subscription updates: one of
                            create_prorations (default), always_invoice, none.
                            See the header comment for what each does to a
                            monthly->annual swap vs a same-interval tier change.
      --privacy-url <url>   Override the portal's privacy policy URL
                            (default: <NEXT_PUBLIC_APP_URL>/privacy).
      --terms-url <url>     Override the portal's terms of service URL
                            (default: <NEXT_PUBLIC_APP_URL>/terms).
      --headline <text>     Optional portal headline text.
      --dry-run             Resolve prices + print the plan; no config write.
  -y, --yes                 Apply: create/update the portal configuration.
  -h, --help                Show this help.

Reads STRIPE_SECRET_KEY, STRIPE_PRICE_BASIC_MONTHLY, STRIPE_PRICE_BASIC_ANNUAL,
STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL, and NEXT_PUBLIC_APP_URL from
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

// Resolve the four price ids up front so a missing one fails loud and early,
// before we touch Stripe. All four are required: switching monthly <-> annual
// needs both cadences present for each tier.
const missing: string[] = [];
const priceInputs = PRICE_ENV_KEYS.map(({ env, label }) => {
  const id = envOrLocal(env);
  if (!id) missing.push(env);
  return { env, label, id: id ?? null };
});
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

const stripe = new Stripe(STRIPE_SECRET_KEY);

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
    interval: price.recurring?.interval ?? null,
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

console.log(`Stripe:             ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE mode' : 'test mode'}`);
console.log(`App URL:            ${appUrl}`);
console.log(`Privacy / Terms:    ${privacyUrl}  |  ${termsUrl}`);
console.log(`Proration:          ${cliArgs.proration}`);
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

const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
  subscription_update: {
    enabled: true,
    default_allowed_updates: ['price'],
    proration_behavior: cliArgs.proration,
    products: productEntries.map((e) => ({ product: e.product, prices: e.prices })),
  },
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

try {
  if (targetConfigId) {
    const updated = await stripe.billingPortal.configurations.update(targetConfigId, {
      features,
      business_profile: businessProfile,
    });
    console.log(`\nDone. Updated portal configuration ${updated.id}.`);
    console.log('Plan switching, cancel, payment-method and invoice features are now enabled on it.');
    if (envOrLocal('STRIPE_PORTAL_CONFIG_ID') !== updated.id) {
      console.log(`\nMake sure STRIPE_PORTAL_CONFIG_ID=${updated.id} is set in .env.local, then: make rebuild`);
    }
  } else {
    const created = await stripe.billingPortal.configurations.create({
      features,
      business_profile: businessProfile,
    });
    console.log(`\nDone. Created portal configuration ${created.id}.`);
    console.log('\nNext steps to make the portal use it:');
    console.log(`  1. Set this in frontend/.env.local:`);
    console.log(`       STRIPE_PORTAL_CONFIG_ID=${created.id}`);
    console.log(`  2. Rebuild so the value is picked up:`);
    console.log(`       make rebuild`);
    console.log(
      '\n(Without STRIPE_PORTAL_CONFIG_ID pinned, the portal keeps using Stripe\'s',
    );
    console.log("account-level default configuration, which does not enable plan switching.)");
  }
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: Stripe portal configuration write failed: ${message}`);
  process.exit(1);
}
