#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types --no-warnings scripts/subscriber-headcount.mts [--names]
//
// WHY THIS EXISTS: the admin Total Subscribers chart gives you four numbers and
// no way to interrogate them. When a line moves and you don't know why — "Full
// Subscriber went 113 -> 111, who left?" — the alternatives are re-reading the
// GROUP BY in core/monitoring.ts by hand or guessing.
//
// This runs the chart's OWN bucket rule per row and prints the decomposition,
// then separately accounts for every subscription-carrying account the chart
// does NOT count, because that is where an unexplained drop almost always is:
//
//   • Converting     — the trial ended and Stripe raised the first invoice, but
//                      no payment has cleared yet. Was folded into Full
//                      Subscriber before the first_payment_at split, so a member
//                      here is a -1 against the old number that is CORRECT.
//   • Paused         — subscription_status 'active' with tier 'public': the
//                      pause-instead-of-cancel retention lever. Stripe keeps the
//                      sub active; the webhook grants no access. Also counted as
//                      a Full Subscriber before the tier gate, and also a
//                      correct -1.
//   • Setup withheld — 'trialing' at tier 'public': the card's SetupIntent never
//                      succeeded, so access was withheld. A -1 against the old
//                      Free Trial line.
//   • Unpriced       — a live paid tier whose stripe_price_id maps to no SKU.
//                      NOT an accounting artifact: it means the price table is
//                      missing an id, and MRR is under-reporting the same member.
//
// Read-only. Reads AUTH_DB_PATH from env or .env.local (default data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { classifySubscriberBucket } from '../core/subscriberBucket.ts';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/subscriber-headcount.mts [--names]

Decomposes the admin Total Subscribers chart and accounts for every
subscription-carrying account it does not count, so a headcount move is
explainable without reading the monitoring SQL.

Options:
  --names    List the email of every member in the non-counted groups.
  -h, --help Show this help.

Reads AUTH_DB_PATH from env or .env.local (default frontend/data/auth.db).
Read-only.`);
  process.exit(0);
}
const showNames = args.includes('--names');

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

// Every account carrying subscription state at all — a deliberately wider net
// than the chart's own WHERE, so the rows it drops can be accounted for rather
// than silently vanishing.
const rows = db
  .prepare(
    `SELECT email, tier, subscription_status, payment_grace_reason, first_payment_at,
            cancel_at_period_end, stripe_price_id, paused_until
       FROM users
      WHERE subscription_status IS NOT NULL
        AND subscription_status IN ('active','trialing','past_due')`,
  )
  .all();

const buckets = { fullSubscriber: [], converting: [], freeTrial: [], trialGrace: [] };
const notCounted = { paused: [], setupWithheld: [], other: [] };

for (const r of rows) {
  const verdict = classifySubscriberBucket({
    subscriptionStatus: r.subscription_status,
    tier: r.tier,
    paymentGraceReason: r.payment_grace_reason,
    cancelAtPeriodEnd: Number(r.cancel_at_period_end) === 1,
    firstPaymentAt: r.first_payment_at,
  });
  if (verdict.bucket !== 'notCounted') {
    buckets[verdict.bucket].push(r);
    continue;
  }
  if (r.subscription_status === 'active') notCounted.paused.push(r);
  else if (r.subscription_status === 'trialing') notCounted.setupWithheld.push(r);
  else notCounted.other.push({ ...r, why: verdict.why });
}

const n = (a) => String(a.length).padStart(4);
const total =
  buckets.fullSubscriber.length +
  buckets.converting.length +
  buckets.freeTrial.length +
  buckets.trialGrace.length;

console.log('');
console.log('Total Subscribers — what the chart draws');
console.log('────────────────────────────────────────');
console.log(`${n(buckets.fullSubscriber)}  Full Subscriber   a payment of theirs has cleared`);
console.log(`${n(buckets.converting)}  Converting        invoice raised, charge not yet cleared`);
console.log(`${n(buckets.freeTrial)}  Free Trial        trial running, card validated`);
console.log(`${n(buckets.trialGrace)}  Trial Grace       first charge declined, Stripe retrying`);
console.log(`${String(total).padStart(4)}  TOTAL SUBSCRIBERS`);

console.log('');
console.log('Has a subscription but is NOT a subscriber');
console.log('─────────────────────────────────────────');
console.log(`${n(notCounted.paused)}  Paused            active in Stripe, no tier granted — a bounded break`);
console.log(`${n(notCounted.setupWithheld)}  Setup withheld    trialing, card setup never succeeded — no access`);
console.log(`${n(notCounted.other)}  Other             past_due past its grace window`);

// What the OLD (pre-split) chart would have shown, so a drop is attributable
// line by line instead of guessed at.
const oldFull = buckets.fullSubscriber.length + buckets.converting.length + notCounted.paused.length;
const oldTrial = buckets.freeTrial.length + notCounted.setupWithheld.length;
console.log('');
console.log('Reconciliation against the pre-split chart');
console.log('─────────────────────────────────────────');
console.log(`  Full Subscriber would previously have read ${oldFull} (now ${buckets.fullSubscriber.length})`);
if (buckets.converting.length > 0) {
  console.log(`    -${buckets.converting.length}  now on Converting — their charge has not cleared yet`);
}
if (notCounted.paused.length > 0) {
  console.log(`    -${notCounted.paused.length}  paused — they have no access and are paying nothing`);
}
if (buckets.converting.length === 0 && notCounted.paused.length === 0) {
  console.log('     (no difference — nothing is mid-conversion or paused right now)');
}
console.log(`  Free Trial would previously have read ${oldTrial} (now ${buckets.freeTrial.length})`);
if (notCounted.setupWithheld.length > 0) {
  console.log(`    -${notCounted.setupWithheld.length}  card setup never succeeded — access was withheld`);
}

// A live paid tier we cannot price is a real gap, not an accounting artifact:
// the same member is missing from MRR. Surfaced unconditionally.
const unpriced = [...buckets.fullSubscriber, ...buckets.converting, ...buckets.freeTrial, ...buckets.trialGrace]
  .filter((r) => !r.stripe_price_id);
if (unpriced.length > 0) {
  console.log('');
  console.log(`  ! ${unpriced.length} counted subscriber(s) carry no stripe_price_id — MRR under-reports them`);
  for (const r of unpriced) console.log(`      ${r.email}`);
}

if (showNames) {
  const list = (label, arr, extra = () => '') => {
    if (arr.length === 0) return;
    console.log('');
    console.log(`${label}:`);
    for (const r of arr) console.log(`  ${r.email}${extra(r)}`);
  };
  console.log('');
  console.log('─────────────────────────────────────────');
  list('Converting (charge in flight)', buckets.converting);
  list('Paused', notCounted.paused, (r) => (r.paused_until ? `  resumes ${r.paused_until}` : '  (indefinite)'));
  list('Setup withheld', notCounted.setupWithheld);
  list('Other (off the chart)', notCounted.other, (r) => `  — ${r.why}`);
}
console.log('');
