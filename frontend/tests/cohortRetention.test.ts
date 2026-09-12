import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCohortReport, type CohortAuditInput, type CohortUserInput } from '../core/cohortRetention.ts';

const user = (id: string, createdAt: string, firstPaymentAt: string | null = null): CohortUserInput => ({
  id, email: `${id}@example.com`, createdAt, firstPaymentAt, currentStatus: firstPaymentAt ? 'active' : null,
  currentTier: firstPaymentAt ? 'pro' : 'public', currentPriceId: firstPaymentAt ? 'price_pro' : null,
  currentPeriodEnd: null, cancelAtPeriodEnd: false, signupUtmSource: id === 'active' ? 'x' : null, cadence: 'monthly',
});
const event = (userId: string, type: string, createdAt: string, message: string): CohortAuditInput => ({ userId, type, createdAt, message });
const sync = (id: string, at: string, status: string, tier: string, sub = `sub_${id}`) => event(id, 'stripe_subscription_sync', at, `Subscription ${sub} status=${status} tier=${tier} cancelAtPeriodEnd=false`);

test('historical milestones use access intervals, not current status', () => {
  const report = buildCohortReport(
    [user('cancel', '2026-08-01T00:00:00Z', '2026-08-08T00:00:00Z')],
    [
      sync('cancel', '2026-08-01T01:00:00Z', 'trialing', 'pro'),
      sync('cancel', '2026-08-08T00:00:00Z', 'active', 'pro'),
      event('cancel', 'stripe_cancellation_requested', '2026-09-20T00:00:00Z', 'Cancellation requested for sub sub_cancel | cancel_feedback=unused'),
      event('cancel', 'stripe_subscription_deleted', '2026-09-25T00:00:00Z', 'Subscription sub_cancel ended; tier reset to public | cancel_feedback=unused'),
    ],
    '2026-12-01T00:00:00Z',
  );
  const result = report.users[0];
  assert.equal(result.retained['30'], true);
  assert.equal(result.retained['60'], false);
  assert.equal(result.churnKind, 'voluntary');
  assert.equal(result.cancellationReason, "Wasn't using it");
  assert.equal(result.daysPaidBeforeChurn, 48);
});

test('active payer and immature payer are classified independently', () => {
  const report = buildCohortReport(
    [user('active', '2026-06-03T00:00:00Z', '2026-06-10T00:00:00Z'), user('recent', '2026-09-01T00:00:00Z', '2026-09-05T00:00:00Z')],
    [sync('active', '2026-06-10T00:00:00Z', 'active', 'pro'), sync('recent', '2026-09-05T00:00:00Z', 'active', 'basic')],
    '2026-09-20T00:00:00Z',
  );
  assert.deepEqual(report.users.find((item) => item.id === 'active')?.retained, { '30': true, '60': true, '90': true });
  assert.deepEqual(report.users.find((item) => item.id === 'recent')?.retained, { '30': null, '60': null, '90': null });
});

test('payment failure, trial-never-paid, and paid-without-trial remain distinct', () => {
  const report = buildCohortReport(
    [user('failed', '2026-05-01T00:00:00Z', '2026-05-08T00:00:00Z'), user('trialonly', '2026-05-02T00:00:00Z'), user('direct', '2026-05-03T00:00:00Z', '2026-05-03T01:00:00Z')],
    [
      sync('failed', '2026-05-08T00:00:00Z', 'active', 'pro'),
      event('failed', 'stripe_payment_failed', '2026-06-07T00:00:00Z', 'Invoice in_1 payment failed for sub sub_failed (attempt 1)'),
      sync('failed', '2026-06-10T00:00:00Z', 'past_due', 'public'),
      sync('trialonly', '2026-05-03T00:00:00Z', 'trialing', 'pro'),
      sync('direct', '2026-05-03T01:00:00Z', 'active', 'basic'),
    ],
    '2026-09-01T00:00:00Z',
  );
  assert.equal(report.users.find((item) => item.id === 'failed')?.churnKind, 'payment_failure');
  assert.equal(report.users.find((item) => item.id === 'trialonly')?.firstPaidAt, null);
  assert.equal(report.users.find((item) => item.id === 'direct')?.trialStartedAt, null);
});

test('resubscription does not bridge an unpaid gap', () => {
  const report = buildCohortReport(
    [user('returner', '2026-01-01T00:00:00Z', '2026-01-05T00:00:00Z')],
    [
      sync('returner', '2026-01-05T00:00:00Z', 'active', 'pro', 'sub_first'),
      event('returner', 'stripe_subscription_deleted', '2026-01-25T00:00:00Z', 'Subscription sub_first ended; tier reset to public'),
      sync('returner', '2026-02-20T00:00:00Z', 'active', 'pro', 'sub_second'),
    ],
    '2026-06-01T00:00:00Z',
  );
  const retained = report.users[0].retained;
  assert.equal(retained['30'], false); // Feb 4 falls in the gap
  assert.equal(retained['60'], true);  // Mar 6 falls in the second interval
  assert.equal(report.summary.becamePaid, 1);
});

test('scheduled cancellation ends economic retention at cancel intent, not access end', () => {
  const report = buildCohortReport(
    [user('scheduled', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')],
    [
      sync('scheduled', '2026-01-02T00:00:00Z', 'active', 'pro'),
      event('scheduled', 'stripe_cancellation_requested', '2026-01-10T00:00:00Z', 'Cancellation requested for sub sub_scheduled'),
      event('scheduled', 'stripe_subscription_deleted', '2026-02-02T01:00:00Z', 'Subscription sub_scheduled ended; tier reset to public'),
    ],
    '2026-05-01T00:00:00Z',
  );
  assert.equal(report.users[0].retained['30'], false);
});

test('monthly renewal counts use successful invoices and actual period-end eligibility', () => {
  const report = buildCohortReport(
    [user('renewing', '2026-01-01T00:00:00Z', '2026-01-05T00:00:00Z')],
    [
      sync('renewing', '2026-01-05T00:00:00Z', 'active', 'pro'),
      event('renewing', 'stripe_invoice_paid', '2026-01-05T00:00:00Z', 'Invoice in_1 paid for sub sub_renewing amount=1900 billing_reason=subscription_cycle period_end=1769990400 price=price_pro'),
      event('renewing', 'stripe_invoice_paid', '2026-02-02T00:00:00Z', 'Invoice in_2 paid for sub sub_renewing amount=1900 billing_reason=subscription_cycle period_end=1772409600 price=price_pro'),
    ],
    '2026-02-15T00:00:00Z',
  );
  assert.equal(report.cohorts[0].payments['1'].successful, 1);
  assert.equal(report.cohorts[0].payments['2'].successful, 1);
  assert.equal(report.cohorts[0].payments['2'].eligible, 1);
  assert.equal(report.cohorts[0].payments['3'].eligible, 0);
});
