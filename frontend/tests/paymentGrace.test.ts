import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidePaymentGrace,
  graceWindowEndIso,
  type PaymentGraceInput,
} from '../core/paymentGrace.ts';

// The bounded payment-recovery grace window decides whether a member whose
// renewal charge just failed keeps their paid tier while Stripe's Smart Retries
// work the card. It's the involuntary-churn fix, so lock the matrix down: it
// must protect established payers, must NOT extend unvalidated trial cards, and
// must stay bounded (never "weeks of free premium").

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 24, 12, 0, 0); // fixed clock for determinism

function input(over: Partial<PaymentGraceInput> = {}): PaymentGraceInput {
  return {
    status: 'past_due',
    previousStatus: 'active',
    graceStartedAt: null,
    graceDays: 3,
    nowMs: NOW,
    ...over,
  };
}

test('opens a window on the first past_due of a previously-active subscription', () => {
  const d = decidePaymentGrace(input({ previousStatus: 'active', graceStartedAt: null }));
  assert.equal(d.inGrace, true);
  assert.equal(d.graceStartedAt, new Date(NOW).toISOString());
  assert.equal(d.graceReason, 'renewal');
});

test('a trial-conversion failure (previousStatus trialing) opens no window', () => {
  const d = decidePaymentGrace(input({ previousStatus: 'trialing', graceStartedAt: null }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('a first past_due with no known previous status opens no window', () => {
  const d = decidePaymentGrace(input({ previousStatus: null, graceStartedAt: null }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('graceDays=0 disables the window (old instant-downgrade behavior preserved)', () => {
  const d = decidePaymentGrace(input({ graceDays: 0, graceStartedAt: null }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

// Trial grace (#2): with trialGrace on, a trial-conversion failure gets the same
// bounded window as a renewal failure; with it off (the default), it does not.
test('trialGrace on: a trialing->past_due failure opens a window', () => {
  const d = decidePaymentGrace(
    input({ previousStatus: 'trialing', trialGrace: true, graceStartedAt: null }),
  );
  assert.equal(d.inGrace, true);
  assert.equal(d.graceStartedAt, new Date(NOW).toISOString());
  assert.equal(d.graceReason, 'trial');
});

test('trialGrace off (default): a trialing->past_due failure opens no window', () => {
  const d = decidePaymentGrace(
    input({ previousStatus: 'trialing', trialGrace: false, graceStartedAt: null }),
  );
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('trialGrace has no effect when grace is globally disabled (graceDays=0)', () => {
  const d = decidePaymentGrace(
    input({ previousStatus: 'trialing', trialGrace: true, graceDays: 0, graceStartedAt: null }),
  );
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('trialGrace does not change the established-renewal path', () => {
  // active still opens regardless of the trialGrace flag.
  for (const trialGrace of [true, false]) {
    const d = decidePaymentGrace(input({ previousStatus: 'active', trialGrace, graceStartedAt: null }));
    assert.equal(d.inGrace, true, `active should open a window (trialGrace=${trialGrace})`);
  }
});

// previousTierGranted guard (trial-access fix): a trial whose payment setup
// never succeeded is withheld access (previous synced tier stayed `public`), so
// its first-charge failure must NOT open a recovery window — otherwise the fix
// that withholds premium during the trial hands it right back at trial-end.
test('trialGrace on but the trial was withheld (previousTierGranted=false): no window', () => {
  const d = decidePaymentGrace(
    input({
      previousStatus: 'trialing',
      trialGrace: true,
      previousTierGranted: false,
      graceStartedAt: null,
    }),
  );
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('trialGrace on and the trial was granted (previousTierGranted=true): opens a window', () => {
  const d = decidePaymentGrace(
    input({
      previousStatus: 'trialing',
      trialGrace: true,
      previousTierGranted: true,
      graceStartedAt: null,
    }),
  );
  assert.equal(d.inGrace, true);
  assert.equal(d.graceStartedAt, new Date(NOW).toISOString());
});

test('previousTierGranted guard is trial-only: an established renewal still opens', () => {
  // The guard must never touch the renewal branch — an established payer whose
  // card fails always had a paid tier, and previousTierGranted=false here would
  // be nonsensical, but even so `active` must keep its recovery window.
  const d = decidePaymentGrace(
    input({ previousStatus: 'active', previousTierGranted: false, graceStartedAt: null }),
  );
  assert.equal(d.inGrace, true);
});

test('a trial-opened window enforces the same bound on later past_due syncs', () => {
  // Opened by a trial failure, then a later sync 2 days into a 3-day window: the
  // "already open" branch keys off the anchor + graceDays, not previousStatus.
  const opened = new Date(NOW - 2 * DAY_MS).toISOString();
  const inWindow = decidePaymentGrace(
    input({ previousStatus: 'past_due', graceStartedAt: opened, trialGrace: true }),
  );
  assert.equal(inWindow.inGrace, true);
  const opened4 = new Date(NOW - 4 * DAY_MS).toISOString();
  const expired = decidePaymentGrace(
    input({ previousStatus: 'past_due', graceStartedAt: opened4, trialGrace: true }),
  );
  assert.equal(expired.inGrace, false);
});

test('stays in grace while within the window, preserving the original anchor', () => {
  const opened = new Date(NOW - 2 * DAY_MS).toISOString(); // 2 days into a 3-day window
  const d = decidePaymentGrace(input({ graceStartedAt: opened, previousStatus: 'past_due' }));
  assert.equal(d.inGrace, true);
  assert.equal(d.graceStartedAt, opened);
});

test('expires once the window has elapsed, retaining the anchor until status changes', () => {
  const opened = new Date(NOW - 4 * DAY_MS).toISOString(); // 4 days into a 3-day window
  const d = decidePaymentGrace(input({ graceStartedAt: opened, previousStatus: 'past_due' }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, opened);
});

test('the window boundary is exclusive (exactly graceDays out is expired)', () => {
  const opened = new Date(NOW - 3 * DAY_MS).toISOString(); // exactly 3 days, window is 3
  const d = decidePaymentGrace(input({ graceStartedAt: opened, previousStatus: 'past_due' }));
  assert.equal(d.inGrace, false);
});

test('a malformed anchor is treated as expired, never trusted into grace', () => {
  const d = decidePaymentGrace(
    input({ graceStartedAt: 'not-a-date', previousStatus: 'past_due' }),
  );
  assert.equal(d.inGrace, false);
});

test('disabling grace mid-window (graceDays=0) expires an already-open window', () => {
  const opened = new Date(NOW - 1 * DAY_MS).toISOString();
  const d = decidePaymentGrace(
    input({ graceStartedAt: opened, graceDays: 0, previousStatus: 'past_due' }),
  );
  assert.equal(d.inGrace, false);
});

test('any non-past_due status closes the window and grants no grace', () => {
  const open = new Date(NOW - DAY_MS).toISOString();
  for (const status of [
    'active',
    'trialing',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
  ]) {
    const d = decidePaymentGrace(input({ status, graceStartedAt: open }));
    assert.equal(d.inGrace, false, `status=${status} should not be in grace`);
    assert.equal(d.graceStartedAt, null, `status=${status} should clear the anchor`);
  }
});

// graceWindowEndIso feeds the payment-failed dunning email: it must return a
// date ONLY while a window is genuinely open, so the email never promises
// retained access that doesn't exist.

test('graceWindowEndIso: returns the window end while the window is open', () => {
  const opened = new Date(NOW - 1 * DAY_MS).toISOString(); // 1 day into a 3-day window
  assert.equal(
    graceWindowEndIso(opened, 3, NOW),
    new Date(Date.parse(opened) + 3 * DAY_MS).toISOString(),
  );
});

test('graceWindowEndIso: null once the window has elapsed', () => {
  const opened = new Date(NOW - 4 * DAY_MS).toISOString(); // past a 3-day window
  assert.equal(graceWindowEndIso(opened, 3, NOW), null);
});

test('graceWindowEndIso: null with no anchor, grace disabled, or a malformed anchor', () => {
  assert.equal(graceWindowEndIso(null, 3, NOW), null);
  assert.equal(graceWindowEndIso(new Date(NOW).toISOString(), 0, NOW), null);
  assert.equal(graceWindowEndIso('not-a-date', 3, NOW), null);
});

// --- grace reason -----------------------------------------------------------
// The reason is what lets admin monitoring break the trial-conversion cohort out
// of Total Subscribers, so it must be written on open, carried across the
// follow-up past_due syncs (whose previousStatus is itself `past_due`, i.e. no
// longer identifies the cohort), and cleared in lockstep with the anchor.

test('no open window means no reason (the two columns never disagree)', () => {
  for (const d of [
    decidePaymentGrace(input({ previousStatus: null, graceStartedAt: null })),
    decidePaymentGrace(input({ graceDays: 0, graceStartedAt: null })),
    decidePaymentGrace(input({ previousStatus: 'trialing', trialGrace: false, graceStartedAt: null })),
    decidePaymentGrace(
      input({ previousStatus: 'trialing', trialGrace: true, previousTierGranted: false, graceStartedAt: null }),
    ),
  ]) {
    assert.equal(d.graceStartedAt, null);
    assert.equal(d.graceReason, null);
  }
});

test('leaving past_due clears the reason along with the anchor', () => {
  for (const status of ['active', 'trialing', 'canceled', 'unpaid']) {
    const d = decidePaymentGrace(
      input({ status, graceStartedAt: new Date(NOW - DAY_MS).toISOString(), graceReason: 'trial' }),
    );
    assert.equal(d.graceStartedAt, null, `${status} should clear the anchor`);
    assert.equal(d.graceReason, null, `${status} should clear the reason`);
  }
});

test('a later past_due sync carries the opening reason through unchanged', () => {
  const opened = new Date(NOW - DAY_MS).toISOString();
  for (const reason of ['trial', 'renewal'] as const) {
    const d = decidePaymentGrace(
      input({ previousStatus: 'past_due', graceStartedAt: opened, graceReason: reason }),
    );
    assert.equal(d.inGrace, true);
    assert.equal(d.graceReason, reason);
  }
});

test('an expired window still reports its reason (the anchor is kept, not reopened)', () => {
  const opened = new Date(NOW - 4 * DAY_MS).toISOString();
  const d = decidePaymentGrace(
    input({ previousStatus: 'past_due', graceStartedAt: opened, graceReason: 'trial' }),
  );
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, opened);
  assert.equal(d.graceReason, 'trial');
});

test('a legacy window with no recorded reason stays unattributed', () => {
  // Rows whose window opened before the reason column existed must not be
  // guessed at: monitoring counts a null reason with the established payers,
  // exactly as it did before the split.
  const opened = new Date(NOW - DAY_MS).toISOString();
  const d = decidePaymentGrace(input({ previousStatus: 'past_due', graceStartedAt: opened }));
  assert.equal(d.inGrace, true);
  assert.equal(d.graceReason, null);
});

// ── Trial-conversion attribution across Stripe's trial-end `active` sync ────
// At trial end Stripe does NOT jump straight to past_due: it moves the sub to
// `active` when the cycle invoice is created, then to `past_due` only once that
// invoice finalizes (~an hour later) and the charge is declined. By then the
// last-synced status is `active`, so previousStatus alone attributes a genuine
// first-charge failure to the RENEWAL cohort — which is why admin monitoring's
// Trial Grace bucket read zero. `trialConversion` is the order-independent
// signal the caller derives from the subscription's trial_end (window logic in
// core/trialDunning, covered in tests/trialDunning.test.ts).

test('trial end → active → past_due is still a TRIAL conversion, not a renewal', () => {
  const d = decidePaymentGrace(
    input({
      previousStatus: 'active', // Stripe's trial-end sync already overwrote `trialing`
      trialConversion: true,
      trialGrace: true,
      previousTierGranted: true,
    }),
  );
  assert.equal(d.graceReason, 'trial');
  assert.equal(d.inGrace, true);
});

test('an established payer whose renewal fails stays a RENEWAL', () => {
  const d = decidePaymentGrace(
    input({ previousStatus: 'active', trialConversion: false, trialGrace: true }),
  );
  assert.equal(d.graceReason, 'renewal');
  assert.equal(d.inGrace, true);
});

test('the trial_end signal respects the trialGrace switch', () => {
  // Trial grace off is the old hard trial-end: no window, and crucially NOT a
  // renewal window smuggled in through Stripe's trial-end `active` sync — that
  // would make BILLING_TRIAL_GRACE_ENABLED=0 silently ineffective.
  const d = decidePaymentGrace(
    input({ previousStatus: 'active', trialConversion: true, trialGrace: false }),
  );
  assert.equal(d.graceStartedAt, null);
  assert.equal(d.graceReason, null);
  assert.equal(d.inGrace, false);
});

test('the trial_end signal never bypasses the withheld-card guard', () => {
  for (const previousStatus of ['active', 'trialing']) {
    const d = decidePaymentGrace(
      input({
        previousStatus,
        trialConversion: true,
        trialGrace: true,
        previousTierGranted: false,
      }),
    );
    assert.equal(d.graceStartedAt, null, previousStatus);
    assert.equal(d.graceReason, null, previousStatus);
    assert.equal(d.inGrace, false, previousStatus);
  }
});

test('previousStatus trialing still works as the fallback with no trial_end signal', () => {
  const d = decidePaymentGrace(
    input({ previousStatus: 'trialing', trialConversion: false, trialGrace: true }),
  );
  assert.equal(d.graceReason, 'trial');
});

test('trial attribution survives the later past_due retry syncs', () => {
  const opened = new Date(NOW - DAY_MS).toISOString();
  const d = decidePaymentGrace(
    input({
      previousStatus: 'past_due',
      graceStartedAt: opened,
      graceReason: 'trial',
      trialConversion: true,
      trialGrace: true,
    }),
  );
  assert.equal(d.graceReason, 'trial');
  assert.equal(d.graceStartedAt, opened);
});

test('a trial conversion on a sub with no prior status still opens as trial', () => {
  // previousStatus null (a sub we never synced before) carries no cohort
  // information, but trial_end does — and it must not fall through to renewal.
  const d = decidePaymentGrace(
    input({ previousStatus: null, trialConversion: true, trialGrace: true }),
  );
  assert.equal(d.graceReason, 'trial');
  assert.equal(d.inGrace, true);
});
