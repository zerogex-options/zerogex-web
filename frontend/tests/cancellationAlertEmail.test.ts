import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCancellationAlertEmail } from '../core/mailer.ts';
import { buildChurnAlert, type ChurnAlertInput, type ChurnRefund } from '../core/cancellationAlert.ts';
import { formatCancellationRequestedMessage } from '../core/cancellationReason.ts';

// The operator's cancellation alert as it lands in the inbox. A Cancel after
// the payment had already failed ends the plan on the spot and voids its bill
// (core/pastDueCancel.ts), so its alert must not wear the "still has access"
// badge or a save deadline, and must say what happened to the bill. The
// builder's own rules are in tests/cancellationAlert.test.ts; this checks that
// the rendered email says the same thing in both the HTML and the text part.

const BASE: ChurnAlertInput = {
  churnEventId: 'audit_deadbeef',
  kind: 'pending',
  email: 'member@example.com',
  userId: 'user_1',
  auditMessage: formatCancellationRequestedMessage('sub_1AbC9', { feedback: 'too_expensive' }),
  churnedAtIso: '2026-08-28T14:00:00.000Z',
  accountCreatedAtIso: '2026-08-24T03:21:07.556Z',
  subscriptionStartedAtIso: null,
  tier: 'pro',
  billing: 'paying',
  currentPeriodEndIso: '2026-09-28T10:00:00.000Z',
};

const NOW = '2026-09-02T12:00:00.000Z';

function endedEmail(billVoided: boolean) {
  const auditMessage = formatCancellationRequestedMessage('sub_1AbC9', { feedback: 'too_expensive' }, { billVoided });
  return buildCancellationAlertEmail(buildChurnAlert({ ...BASE, auditMessage }, NOW));
}

test('a cancel scheduled for period end keeps its savable badge and save deadline', () => {
  const { html, text } = buildCancellationAlertEmail(buildChurnAlert(BASE, NOW));
  assert.match(html, /Paying member canceled &mdash; still has access/);
  assert.match(html, /26 days left to reply/);
  assert.match(text, /^Cancellation requested — they still have access, so this is savable\./);
  assert.match(text, /make save-url EMAIL=member@example\.com/);
});

test('a cancel that ended the plan on a failed payment never reads as savable', () => {
  for (const billVoided of [true, false]) {
    const { subject, html, text } = endedEmail(billVoided);
    assert.match(subject, /^\[ZeroGEX\] Canceled, plan ended/);
    assert.match(html, /Plan ended &mdash; payment had failed/);
    assert.match(text, /^Plan already ended — their payment had failed/);
    assert.match(text, /Access ends\s+Already ended/);
    for (const body of [html, text]) {
      assert.doesNotMatch(body, /still has access|still have access|savable|left to reply/);
      assert.doesNotMatch(body, /make save-url|make honor-winback-discount/);
    }
  }
});

test('the rendered alert says whether the bill was voided', () => {
  const voided = endedEmail(true);
  for (const body of [voided.html, voided.text]) {
    assert.match(body, /The unpaid bill was voided, so nothing more can be charged\./);
    assert.doesNotMatch(body, /make cancel-subscription/);
  }

  const notVoided = endedEmail(false);
  for (const body of [notVoided.html, notVoided.text]) {
    assert.match(body, /The unpaid bill was not voided and may still be payable\./);
    assert.match(body, /make cancel-subscription EMAIL=member@example\.com VOID_INVOICE=1 DRY_RUN=1/);
  }
});

// A Cancel followed by the 7-day money-back refund before the sweep ran: the
// refund ended the plan on the spot and cleared the member's row, so the alert
// must not wear the "still has access" badge either (Nov 19, 2026).
const REFUNDED: ChurnRefund = {
  status: 'completed',
  amountRefunded: 5900,
  currency: 'usd',
  tier: 'pro',
  atIso: '2026-08-28T14:04:11.000Z',
};

test('a cancel followed by a money-back refund never reads as savable', () => {
  const { subject, html, text } = buildCancellationAlertEmail(
    buildChurnAlert({ ...BASE, tier: 'public', currentPeriodEndIso: null, refund: REFUNDED }, NOW),
  );
  assert.match(subject, /^\[ZeroGEX\] Canceled and refunded: member@example\.com — /);
  assert.match(html, /Canceled and refunded &mdash; access ended/);
  assert.match(text, /^Refunded — they took the 7-day money-back refund/);
  assert.match(text, /Access ends\s+Ended with the refund/);
  assert.match(text, /Tier at churn\s+pro/);
  for (const body of [html, text]) {
    assert.match(body, /\$59\.00 on /);
    assert.doesNotMatch(body, /still has access|still have access|savable|left to reply/);
    assert.doesNotMatch(body, /make save-url|make honor-winback-discount|make money-back-refund/);
  }
  // Not dressed in the amber of a live save.
  assert.doesNotMatch(html, /background: #fff8e1; color: #8a6100;/);
});

test('a money-back refund that has not finished says so, and how to finish it', () => {
  const { subject, html, text } = buildCancellationAlertEmail(
    buildChurnAlert({ ...BASE, refund: { ...REFUNDED, status: 'pending', amountRefunded: 0, tier: null, atIso: null } }, NOW),
  );
  assert.match(subject, /^\[ZeroGEX\] Canceled, refund not finished: member@example\.com — /);
  assert.match(html, /Canceled &mdash; refund not finished/);
  assert.match(text, /^Refund not finished/);
  for (const body of [html, text]) {
    assert.match(body, /make money-back-refund EMAIL=member@example\.com/);
    assert.doesNotMatch(body, /still has access|still have access|savable|left to reply/);
    assert.doesNotMatch(body, /make save-url|make honor-winback-discount/);
  }
});
