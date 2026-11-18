#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/pause-subscription.mts \
//     --email <addr> --months <1|2|3> [--force] [--dry-run | --yes]
//
// Pause ONE member's subscription for 1-3 months on their behalf, for a member
// who asks by email instead of using the Account page. It is the SAME pause the
// Account page's "Pause instead of canceling" sets
// (app/api/billing/cancel-flow/route.ts): Stripe pause_collection with behavior
// 'void', resuming exactly N calendar months from now (core/subscriptionPause.ts),
// any scheduled cancel cleared. Same rules too: only a live (active/trialing)
// subscription on a monthly plan.
//
// What the member gets: no access and no charge while paused, then it resumes
// on its own. Stripe keeps billing on schedule during a pause and voids every
// bill dated inside it, so N months paused skips exactly N monthly bills. A
// member who renewed just before pausing loses nothing: the month they paid for
// covers the stretch from the resume to the next bill. The preview prints the
// bills that will be skipped and the next charge date, which is what to tell
// the member.
//
// On a Pro plan the member also loses their API key, for good. Access drops
// out of Pro, the webhook revokes every key on that drop, and the key service
// can revoke a key but not suspend one, so the old key never works again
// (core/subscriptionPause.ts pauseRevokesApiKeys). The preview says so, with the
// link where they make a new key once Pro is back. Put that in your reply too:
// anything still using the old key fails after the pause until it's replaced.
//
// Why not the Stripe Dashboard: its pause resumes on a calendar DAY. Pick the
// member's billing day and that bill can land just after the resume and be
// charged. Resuming at the same minute N months out, as the app does, can't.
//
// Everything downstream stays automatic. Stripe emits
// customer.subscription.updated, and the webhook switches access off and
// records paused_until, so the Account page shows "paused, resumes on <date>"
// with a Resume now button. This waits up to 30 seconds to confirm the site
// picked it up.
//
// SAFETY: dry run by default; --yes applies. Refuses a subscription that isn't
// active/trialing (a member whose payment failed should fix it, not pause), one
// not on a monthly plan, and one already paused (a no-op). A scheduled cancel is
// the member's own decision to leave, and the pause clears it, so that needs
// --force.
//
// Records an audit_events row (type billing_pause_requested, as the Account page
// does). Sends NO email; tell the member yourself.
//
// Reads STRIPE_SECRET_KEY + STRIPE_PRICE_* from env or .env.local. Set
// AUTH_DB_PATH to override the DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import Stripe from 'stripe';

import { loadEnvLocal, warnIfPricesUnconfigured } from './env-local.mts';
import {
  PAUSE_MONTH_OPTIONS,
  billsDuringPause,
  computeResumesAtUnix,
  derivePauseState,
  isPausableCadence,
  pauseRevokesApiKeys,
} from '../core/subscriptionPause.ts';

loadEnvLocal();

// Where a member makes a new API key, for the note to them (as
// quarterly-receipt.mts builds its links).
const API_KEY_URL = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://zerogex.io').replace(/\/+$/, '')}/account#api-access`;

// The type the Account page's pause writes, so an operator pause reads the same
// in diagnose-user and anywhere pause requests are counted.
const AUDIT_TYPE = 'billing_pause_requested';
// How long to wait for the webhook to mirror the pause onto the users row.
const WEBHOOK_WAIT_SECONDS = 30;

type Args = {
  email: string | null;
  months: string | null;
  force: boolean;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { email: null, months: null, force: false, dryRun: false, yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--months') args.months = (argv[++i] ?? '').trim() || null;
    else if (arg === '--force') args.force = true;
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
  node --experimental-strip-types --no-warnings scripts/pause-subscription.mts \\
    --email <addr> --months <1|2|3> [--force] [--dry-run | --yes]

Pauses one member's monthly subscription on their behalf, exactly as the
Account page's "Pause instead of canceling" does: no access and no charge for
the chosen months, then it resumes on its own. The preview lists the bills the
pause skips and the date of the next charge. On a Pro plan it also says the
member's API key is revoked for good, and where they make a new one.

Options:
      --email     Member's email address (required).
      --months    1, 2 or 3, the Account page's choices (required).
      --force     Pause even though the member has a cancel scheduled. The
                  pause clears it, so they'll be billed after the pause unless
                  they cancel again.
      --dry-run   Print the plan; no writes. (Default without --yes.)
  -y, --yes       Apply: pause in Stripe and write an audit row.
  -h, --help      Show this help.

Refuses a subscription that isn't active or trialing, isn't on a monthly plan,
or is already paused. Sends NO email.

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

// Mirror core/stripe.ts getCurrentPeriodEndUnix (as set-cancellation.mts does):
// item-level first (2024+ API), then the legacy sub-level. On a trial this is
// trial_end.
function currentPeriodEndUnix(subscription: Stripe.Subscription): number | null {
  const item = subscription.items?.data?.[0];
  const itemValue = (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  if (typeof itemValue === 'number') return itemValue;
  const subValue = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof subValue === 'number') return subValue;
  return null;
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
const isoOf = (unix: number) => new Date(unix * 1000).toISOString();
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
// Strict on purpose. The Account page clamps a bad value to a valid one, but a
// typo here should stop the run, not pause someone for a length nobody chose.
const months = Number(cliArgs.months);
if (!cliArgs.months || !(PAUSE_MONTH_OPTIONS as readonly number[]).includes(months)) {
  console.error(
    `Error: --months must be ${PAUSE_MONTH_OPTIONS.join(', ').replace(/, (\d+)$/, ' or $1')} (the Account page's choices); got "${cliArgs.months ?? ''}".`,
  );
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
const { priceIdToSku } = await import('../core/stripe.ts');

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
  fail(`${user.email} has no subscription on file (status ${user.subscription_status ?? 'none'}). Nothing to pause.`);
}

// The live subscription is the source of truth; the row can lag a webhook.
let subscription: Stripe.Subscription;
try {
  subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
} catch (err) {
  fail(
    `could not retrieve subscription ${user.stripe_subscription_id}: ${err instanceof Error ? err.message : 'unknown error'}`,
  );
}

const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
const sku = priceId ? priceIdToSku(priceId) : null;
const planLabel = sku ? `${sku.tier} ${sku.cadence}` : `unknown (price ${priceId ?? 'none'} maps to no plan)`;
// Pro: the pause revokes the member's API key, and it can't come back.
const revokesApiKey = pauseRevokesApiKeys(sku?.tier);
const periodEnd = currentPeriodEndUnix(subscription);
const existingPause = derivePauseState(
  subscription.pause_collection
    ? {
        behavior: subscription.pause_collection.behavior ?? null,
        resumesAt: subscription.pause_collection.resumes_at ?? null,
      }
    : null,
);

console.log(`Auth DB:           ${dbPath}`);
console.log(`Member:            ${user.email} (id=${user.id}, tier ${user.tier ?? 'public'})`);
console.log(`Subscription:      ${subscription.id} (${subscription.status})`);
console.log(`Plan:              ${planLabel}`);
console.log(`Next bill:         ${when(periodEnd)}`);
console.log(`Scheduled cancel:  ${subscription.cancel_at_period_end ? `yes, at ${when(periodEnd)}` : 'no'}`);

// --- Same gate as the Account page ------------------------------------------
if (subscription.status !== 'active' && subscription.status !== 'trialing') {
  fail(
    `${subscription.id} is '${subscription.status}'. Only an active or trialing subscription can be paused.`,
    'A member whose payment failed should fix it first; the Account page refuses this too.',
  );
}
if (existingPause.paused) {
  console.log('');
  console.log(
    `Already paused (${subscription.pause_collection?.behavior ?? 'unknown behavior'}), ` +
      (existingPause.resumesAtIso
        ? `resuming ${when(Date.parse(existingPause.resumesAtIso) / 1000)}.`
        : 'with no resume date.'),
  );
  console.log('Nothing to do.');
  process.exit(0);
}
if (!isPausableCadence(sku?.cadence)) {
  fail(
    `the plan is ${planLabel}, not monthly.`,
    'A pause across a quarterly or annual renewal voids the whole multi-month bill, and',
    'one that misses it takes away months the member paid for. The Account page only',
    'offers a pause on monthly plans for the same reason.',
  );
}
if (subscription.cancel_at_period_end && !cliArgs.force) {
  fail(
    `${user.email} has a cancel scheduled for ${when(periodEnd)}.`,
    'Pausing clears it, as it does on the Account page, so they would be billed again',
    'after the pause unless they cancel again. If they asked for a pause instead,',
    're-run with FORCE=1 (make) or --force.',
  );
}

// --- The plan --------------------------------------------------------------
const nowMs = Date.now();
const nowUnix = Math.floor(nowMs / 1000);
const resumesAt = computeResumesAtUnix(nowMs, months);
const bills = billsDuringPause(subscription.billing_cycle_anchor, nowUnix, resumesAt);
// The preview dates bills from the billing anchor. Check that it lands on the
// next bill Stripe reports before trusting any of the dates it prints.
const firstBill = bills.skippedUnix[0] ?? bills.nextChargeUnix;
const datesLineUp = periodEnd != null && firstBill != null && Math.abs(firstBill - periodEnd) <= 3600;

console.log('');
console.log(`Pause:             ${months} month${months === 1 ? '' : 's'}, from now until ${when(resumesAt)}`);
console.log(`                   (resumes_at ${isoOf(resumesAt)})`);
console.log(`Access:            off from now, back on its own ${when(resumesAt)}`);
if (revokesApiKey) {
  console.log(`API keys:          REVOKED when access goes off, and they can't be turned back on.`);
  console.log(`                   Tell the member to make a new one at ${API_KEY_URL}`);
  console.log(`                   once Pro is back, and swap it in wherever the old key is used.`);
}
console.log(
  `Bills skipped:     ${bills.skippedUnix.length ? bills.skippedUnix.map(when).join('; ') : 'none'}`,
);
console.log(`Next charge:       ${when(bills.nextChargeUnix)}`);
if (subscription.cancel_at_period_end) {
  console.log('Scheduled cancel:  will be CLEARED (FORCE=1)');
}
if (!datesLineUp) {
  console.log('');
  console.log(`  ! Stripe says the next bill is ${when(periodEnd)}, which doesn't match these dates.`);
  console.log('    The pause itself is still right. Check the bill dates in Stripe before you quote them.');
}

if (!cliArgs.yes) {
  console.log('');
  console.log('Dry run: nothing changed. Re-run with YES=1 (make) or --yes to pause.');
  process.exit(0);
}

// --- Apply -----------------------------------------------------------------
try {
  await stripe.subscriptions.update(subscription.id, {
    pause_collection: { behavior: 'void', resumes_at: resumesAt },
    // As on the Account page: choosing a pause supersedes a pending cancel.
    cancel_at_period_end: false,
  });
} catch (err) {
  fail(`Stripe refused the pause: ${err instanceof Error ? err.message : 'unknown error'}`);
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
    `Operator pause (make pause-subscription) for sub ${subscription.id}: ${months} month(s), resumes ${isoOf(resumesAt)}` +
      (subscription.cancel_at_period_end ? '; scheduled cancel cleared' : ''),
    new Date().toISOString(),
  );
} catch (err) {
  // The pause is already live in Stripe, and the webhook still records it. Only
  // the note that it was done by hand is missing.
  console.warn(
    `  ! Paused in Stripe, but the audit row didn't save: ${err instanceof Error ? err.message : 'unknown error'}`,
  );
}

console.log('');
console.log(`Paused in Stripe. Waiting up to ${WEBHOOK_WAIT_SECONDS}s for the site to pick it up...`);
const readBack = db.prepare(`SELECT tier, paused_until FROM users WHERE id = ?`);
let synced: { tier: string | null; paused_until: string | null } | undefined;
for (let waited = 0; waited < WEBHOOK_WAIT_SECONDS; waited++) {
  const row = readBack.get(user.id) as { tier: string | null; paused_until: string | null } | undefined;
  if (row?.paused_until) {
    synced = row;
    break;
  }
  await sleep(1000);
}

console.log('');
console.log(`Done. ${user.email} is paused for ${months} month${months === 1 ? '' : 's'}.`);
console.log(`  Access:         off now, back on its own ${when(resumesAt)}`);
console.log(`  Bills skipped:  ${bills.skippedUnix.length ? bills.skippedUnix.map(when).join('; ') : 'none'}`);
console.log(`  Next charge:    ${when(bills.nextChargeUnix)}${datesLineUp ? '' : '  (check in Stripe, see above)'}`);
if (revokesApiKey) {
  console.log(`  API keys:       revoked by the pause, for good. New one at ${API_KEY_URL} once Pro is back`);
}
if (synced) {
  console.log(`  The site has it: tier ${synced.tier ?? 'public'}, paused until ${synced.paused_until}.`);
} else {
  console.log(`  The site hasn't heard yet, so access is still on until the webhook lands. Check in a`);
  console.log(`  minute with: make diagnose-user EMAIL=${user.email}`);
}
console.log(
  revokesApiKey
    ? 'No email was sent. Tell the member, including that their API key is gone and how to make a new one.'
    : 'No email was sent. Tell the member.',
);
