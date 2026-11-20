#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/resume-subscription.mts \
//     --email <addr> [--dry-run | --yes]
//
// End ONE member's pause now, on their behalf. It is the Account page's
// "Resume now" (action 'resume' in app/api/billing/cancel-flow/route.ts), for a
// member who asks by email instead of clicking it: it clears Stripe's
// pause_collection and changes nothing else.
//
// What the member gets: access back as soon as the webhook hears, and billing
// on its usual monthly date. A cancel they scheduled STAYS scheduled: access
// lasts until the period ends, then the plan ends, and nothing more is charged.
// That is also the fix for a member who paused and then canceled
// (docs/outreach/2026-11-20-mat-paused-then-canceled.md). Their cancel email
// promised access until the period ended, but the pause had already switched
// it off.
//
// The preview says when access ends (or that it carries on) and the next
// charge. If the pause already voided this period's bill, resuming hands over
// the rest of the period with no payment behind it, as Resume now does in the
// app. The preview flags that, so it is a choice and not a surprise.
//
// On a Pro plan the pause revoked the member's API key for good
// (core/subscriptionPause.ts pauseRevokesApiKeys), and resuming doesn't bring
// it back. The preview says so, with the link where they make a new one.
//
// Everything downstream stays automatic. Stripe emits
// customer.subscription.updated, and the webhook turns access back on and
// clears paused_until. This waits up to 30 seconds to confirm the site picked
// it up.
//
// SAFETY: dry run by default; --yes applies. Refuses a subscription that isn't
// active or trialing. One that isn't paused is left alone.
//
// Records an audit_events row (type billing_resume_requested, as the Account
// page does). Sends NO email; tell the member yourself.
//
// Reads STRIPE_SECRET_KEY + STRIPE_PRICE_* from env or .env.local. Set
// AUTH_DB_PATH to override the DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import Stripe from 'stripe';

import { loadEnvLocal, warnIfPricesUnconfigured } from './env-local.mts';
import { derivePauseState, pauseRevokesApiKeys, previewResume } from '../core/subscriptionPause.ts';

loadEnvLocal();

// Where a member makes a new API key, for the note to them (as
// pause-subscription.mts builds it).
const API_KEY_URL = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://zerogex.io').replace(/\/+$/, '')}/account#api-access`;

// The type the Account page's Resume now writes, so an operator resume reads
// the same in diagnose-user.
const AUDIT_TYPE = 'billing_resume_requested';
// How long to wait for the webhook to mirror the resume onto the users row.
const WEBHOOK_WAIT_SECONDS = 30;

type Args = {
  email: string | null;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { email: null, dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
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
  node --experimental-strip-types --no-warnings scripts/resume-subscription.mts \\
    --email <addr> [--dry-run | --yes]

Ends one member's pause now, on their behalf, exactly as the Account page's
"Resume now" does: access comes back, and billing carries on at the usual
monthly date. A scheduled cancel stays: access then lasts until the period
ends, the plan ends, and nothing more is charged.

Options:
      --email     Member's email address (required).
      --dry-run   Print the plan; no writes. (Default without --yes.)
  -y, --yes       Apply: resume in Stripe and write an audit row.
  -h, --help      Show this help.

Refuses a subscription that isn't active or trialing. Sends NO email.

Reads STRIPE_SECRET_KEY and STRIPE_PRICE_* from env or .env.local. Set
AUTH_DB_PATH to override the default DB path (data/auth.db).`);
}

function fail(message: string, ...detail: string[]): never {
  console.error('');
  console.error(`REFUSING: ${message}`);
  for (const line of detail) console.error(`  ${line}`);
  console.error('');
  console.error('Nothing was changed.');
  process.exit(1);
}

// Dates in Eastern time, the time zone every outreach note uses.
const etFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});
const when = (unix: number | null | undefined) =>
  typeof unix === 'number' && Number.isFinite(unix) ? etFormat.format(new Date(unix * 1000)) : 'unknown';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Error: STRIPE_SECRET_KEY is not set (env or .env.local).');
  process.exit(1);
}
warnIfPricesUnconfigured();

// Checked before opening: opening a path that doesn't exist would create an
// empty database there and report "no user found" instead of the real problem.
const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

// Imported after loadEnvLocal: core/db.ts reads AUTH_DB_PATH and core/stripe.ts
// builds its price table at module load.
const { getDb } = await import('../core/db.ts');
const { getCurrentPeriodEndUnix, priceIdToSku } = await import('../core/stripe.ts');

const db = getDb();
const stripe = new Stripe(secretKey);

type UserRow = {
  id: string;
  email: string;
  tier: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

const user = db
  .prepare(
    `SELECT id, email, tier, subscription_status, stripe_subscription_id
       FROM users WHERE lower(email) = ? LIMIT 1`,
  )
  .get(cliArgs.email) as UserRow | undefined;

if (!user) fail(`no user found with email ${cliArgs.email}.`);
if (!user.stripe_subscription_id) {
  fail(`${user.email} has no subscription on file (status ${user.subscription_status ?? 'none'}). Nothing to resume.`);
}

// The live subscription is the source of truth; the row can lag a webhook. Its
// latest invoice is this period's bill, which says whether the period was paid.
let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, { expand: ['latest_invoice'] });
} catch (err) {
  fail(
    `could not retrieve subscription ${user.stripe_subscription_id}: ${err instanceof Error ? err.message : 'unknown error'}`,
  );
}

const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
const sku = priceId ? priceIdToSku(priceId) : null;
const planLabel = sku ? `${sku.tier} ${sku.cadence}` : `unknown (price ${priceId ?? 'none'} maps to no plan)`;
const periodEnd = getCurrentPeriodEndUnix(subscription);
const pause = derivePauseState(
  subscription.pause_collection
    ? {
        behavior: subscription.pause_collection.behavior ?? null,
        resumesAt: subscription.pause_collection.resumes_at ?? null,
      }
    : null,
);
const latestInvoice =
  subscription.latest_invoice && typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
const bill = latestInvoice
  ? `its bill ${latestInvoice.id} (${(latestInvoice.amount_due / 100).toFixed(2)} ${latestInvoice.currency.toUpperCase()}) is ${latestInvoice.status ?? 'unknown'}`
  : 'no bill on record';

console.log(`Auth DB:           ${dbPath}`);
console.log(`Member:            ${user.email} (id=${user.id}, tier ${user.tier ?? 'public'})`);
console.log(`Subscription:      ${subscription.id} (${subscription.status})`);
console.log(`Plan:              ${planLabel}`);
console.log(
  `Paused:            ${
    pause.paused
      ? pause.resumesAtIso
        ? `yes, until ${when(Date.parse(pause.resumesAtIso) / 1000)}`
        : 'yes, with no resume date'
      : 'no'
  }`,
);
console.log(`This period:       ends ${when(periodEnd)}; ${bill}`);
console.log(`Scheduled cancel:  ${subscription.cancel_at_period_end ? `yes, at ${when(periodEnd)}` : 'no'}`);

// --- Gates -----------------------------------------------------------------
if (subscription.status !== 'active' && subscription.status !== 'trialing') {
  fail(
    `${subscription.id} is '${subscription.status}'. Only an active or trialing subscription is resumed here.`,
    `Look at it first: make diagnose-user EMAIL=${user.email}`,
  );
}
if (!pause.paused) {
  console.log('');
  console.log('Not paused. Nothing to do.');
  process.exit(0);
}

// --- The plan --------------------------------------------------------------
const plan = previewResume({
  cancelAtPeriodEnd: subscription.cancel_at_period_end,
  periodEndUnix: periodEnd,
  latestInvoiceStatus: latestInvoice?.status ?? null,
});
// On a Pro plan the pause already revoked the API key, for good.
const keyGone = pauseRevokesApiKeys(sku?.tier);

const accessLine = subscription.cancel_at_period_end
  ? `back on now, until ${when(plan.accessUntilUnix)}, when the scheduled cancel ends the plan`
  : 'back on now, and it carries on';
const chargeLine = subscription.cancel_at_period_end
  ? 'none. The scheduled cancel stays, so nothing more is billed.'
  : subscription.status === 'trialing'
    ? `${when(plan.nextChargeUnix)}, the first charge, when the trial ends`
    : `${when(plan.nextChargeUnix)}, the usual monthly bill`;

console.log('');
console.log("Resume:            clears the pause now, as the Account page's Resume now does");
console.log(`Access:            ${accessLine}`);
console.log(`Next charge:       ${chargeLine}`);
if (keyGone) {
  console.log(`API keys:          the pause revoked them for good, and resuming doesn't bring them back.`);
  console.log(`                   Tell the member to make a new one at ${API_KEY_URL}`);
}
if (plan.periodUnpaid) {
  console.log('');
  console.log(`  ! This period's bill was voided (a pause voids every bill inside it), so they get`);
  console.log(`    the rest of the period, until ${when(periodEnd)}, without paying for it.`);
  console.log('    Resume now in the app does the same.');
}

if (!cliArgs.yes) {
  console.log('');
  console.log('Dry run: nothing changed. Re-run with YES=1 (make) or --yes to resume.');
  process.exit(0);
}

// --- Apply -----------------------------------------------------------------
try {
  // An empty string clears pause_collection, as the Account page's Resume now
  // does. Nothing else changes: a scheduled cancel stays scheduled.
  await stripe.subscriptions.update(subscription.id, { pause_collection: '' });
} catch (err) {
  fail(`Stripe refused the resume: ${err instanceof Error ? err.message : 'unknown error'}`);
}

try {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, NULL, ?, 'manual-script', ?, ?)`,
  ).run(
    `audit_${crypto.randomBytes(12).toString('hex')}`,
    AUDIT_TYPE,
    user.id,
    user.email,
    `Operator resume (make resume-subscription) for sub ${subscription.id}: was paused until ${pause.resumesAtIso ?? 'no date'}` +
      (subscription.cancel_at_period_end ? '; scheduled cancel kept' : ''),
    new Date().toISOString(),
  );
} catch (err) {
  // The resume is already live in Stripe, and the webhook still records it.
  // Only the note that it was done by hand is missing.
  console.warn(
    `  ! Resumed in Stripe, but the audit row didn't save: ${err instanceof Error ? err.message : 'unknown error'}`,
  );
}

console.log('');
console.log(`Resumed in Stripe. Waiting up to ${WEBHOOK_WAIT_SECONDS}s for the site to pick it up...`);
const readBack = db.prepare(`SELECT tier, paused_until FROM users WHERE id = ?`);
let synced: { tier: string | null; paused_until: string | null } | undefined;
for (let waited = 0; waited < WEBHOOK_WAIT_SECONDS; waited++) {
  const row = readBack.get(user.id) as { tier: string | null; paused_until: string | null } | undefined;
  if (row && row.paused_until == null) {
    synced = row;
    break;
  }
  await sleep(1000);
}

console.log('');
console.log(`Done. ${user.email} is no longer paused.`);
console.log(`  Access:         ${accessLine}`);
console.log(`  Next charge:    ${chargeLine}`);
if (keyGone) {
  console.log(`  API keys:       still gone. New one at ${API_KEY_URL}`);
}
if (synced) {
  console.log(`  The site has it: tier ${synced.tier ?? 'public'}.`);
  if ((synced.tier ?? 'public') === 'public') {
    console.log(`  ! Access still reads public. Check: make diagnose-user EMAIL=${user.email}`);
  }
} else {
  console.log(`  The site hasn't heard yet, so access stays off until the webhook lands. Check in a`);
  console.log(`  minute with: make diagnose-user EMAIL=${user.email}`);
}
console.log(
  keyGone
    ? 'No email was sent. Tell the member, including that they need a new API key.'
    : 'No email was sent. Tell the member.',
);
