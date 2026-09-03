import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHURN_EVENT_TYPES,
  CHURN_EVENT_TYPE_VALUES,
  ALERT_SENT_EVENT_TYPE,
  classifyChurnEvent,
  buildAlertLatchMessage,
  parseAlertLatchEventId,
  tenureDays,
  describeTenure,
  daysUntil,
  buildChurnAlert,
  selectBatch,
  shouldAlertOnChurn,
  type ChurnAlertInput,
} from '../core/cancellationAlert.ts';
import { formatCancellationReasonSuffix } from '../core/cancellationReason.ts';

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
  tier: 'pro',
  currentPeriodEndIso: '2026-09-28T10:00:00.000Z',
};

const NOW = '2026-09-02T12:00:00.000Z';

test('shouldAlertOnChurn: a pending cancel always alerts, reason or not', () => {
  // They still have access, so there is a live save window and a decision to
  // make. Tenure alone can justify a reply — a silent cancel at four months is
  // worth an email. Filtering these would defeat the point of the alert.
  assert.equal(shouldAlertOnChurn('pending', 'Cancellation requested for sub_1', false), true);
  assert.equal(
    shouldAlertOnChurn('pending', 'Cancellation requested | cancel_feedback=unused', false),
    true,
  );
});

test('shouldAlertOnChurn: a lapse only alerts when the survey captured something', () => {
  // Access is already gone. A lapse with no reason carries no decision and no
  // information — overwhelmingly a trial that just ended — and on real data that
  // class was ~85% of the stream, enough noise to bury the signal with it.
  assert.equal(shouldAlertOnChurn('lapsed', 'Subscription sub_1 ended', false), false);

  // A captured enum is signal.
  assert.equal(
    shouldAlertOnChurn('lapsed', 'Subscription sub_1 ended | cancel_feedback=switched_service', false),
    true,
  );
  // So is free text, which is the richest case of all.
  assert.equal(
    shouldAlertOnChurn(
      'lapsed',
      'Subscription sub_1 ended | cancel_comment="dealer hedging flows are missing"',
      false,
    ),
    true,
  );
});

test('shouldAlertOnChurn: the escape hatch restores the unfiltered stream', () => {
  assert.equal(shouldAlertOnChurn('lapsed', 'Subscription sub_1 ended', true), true);
  // ...and never suppresses anything that was already alerting.
  assert.equal(shouldAlertOnChurn('pending', 'Cancellation requested', true), true);
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
  // Neighbouring subscription events must NOT be treated as churn — a sync or a
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
