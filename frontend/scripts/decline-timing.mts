#!/usr/bin/env node
// Run from the frontend/ directory (or via `make decline-timing`):
//   node --experimental-strip-types scripts/decline-timing.mts
//
// READ-ONLY. Tests one hypothesis: that insufficient-funds declines persist
// because the retries land while the account is still empty.
//
// WHY IT MATTERS. insufficient_funds is 62% of the money never collected, and
// it is the one category no acceptance product can touch — nothing Stripe does
// puts money into somebody's account. If timing is the story, the lever is the
// retry schedule. If it is not, the lever is the dunning email, and changing
// retry policy would be motion without effect.
//
// IT IS DESIGNED TO BE ABLE TO SAY NO. The payday split is a proxy: we do not
// know when anybody is paid, only whether the dates Stripe tried on straddled
// the two days payroll clusters around. If invoices whose window crossed a
// payday recover no better than the ones that missed, the hypothesis is wrong
// and this prints that just as readily.
//
// IT NEVER: touches Stripe, sends an email, or writes a row. The report's
// reconcile pass is explicitly disabled.
//
// Flags / environment:
//   AUTH_DB_PATH    which SQLite file to read (same rule as the app)
//   DAYS=<n>        window in days (default 0 = all time — the default differs
//                   from the other scripts because these volumes are small and
//                   a 90-day slice cannot support the split)
//   CATEGORY=<name> which decline category to examine (default insufficient_funds;
//                   pass `all` for every category together)

import { loadEnvLocal } from './env-local.mts';

loadEnvLocal();

const { getPaymentDeclineReport, loadDeclinesForTiming } = await import(
  '../core/paymentDeclinesServer.ts'
);
const { foldDeclinesToInvoices } = await import('../core/paymentDeclines.ts');
const {
  byDayOfMonth,
  byWeekday,
  byPaydayCrossing,
  byDaysToPayday,
  windowByOutcome,
  retryWindowStats,
} = await import('../core/declineTiming.ts');

const daysRaw = process.env.DAYS;
const windowDays = daysRaw === undefined || Number(daysRaw) <= 0 ? null : Number(daysRaw);
const category = (process.env.CATEGORY ?? 'insufficient_funds').toLowerCase();

// reconcile: false — this command settles nothing. It reports the table as it stands.
const report = getPaymentDeclineReport({ windowDays, reconcile: false });
const records = loadDeclinesForTiming(report.since);
const all = foldDeclinesToInvoices(records);
const invoices = category === 'all' ? all : all.filter((i) => i.last.category === category);

const pct = (v: number | null, digits = 0) =>
  v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`;
const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (t: string, w: number) => t.padEnd(w);
const padL = (t: string, w: number) => t.padStart(w);

console.log('');
console.log('DECLINE TIMING');
console.log(`  category: ${category}   ·   window: ${windowDays == null ? 'all time' : `${windowDays} days`}`);
console.log(`  ${invoices.length} declined invoice${invoices.length === 1 ? '' : 's'}`);
console.log('');

if (invoices.length === 0) {
  console.log('  Nothing to examine.');
  console.log('');
  process.exit(0);
}

const stats = retryWindowStats(invoices);
console.log('HOW LONG STRIPE ACTUALLY KEPT TRYING');
console.log(`  median window   ${stats.medianDays ?? '—'} days      longest ${stats.maxDays ?? '—'} days`);
console.log(
  `  never retried   ${stats.singleAttempt} of ${stats.invoices} invoice${stats.invoices === 1 ? '' : 's'}` +
    ` (one failure and nothing after it)`,
);
console.log('');

function table(title: string, note: string, rows: ReturnType<typeof byDayOfMonth>) {
  console.log(title);
  if (note) console.log(`  ${note}`);
  console.log(
    `  ${pad('', 34)}${padL('INV', 5)}${padL('REC', 5)}${padL('LOST', 6)}${padL('OPEN', 6)}${padL('RATE', 7)}  ${pad('95% RANGE', 14)}${padL('LOST $', 12)}`,
  );
  for (const row of rows) {
    const range = row.recoveryRateInterval
      ? `${pct(row.recoveryRateInterval.low)}–${pct(row.recoveryRateInterval.high)}`
      : '—';
    console.log(
      `  ${pad(row.label, 34)}${padL(String(row.invoices), 5)}${padL(String(row.recovered), 5)}` +
        `${padL(String(row.lost), 6)}${padL(String(row.open), 6)}${padL(pct(row.recoveryRate), 7)}  ` +
        `${pad(range, 14)}${padL(money(row.amountLost), 12)}`,
    );
  }
  console.log('');
}

// The window is measured to the LAST FAILURE, so a recovered invoice has a short
// one for that reason alone. Printing this split first is what stops a reader
// taking the crossing table below at face value.
console.log('IS THE WINDOW MEASURE CONTAMINATED BY THE OUTCOME?');
for (const row of windowByOutcome(invoices)) {
  console.log(
    `  ${pad(row.outcome, 12)}${padL(String(row.invoices), 4)} invoices    median ${row.medianDays ?? '—'} days    longest ${row.maxDays ?? '—'} days`,
  );
}
console.log('  A shorter median for recovered invoices means yes: an invoice that recovers stops');
console.log('  failing, so anything derived from window length partly measures the outcome.');
console.log('');

table(
  'THE TEST — how long after the failure did a payday arrive?',
  'Depends only on the FIRST failure date, so no outcome can move it. This is the one to read.',
  byDaysToPayday(invoices),
);

table(
  'THE SAME QUESTION ASKED BADLY — did the retry window cross a payday?',
  'BIASED: the window ends at the last failure, so recovering shortens it. Shown to expose the trap, never to act on.',
  byPaydayCrossing(invoices),
);

table('WHEN THE FIRST ATTEMPT LANDED — day of month', '', byDayOfMonth(invoices));
table('WHEN THE FIRST ATTEMPT LANDED — weekday', '', byWeekday(invoices));

console.log('HOW TO READ THIS');
console.log('  Read "how long after the failure did a payday arrive" and nothing else. It depends');
console.log('  only on when the charge first failed — for a trial conversion, seven days after a');
console.log('  signup that happened long before any of this — so no outcome can reach back and');
console.log('  change it. Overlapping ranges there mean no difference was shown, and lengthening');
console.log('  the retry window would be motion without effect.');
console.log('');
console.log('  The crossing table beneath it is a warning, not evidence. It looks like the same');
console.log('  question and is not: its window ends at the last failure, so an invoice that');
console.log('  recovered has a short window for that reason alone and lands on the other side of');
console.log('  the split. It returns a large, confident, entirely spurious answer.');
console.log('');
console.log('  Day-of-month and weekday are context, and seven weekday buckets will throw up an');
console.log('  extreme one by chance. We do not know when any member is actually paid: this is a');
console.log('  proxy and cannot become proof, however the numbers come out.');
console.log('');
