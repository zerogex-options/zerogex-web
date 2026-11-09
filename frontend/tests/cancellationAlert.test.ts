import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHURN_EVENT_TYPES,
  CHURN_EVENT_TYPE_VALUES,
  ALERT_SENT_EVENT_TYPE,
  classifyChurnEvent,
  buildAlertLatchMessage,
  parseAlertLatchEventId,
  parseChurnSubscriptionId,
  tenureDays,
  describeTenure,
  daysUntil,
  buildChurnAlert,
  selectBatch,
  shouldAlertOnChurn,
  DEFAULT_CHURN_ALERT_KIND,
  alertRunExitCode,
  billingAtCancel,
  LEDGER_MATCH_WINDOW_MS,
  type ChurnAlertInput,
} from '../core/cancellationAlert.ts';
import {
  formatCancellationReasonSuffix,
  formatCancellationRequestedMessage,
  parseCancellationReasonFromMessage,
  parseEndedOnFailedPayment,
  type CancellationDetails,
} from '../core/cancellationReason.ts';
import { cancelDecisionRows } from '../core/cancelDecisions.ts';
import { buildCohortReport } from '../core/cohortRetention.ts';
import { buildSubscriberLedger, type LedgerSyncEvent } from '../core/subscriberBucket.ts';

// The alert is only as trustworthy as two contracts:
//   1. The LATCH round-trip. If buildAlertLatchMessage ⇄ parseAlertLatchEventId
//      ever disagree, the sweeper either re-emails the whole churn history on
//      every tick or silently never emails again. Both are worse than no alert.
//   2. The REASON passthrough. The alert must say exactly what the webhook wrote
//      onto the churn row — if the two drift, the email is confidently wrong
//      about why somebody left, which is the one thing it exists to report.

const BASE: ChurnAlertInput = {
  churnEventId: 'audit_deadbeef',
  kind: 'pending',
  email: 'member@example.com',
  userId: 'user_1',
  auditMessage: 'Cancellation requested for sub sub_123',
  churnedAtIso: '2026-08-28T14:00:00.000Z',
  accountCreatedAtIso: '2026-08-24T03:21:07.556Z',
  subscriptionStartedAtIso: null,
  tier: 'pro',
  billing: null,
  currentPeriodEndIso: '2026-09-28T10:00:00.000Z',
};

const NOW = '2026-09-02T12:00:00.000Z';

test('alertRunExitCode: only a run where NOTHING succeeded fails the unit', () => {
  // Clean run.
  assert.equal(alertRunExitCode(25, 0), 0);
  // Partial: the failures were never latched, so the next tick retries them.
  // Failing the unit here would light up `systemctl --failed` over a condition
  // that resolves itself, and drown the run that genuinely needs attention.
  assert.equal(alertRunExitCode(24, 1), 0);
  assert.equal(alertRunExitCode(1, 24), 0);
  // Nothing sent and failures present: credentials, egress, a revoked key —
  // none of which self-heal. This is the one that should page you.
  assert.equal(alertRunExitCode(0, 25), 1);
  // Nothing to do at all is not a failure.
  assert.equal(alertRunExitCode(0, 0), 0);
});

test('shouldAlertOnChurn: churn that said nothing does not email', () => {
  // Neither a survey selection nor a typed comment. The row reports a departure
  // and nothing else, which the admin dashboard already carries; on real data
  // this class was most of the stream, enough noise to get the whole alert
  // filtered to a folder and take the useful ones with it.
  assert.equal(shouldAlertOnChurn('Cancellation requested for sub_1', false), false);
  assert.equal(shouldAlertOnChurn('Subscription sub_1 ended', false), false);
});

test('shouldAlertOnChurn: either half of the survey is enough to email', () => {
  // A selected enum on its own is signal...
  assert.equal(
    shouldAlertOnChurn('Cancellation requested | cancel_feedback=too_expensive', false),
    true,
  );
  // ...so is free text on its own, which is the richest case of all...
  assert.equal(
    shouldAlertOnChurn(
      'Cancellation requested | cancel_comment="dealer hedging flows are missing"',
      false,
    ),
    true,
  );
  // ...and so is both together.
  assert.equal(
    shouldAlertOnChurn(
      'Cancellation requested | cancel_feedback=missing_features cancel_comment="no 0DTE"',
      false,
    ),
    true,
  );
});

test('shouldAlertOnChurn: an empty comment is not a reason', () => {
  // The suffix is present but carries nothing — a survey submitted blank must
  // not read as "they told us why".
  assert.equal(shouldAlertOnChurn('Cancellation requested | cancel_comment=""', false), false);
});

test('shouldAlertOnChurn: the escape hatch restores the unfiltered stream', () => {
  assert.equal(shouldAlertOnChurn('Cancellation requested for sub_1', true), true);
  assert.equal(shouldAlertOnChurn('Subscription sub_1 ended', true), true);
});

test('the sweep defaults to the cancel CLICK, not the lapse that repeats it', () => {
  // Stripe carries the same cancellation_details onto the terminal row, so
  // alerting on both kinds sent two emails for one departure — the second
  // arriving after the save window it reported on had already closed.
  assert.equal(DEFAULT_CHURN_ALERT_KIND, 'pending');
  assert.equal(CHURN_EVENT_TYPES[DEFAULT_CHURN_ALERT_KIND], 'stripe_cancellation_requested');
});

test('selectBatch: the per-run cap is an INBOX guard, so mark-only ignores it', () => {
  const pending = Array.from({ length: 60 }, (_, i) => i);

  // A sending run is capped: that is the whole point — one wide --since must not
  // mail the entire churn history at once.
  assert.equal(selectBatch(pending, 25, false).length, 25);

  // A mark-only run sends nothing, so capping it silences 25 and leaves the
  // timer to mail the other 35 — the exact outcome --mark-only exists to
  // prevent. This shipped once; it must not ship again.
  assert.equal(selectBatch(pending, 25, true).length, 60);

  // limit <= 0 means unlimited on either path.
  assert.equal(selectBatch(pending, 0, false).length, 60);
  assert.equal(selectBatch(pending, -1, false).length, 60);

  // Never returns more than it was given, and never mutates the input.
  assert.equal(selectBatch(pending, 500, false).length, 60);
  assert.equal(selectBatch([], 25, false).length, 0);
  assert.equal(pending.length, 60);
});

test('churn event types: the two rows that mean someone is leaving', () => {
  assert.equal(classifyChurnEvent('stripe_cancellation_requested'), 'pending');
  assert.equal(classifyChurnEvent('stripe_subscription_deleted'), 'lapsed');
  // Neighboring subscription events must NOT be treated as churn — a sync or a
  // cancel-ack row would otherwise fire a duplicate alert for the same exit.
  assert.equal(classifyChurnEvent('stripe_subscription_sync'), null);
  assert.equal(classifyChurnEvent('cancellation_ack_email_sent'), null);
  assert.equal(classifyChurnEvent(''), null);
  assert.deepEqual(
    [...CHURN_EVENT_TYPE_VALUES].sort(),
    [CHURN_EVENT_TYPES.lapsed, CHURN_EVENT_TYPES.pending].sort(),
  );
  // The latch type must never collide with a churn type, or the sweeper would
  // read its own latches back as cancellations.
  assert.ok(!CHURN_EVENT_TYPE_VALUES.includes(ALERT_SENT_EVENT_TYPE));
});

test('latch round-trip: what is written comes back out', () => {
  for (const kind of ['pending', 'lapsed'] as const) {
    const id = 'audit_0a1b2c3d4e5f6071';
    const parsed = parseAlertLatchEventId(buildAlertLatchMessage(id, kind));
    assert.equal(parsed, id);
  }
});

test('latch parse: absent or malformed token yields null, never a false match', () => {
  assert.equal(parseAlertLatchEventId('Sent cancellation alert for pending churn event'), null);
  assert.equal(parseAlertLatchEventId(''), null);
  // A different token that merely contains the substring must not be mistaken
  // for the latch key — a false match here would latch an event we never
  // actually emailed about, silently swallowing the alert.
  assert.equal(parseAlertLatchEventId('not_alert_for_this=audit_x'), null);
  assert.equal(parseAlertLatchEventId('xalert_for=audit_x'), null);
  // But a real token still parses out of surrounding prose.
  assert.equal(
    parseAlertLatchEventId('Sent cancellation alert for pending churn event alert_for=audit_9f'),
    'audit_9f',
  );
});

test('latch keys on the churn event id, so a re-cancel alerts again', () => {
  // Same member, two separate exits (cancel → reactivate → cancel). Distinct
  // audit ids must produce distinct latches, or the second exit goes unreported.
  const first = buildAlertLatchMessage('audit_aaa', 'pending');
  const second = buildAlertLatchMessage('audit_bbb', 'pending');
  assert.notEqual(parseAlertLatchEventId(first), parseAlertLatchEventId(second));
});

test('tenure: days between signup and churn, and how it reads', () => {
  assert.equal(tenureDays('2026-08-24T00:00:00.000Z', '2026-08-28T00:00:00.000Z'), 4);
  assert.equal(tenureDays('2026-08-24T00:00:00.000Z', '2026-08-24T09:00:00.000Z'), 0);
  // Unknown or nonsensical inputs degrade to null rather than a guessed number.
  assert.equal(tenureDays(null, '2026-08-28T00:00:00.000Z'), null);
  assert.equal(tenureDays('not-a-date', '2026-08-28T00:00:00.000Z'), null);
  assert.equal(tenureDays('2026-08-28T00:00:00.000Z', '2026-08-24T00:00:00.000Z'), null);

  assert.equal(describeTenure(null), 'unknown');
  assert.equal(describeTenure(0), 'same day');
  assert.equal(describeTenure(1), '1 day');
  assert.equal(describeTenure(4), '4 days');
  // Past ~6 weeks the raw day count stops being readable, so a month figure
  // rides along — that is the trial-vs-tenured distinction at a glance.
  assert.equal(describeTenure(87), '87 days (~3 months)');
});

// A member whose first trial lapsed, who came back weeks later, paid, and
// canceled four weeks into the new subscription. Counted from the account, the
// alert said "69 days (~2 months)".
test('tenure counts from when the subscription began, not from the account', () => {
  const alert = buildChurnAlert(
    {
      ...BASE,
      churnedAtIso: '2026-09-17T15:00:00.000Z',
      accountCreatedAtIso: '2026-07-10T12:00:00.000Z',
      subscriptionStartedAtIso: '2026-08-20T12:00:00.000Z',
      currentPeriodEndIso: '2026-09-20T12:00:00.000Z',
    },
    '2026-09-17T15:10:00.000Z',
  );
  assert.equal(alert.tenureDays, 28);
  assert.equal(alert.tenure, '28 days');
  const byLabel = new Map(alert.facts.map((f) => [f.label, f.value]));
  assert.equal(byLabel.get('Tenure'), '28 days');
  // The account's age is still on the alert, next to the subscription's.
  assert.match(byLabel.get('Signed up') as string, /^Jul 10, 2026/);
  assert.match(byLabel.get('Subscribed') as string, /^Aug 20, 2026/);
});

test('tenure falls back to the account when the subscription start is unknown', () => {
  const alert = buildChurnAlert(BASE, NOW);
  assert.equal(alert.tenureDays, 4);
  const byLabel = new Map(alert.facts.map((f) => [f.label, f.value]));
  assert.equal(byLabel.get('Subscribed'), '—');
});

test('parseChurnSubscriptionId reads both churn rows, and nothing else', () => {
  assert.equal(parseChurnSubscriptionId('Cancellation requested for sub sub_1AbC9'), 'sub_1AbC9');
  assert.equal(
    parseChurnSubscriptionId(
      'Subscription sub_1AbC9 ended; tier reset to public' +
        formatCancellationReasonSuffix({ feedback: 'other', comment: 'Subscription sub_OTHER was fine' }),
    ),
    'sub_1AbC9',
  );
  assert.equal(parseChurnSubscriptionId('Login successful'), null);
});

test('daysUntil: the save window, rounded up so a partial day still counts', () => {
  assert.equal(daysUntil('2026-09-28T12:00:00.000Z', NOW), 26);
  assert.equal(daysUntil(null, NOW), null);
  // Already past: negative, so the caller can switch to the past tense.
  assert.ok((daysUntil('2026-08-30T12:00:00.000Z', NOW) as number) < 0);
});

test('the reason the webhook wrote is the reason the alert reports', () => {
  // Build the audit message the same way the webhook does, then assert the alert
  // reads it back identically. This is the drift guard between the two modules.
  const suffix = formatCancellationReasonSuffix({
    feedback: 'missing_features',
    comment: 'I want data for FUTURES, ES, MES, NASDAQ',
  });
  const alert = buildChurnAlert(
    { ...BASE, auditMessage: `Cancellation requested for sub sub_123${suffix}` },
    NOW,
  );

  assert.equal(alert.reason.feedback, 'missing_features');
  assert.equal(alert.comment, 'I want data for FUTURES, ES, MES, NASDAQ');
  assert.equal(alert.reasonLabel, 'Missing features');
  assert.ok(alert.hasSignal);
});

test('subject: the free-text comment wins the slot, because it is the real signal', () => {
  const withComment = buildChurnAlert(
    {
      ...BASE,
      auditMessage:
        'Cancellation requested for sub sub_123 | cancel_feedback=too_expensive cancel_comment="costs more than I want to pay"',
    },
    NOW,
  );
  assert.ok(withComment.subject.includes('member@example.com'));
  assert.ok(withComment.subject.includes('costs more than I want to pay'));

  // Enum but no free text: fall back to the human label.
  const enumOnly = buildChurnAlert(
    { ...BASE, auditMessage: 'Cancellation requested for sub sub_123 | cancel_feedback=unused' },
    NOW,
  );
  assert.ok(enumOnly.subject.includes("Wasn't using it"));

  // Nothing captured at all: say so plainly instead of rendering an empty dash.
  const silent = buildChurnAlert(BASE, NOW);
  assert.ok(silent.subject.includes('no reason given'));
  assert.equal(silent.comment, null);
  assert.equal(silent.hasSignal, false);
});

test('subject stays short enough to survive a phone notification', () => {
  const long = 'x'.repeat(400);
  const alert = buildChurnAlert(
    {
      ...BASE,
      auditMessage: `Cancellation requested for sub sub_123 | cancel_comment="${long}"`,
    },
    NOW,
  );
  assert.ok(alert.subject.length < 160, `subject was ${alert.subject.length} chars`);
  assert.ok(alert.subject.endsWith('…'));
});

test('pending vs lapsed: only a pending cancel advertises a save window', () => {
  const pending = buildChurnAlert(BASE, NOW);
  assert.match(pending.headline, /still have access/);
  assert.ok(pending.saveWindowNote);
  assert.match(pending.saveWindowNote as string, /26 days left/);

  const lapsed = buildChurnAlert(
    { ...BASE, kind: 'lapsed', currentPeriodEndIso: null },
    NOW,
  );
  assert.match(lapsed.headline, /access has been revoked/i);
  assert.equal(lapsed.saveWindowNote, null);
});

test('a pending cancel whose period end already passed reads in the past tense', () => {
  const alert = buildChurnAlert(
    { ...BASE, currentPeriodEndIso: '2026-08-30T10:00:00.000Z' },
    NOW,
  );
  assert.match(alert.saveWindowNote as string, /^Access ran until/);
});

test('the alert carries the commands you would otherwise go dig up', () => {
  const alert = buildChurnAlert(BASE, NOW);
  assert.ok(alert.commands.every((c) => c.includes(BASE.email)));
  assert.ok(alert.commands.some((c) => c.startsWith('make diagnose-user')));
  assert.ok(alert.commands.some((c) => c.startsWith('make save-url')));
});

test('missing member context degrades to em dashes, never to a crash', () => {
  // A churn row whose user row is gone (deleted account) still has to produce a
  // sendable alert — a partial alert beats a dropped one.
  const alert = buildChurnAlert(
    {
      ...BASE,
      userId: null,
      tier: null,
      accountCreatedAtIso: null,
      currentPeriodEndIso: null,
    },
    NOW,
  );
  assert.equal(alert.tenure, 'unknown');
  const byLabel = new Map(alert.facts.map((f) => [f.label, f.value]));
  assert.equal(byLabel.get('Signed up'), '—');
  assert.equal(byLabel.get('Tier at churn'), 'unknown');
  assert.equal(byLabel.get('User id'), 'unknown');
  assert.ok(alert.subject.length > 0);
});

// ── Paying member or free trial ──────────────────────────────────────────────
// The label must say what the Subscriber Ledger says about the same cancel, so
// these run the real ledger builder rather than hand-written ledger rows.

function sync(overrides: Partial<LedgerSyncEvent>): LedgerSyncEvent {
  return {
    subId: 'sub_1',
    userId: 'user_1',
    email: 'member@example.com',
    at: '2026-09-01T00:00:00.000Z',
    status: 'active',
    tier: 'pro',
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

test('billing: a cancel during the free trial reads as a trial, as it does in the ledger', () => {
  const ledger = buildSubscriberLedger(
    [
      sync({ at: '2026-09-20T22:52:00.000Z', status: 'trialing' }),
      sync({ at: '2026-09-25T22:31:00.000Z', status: 'trialing', cancelAtPeriodEnd: true }),
    ],
    [],
    [],
    [],
    Date.parse('2026-09-25T23:00:00.000Z'),
  );
  assert.ok(ledger.some((r) => r.kind === 'cancelScheduledTrial'));
  // The churn row lands a few seconds after the sync the ledger row came from.
  assert.equal(billingAtCancel(ledger, 'user_1', '2026-09-25T22:31:04.000Z'), 'trial');
});

test('billing: a cancel after the first payment cleared reads as paying', () => {
  const ledger = buildSubscriberLedger(
    [
      sync({ at: '2026-08-24T18:00:00.000Z', status: 'trialing' }),
      sync({ at: '2026-08-31T18:00:00.000Z', status: 'active' }),
      sync({ at: '2026-09-29T07:26:00.000Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [],
    [{ subId: 'sub_1', userId: 'user_1', email: 'member@example.com', at: '2026-09-01T19:00:00.000Z' }],
    [],
    Date.parse('2026-09-29T08:00:00.000Z'),
  );
  assert.ok(ledger.some((r) => r.kind === 'cancelScheduledPaid'));
  assert.equal(billingAtCancel(ledger, 'user_1', '2026-09-29T07:26:02.000Z'), 'paying');
});

test('billing: no answer rather than a guess', () => {
  const ledger = buildSubscriberLedger(
    [
      sync({ at: '2026-09-20T00:00:00.000Z', status: 'trialing' }),
      sync({ at: '2026-09-25T00:00:00.000Z', status: 'trialing', cancelAtPeriodEnd: true }),
    ],
    [],
    [],
    [],
    Date.parse('2026-09-26T00:00:00.000Z'),
  );
  // Another member's cancel at the same moment says nothing about this one.
  assert.equal(billingAtCancel(ledger, 'user_2', '2026-09-25T00:00:01.000Z'), null);
  // A churn row whose account is gone has no member to look up.
  assert.equal(billingAtCancel(ledger, null, '2026-09-25T00:00:01.000Z'), null);
  // A cancel the ledger saw long before is a different click.
  const later = new Date(Date.parse('2026-09-25T00:00:00.000Z') + LEDGER_MATCH_WINDOW_MS + 1000).toISOString();
  assert.equal(billingAtCancel(ledger, 'user_1', later), null);
  assert.equal(billingAtCancel(ledger, 'user_1', 'not a date'), null);
  assert.equal(billingAtCancel([], 'user_1', '2026-09-25T00:00:01.000Z'), null);
});

test('billing: a member who cancels twice gets the verdict for the click nearest the churn row', () => {
  // Canceled the trial, took it back, converted and paid, then canceled again.
  const ledger = buildSubscriberLedger(
    [
      sync({ at: '2026-09-01T00:00:00.000Z', status: 'trialing' }),
      sync({ at: '2026-09-03T00:00:00.000Z', status: 'trialing', cancelAtPeriodEnd: true }),
      sync({ at: '2026-09-03T00:01:00.000Z', status: 'trialing' }),
      sync({ at: '2026-09-08T00:00:00.000Z', status: 'active' }),
      sync({ at: '2026-09-03T00:08:00.000Z', status: 'trialing', cancelAtPeriodEnd: true, subId: 'sub_other', userId: 'user_9' }),
      sync({ at: '2026-09-20T00:00:00.000Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [],
    [{ subId: 'sub_1', userId: 'user_1', email: 'member@example.com', at: '2026-09-08T01:00:00.000Z' }],
    [],
    Date.parse('2026-09-21T00:00:00.000Z'),
  );
  assert.equal(billingAtCancel(ledger, 'user_1', '2026-09-03T00:00:03.000Z'), 'trial');
  assert.equal(billingAtCancel(ledger, 'user_1', '2026-09-20T00:00:03.000Z'), 'paying');
});

test('subject and facts lead with paying or trial', () => {
  const paying = buildChurnAlert({ ...BASE, billing: 'paying' }, NOW);
  assert.ok(paying.subject.startsWith('[ZeroGEX] Paying member canceled: member@example.com — '));
  assert.equal(new Map(paying.facts.map((f) => [f.label, f.value])).get('Billing'), 'Paying member');

  const trial = buildChurnAlert({ ...BASE, billing: 'trial' }, NOW);
  assert.ok(trial.subject.startsWith('[ZeroGEX] Trial canceled, never charged: member@example.com — '));
  assert.equal(new Map(trial.facts.map((f) => [f.label, f.value])).get('Billing'), 'Free trial, never charged');

  // Unknown keeps the old subject: an alert never claims what it can't back up.
  const unknown = buildChurnAlert(BASE, NOW);
  assert.ok(unknown.subject.startsWith('[ZeroGEX] member@example.com canceled — '));
  assert.equal(new Map(unknown.facts.map((f) => [f.label, f.value])).get('Billing'), 'unknown');
});

// ── A cancel on a failed payment ended the plan on the spot ─────────────────
// When the payment had already failed (past_due/unpaid), Cancel ends the
// subscription now and voids its bill (core/pastDueCancel.ts) instead of
// scheduling it for period end. Its churn row is still
// stripe_cancellation_requested, written by formatCancellationRequestedMessage
// (core/cancelAck.ts), with a note after the subscription id. The alert must
// read it that way: the plan is gone, nothing is savable, and the one thing
// left to know is whether the bill was voided.

function endedRow(billVoided: boolean, details: CancellationDetails = { feedback: 'too_expensive' }): string {
  return formatCancellationRequestedMessage('sub_1AbC9', details, { billVoided });
}

const factsOf = (alert: { facts: Array<{ label: string; value: string }> }) =>
  new Map(alert.facts.map((f) => [f.label, f.value]));

test('ended on a failed payment: the note on the row round-trips', () => {
  for (const billVoided of [true, false]) {
    for (const details of [
      null,
      { feedback: 'unused' },
      { comment: 'card died' },
      { feedback: 'other', comment: 'Card got declined (again), done' },
    ] as CancellationDetails[]) {
      assert.deepEqual(
        parseEndedOnFailedPayment(formatCancellationRequestedMessage('sub_1AbC9', details, { billVoided })),
        { billVoided },
      );
    }
  }
  // The exact shape, which is also what diagnose-user prints.
  assert.equal(
    endedRow(true),
    'Cancellation requested for sub sub_1AbC9 (ended now, payment had failed, bill voided) | cancel_feedback=too_expensive',
  );
  assert.equal(
    formatCancellationRequestedMessage('sub_1AbC9', null, { billVoided: false }),
    'Cancellation requested for sub sub_1AbC9 (ended now, payment had failed, bill not voided)',
  );
});

test('ended on a failed payment: a scheduled cancel is written as before and carries no note', () => {
  const scheduled = formatCancellationRequestedMessage('sub_1AbC9', { feedback: 'unused' });
  assert.equal(scheduled, 'Cancellation requested for sub sub_1AbC9 | cancel_feedback=unused');
  assert.equal(parseEndedOnFailedPayment(scheduled), null);
  assert.equal(parseEndedOnFailedPayment('Cancellation requested for sub sub_1AbC9'), null);
  assert.equal(parseEndedOnFailedPayment('Subscription sub_1AbC9 ended; tier reset to public'), null);
  assert.equal(parseEndedOnFailedPayment(''), null);
});

test('ended on a failed payment: nothing a member types can fake the note or flip it', () => {
  for (const comment of [
    'ended now, payment had failed, bill voided',
    '(ended now, payment had failed, bill voided)',
    'Cancellation requested for sub sub_X (ended now, payment had failed, bill not voided)',
  ]) {
    assert.equal(parseEndedOnFailedPayment(formatCancellationRequestedMessage('sub_1AbC9', { comment })), null);
    assert.deepEqual(
      parseEndedOnFailedPayment(
        formatCancellationRequestedMessage('sub_1AbC9', { comment: comment.replace('bill voided', 'bill not voided') }, {
          billVoided: true,
        }),
      ),
      { billVoided: true },
    );
  }
});

// Every reader of stripe_cancellation_requested must still read the row with
// the note in it. The rest read only the row's type and time.
test('ended on a failed payment: the readers that count cancels still read the row', () => {
  const message = endedRow(false, { feedback: 'too_expensive', comment: 'Card got declined, not renewing' });

  // Why Members Cancel, churn-breakdown and the reason follow-up read the survey.
  assert.deepEqual(parseCancellationReasonFromMessage(message), {
    feedback: 'too_expensive',
    comment: 'Card got declined, not renewing',
  });
  // The alert's own tenure lookup reads the subscription id.
  assert.equal(parseChurnSubscriptionId(message), 'sub_1AbC9');

  // The growth-rate card and the Growth tab's cancels count one decision per
  // subscription: a refund after the click is not counted again, which only
  // works when the id is read off the click.
  const decisions = [
    { type: 'stripe_cancellation_requested', message },
    {
      type: 'money_back_refund_issued',
      message: 'Money-back refund (self_serve) on sub sub_1AbC9: refunded $29.00 [re_1], subscription canceled',
    },
  ];
  assert.deepEqual(cancelDecisionRows(decisions), [decisions[0]]);

  // Cohort retention calls the loss voluntary only when the click names the
  // subscription the member first paid on, read with the loosest id pattern
  // (/\bsub_\S+/). Misread, this member would count as a payment failure.
  const cohort = buildCohortReport(
    [
      {
        id: 'u1',
        email: 'u1@example.test',
        createdAt: '2026-06-01T00:00:00.000Z',
        firstPaymentAt: '2026-06-08T00:00:00.000Z',
        currentStatus: null,
        currentTier: 'public',
        currentPriceId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        signupUtmSource: null,
        foundingRate: false,
        cadence: 'monthly',
        cadenceSource: 'current_price',
      },
    ],
    [
      {
        userId: 'u1',
        type: 'stripe_subscription_sync',
        createdAt: '2026-06-08T00:00:00.000Z',
        message: 'Subscription sub_1AbC9 status=active tier=pro cancelAtPeriodEnd=false',
      },
      {
        userId: 'u1',
        type: 'stripe_first_payment',
        createdAt: '2026-06-08T00:00:01.000Z',
        message: 'First payment cleared on sub sub_1AbC9 (invoice in_1, 2900 usd)',
      },
      {
        userId: 'u1',
        type: 'stripe_payment_failed',
        createdAt: '2026-08-08T00:00:00.000Z',
        message: 'Invoice in_2 payment failed for sub sub_1AbC9 (attempt 1)',
      },
      { userId: 'u1', type: 'stripe_cancellation_requested', createdAt: '2026-08-09T00:00:00.000Z', message },
      {
        userId: 'u1',
        type: 'stripe_subscription_deleted',
        createdAt: '2026-08-09T00:00:02.000Z',
        message: 'Subscription sub_1AbC9 ended; tier reset to public | cancel_feedback=too_expensive',
      },
    ],
    '2026-09-12T00:00:00.000Z',
  );
  assert.equal(cohort.users[0].churnKind, 'voluntary');
  assert.equal(cohort.users[0].cancellationReason, 'Too expensive: Card got declined, not renewing');
});

test('ended on a failed payment: the alert says the plan already ended, not that it is savable', () => {
  for (const billVoided of [true, false]) {
    // BASE carries a period end 26 days out, as a row the webhook has not yet
    // cleared would. It must not turn into a save window.
    const alert = buildChurnAlert({ ...BASE, auditMessage: endedRow(billVoided) }, NOW);
    assert.deepEqual(alert.endedOnFailedPayment, { billVoided });
    assert.match(alert.headline, /^Plan already ended — their payment had failed/);
    assert.match(alert.headline, /no subscription left to save/);
    assert.doesNotMatch(alert.headline, /savable|still have access/);
    assert.equal(alert.saveWindowNote, null);
    assert.equal(factsOf(alert).get('Access ends'), 'Already ended');
    // Nothing left for the save link or the win-back discount to act on.
    assert.ok(!alert.commands.some((c) => /make (save-url|honor-winback-discount)/.test(c)));
    assert.equal(alert.commands[0], 'make diagnose-user EMAIL=member@example.com');
    // The reason still comes through.
    assert.equal(alert.reasonLabel, 'Too expensive');
    assert.equal(alert.kind, 'pending');
  }
});

test('ended on a failed payment: the alert says whether the bill was voided', () => {
  const voided = buildChurnAlert({ ...BASE, auditMessage: endedRow(true) }, NOW);
  assert.equal(voided.billNote, 'The unpaid bill was voided, so nothing more can be charged.');
  assert.ok(voided.subject.startsWith('[ZeroGEX] Canceled, plan ended (payment had failed): member@example.com — '));
  assert.deepEqual(voided.commands, ['make diagnose-user EMAIL=member@example.com']);

  const notVoided = buildChurnAlert({ ...BASE, auditMessage: endedRow(false) }, NOW);
  assert.match(notVoided.billNote as string, /^The unpaid bill was not voided and may still be payable\./);
  // Points at the row the cancel flow wrote with the reason and what to run.
  assert.match(notVoided.billNote as string, /billing_cancel_bill_not_voided/);
  assert.ok(notVoided.subject.startsWith('[ZeroGEX] Canceled, plan ended, bill not voided: member@example.com — '));
  assert.deepEqual(notVoided.commands, [
    'make diagnose-user EMAIL=member@example.com',
    'make cancel-subscription EMAIL=member@example.com VOID_INVOICE=1 DRY_RUN=1',
  ]);
});

test('ended on a failed payment: the subject leads with it even when the ledger has a label', () => {
  const alert = buildChurnAlert({ ...BASE, billing: 'paying', auditMessage: endedRow(true) }, NOW);
  assert.ok(alert.subject.startsWith('[ZeroGEX] Canceled, plan ended (payment had failed): '));
  // The Billing line still says what the ledger says.
  assert.equal(factsOf(alert).get('Billing'), 'Paying member');
});

test('ended on a failed payment: a cancel scheduled for period end still reads as savable', () => {
  const alert = buildChurnAlert(
    { ...BASE, auditMessage: formatCancellationRequestedMessage('sub_123', { feedback: 'unused' }) },
    NOW,
  );
  assert.equal(alert.endedOnFailedPayment, null);
  assert.equal(alert.billNote, null);
  assert.match(alert.headline, /still have access, so this is savable/);
  assert.match(alert.saveWindowNote as string, /26 days left/);
  assert.ok(alert.commands.some((c) => c.startsWith('make save-url')));
});

test('shouldAlertOnChurn: a bill left unvoided alerts even when no reason was given', () => {
  assert.equal(shouldAlertOnChurn(formatCancellationRequestedMessage('sub_1', null, { billVoided: false }), false), true);
  // A voided one with no reason reports a departure and nothing else, like any
  // other silent cancel.
  assert.equal(shouldAlertOnChurn(formatCancellationRequestedMessage('sub_1', null, { billVoided: true }), false), false);
  // With a reason, both alert, as every cancel with a reason does.
  assert.equal(
    shouldAlertOnChurn(formatCancellationRequestedMessage('sub_1', { feedback: 'unused' }, { billVoided: true }), false),
    true,
  );
});
