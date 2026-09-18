import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideStaleInvoice,
  hoursOfValueRemaining,
  type StaleInvoiceInput,
} from '../core/staleInvoice.ts';

// Voiding an invoice is FINAL and takes away a member's ability to buy back the
// period they lost. These tests pin both directions of the mistake: voiding one
// that still buys access (destroying a real option), and keeping one that
// cannot (leaving the trap that took $29.00 for nothing).

const NOW = Math.floor(Date.UTC(2026, 8, 18, 12, 0, 0) / 1000); // 2026-09-18
const DAY = 24 * 60 * 60;

function input(over: Partial<StaleInvoiceInput> = {}): StaleInvoiceInput {
  return {
    invoiceStatus: 'open',
    amountDue: 2900,
    // The incident's invoice: covers Aug 19 - Sep 19.
    periodEndUnix: Math.floor(Date.UTC(2026, 8, 19, 6, 43, 0) / 1000),
    subscriptionStatus: null, // Stripe deleted it for nonpayment
    cancellationReason: 'payment_failed',
    nowUnix: NOW,
    ...over,
  };
}

test('an invoice that still buys access is kept', () => {
  // One day left is still a day the member paid for. This is the window
  // core/orphanPayment.ts exists to honour.
  const d = decideStaleInvoice(input());
  assert.equal(d.kind, 'keep');
  if (d.kind !== 'keep') return;
  assert.equal(d.reason, 'still_buys_access');
});

test('the same invoice two days later is void', () => {
  // Past the period end, paying it buys nothing and Stripe will not accept a
  // billing anchor in the past. Every dollar it can still collect is a dollar
  // collected for nothing.
  const d = decideStaleInvoice(input({ nowUnix: NOW + 2 * DAY }));
  assert.equal(d.kind, 'void');
});

test('a live subscription is never stale, however old the invoice', () => {
  for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']) {
    const d = decideStaleInvoice(
      input({ subscriptionStatus: status, nowUnix: NOW + 400 * DAY }),
    );
    assert.equal(d.kind, 'keep', `expected keep for ${status}`);
    if (d.kind !== 'keep') return;
    assert.equal(d.reason, 'subscription_live');
  }
});

test('an unreadable period is kept, because voiding is irreversible', () => {
  // Not knowing is not a licence to destroy the member's option.
  const d = decideStaleInvoice(input({ periodEndUnix: null, nowUnix: NOW + 400 * DAY }));
  assert.equal(d.kind, 'keep');
  if (d.kind !== 'keep') return;
  assert.equal(d.reason, 'period_unresolved');
});

test('only an open invoice is void-able', () => {
  for (const status of ['paid', 'void', 'uncollectible', 'draft', null]) {
    const d = decideStaleInvoice(
      input({ invoiceStatus: status, nowUnix: NOW + 400 * DAY }),
    );
    assert.equal(d.kind, 'keep', `expected keep for ${String(status)}`);
  }
});

test('a zero-due invoice springs no trap and is left alone', () => {
  const d = decideStaleInvoice(input({ amountDue: 0, nowUnix: NOW + 400 * DAY }));
  assert.equal(d.kind, 'keep');
  if (d.kind !== 'keep') return;
  assert.equal(d.reason, 'zero_amount_due');
});

test('the kept decision carries the date the value runs out', () => {
  // So an operator never has to derive the cliff by hand off a period end.
  const d = decideStaleInvoice(input());
  assert.equal(d.kind, 'keep');
  if (d.kind !== 'keep') return;
  assert.equal(d.buysAccessUntilUnix, Math.floor(Date.UTC(2026, 8, 19, 6, 43, 0) / 1000));
});

test('hours of remaining value counts down and floors at zero', () => {
  assert.equal(hoursOfValueRemaining({ periodEndUnix: NOW + 3600 * 5, nowUnix: NOW }), 5);
  assert.equal(hoursOfValueRemaining({ periodEndUnix: NOW - 10, nowUnix: NOW }), 0);
  assert.equal(hoursOfValueRemaining({ periodEndUnix: null, nowUnix: NOW }), null);
});

test('the boundary itself is not worth paying', () => {
  // Exactly at period end there is no access left to buy.
  const at = decideStaleInvoice(input({ periodEndUnix: NOW, nowUnix: NOW }));
  assert.equal(at.kind, 'void');
  const oneSecondBefore = decideStaleInvoice(input({ periodEndUnix: NOW + 1, nowUnix: NOW }));
  assert.equal(oneSecondBefore.kind, 'keep');
});

test('a voluntary cancel leaves the bill standing', () => {
  // Dunning cuts access at cancellation, so its invoice bills for a period the
  // member never got. A member who cancelled on their own may well have HAD the
  // period — that is a receivable, and writing it off is not automatic.
  for (const reason of ['cancellation_requested', null, 'unknown_reason']) {
    const d = decideStaleInvoice(
      input({ cancellationReason: reason, nowUnix: NOW + 400 * DAY }),
    );
    assert.equal(d.kind, 'keep', `expected keep for ${String(reason)}`);
    if (d.kind !== 'keep') return;
    assert.ok(d.reason.startsWith('not_a_dunning_cancellation'));
  }
});

test('an operator can sweep voluntary leftovers deliberately', () => {
  const d = decideStaleInvoice(
    input({
      cancellationReason: 'cancellation_requested',
      includeVoluntary: true,
      nowUnix: NOW + 400 * DAY,
    }),
  );
  assert.equal(d.kind, 'void');
});

test('the override cannot void an invoice that still buys access', () => {
  // It widens WHICH dead subscriptions are in scope, never the period rule.
  const d = decideStaleInvoice(input({ includeVoluntary: true }));
  assert.equal(d.kind, 'keep');
  if (d.kind !== 'keep') return;
  assert.equal(d.reason, 'still_buys_access');
});
