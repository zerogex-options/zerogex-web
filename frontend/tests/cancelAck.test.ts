import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The cancellation acknowledgment's whole lifecycle (core/cancelAck.ts), driven
// through the same calls the Stripe webhook makes, against a throwaway SQLite
// file carrying the REAL schema. The send-once latch is a SQL predicate
// (`cancel_ack_email_sent_at IS NULL`) and its failure mode is silence: a latch
// that is never released just makes the next cancel send nothing. That is how
// members who lapsed and came back went unacknowledged when they canceled again.

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-cancel-ack-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first.
const { getDb } = await import('../core/db.ts');
const { markSubscriptionEnded } = await import('../core/billingUser.ts');
const { acknowledgeEndedCancel, handleCancelAckTransition } = await import('../core/cancelAck.ts');
const { buildChurnAlert, shouldAlertOnChurn } = await import('../core/cancellationAlert.ts');

const db = getDb();

type Sent = {
  to: string;
  periodEndIso: string | null;
  saveUrl: string | null;
  conversionChargePending: boolean;
  trialing: boolean;
  cancellationFeedback: string | null;
  cancellationComment: string | null;
  savePercent: number;
  paymentFailed?: { neverPaid: boolean; billVoided: boolean } | null;
  cadence?: string | null;
};

// Fakes for what the webhook passes in: the mailer, the save-link builder and
// its audit writer. The clock ticks a second per call so stamps are ordered.
function harness(opts: { failSend?: boolean; noSaveSecret?: boolean } = {}) {
  const sent: Sent[] = [];
  const audits: Array<{ type: string; userId: string; message: string }> = [];
  let clock = Date.UTC(2026, 6, 1, 12, 0, 0);
  const deps = {
    send: async (to: string, o: Omit<Sent, 'to'>) => {
      if (opts.failSend) throw new Error('Resend returned 503');
      sent.push({ to, ...o });
    },
    buildSaveUrl: (userId: string, offer: 'save' | 'price') => {
      if (opts.noSaveSecret) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
      return `https://zerogex.io/save?u=${userId}${offer === 'price' ? '&o=price' : ''}`;
    },
    audit: (e: { type: string; userId: string; email: string; message: string }) => {
      audits.push({ type: e.type, userId: e.userId, message: e.message });
    },
    nowIso: () => new Date((clock += 1000)).toISOString(),
  };
  const acks = (userId: string) =>
    audits.filter((a) => a.userId === userId && a.type === 'cancellation_ack_email_sent');
  return { sent, audits, deps, acks };
}

function seedMember(id: string) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, stripe_customer_id)
     VALUES (?, ?, 'public', ?, ?, ?)`,
  ).run(id, `${id}@example.com`, now, now, `cus_${id}`);
  return { id, email: `${id}@example.com` };
}

// What syncSubscriptionToUser does to the row for one subscription event, as far
// as this latch is concerned: read cancel_at_period_end BEFORE the update, write
// the subscription's state, and hand the before/after pair on.
function sync(memberId: string, sub: { id: string; cancelAtPeriodEnd: 0 | 1 }) {
  const before = db
    .prepare('SELECT cancel_at_period_end FROM users WHERE id = ?')
    .get(memberId) as { cancel_at_period_end: number };
  db.prepare(
    `UPDATE users SET tier = 'pro', stripe_subscription_id = ?, subscription_status = 'active',
                      current_period_end = '2026-10-01T12:00:00.000Z', cancel_at_period_end = ?
     WHERE id = ?`,
  ).run(sub.id, sub.cancelAtPeriodEnd, memberId);
  return {
    previous: before.cancel_at_period_end ? 1 : 0,
    next: sub.cancelAtPeriodEnd,
    periodEndIso: '2026-10-01T12:00:00.000Z',
    subscriptionId: sub.id,
    conversionChargePending: false,
  };
}

function latchOf(memberId: string): string | null {
  return (
    db.prepare('SELECT cancel_ack_email_sent_at AS l FROM users WHERE id = ?').get(memberId) as {
      l: string | null;
    }
  ).l;
}

test('a cancel is acknowledged once, with the save link, and a repeat sends nothing', async () => {
  const h = harness();
  const m = seedMember('u_once');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps), 'sent');
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, m.email);
  assert.equal(h.sent[0].saveUrl, `https://zerogex.io/save?u=${m.id}`);
  assert.equal(h.sent[0].periodEndIso, '2026-10-01T12:00:00.000Z');
  assert.equal(h.acks(m.id).length, 1);
  assert.notEqual(latchOf(m.id), null);

  // A second event that also saw the 0→1 flip (a race between two deliveries)
  // finds the latch taken.
  const again = { previous: 0, next: 1, periodEndIso: null, subscriptionId: 'sub_A', conversionChargePending: false };
  assert.equal(await handleCancelAckTransition(m, again, h.deps), 'already_acknowledged');
  assert.equal(h.sent.length, 1);
  assert.equal(h.acks(m.id).length, 1);
});

// The case this module was pulled out of the webhook to prove.
test('a member who lapses, comes back and cancels again is acknowledged again', async () => {
  const h = harness();
  const m = seedMember('u_returning');

  // First subscription: cancel, acknowledged.
  sync(m.id, { id: 'sub_FIRST', cancelAtPeriodEnd: 0 });
  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_FIRST', cancelAtPeriodEnd: 1 }), h.deps),
    'sent',
  );

  // It runs out: customer.subscription.deleted.
  assert.equal(
    markSubscriptionEnded({ userId: m.id, subscriptionId: 'sub_FIRST', status: 'canceled', nowIso: h.deps.nowIso() }),
    true,
  );

  // Weeks later they buy again. The new subscription arrives un-canceled, so
  // there is no transition to act on.
  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_SECOND', cancelAtPeriodEnd: 0 }), h.deps),
    'no_transition',
  );

  // And cancel again.
  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_SECOND', cancelAtPeriodEnd: 1 }), h.deps),
    'sent',
  );
  assert.equal(h.sent.length, 2);
  const acks = h.acks(m.id);
  assert.equal(acks.length, 2);
  assert.match(acks[1].message, /sub_SECOND/);
});

// The state the bug left behind: a latch from an earlier subscription on a row
// with no cancel pending. Members already in it when the fix shipped needed
// the latch cleared by hand; nothing clears it on its own until they cancel
// and that subscription ends.
test('a latch left over from an earlier subscription swallows the next acknowledgment', async () => {
  const h = harness();
  const m = seedMember('u_leftover');
  sync(m.id, { id: 'sub_NOW', cancelAtPeriodEnd: 0 });
  db.prepare('UPDATE users SET cancel_ack_email_sent_at = ? WHERE id = ?').run('2026-07-15T09:00:00.000Z', m.id);

  const outcome = await handleCancelAckTransition(m, sync(m.id, { id: 'sub_NOW', cancelAtPeriodEnd: 1 }), h.deps);
  assert.equal(outcome, 'already_acknowledged');
  assert.equal(h.sent.length, 0);
  // The cancel itself is still on record; only the acknowledgment is missing.
  assert.equal(h.audits.filter((a) => a.type === 'stripe_cancellation_requested').length, 1);
  assert.equal(h.acks(m.id).length, 0);
});

test('un-canceling releases the latch, so a second cancel is acknowledged', async () => {
  const h = harness();
  const m = seedMember('u_changed_mind');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });
  await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps);

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 }), h.deps), 'released');
  assert.equal(latchOf(m.id), null);

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps), 'sent');
  assert.equal(h.acks(m.id).length, 2);
});

// A failed send keeps the latch: the claim happens before the send, so a
// redelivery can't turn one outage into a string of duplicate emails.
test('a failed send is recorded, and a repeat does not resend', async () => {
  const h = harness({ failSend: true });
  const m = seedMember('u_send_failed');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });

  assert.equal(
    await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps),
    'send_failed',
  );
  const errors = h.audits.filter((a) => a.type === 'cancellation_ack_email_error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Resend returned 503/);
  assert.notEqual(latchOf(m.id), null);

  const again = { previous: 0, next: 1, periodEndIso: null, subscriptionId: 'sub_A', conversionChargePending: false };
  assert.equal(await handleCancelAckTransition(m, again, h.deps), 'already_acknowledged');
});

test('without a save link the acknowledgment still goes out, just without the offer', async () => {
  const h = harness({ noSaveSecret: true });
  const m = seedMember('u_no_secret');
  sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 0 });

  assert.equal(await handleCancelAckTransition(m, sync(m.id, { id: 'sub_A', cancelAtPeriodEnd: 1 }), h.deps), 'sent');
  assert.equal(h.sent[0].saveUrl, null);
});

test('a "too expensive" cancel gets the 50% save link; any other reason gets 25%', async () => {
  const h = harness();
  const pricey = seedMember('u_pricey');
  sync(pricey.id, { id: 'sub_P', cancelAtPeriodEnd: 0 });
  const t = sync(pricey.id, { id: 'sub_P', cancelAtPeriodEnd: 1 });
  await handleCancelAckTransition(
    pricey,
    { ...t, cancellationDetails: { feedback: 'too_expensive' } },
    h.deps,
  );
  assert.equal(h.sent[0].saveUrl, `https://zerogex.io/save?u=${pricey.id}&o=price`);
  assert.equal(h.sent[0].savePercent, 50);
  assert.equal(h.sent[0].cancellationFeedback, 'too_expensive');

  const other = seedMember('u_other');
  sync(other.id, { id: 'sub_O', cancelAtPeriodEnd: 0 });
  const o = sync(other.id, { id: 'sub_O', cancelAtPeriodEnd: 1 });
  await handleCancelAckTransition(other, { ...o, cancellationDetails: { feedback: 'unused' } }, h.deps);
  assert.equal(h.sent[1].saveUrl, `https://zerogex.io/save?u=${other.id}`);
  assert.equal(h.sent[1].savePercent, 25);
});

test('a trial cancel is flagged to the email; a paid one is not', async () => {
  const h = harness();
  const trial = seedMember('u_trial');
  sync(trial.id, { id: 'sub_T', cancelAtPeriodEnd: 0 });
  const t = sync(trial.id, { id: 'sub_T', cancelAtPeriodEnd: 1 });
  await handleCancelAckTransition(trial, { ...t, trialing: true }, h.deps);
  assert.equal(h.sent[0].trialing, true);

  const paid = seedMember('u_paid');
  sync(paid.id, { id: 'sub_Pd', cancelAtPeriodEnd: 0 });
  const p = sync(paid.id, { id: 'sub_Pd', cancelAtPeriodEnd: 1 });
  await handleCancelAckTransition(paid, p, h.deps);
  assert.equal(h.sent[1].trialing, false);
});

test("the plan's billing period rides along to the email; unknown is sent as null", async () => {
  const h = harness();
  const yearly = seedMember('u_yearly');
  sync(yearly.id, { id: 'sub_Y', cancelAtPeriodEnd: 0 });
  const y = sync(yearly.id, { id: 'sub_Y', cancelAtPeriodEnd: 1 });
  await handleCancelAckTransition(yearly, { ...y, cadence: 'annual' }, h.deps);
  assert.equal(h.sent[0].cadence, 'annual');

  // A price that maps to no plan, or a caller that does not say: null, which
  // keeps the email's general save wording.
  const unknown = seedMember('u_unknown_plan');
  sync(unknown.id, { id: 'sub_U', cancelAtPeriodEnd: 0 });
  await handleCancelAckTransition(unknown, sync(unknown.id, { id: 'sub_U', cancelAtPeriodEnd: 1 }), h.deps);
  assert.equal(h.sent[1].cadence, null);
});

test('the survey comment rides along to the email, so they are not asked why again', async () => {
  const h = harness();
  const m = seedMember('u_commented');
  sync(m.id, { id: 'sub_C', cancelAtPeriodEnd: 0 });
  const t = sync(m.id, { id: 'sub_C', cancelAtPeriodEnd: 1 });
  await handleCancelAckTransition(
    m,
    { ...t, cancellationDetails: { feedback: 'other', comment: 'Moving to futures only' } },
    h.deps,
  );
  assert.equal(h.sent[0].cancellationComment, 'Moving to futures only');
});

// A cancel after the payment had already failed. The in-app flow ends that
// subscription on the spot and voids its bill (core/pastDueCancel.ts), so there
// is no 0→1 transition for the webhook to acknowledge: acknowledgeEndedCancel
// does it, with the failed-payment version of the email. The reason still has
// to land on stripe_cancellation_requested, which every cancel report reads.

function requestedRows(h: ReturnType<typeof harness>, userId: string) {
  return h.audits.filter((a) => a.userId === userId && a.type === 'stripe_cancellation_requested');
}

test('past_due trial conversion: recorded with its reason, trial copy, bill voided, no save link', async () => {
  const h = harness();
  const m = seedMember('u_pd_trial');

  const outcome = await acknowledgeEndedCancel(
    m,
    {
      subscriptionId: 'sub_PDT',
      neverPaid: true,
      billVoided: true,
      cancellationDetails: { feedback: 'missing_features', comment: 'No futures' },
    },
    h.deps,
  );

  assert.equal(outcome, 'sent');
  const requested = requestedRows(h, m.id);
  assert.equal(requested.length, 1);
  // The note after the id is what keeps the operator alert from calling this
  // savable; the reason suffix after it is unchanged.
  assert.equal(
    requested[0].message,
    'Cancellation requested for sub sub_PDT (ended now, payment had failed, bill voided)' +
      ' | cancel_feedback=missing_features cancel_comment="No futures"',
  );
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.sent[0].paymentFailed, { neverPaid: true, billVoided: true });
  // Nothing to keep and no date to keep it until: the subscription has ended.
  assert.equal(h.sent[0].saveUrl, null);
  assert.equal(h.sent[0].periodEndIso, null);
  assert.equal(h.sent[0].conversionChargePending, false);
  assert.equal(h.sent[0].cancellationFeedback, 'missing_features');
  assert.equal(h.sent[0].cancellationComment, 'No futures');
  assert.equal(h.acks(m.id).length, 1);
});

test('past_due renewal: paid copy, and a bill that could not be voided is passed on as such', async () => {
  const h = harness();
  const m = seedMember('u_pd_renewal');

  await acknowledgeEndedCancel(m, { subscriptionId: 'sub_PDR', neverPaid: false, billVoided: false }, h.deps);

  assert.deepEqual(h.sent[0].paymentFailed, { neverPaid: false, billVoided: false });
  assert.equal(h.sent[0].trialing, false);
  assert.equal(
    requestedRows(h, m.id)[0].message,
    'Cancellation requested for sub sub_PDR (ended now, payment had failed, bill not voided)',
  );
});

// The operator's cancellation alert reads the row this path writes. Driven
// end to end so the writer and the alert cannot drift apart.
test('the cancellation alert reads an ended cancel as ended, with its bill', async () => {
  for (const billVoided of [true, false]) {
    const h = harness();
    const m = seedMember(`u_pd_alert_${billVoided ? 'voided' : 'open'}`);
    await acknowledgeEndedCancel(
      m,
      { subscriptionId: 'sub_PDA', neverPaid: false, billVoided, cancellationDetails: { feedback: 'too_expensive' } },
      h.deps,
    );
    const [row] = requestedRows(h, m.id);
    const alert = buildChurnAlert(
      {
        churnEventId: 'audit_pd_alert',
        kind: 'pending',
        email: m.email,
        userId: m.id,
        auditMessage: row.message,
        churnedAtIso: '2026-07-01T12:00:00.000Z',
        accountCreatedAtIso: null,
        subscriptionStartedAtIso: null,
        tier: 'pro',
        billing: null,
        // A row the deleted webhook has not cleared yet still has a period end.
        currentPeriodEndIso: '2026-07-20T12:00:00.000Z',
      },
      '2026-07-01T12:05:00.000Z',
    );
    assert.deepEqual(alert.endedOnFailedPayment, { billVoided });
    assert.match(alert.headline, /^Plan already ended/);
    assert.equal(alert.saveWindowNote, null);
    assert.equal(alert.reasonLabel, 'Too expensive');
  }
  // A bill left open alerts even with no reason given.
  const h = harness();
  const silent = seedMember('u_pd_alert_silent');
  await acknowledgeEndedCancel(silent, { subscriptionId: 'sub_PDS', neverPaid: true, billVoided: false }, h.deps);
  assert.equal(shouldAlertOnChurn(requestedRows(h, silent.id)[0].message, false), true);
});

// No latch on this path: it runs once per click, behind a Stripe cancel that
// succeeds once. Claiming one here would race the release that
// customer.subscription.deleted makes, and could outlive the subscription.
test('an ended cancel neither needs the latch nor touches it', async () => {
  const h = harness();
  const leftover = seedMember('u_pd_leftover');
  db.prepare('UPDATE users SET cancel_ack_email_sent_at = ? WHERE id = ?').run('2026-07-15T09:00:00.000Z', leftover.id);
  assert.equal(
    await acknowledgeEndedCancel(leftover, { subscriptionId: 'sub_L', neverPaid: false, billVoided: true }, h.deps),
    'sent',
  );
  assert.equal(latchOf(leftover.id), '2026-07-15T09:00:00.000Z');

  const clean = seedMember('u_pd_clean');
  await acknowledgeEndedCancel(clean, { subscriptionId: 'sub_C', neverPaid: true, billVoided: true }, h.deps);
  assert.equal(latchOf(clean.id), null);
});

test('an ended cancel whose email fails is still recorded as a cancel', async () => {
  const h = harness({ failSend: true });
  const m = seedMember('u_pd_send_failed');
  assert.equal(
    await acknowledgeEndedCancel(m, { subscriptionId: 'sub_F', neverPaid: true, billVoided: true }, h.deps),
    'send_failed',
  );
  assert.equal(requestedRows(h, m.id).length, 1);
  const errors = h.audits.filter((a) => a.userId === m.id && a.type === 'cancellation_ack_email_error');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /sub_F: Resend returned 503/);
});

// The webhook path. A cancel scheduled at period end on a failed payment can
// only come from outside the app now (the Stripe Dashboard, or the portal if its
// Cancel is turned back on). Nothing was ended or voided and Stripe is still
// retrying, so the usual "full access until …" email would be false.
test('a cancel scheduled on a failed payment is recorded and flagged, and no email goes out', async () => {
  const h = harness();
  const m = seedMember('u_pd_outside');
  sync(m.id, { id: 'sub_O', cancelAtPeriodEnd: 0 });

  const outcome = await handleCancelAckTransition(
    m,
    { ...sync(m.id, { id: 'sub_O', cancelAtPeriodEnd: 1 }), paymentFailed: true, cancellationDetails: { feedback: 'unused' } },
    h.deps,
  );

  assert.equal(outcome, 'withheld_payment_failed');
  assert.equal(h.sent.length, 0);
  assert.equal(latchOf(m.id), null);
  assert.equal(requestedRows(h, m.id).length, 1);
  // Nothing was ended here: Stripe is still retrying. So the row carries no
  // "ended now" note, only the reason.
  assert.equal(requestedRows(h, m.id)[0].message, 'Cancellation requested for sub sub_O | cancel_feedback=unused');
  const flagged = h.audits.filter((a) => a.userId === m.id && a.type === 'cancellation_ack_withheld_payment_failed');
  assert.equal(flagged.length, 1);
  assert.match(flagged[0].message, /sub_O/);
  assert.match(flagged[0].message, /make cancel-subscription EMAIL=u_pd_outside@example\.com VOID_INVOICE=1 DRY_RUN=1/);
});
