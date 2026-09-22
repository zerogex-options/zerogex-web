#!/usr/bin/env node
// Run from the frontend/ directory (or via `make audit-customers`):
//   node --experimental-strip-types scripts/audit-customer-classification.mts
//   EMAIL=someone@example.com node --experimental-strip-types scripts/audit-customer-classification.mts
//
// Prints, for a sample of real customers, every event the dashboard reads and
// every conclusion it draws from them — so a human can check the classification
// against Stripe rather than trusting it.
//
// READ-ONLY. It opens the same SQLite file the app reads and writes nothing, to
// that database or to Stripe.
//
// With no EMAIL it picks one customer for each of the thirteen shapes that are
// easy to classify wrongly, and says so when it cannot find one:
//
//    1 trial → paid                        8 recurring failure that churned
//    2 direct to paid, no trial            9 first charge failed, never paid
//    3 paying, before first renewal       10 churned then resubscribed
//    4 renewed at least once              11 annual customer
//    5 cancelled before first renewal     12 churned before day 30
//    6 cancellation scheduled, still on   13 changed tier mid-subscription
//    7 recurring failure that recovered
//
// Flags:
//   EMAIL=<addr>   trace exactly this customer instead of the sample
//   LIMIT=<n>      how many customers per shape (default 1)
//   EVENTS=0       summary only, no event timeline

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
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
if (envLocal.AUTH_DB_PATH && !process.env.AUTH_DB_PATH) process.env.AUTH_DB_PATH = envLocal.AUTH_DB_PATH;

const { getCohortRetentionReport } = await import('../core/cohortRetentionServer.ts');
const { buildRenewalReport } = await import('../core/renewalRetention.ts');
const { parseAmountTable } = await import('../core/pricing.ts');

type Report = Awaited<ReturnType<typeof getCohortRetentionReport>>;
type Customer = Report['users'][number];

const report = getCohortRetentionReport();
const renewals = buildRenewalReport(report.users, parseAmountTable(process.env.MRR_PRICE_TABLE_JSON));
const showEvents = process.env.EVENTS !== '0';
const perShape = Math.max(1, Number(process.env.LIMIT) || 1);

const day = (value: string | null) => (value ? value.slice(0, 10) : '—');

function trace(customer: Customer, shape: string): void {
  console.log('');
  console.log('─'.repeat(78));
  console.log(`${shape}`);
  console.log(`  ${customer.email}   (cohort ${customer.cohort})`);
  console.log('─'.repeat(78));
  console.log(`  registered            ${day(customer.registeredAt)}`);
  console.log(`  trial started         ${day(customer.trialStartedAt)}`);
  console.log(`  first payment         ${day(customer.firstPaidAt)}`);
  console.log(`  cancellation asked    ${day(customer.cancellationAt)}`);
  console.log(`  access first stopped  ${day(customer.firstAccessEndedAt)}`);
  console.log(`  access ended (stands) ${day(customer.lastAccessEndedAt)}`);
  console.log(`  access scheduled end  ${day(customer.scheduledAccessEndAt)}`);
  console.log(`  current period end    ${day(customer.currentPeriodEnd)}`);
  console.log('');
  console.log(`  entitled now          ${customer.currentlyEntitled}`);
  console.log(`  came back after gap   ${customer.reactivatedAfterInterruption}`);
  console.log(`  paid after a trial    ${customer.paidAfterTrial}`);
  console.log(`  direct to paid        ${customer.directToPaid}`);
  console.log(`  plan                  ${customer.tier} / ${customer.cadence ?? 'cadence unknown'} (via ${customer.cadenceSource})`);
  console.log(`  failed charges        ${customer.failedPaymentAttempts}  state=${customer.paymentFailureState ?? '—'}`);
  console.log('');
  console.log(`  CLASSIFIED AS         ${customer.paidCustomerState ?? 'never paid'}`);
  console.log(`  churn kind            ${customer.churnKind ?? '—'}`);
  if (customer.classificationExplanation) console.log(`  because               ${customer.classificationExplanation}`);
  console.log(`  retained  30d=${String(customer.retained['30'])}  60d=${String(customer.retained['60'])}  90d=${String(customer.retained['90'])}`);
  console.log(`    (null = not answerable yet; false = lost before the milestone)`);

  console.log('');
  console.log(`  billing periods paid  ${customer.cycleInvoices.length}  (all paid invoices: ${customer.paidInvoices.length})`);
  for (const [index, invoice] of customer.cycleInvoices.entries()) {
    console.log(`    #${index + 1}  ${day(invoice.paidAt)}  $${(invoice.amountCents / 100).toFixed(2)}`
      + `  ${invoice.billingReason ?? 'reason unknown'}  period ends ${day(invoice.periodEnd)}`);
  }
  for (const invoice of customer.paidInvoices.filter((i) => !customer.cycleInvoices.includes(i))) {
    console.log(`    --  ${day(invoice.paidAt)}  $${(invoice.amountCents / 100).toFixed(2)}`
      + `  ${invoice.billingReason ?? 'reason unknown'}  (NOT a billing period)`);
  }

  if (showEvents) {
    console.log('');
    console.log('  audit trail');
    for (const event of customer.auditEvents) {
      console.log(`    ${event.createdAt.slice(0, 19)}  ${event.type.padEnd(30)} ${event.message.slice(0, 90)}`);
    }
  }
}

const everPaid = report.users.filter((user) => user.firstPaidAt != null);
const renewalOf = (customer: Customer) =>
  customer.cycleInvoices.length > 1;

const SHAPES: Array<[string, (user: Customer) => boolean]> = [
  ['1  trial → paid', (u) => u.paidAfterTrial],
  ['2  direct to paid (no trial)', (u) => u.directToPaid],
  ['3  paying, before first renewal', (u) => u.paidCustomerState === 'active' && u.cadence === 'monthly' && !renewalOf(u) && u.scheduledAccessEndAt == null],
  ['4  renewed at least once', (u) => renewalOf(u)],
  ['5  cancelled before first renewal', (u) => u.churnKind === 'voluntary' && (u.daysPaidBeforePermanentLoss ?? 99) <= 35],
  ['6  cancellation scheduled, access still live', (u) => u.paidCustomerState === 'active' && u.scheduledAccessEndAt != null],
  ['7  payment failure that recovered', (u) => u.paymentFailureState === 'recovered'],
  ['8  payment failure that churned', (u) => u.paymentFailureState === 'lost'],
  ['9  first charge failed, never paid', (u) => u.firstPaidAt == null && u.failedPaymentAttempts > 0],
  ['10 churned then resubscribed', (u) => u.reactivatedAfterInterruption],
  ['11 annual customer', (u) => u.cadence === 'annual' && u.firstPaidAt != null],
  ['12 churned before day 30', (u) => (u.daysPaidBeforePermanentLoss ?? 999) < 30],
  ['13 changed tier mid-subscription', (u) => u.firstPaidAt != null
    && new Set(u.auditEvents.filter((e) => e.type === 'stripe_subscription_sync')
      .map((e) => e.message.match(/tier=(\w+)/)?.[1]).filter((t) => t === 'basic' || t === 'pro')).size > 1],
];

const email = process.env.EMAIL?.trim().toLowerCase();
if (email) {
  const customer = report.users.find((user) => user.email.toLowerCase() === email);
  if (!customer) {
    console.error(`No account found for ${email}. It may be one of the accounts held out of the report (admin, comped partner, comped member).`);
    process.exit(1);
  }
  trace(customer, 'Requested customer');
} else {
  console.log('');
  console.log(`Population: ${report.users.length} accounts, ${everPaid.length} of whom have ever paid.`);
  console.log(`Held out:   ${report.excluded.total} (${report.excluded.byReason.admin} admin, ${report.excluded.byReason.partner_grant} partner grants, ${report.excluded.byReason.comped} comped).`);
  const states = report.summary.paidCustomerStates;
  const reconciled = states.active + states.voluntarily_churned + states.involuntarily_churned + states.other_unknown;
  console.log(`States:     ${reconciled} of ${report.summary.becamePaid} ever-paid customers reconciled`
    + ` (${states.active} active, ${states.voluntarily_churned} voluntary, ${states.involuntarily_churned} nonpayment, ${states.other_unknown} unattributed).`);
  console.log('');
  console.log(`Trial → paid: ${report.summary.trialThenPaid} of ${report.summary.trialStarts} trial starters`
    + ` = ${report.summary.trialToPaid == null ? '—' : `${(report.summary.trialToPaid * 100).toFixed(1)}%`}`
    + `; ${report.summary.directToPaid} more paid without a trial.`);
  for (const day of ['30', '60', '90'] as const) {
    const point = report.summary.retention[day];
    console.log(`Retained @${day.padStart(2)}d: ${point.retained} of ${point.eligible} eligible`
      + ` = ${point.rate == null ? '—' : `${(point.rate * 100).toFixed(1)}%`}`);
  }
  console.log('');
  console.log(`Invoice record starts: ${renewals.observableFrom ?? 'NEVER — run make backfill-stripe-invoices'}`);
  for (const step of renewals.steps) {
    console.log(`Renewal #${step.renewalNumber}: ${step.renewed}/${step.eligible} eligible`
      + ` = ${step.rate == null ? '—' : `${(step.rate * 100).toFixed(1)}%`}`
      + `  · ${step.approaching} still in period (${step.approachingScheduledCancel} cancelling)`
      + `  · ${step.unobservable} unobservable`);
  }
  const pool = renewals.atRisk;
  console.log('');
  console.log(`At risk now: ${pool.total} scheduled cancellations — ${pool.monthly} monthly, ${pool.annual} annual, ${pool.cadenceUnknown} cadence unknown.`);
  console.log(`             $${Math.round(pool.monthlyMrrAtRisk)} MRR and $${Math.round(pool.annualRevenueAtRisk)} of annual contracts.`);
  console.log(`             ${pool.endingWithin7Days} gone within 7 days, ${pool.endingWithin30Days} within 30.`);
  console.log(`Cadence coverage of ever-paid: ${report.cadenceCoverage.monthly} monthly, ${report.cadenceCoverage.annual} annual, ${report.cadenceCoverage.unknown} unknown.`);

  let missing = 0;
  for (const [shape, predicate] of SHAPES) {
    const matches = report.users.filter(predicate).slice(0, perShape);
    if (matches.length === 0) {
      missing += 1;
      console.log('');
      console.log(`${shape} — no customer of this shape exists yet.`);
      continue;
    }
    for (const customer of matches) trace(customer, shape);
  }
  console.log('');
  console.log(`${SHAPES.length - missing} of ${SHAPES.length} customer shapes found in this database.`);
}
