#!/usr/bin/env node
// Run from the frontend/ directory (or via `make decline-by-source`):
//   node --experimental-strip-types scripts/decline-by-source.mts
//
// READ-ONLY. Decline rate by the acquisition channel that first brought each
// member in — the same table the admin panel draws, printed to a terminal so it
// can be read on production before anything is deployed.
//
// WHY THIS CUT IS DIFFERENT FROM THE OTHERS. Every instrument breakdown in the
// report (card brand, funding, issuing country, wallet vs card) is a share of
// the FAILURES, because a successful charge leaves no row in payment_declines
// and its card is therefore not there to divide by. A successful charge does
// leave a MEMBER, and a member carries a first-touch utm_source — so this one
// has both sides of the ratio and can state a real rate.
//
// WHAT IT IS FOR. Deciding whether a slice of the lost conversions was ever a
// billing problem. If one channel's trial signups decline at twice everybody
// else's rate, no amount of retry tuning, card-update prompting or dunning copy
// recovers them: the fix is upstream, in what that channel is sending.
//
// IT NEVER: touches Stripe, sends an email, or writes a single row. It opens
// the SQLite file read-only-in-effect (no INSERT, UPDATE or DELETE is issued;
// the report's reconcile pass is explicitly turned off) and prints.
//
// Flags / environment:
//   AUTH_DB_PATH   which SQLite file to read (same rule as the app)
//   DAYS=<n>       window, in days back from now (default 90; DAYS=0 for all time)
//   SCOPE=first    first payments only (default) — the version that reports on
//                  the channel rather than on a card years after the click
//   SCOPE=all      every charge, conversions and renewals together
//   JSON=<path>    also write the full report section as JSON

import { loadEnvLocal } from './env-local.mts';
import fs from 'node:fs';

// The report reads prices to label plans; without them every row says "plan
// unknown". Same whole-file load as every other script here.
loadEnvLocal();

const { getPaymentDeclineReport } = await import('../core/paymentDeclinesServer.ts');
const { THIN_SOURCE_VOLUME, sourceRatesAreSkewed } = await import('../core/paymentDeclines.ts');

const daysRaw = process.env.DAYS;
const windowDays = daysRaw === undefined ? 90 : Number(daysRaw) > 0 ? Number(daysRaw) : null;
const scope = process.env.SCOPE === 'all' ? 'all' : 'first';
const jsonPath = process.env.JSON;

// reconcile: false — this command settles nothing and closes nothing. It reports
// the table exactly as it stands.
const report = getPaymentDeclineReport({ windowDays, reconcile: false });

const rows =
  scope === 'first' && report.bySignupSourceFirstPayment
    ? report.bySignupSourceFirstPayment
    : report.bySignupSource;

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (value: number | null, digits = 1) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const pad = (text: string, width: number) => text.padEnd(width);
const padLeft = (text: string, width: number) => text.padStart(width);

console.log('');
console.log('DECLINE RATE BY ACQUISITION SOURCE');
console.log(
  `  window: ${windowDays == null ? 'all time' : `${windowDays} days`}   ·   scope: ${
    scope === 'first' ? 'first payments (trial conversions + no-trial first charges)' : 'all charges'
  }`,
);
if (scope === 'first' && !report.bySignupSourceFirstPayment) {
  console.log('  (no first payments in this window — showing all charges instead)');
}
console.log('');

const attribution = report.signupSourceAttribution;

function writeJson() {
  if (!jsonPath) return;
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ windowDays, scope, generatedAt: report.generatedAt, attribution, rows }, null, 2),
  );
  console.log(`  Wrote ${jsonPath}`);
  console.log('');
}

// Emptiness first: a window with nothing in it is not a data-quality problem,
// and saying so before the warning is what keeps "— of declines are attributed"
// off the screen.
if (rows.length === 0) {
  console.log('  Nothing charged in this window.');
  console.log('');
  writeJson();
  process.exit(0);
}

if (sourceRatesAreSkewed(attribution)) {
  console.log('  ⚠  RATES BELOW ARE NOT COMPARABLE ACROSS ROWS.');
  console.log(
    `     ${pct(attribution.declineCoverage, 0)} of declined invoices and ${pct(
      attribution.paidCoverage,
      0,
    )} of paid invoices could be tied to an account here.`,
  );
  console.log(
    '     When those differ, the named channels are missing part of one side of their ratio and every',
  );
  console.log('     rate is skewed the same way — which looks exactly like a real finding. Read the counts.');
  console.log('');
}

console.log(
  `  ${pad('SOURCE', 30)}${padLeft('CHARGED', 9)}${padLeft('DECL', 6)}${padLeft('RATE', 8)}  ${pad(
    '95% RANGE',
    16,
  )}${padLeft('LOST', 6)}${padLeft('LOST $', 12)}`,
);
console.log(`  ${'-'.repeat(87)}`);

for (const row of rows) {
  const range = row.declineRateInterval
    ? `${pct(row.declineRateInterval.low, 0)}–${pct(row.declineRateInterval.high, 0)}`
    : '—';
  const mark = row.thin ? ' *' : row.channel ? '' : ' †';
  console.log(
    `  ${pad(row.label.slice(0, 29) + mark, 30)}${padLeft(String(row.attemptedInvoices), 9)}${padLeft(
      String(row.invoices),
      6,
    )}${padLeft(pct(row.declineRate), 8)}  ${pad(range, 16)}${padLeft(String(row.lostInvoices), 6)}${padLeft(
      money(row.lostAmount),
      12,
    )}`,
  );
}

console.log('');
console.log(
  `  * fewer than ${THIN_SOURCE_VOLUME} charges — the interval spans most of the axis, so the percentage carries almost no information.`,
);
console.log('  † describes our records, not a channel: no source was ever written down for these.');
console.log('');
console.log(
  `  ${attribution.channels} tagged channel${attribution.channels === 1 ? '' : 's'}.  ` +
    `Attribution: ${pct(attribution.declineCoverage, 0)} of declines, ${pct(attribution.paidCoverage, 0)} of payments.  ` +
    `Attribution recorded since ${attribution.trackingSince?.slice(0, 10) ?? 'never — nothing is tagged'}.`,
);
console.log(
  '  Two channels whose ranges overlap have NOT been shown to differ, however far apart their percentages look.',
);
console.log('');

writeJson();
