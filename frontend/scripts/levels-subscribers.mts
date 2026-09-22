#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/levels-subscribers.mts [--json]
//
// Read-only readout of the free daily levels email list. Writes nothing.
//
// WHY THIS EXISTS. The number that decides whether this channel is working is
// the DOUBLE OPT-IN RATE — of the people who submitted an address, how many
// clicked the confirmation link. It cannot be read off any existing surface:
// countLevelsSubscribers() answers a different question, and PostHog holds
// only half of it. This turns "remember to check that" into one command.
//
// TWO DEFINITIONS THAT ARE EASY TO GET WRONG, in the spirit of
// docs/growth-metric-definitions.md:
//
//   * EVER CONFIRMED is `confirmed_at IS NOT NULL`, regardless of what
//     happened afterwards. Somebody who confirmed and later unsubscribed DID
//     confirm; counting them as a failure of the opt-in flow would blame the
//     confirmation email for a decision made weeks later. countLevelsSubscribers()
//     deliberately does not work this way — it answers "who can we mail today",
//     which is the send list, not the funnel.
//
//   * The denominator here is ROWS, not submissions. A malformed address, a
//     honeypot trip, a rate-limited attempt and a resubmission of an address
//     already on the list all fail to create a row. So this rate is an UPPER
//     BOUND on the true confirm rate; PostHog's levels_email_submitted is the
//     honest denominator, and the gap between the two counts is itself the
//     signal. Both numbers are printed side by side below with that caveat.

import fs from 'node:fs';
import path from 'node:path';

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
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const asJson = process.argv.includes('--json');
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage:
  node --experimental-strip-types scripts/levels-subscribers.mts [--json]

Read-only readout of the free daily levels email list: funnel counts, the
double opt-in rate, and the split by preferred symbol and signup page.
Reads AUTH_DB_PATH from the environment or frontend/.env.local.`);
  process.exit(0);
}

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
if (!process.env.AUTH_DB_PATH && envLocal.AUTH_DB_PATH) {
  process.env.AUTH_DB_PATH = envLocal.AUTH_DB_PATH;
}

const { getDb } = await import('../core/db.ts');
const db = getDb();

type Row = Record<string, number | string | null>;

const funnel = db
  .prepare(
    `SELECT
       COUNT(*)                                                          AS submitted,
       SUM(CASE WHEN confirmed_at IS NOT NULL THEN 1 ELSE 0 END)         AS ever_confirmed,
       SUM(CASE WHEN confirmed_at IS NULL AND unsubscribed_at IS NULL
                THEN 1 ELSE 0 END)                                       AS pending,
       SUM(CASE WHEN confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
                THEN 1 ELSE 0 END)                                       AS active,
       SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END)      AS unsubscribed,
       SUM(CASE WHEN last_sent_at IS NOT NULL THEN 1 ELSE 0 END)         AS ever_sent
     FROM levels_subscribers`,
  )
  .get() as Row;

const n = (v: unknown) => Number(v ?? 0);
const submitted = n(funnel.submitted);
const everConfirmed = n(funnel.ever_confirmed);
const confirmRate = submitted > 0 ? (everConfirmed / submitted) * 100 : 0;

const bySymbol = db
  .prepare(
    `SELECT symbol, COUNT(*) AS n
       FROM levels_subscribers
      WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
      GROUP BY symbol ORDER BY n DESC, symbol ASC`,
  )
  .all() as Row[];

const bySource = db
  .prepare(
    `SELECT COALESCE(source, '(none)') AS source,
            COUNT(*)                                                   AS submitted,
            SUM(CASE WHEN confirmed_at IS NOT NULL THEN 1 ELSE 0 END)  AS confirmed
       FROM levels_subscribers
      GROUP BY source ORDER BY submitted DESC`,
  )
  .all() as Row[];

// A pending row whose confirmation went out more than this long ago is very
// unlikely to ever be clicked. Reported separately so a healthy "waiting" pile
// on a growing list is not mistaken for a broken confirmation email.
const STALE_PENDING_HOURS = 48;
const stalePending = n(
  (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM levels_subscribers
          WHERE confirmed_at IS NULL AND unsubscribed_at IS NULL
            AND confirm_sent_at IS NOT NULL
            AND confirm_sent_at < ?`,
      )
      .get(new Date(Date.now() - STALE_PENDING_HOURS * 3600_000).toISOString()) as Row
  ).n,
);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        submitted,
        everConfirmed,
        confirmRatePct: Number(confirmRate.toFixed(1)),
        pending: n(funnel.pending),
        stalePending,
        active: n(funnel.active),
        unsubscribed: n(funnel.unsubscribed),
        everSent: n(funnel.ever_sent),
        bySymbol,
        bySource,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const pct = (v: number) => `${v.toFixed(1)}%`;

console.log(`Free daily levels email — ${process.env.AUTH_DB_PATH ?? '(default DB)'}\n`);
console.log('Funnel');
console.log(`  Submitted (rows written)   ${submitted}`);
console.log(`  Ever confirmed             ${everConfirmed}   ${submitted ? pct(confirmRate) : '—'}  <- double opt-in rate`);
console.log(`  Still pending              ${n(funnel.pending)}${stalePending ? `   (${stalePending} older than ${STALE_PENDING_HOURS}h)` : ''}`);
console.log(`  Unsubscribed               ${n(funnel.unsubscribed)}`);
console.log(`  ACTIVE (today's send list) ${n(funnel.active)}`);
console.log(`  Have received a digest     ${n(funnel.ever_sent)}`);

if (submitted === 0) {
  console.log('\nNo subscribers yet. The rate above is undefined, not zero.');
} else if (submitted < 20) {
  // Said plainly so a 100% or a 33% off four rows is not read as a trend.
  const noun = submitted === 1 ? '1 row is' : `${submitted} rows are`;
  console.log(`\nNOTE: ${noun} too few to read a rate from. Treat the percentage`);
  console.log('as a count until this is comfortably into the dozens.');
}

if (bySymbol.length) {
  console.log('\nActive by preferred symbol');
  for (const r of bySymbol) console.log(`  ${String(r.symbol).padEnd(5)} ${r.n}`);
}

if (bySource.length) {
  console.log('\nBy signup page (submitted -> confirmed)');
  for (const r of bySource) {
    console.log(`  ${String(r.source).padEnd(24)} ${n(r.submitted)} -> ${n(r.confirmed)}`);
  }
}

console.log('\nThe denominator above counts ROWS. Malformed addresses, honeypot trips,');
console.log('rate-limited attempts and resubmissions of an existing address never');
console.log('create one, so this is an UPPER BOUND on the real confirm rate. Compare');
console.log('it against levels_email_submitted in PostHog for the honest figure —');
console.log('the gap between the two counts is itself the signal.');
