#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types --no-warnings scripts/no-card-trials.mts [--since YYYY-MM-DD]
//
// How the trial without a card (core/noCardTrial.ts) is doing, next to the
// card-first trial over the same period. Read-only: no writes, no Stripe, no
// email.
//
//   No-card trials   every subscription that started without a card (the
//                    users.no_card_trial_subscription_id the webhook stamps),
//                    split into still running (and whether a card has been
//                    added), paid, and ended without paying.
//   Card-first       members whose checkout opened a 7-day trial that asked for
//                    a card and whose subscription then started, split the same
//                    way. That is a checkout tagged card=1, or any 7-day trial
//                    checkout from before the card= tag shipped with the no-card
//                    trial: until then, every trial asked for a card.
//
// "Paid" is users.first_payment_at: a member on their first trial has never
// paid before, so any first payment is this trial converting. The two numbers
// worth comparing are paid per trial started, and paid per checkout opened: a
// no-card trial is expected to start far more often and convert less often per
// trial, and the question is which yields more paying members.
//
// THE COMPARISON THAT DECIDES IT is against the card-first trial from BEFORE
// the switch. With BILLING_NO_CARD_TRIAL on, every first-time trial is a no-card
// one, so after the switch the card-first side holds only inboxes that had
// already had a trial: a handful at most, and not a fair comparison group.
// A --since date before the first no-card checkout brings the earlier
// card-first trials in. The default run prints that command, 30 days back.
//
// --since counts checkouts opened on or after a date (default: the first
// no-card checkout on record). Reads AUTH_DB_PATH from env or .env.local.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

let since: string | null = null;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--since') {
    const value = process.argv[++i] ?? '';
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) {
      console.error('Error: --since expects a date, e.g. 2026-11-10.');
      process.exit(1);
    }
    since = new Date(ms).toISOString();
  } else if (arg === '--help' || arg === '-h') {
    console.log('Usage: node --experimental-strip-types --no-warnings scripts/no-card-trials.mts [--since YYYY-MM-DD]');
    process.exit(0);
  }
}

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(process.cwd(), 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}. Set AUTH_DB_PATH.`);
  process.exit(1);
}
const flag = (process.env.BILLING_NO_CARD_TRIAL || envLocal.BILLING_NO_CARD_TRIAL || '').trim() || '(unset)';
const db = new DatabaseSync(dbPath, { readOnly: true });
// The live site writes to this database whenever a member is active, and
// node:sqlite's busy timeout is zero unless set: a statement that meets the
// site's lock fails on the spot with "database is locked". Wait instead, the
// way the site does (core/db.ts sets busy_timeout too).
db.exec('PRAGMA busy_timeout = 15000;');

type Checkout = { user_id: string; created_at: string; card: string };

// Every 7-day trial checkout, with whether it asked for a card. card=0 marks a
// no-card checkout. card=1, or no tag at all, marks a card-first one: the tag
// shipped with the no-card trial, and every trial before it asked for a card.
const checkouts = db
  .prepare(
    `SELECT user_id, created_at,
            CASE WHEN message LIKE '% card=0%' THEN '0' ELSE '1' END AS card
       FROM audit_events
      WHERE type = 'billing_checkout_started'
        AND message LIKE '% trial=7d %'
      ORDER BY created_at ASC`,
  )
  .all() as Checkout[];

const firstNoCard = checkouts.find((c) => c.card === '0')?.created_at ?? null;
const floor = since ?? firstNoCard;

console.log(`Auth DB:               ${dbPath}`);
console.log(`BILLING_NO_CARD_TRIAL: ${flag}`);
if (!floor) {
  console.log('\nNo no-card checkout on record yet, and no --since given: nothing to compare.');
  process.exit(0);
}
console.log(`Trials since:          ${floor.slice(0, 10)}${since ? '' : ' (the first no-card checkout)'}`);
if (since && firstNoCard && since < firstNoCard) {
  console.log(`No-card since:         ${firstNoCard.slice(0, 10)} (the first no-card checkout)`);
}

type Member = {
  id: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  first_payment_at: string | null;
  paid_welcome_email_sent_at: string | null;
  no_card_trial_subscription_id: string | null;
  no_card_trial_card_added_at: string | null;
};
const memberById = new Map<string, Member>();
for (const row of db
  .prepare(
    `SELECT id, stripe_subscription_id, subscription_status, first_payment_at, paid_welcome_email_sent_at,
            no_card_trial_subscription_id, no_card_trial_card_added_at
       FROM users`,
  )
  .all() as Member[]) {
  memberById.set(row.id, row);
}

type Tally = {
  opened: number;
  started: number;
  running: number;
  runningWithCard: number;
  paid: number;
  ended: number;
  // Earliest and latest checkout counted on this side, so a reader can see how
  // many weeks each column covers before comparing its counts.
  firstAt: string | null;
  lastAt: string | null;
};
const blank = (): Tally => ({
  opened: 0,
  started: 0,
  running: 0,
  runningWithCard: 0,
  paid: 0,
  ended: 0,
  firstAt: null,
  lastAt: null,
});
const noCard = blank();
const cardFirst = blank();

// Each member's latest checkout on EACH side inside the window. A member can
// be on both sides: a card-first checkout abandoned before the switch, then a
// no-card trial after it. Each side's funnel counts its own checkouts.
const latest = new Map<string, Checkout>();
for (const c of checkouts) if (c.created_at >= floor) latest.set(`${c.card}:${c.user_id}`, c);

for (const c of latest.values()) {
  const side = c.card === '0' ? noCard : cardFirst;
  side.opened++;
  if (!side.firstAt || c.created_at < side.firstAt) side.firstAt = c.created_at;
  if (!side.lastAt || c.created_at > side.lastAt) side.lastAt = c.created_at;
  const m = memberById.get(c.user_id);
  if (!m) continue;
  // A trial started: for no-card, the webhook's marker; for card-first, the
  // welcome stamp landing after this checkout opened. An account gets one
  // trial, and the webhook never clears the no-card marker, so a member who
  // carries it never had a card-first trial: their welcome stamp belongs to
  // the no-card trial that followed an abandoned card-first checkout.
  const started =
    c.card === '0'
      ? m.no_card_trial_subscription_id != null
      : m.no_card_trial_subscription_id == null &&
        m.paid_welcome_email_sent_at != null &&
        m.paid_welcome_email_sent_at >= c.created_at;
  if (!started) continue;
  side.started++;
  if (m.first_payment_at) {
    side.paid++;
  } else if (m.subscription_status === 'trialing') {
    side.running++;
    if (c.card === '1' || m.no_card_trial_card_added_at) side.runningWithCard++;
  } else {
    side.ended++;
  }
}

const pct = (n: number, d: number) => (d > 0 ? `${((100 * n) / d).toFixed(0)}%` : '-');
function show(label: string, t: Tally, cardNote: string) {
  console.log(`\n${label}`);
  if (t.firstAt && t.lastAt) {
    console.log(`  Checkouts dated:       ${t.firstAt.slice(0, 10)} to ${t.lastAt.slice(0, 10)}`);
  }
  console.log(`  Checkouts opened:      ${t.opened}`);
  console.log(`  Trials started:        ${t.started}  (${pct(t.started, t.opened)} of checkouts)`);
  console.log(`  Still in trial:        ${t.running}  (${t.runningWithCard} ${cardNote})`);
  console.log(`  Paid:                  ${t.paid}  (${pct(t.paid, t.started)} of trials, ${pct(t.paid, t.opened)} of checkouts)`);
  console.log(`  Ended without paying:  ${t.ended}`);
}
show('No-card trials', noCard, 'have added a card');
show('Card-first trials', cardFirst, 'with a card, as every card-first trial has');

const refused = db
  .prepare(
    `SELECT COUNT(*) AS n FROM audit_events
      WHERE type = 'billing_checkout_started' AND message LIKE '% noCardRefused=inbox%' AND created_at >= ?`,
  )
  .get(floor) as { n: number };
console.log(
  `\nRefused a no-card trial because another account on the same inbox had a trial: ${refused.n}` +
    ' (they got the card-first trial)',
);
console.log(
  '\nTrials still running have no outcome yet. Compare "Paid ... of checkouts" once most of them have ended.',
);
if (!since && firstNoCard) {
  const monthBefore = new Date(Date.parse(firstNoCard) - 30 * 86_400_000).toISOString().slice(0, 10);
  console.log(
    'The comparison that decides it is against the card-first trials from before the switch. To include them:' +
      `\n  make no-card-trials SINCE=${monthBefore}`,
  );
}
db.close();
