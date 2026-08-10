#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/enable-portal-cancel-reasons.mts \
//     [--dry-run | --yes]
//
// Turns on the Stripe billing-portal CANCELLATION SURVEY so every future cancel
// records a WHY. Stripe only attaches `cancellation_details` (the feedback enum
// + optional free-text comment) to a subscription when the portal's cancellation
// flow is configured to collect a reason — otherwise the webhook's reason-capture
// (see core/cancellationReason.ts) has nothing to capture. This script flips that
// configuration on.
//
// It targets the portal configuration named by STRIPE_PORTAL_CONFIG_ID (the same
// one app/api/billing/portal/route.ts pins), or the account's default active
// configuration when that env var is unset. It PRESERVES the existing
// subscription_cancel mode (e.g. at_period_end) and only adds reason collection.
//
// CHANGES THE LIVE CUSTOMER-FACING PORTAL. Dry-run by default in spirit: it
// refuses to write without --yes, and --dry-run just prints the plan.

import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';

type Args = { dryRun: boolean; yes: boolean; help: boolean };

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
  const args: Args = { dryRun: false, yes: false, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
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
  node --experimental-strip-types --no-warnings scripts/enable-portal-cancel-reasons.mts \\
    [--dry-run | --yes]

Enables the Stripe billing-portal cancellation survey (a feedback enum + free-
text comment) so future cancellations record a reason. Preserves the existing
subscription_cancel mode; only adds reason collection.

  --dry-run   Print the target configuration and the change; no writes.
  -y, --yes   Apply the update to the live portal configuration.
  -h, --help  Show this help.

Targets STRIPE_PORTAL_CONFIG_ID if set, else the account's default active
portal configuration. Reads STRIPE_SECRET_KEY from env or .env.local.

CHANGES THE LIVE CUSTOMER-FACING PORTAL.`);
}

// Stripe's fixed set of cancellation-reason options. All eight are offered so
// the survey mirrors core/cancellationReason.ts's label map; Stripe requires at
// least three.
const REASON_OPTIONS = [
  'too_expensive',
  'missing_features',
  'switched_service',
  'unused',
  'customer_service',
  'too_complex',
  'low_quality',
  'other',
] as const;

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
const configId = envOrLocal('STRIPE_PORTAL_CONFIG_ID') ?? null;

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Resolve the target configuration: the pinned id, else the default active one.
let config: Stripe.BillingPortal.Configuration;
try {
  if (configId) {
    config = await stripe.billingPortal.configurations.retrieve(configId);
  } else {
    const list = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    const def = list.data.find((c) => c.is_default) ?? list.data[0];
    if (!def) {
      console.error(
        'Error: no active billing-portal configuration found. Create one in the Stripe dashboard (Settings → Billing → Customer portal), or set STRIPE_PORTAL_CONFIG_ID.',
      );
      process.exit(1);
    }
    config = def;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`Error: could not load portal configuration: ${message}`);
  process.exit(1);
}

const subCancel = config.features?.subscription_cancel;
const currentMode = subCancel?.mode ?? 'at_period_end';
const currentlyEnabled = subCancel?.enabled ?? false;
const reasonEnabled = subCancel?.cancellation_reason?.enabled ?? false;

console.log(`Portal configuration: ${config.id}${config.is_default ? ' (default)' : ''}`);
console.log(`  subscription_cancel.enabled:            ${currentlyEnabled}`);
console.log(`  subscription_cancel.mode:               ${currentMode}`);
console.log(`  subscription_cancel.cancellation_reason: ${reasonEnabled ? 'enabled' : 'disabled'}  →  enabled`);
console.log(`  reason options:                         ${REASON_OPTIONS.join(', ')}`);

if (currentlyEnabled && reasonEnabled) {
  console.log('\nCancellation reason collection is already enabled. Nothing to do.');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log('\nRefusing to change the live portal without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

// Enabling cancellation_reason requires subscription_cancel.enabled=true; keep
// the existing mode so we don't silently change when access ends.
try {
  const updated = await stripe.billingPortal.configurations.update(config.id, {
    features: {
      subscription_cancel: {
        enabled: true,
        mode: currentMode,
        cancellation_reason: {
          enabled: true,
          options: [...REASON_OPTIONS],
        },
      },
    },
  });
  const nowEnabled = updated.features?.subscription_cancel?.cancellation_reason?.enabled ?? false;
  console.log(`\nDone. Cancellation reason collection is now ${nowEnabled ? 'ENABLED' : 'unchanged'} on ${updated.id}.`);
  console.log('Future cancellations will record a feedback reason (and any comment) into the audit log.');
  console.log('Verify with:  make churn-breakdown   (the "Cancel reasons" section will start filling in)');
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`\nError: portal configuration update failed: ${message}`);
  process.exit(1);
}
