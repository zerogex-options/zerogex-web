import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChargeSearchQueries,
  decidePaymentClaim,
  formatMinor,
  isAttributable,
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
    matchStrength: 'card',
    cardLabel: 'mastercard ····3392',
    disputed: false,
    description: null,
    invoiceId: null,
    ...over,
  };
}

function verdict(charges: ChargeEvidence[], failedQueries: string[] = []) {
  return decidePaymentClaim({ charges, failedQueries });
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
    claim: { amountMinor: null, postedDateIso: null, last4: '3392' },
    window: null,
  });
  assert.ok(!queries.some((q) => q.query.includes('last4')));
});

// --- the verdict ------------------------------------------------------------

test('nothing matched, every query ran, is the only route to "we never charged you"', () => {
  assert.deepEqual(verdict([]), { kind: 'none' });
});

test('a query that errored makes "nothing" inconclusive, not clean', () => {
  // A hole in the sweep is not an empty result. The first live run hit this:
  // Stripe rejected billing_details.email as an unsupported search field.
  const v = verdict([], ['billing email them@example.com']);
  assert.equal(v.kind, 'inconclusive');
});

test('failed attempts on their own card do not clear us', () => {
  const v = verdict([charge({ status: 'failed' }), charge({ status: 'failed' })]);
  assert.equal(v.kind, 'attempted_only');
});

test('a succeeded charge on a DIFFERENT customer, same card, is still their money', () => {
  // Their own customer record is empty and the money sits on a second customer
  // nothing local owns. Same physical card, so it is theirs.
  const v = verdict([
    charge({ status: 'failed', onClaimedCustomer: true }),
    charge({
      id: 'ch_other',
      customerId: 'cus_B',
      localUserId: null,
      onClaimedCustomer: false,
      matchStrength: 'card',
    }),
  ]);
  assert.equal(v.kind, 'collected');
  if (v.kind !== 'collected') return;
  assert.equal(v.netMinor, 2950);
  assert.equal(v.unlinked.length, 1);
});

test("another member's charge at the same amount is NEVER this member's money", () => {
  // THE REGRESSION. Live run, 2026-09-18: the amount+window query returned
  // seven charges at $29.50 — five were one unrelated member's dunning retries,
  // two were two other members' successful renewals. Counting them produced
  // "WE HAVE THEIR MONEY — $59.00 net" about a member whose card had never
  // successfully paid us once. Their own card showed five declines and nothing
  // else, which is `attempted_only`.
  const v = verdict([
    charge({ id: 'ch_theirs_1', status: 'failed', amountMinor: 2900, matchStrength: 'card' }),
    charge({ id: 'ch_theirs_2', status: 'failed', amountMinor: 2900, matchStrength: 'account' }),
    charge({
      id: 'ch_stranger_a',
      status: 'succeeded',
      customerId: 'cus_STRANGER_A',
      localUserId: 'user_stranger_a',
      onClaimedCustomer: false,
      matchStrength: 'circumstantial',
    }),
    charge({
      id: 'ch_stranger_b',
      status: 'succeeded',
      customerId: 'cus_STRANGER_B',
      localUserId: 'user_stranger_b',
      onClaimedCustomer: false,
      matchStrength: 'circumstantial',
    }),
  ]);
  assert.equal(v.kind, 'attempted_only');
  if (v.kind !== 'attempted_only') return;
  // The strangers are surfaced as leads — they are the reason to keep looking —
  // but they are not in the charge total and there is no net.
  assert.equal(v.charges.length, 2);
  assert.equal(v.leads.length, 2);
  assert.ok(!('netMinor' in v));
});

test('circumstantial matches alone are leads, not an answer either way', () => {
  const v = verdict([
    charge({ id: 'ch_maybe', matchStrength: 'circumstantial', onClaimedCustomer: false }),
  ]);
  assert.equal(v.kind, 'leads_only');
  if (v.kind !== 'leads_only') return;
  assert.equal(v.leads.length, 1);
});

test('a failed lead is not even a lead', () => {
  // A decline at the same amount tells the operator nothing to chase.
  const v = verdict([charge({ matchStrength: 'circumstantial', status: 'failed' })]);
  assert.equal(v.kind, 'none');
});

test('a pending charge on their card counts as collected', () => {
  const v = verdict([charge({ status: 'pending' })]);
  assert.equal(v.kind, 'collected');
});

test('a fully refunded charge reads as refunded, not as never charged', () => {
  const v = verdict([charge({ amountRefundedMinor: 2950 })]);
  assert.equal(v.kind, 'refunded');
  if (v.kind !== 'refunded') return;
  assert.equal(v.netMinor, 0);
});

test('a partial refund leaves us still holding money', () => {
  const v = verdict([charge({ amountRefundedMinor: 1000 })]);
  assert.equal(v.kind, 'collected');
  if (v.kind !== 'collected') return;
  assert.equal(v.netMinor, 1950);
});

test('a failed query cannot downgrade money we have actually found', () => {
  // The hole only invalidates the NEGATIVE claim.
  const v = verdict([charge()], ['billing email them@example.com']);
  assert.equal(v.kind, 'collected');
});

test('leads ride along with a positive verdict too', () => {
  const v = verdict([
    charge(),
    charge({ id: 'ch_lead', matchStrength: 'circumstantial', onClaimedCustomer: false }),
  ]);
  assert.equal(v.kind, 'collected');
  if (v.kind !== 'collected') return;
  assert.equal(v.netMinor, 2950);
  assert.equal(v.leads.length, 1);
});

test('isAttributable is the whole rule, in one place', () => {
  assert.equal(isAttributable(charge({ matchStrength: 'card' })), true);
  assert.equal(isAttributable(charge({ matchStrength: 'account' })), true);
  assert.equal(isAttributable(charge({ matchStrength: 'circumstantial' })), false);
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
