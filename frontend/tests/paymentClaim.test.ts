import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChargeSearchQueries,
  decidePaymentClaim,
  formatMinor,
  parseStatementAmount,
  quoteSearchValue,
  statementSearchWindow,
  type ChargeEvidence,
} from '../core/paymentClaim.ts';

// This module decides whether we can tell a member "we never charged you".
// Getting that wrong in the confident direction is the expensive failure — it
// calls a customer holding a real statement line a liar — so the tests lean on
// the cases where our own records look empty and the money is real anyway.

function charge(over: Partial<ChargeEvidence> = {}): ChargeEvidence {
  return {
    id: 'ch_test',
    amountMinor: 2950,
    amountRefundedMinor: 0,
    currency: 'usd',
    status: 'succeeded',
    createdUnix: 1_789_000_000,
    customerId: 'cus_A',
    localUserId: 'user_a',
    onClaimedCustomer: true,
    disputed: false,
    description: null,
    invoiceId: null,
    ...over,
  };
}

// --- parseStatementAmount ---------------------------------------------------

test('reads the amounts members actually type', () => {
  assert.equal(parseStatementAmount('$29.50'), 2950);
  assert.equal(parseStatementAmount('29.50'), 2950);
  assert.equal(parseStatementAmount('  29.5 '), 2950);
  assert.equal(parseStatementAmount('29,50'), 2950);
  assert.equal(parseStatementAmount('USD 29.50'), 2950);
  assert.equal(parseStatementAmount('1,234.56'), 123456);
});

test('a bare integer is dollars, not cents', () => {
  // Nobody reports a statement line in cents. Reading "29" as $0.29 would
  // search for the wrong amount and return a confident, wrong "no charge".
  assert.equal(parseStatementAmount('29'), 2900);
  assert.equal(parseStatementAmount('$59'), 5900);
});

test('a 3-digit group is thousands, not a fraction', () => {
  assert.equal(parseStatementAmount('1,234'), 123400);
  assert.equal(parseStatementAmount('2.500'), 250000);
});

test('unreadable input is null, never zero', () => {
  // A null makes the caller ask again; a 0 would silently search for $0.00.
  for (const bad of ['', '   ', 'twenty nine', '-29.50', 'abc', '$', '29.5.5']) {
    assert.equal(parseStatementAmount(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

// --- statementSearchWindow --------------------------------------------------

test('the window reaches further back than forward', () => {
  // Statements print a POSTED date; the authorization is routinely days
  // earlier. A symmetric window misses the charge it was built to find.
  const w = statementSearchWindow({ postedDateIso: '2026-09-14' })!;
  const posted = Date.UTC(2026, 8, 14) / 1000;
  assert.ok(posted - w.fromUnix > w.toUnix - posted);
});

test('the default window spans the real-world posting lag', () => {
  const w = statementSearchWindow({ postedDateIso: '2026-09-14' })!;
  // The charge in the incident that prompted this: made Sun Sep 13, posted
  // Mon Sep 14. Any window that misses a one-day lag is useless.
  const madeOn = Date.UTC(2026, 8, 13) / 1000;
  assert.ok(w.fromUnix <= madeOn && madeOn <= w.toUnix);
  // And a charge a full week before the posting still falls inside.
  const weekBefore = Date.UTC(2026, 8, 7) / 1000;
  assert.ok(w.fromUnix <= weekBefore);
});

test('an unreadable date is null, so the caller widens deliberately', () => {
  assert.equal(statementSearchWindow({ postedDateIso: 'last tuesday' }), null);
  assert.equal(statementSearchWindow({ postedDateIso: '' }), null);
});

// --- query construction -----------------------------------------------------

test('quotes and backslashes in a search value are escaped', () => {
  assert.equal(quoteSearchValue('a"b'), '"a\\"b"');
  assert.equal(quoteSearchValue('a\\b'), '"a\\\\b"');
});

test('the fingerprint query carries no date window', () => {
  // A claim about September is not evidence about August. The card's whole
  // history with us is the point.
  const [q] = buildChargeSearchQueries({
    fingerprints: ['fp_abc'],
    emails: [],
    claim: { amountMinor: 2950, postedDateIso: '2026-09-14', last4: null },
    window: statementSearchWindow({ postedDateIso: '2026-09-14' }),
  });
  assert.equal(q.strength, 'card');
  assert.ok(q.query.includes('fp_abc'));
  assert.ok(!q.query.includes('created'));
});

test('an amount-only claim still produces a runnable query', () => {
  // The case this tool exists for: we hold no card, no customer, nothing.
  const queries = buildChargeSearchQueries({
    fingerprints: [],
    emails: [],
    claim: { amountMinor: 2950, postedDateIso: '2026-09-14', last4: '3392' },
    window: statementSearchWindow({ postedDateIso: '2026-09-14' }),
  });
  assert.ok(queries.length >= 2);
  assert.ok(queries.some((q) => q.query.startsWith('amount:2950')));
  assert.ok(queries.some((q) => q.query.includes('last4')));
  assert.ok(queries.every((q) => q.strength === 'circumstantial'));
});

test('last4 is skipped when we already hold the card', () => {
  // The fingerprint supersedes it, and last4 collides across members.
  const queries = buildChargeSearchQueries({
    fingerprints: ['fp_abc'],
    emails: [],
    claim: { amountMinor: null, postedDateIso: null, last4: '3392' },
    window: null,
  });
  assert.ok(!queries.some((q) => q.query.includes('last4')));
});

// --- the verdict ------------------------------------------------------------

test('nothing matched is the only route to "we never charged you"', () => {
  assert.deepEqual(decidePaymentClaim([]), { kind: 'none' });
});

test('failed attempts alone do not clear us', () => {
  const v = decidePaymentClaim([charge({ status: 'failed' }), charge({ status: 'failed' })]);
  assert.equal(v.kind, 'attempted_only');
});

test('a succeeded charge on a DIFFERENT customer still means we have their money', () => {
  // The whole point: the member's own customer record is empty, and the money
  // is sitting on a second customer nothing local owns.
  const v = decidePaymentClaim([
    charge({ status: 'failed', onClaimedCustomer: true }),
    charge({
      id: 'ch_other',
      customerId: 'cus_B',
      localUserId: null,
      onClaimedCustomer: false,
    }),
  ]);
  assert.equal(v.kind, 'collected');
  if (v.kind !== 'collected') return;
  assert.equal(v.netMinor, 2950);
  assert.equal(v.unlinked.length, 1);
  assert.equal(v.unlinked[0].id, 'ch_other');
});

test('a pending charge counts as collected', () => {
  // It is on their statement and the money is on its way to us. Calling that
  // "not a charge" is exactly the error this module prevents.
  const v = decidePaymentClaim([charge({ status: 'pending' })]);
  assert.equal(v.kind, 'collected');
});

test('a fully refunded charge reads as refunded, not as never charged', () => {
  const v = decidePaymentClaim([charge({ amountRefundedMinor: 2950 })]);
  assert.equal(v.kind, 'refunded');
  if (v.kind !== 'refunded') return;
  assert.equal(v.netMinor, 0);
});

test('a partial refund leaves us still holding money', () => {
  const v = decidePaymentClaim([charge({ amountRefundedMinor: 1000 })]);
  assert.equal(v.kind, 'collected');
  if (v.kind !== 'collected') return;
  assert.equal(v.netMinor, 1950);
});

test('a charge linked to the claimed customer is not reported as unlinked', () => {
  const v = decidePaymentClaim([charge()]);
  assert.equal(v.kind, 'collected');
  if (v.kind !== 'collected') return;
  assert.equal(v.unlinked.length, 0);
});

test('formatMinor renders the amount a member would recognise', () => {
  assert.equal(formatMinor(2950), '$29.50');
  assert.equal(formatMinor(2900), '$29.00');
  assert.equal(formatMinor(5900), '$59.00');
  assert.equal(formatMinor(0), '$0.00');
});

test('a loose date is refused rather than guessed', () => {
  // Date.parse reads all of these as SOME date, in the local zone, in the
  // current year, by implementation-defined rules. Searching a window nobody
  // chose and reporting "no charge found" is the failure this tool exists to
  // prevent, so they are refused and the operator retypes.
  for (const loose of ['sept 13', '9/13', '13/09/2026', 'Sep 13 2026', '2026-9-13']) {
    assert.equal(
      statementSearchWindow({ postedDateIso: loose }),
      null,
      `expected null for ${JSON.stringify(loose)}`,
    );
  }
});

test('the two accepted date shapes both resolve', () => {
  assert.ok(statementSearchWindow({ postedDateIso: '2026-09-14' }));
  assert.ok(statementSearchWindow({ postedDateIso: '2026-09-14T13:45:00Z' }));
});
