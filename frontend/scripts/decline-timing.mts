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
const { byDayOfMonth, byWeekday, byPaydayCrossing, retryWindowStats, ordinal, PAYDAY_PROXY_DAYS } =
  await import('../core/declineTiming.ts');

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

table(
  'THE TEST — did the retries ever reach a payday?',
  `proxy: the window covered the ${PAYDAY_PROXY_DAYS.map(ordinal).join(' or the ')} of a month. Overlapping ranges mean no difference was shown.`,
  byPaydayCrossing(invoices),
);

table('WHEN THE FIRST ATTEMPT LANDED — day of month', '', byDayOfMonth(invoices));
table('WHEN THE FIRST ATTEMPT LANDED — weekday', '', byWeekday(invoices));

console.log('HOW TO READ THIS');
console.log('  The payday split is the only row that tests anything. If the two ranges overlap,');
console.log('  the retries reaching a payday made no observable difference — and lengthening the');
console.log('  retry window would be motion without effect. The day-of-month and weekday tables');
console.log('  are context: a trial converts seven days after signup, so the charge date is close');
console.log('  to random and a flat distribution there is the expected result, not a finding.');
console.log('');
console.log('  We do not know when any member is actually paid. This is a proxy and cannot');
console.log('  become proof, however the numbers come out.');
console.log('');
