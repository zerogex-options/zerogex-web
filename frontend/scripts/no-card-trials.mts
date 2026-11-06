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
//                    a card (billing_checkout_started ... trial=7d card=1) and
//                    whose subscription then started, split the same way.
//
// "Paid" is users.first_payment_at: a member on their first trial has never
// paid before, so any first payment is this trial converting. The two numbers
// worth comparing are paid per trial started, and paid per checkout opened: a
// no-card trial is expected to start far more often and convert less often per
// trial, and the question is which yields more paying members.
//
// --since narrows both sides to trials started on or after a date (default:
// the first no-card checkout on record, so the comparison covers the same
// weeks). Reads AUTH_DB_PATH from env or .env.local.

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

type Checkout = { user_id: string; created_at: string; card: string };

// Each member's most recent trial checkout, with whether it asked for a card.
// Only checkouts the card= tag exists on (it shipped with the no-card trial).
const checkouts = db
  .prepare(
    `SELECT user_id, created_at,
            CASE WHEN message LIKE '% card=0%' THEN '0' ELSE '1' END AS card
       FROM audit_events
      WHERE type = 'billing_checkout_started'
        AND message LIKE '% trial=7d %'
        AND (message LIKE '% card=0%' OR message LIKE '% card=1%')
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

type Tally = { opened: number; started: number; running: number; runningWithCard: number; paid: number; ended: number };
const blank = (): Tally => ({ opened: 0, started: 0, running: 0, runningWithCard: 0, paid: 0, ended: 0 });
const noCard = blank();
const cardFirst = blank();

// The latest checkout per member inside the window decides which side they are on.
const latest = new Map<string, Checkout>();
for (const c of checkouts) if (c.created_at >= floor) latest.set(c.user_id, c);

for (const c of latest.values()) {
  const side = c.card === '0' ? noCard : cardFirst;
  side.opened++;
  const m = memberById.get(c.user_id);
  if (!m) continue;
  // A trial started: for no-card, the webhook's marker; for card-first, the
  // welcome stamp landing after this checkout opened.
  const started =
    c.card === '0'
      ? m.no_card_trial_subscription_id != null
      : m.paid_welcome_email_sent_at != null && m.paid_welcome_email_sent_at >= c.created_at;
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
db.close();
