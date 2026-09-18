import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCluster,
  handoffGapHours,
  closestSignupGapHours,
  compareClusters,
  grantedATrial,
  parseTrialGrant,
  type ClusterAccount,
} from '../core/duplicateAccounts.ts';

// The sweep behind these rules points a human at other people's accounts and
// says "this might be one person". Getting it wrong in the loud direction —
// calling two flatmates a fraudster — is worse than missing one, so the tests
// lean on what must NOT be escalated as hard as on what must.

function account(over: Partial<ClusterAccount> = {}): ClusterAccount {
  return {
    userId: 'user_a',
    email: 'a@example.com',
    createdAt: '2026-08-12T06:42:04Z',
    tier: 'public',
    everPaid: false,
    lifetimeCollectedMinor: 0,
    tookTrial: false,
    deletedAt: null,
    ...over,
  };
}

// --- parsing the trial grant off the audit row ------------------------------

test('reads the trial a checkout actually granted', () => {
  // Verbatim shapes from app/api/billing/checkout/route.ts.
  assert.equal(
    parseTrialGrant('tier=pro cadence=monthly heldBefore=0 everPaid=0 trial=7d session=cs_live_x'),
    '7d',
  );
  assert.equal(parseTrialGrant('tier=pro campaign=TARGET trial=0 session=cs_live_x'), '0');
  assert.equal(parseTrialGrant('tier=pro trial=founding_july1 session=cs_live_x'), 'founding_july1');
});

test('an absent trial field is null, not "no trial"', () => {
  // A quiet gap in the log must not read as evidence the gate held.
  assert.equal(parseTrialGrant('tier=pro cadence=monthly session=cs_live_x'), null);
  assert.equal(parseTrialGrant(''), null);
});

test('a field merely ending in trial= is not the trial field', () => {
  assert.equal(parseTrialGrant('reactivation_trial=7d session=cs_live_x'), null);
});

test('only a real grant counts as a trial taken', () => {
  assert.equal(grantedATrial('7d'), true);
  assert.equal(grantedATrial('30d'), true);
  assert.equal(grantedATrial('founding_july1'), true);
  assert.equal(grantedATrial('0'), false);
  assert.equal(grantedATrial('none'), false);
  assert.equal(grantedATrial(null), false);
});

// --- classification ---------------------------------------------------------

test('two paying accounts outrank everything — we may be billing one person twice', () => {
  const v = classifyCluster([
    account({ everPaid: true, tookTrial: true, lifetimeCollectedMinor: 2950 }),
    account({ userId: 'user_b', everPaid: true, tookTrial: true, lifetimeCollectedMinor: 5900 }),
  ]);
  assert.equal(v.shape, 'multiple_paying');
  assert.equal(v.collectedMinor, 8850);
});

test('two trials on one address is the gate being bypassed', () => {
  // The live case: an August trial that lapsed unpaid, and a September trial on
  // a second email that converted.
  const v = classifyCluster([
    account({ email: 'old@example.com', tookTrial: true }),
    account({
      userId: 'user_b',
      email: 'new@example.com',
      createdAt: '2026-09-06T23:04:50Z',
      tier: 'pro',
      tookTrial: true,
      everPaid: true,
      lifetimeCollectedMinor: 2950,
    }),
  ]);
  assert.equal(v.shape, 'trial_recycled');
});

test('one payer and dormant siblings is a tidy-up, not an alarm', () => {
  const v = classifyCluster([
    account({ everPaid: true, lifetimeCollectedMinor: 2950 }),
    account({ userId: 'user_b' }),
  ]);
  assert.equal(v.shape, 'paid_and_dormant');
});

test('nobody paid is the quiet case', () => {
  const v = classifyCluster([account(), account({ userId: 'user_b' })]);
  assert.equal(v.shape, 'all_free');
  assert.equal(v.collectedMinor, 0);
});

test('a deleted account never escalates a cluster', () => {
  // They asked us to delete it. It must not make a live account look like half
  // of a duplicate pair.
  const v = classifyCluster([
    account({ everPaid: true, tookTrial: true, lifetimeCollectedMinor: 2950 }),
    account({
      userId: 'user_b',
      everPaid: true,
      tookTrial: true,
      lifetimeCollectedMinor: 2950,
      deletedAt: '2026-09-01T00:00:00Z',
    }),
  ]);
  assert.equal(v.shape, 'paid_and_dormant');
  // And its money is not counted toward the cluster's total.
  assert.equal(v.collectedMinor, 2950);
});

// --- ranking ----------------------------------------------------------------

test('shape decides the order before money or size does', () => {
  const twoPaying = {
    verdict: classifyCluster([
      account({ everPaid: true, lifetimeCollectedMinor: 100 }),
      account({ userId: 'b', everPaid: true, lifetimeCollectedMinor: 100 }),
    ]),
    accounts: [account(), account({ userId: 'b' })],
  };
  const bigFreeCluster = {
    verdict: classifyCluster([account(), account({ userId: 'b' }), account({ userId: 'c' })]),
    accounts: [account(), account({ userId: 'b' }), account({ userId: 'c' })],
  };
  assert.ok(compareClusters(twoPaying, bigFreeCluster) < 0);
});

test('within a shape, more money reads first', () => {
  const rich = {
    verdict: classifyCluster([
      account({ everPaid: true, lifetimeCollectedMinor: 50000 }),
      account({ userId: 'b', everPaid: true, lifetimeCollectedMinor: 50000 }),
    ]),
    accounts: [account(), account({ userId: 'b' })],
  };
  const lean = {
    verdict: classifyCluster([
      account({ everPaid: true, lifetimeCollectedMinor: 100 }),
      account({ userId: 'b', everPaid: true, lifetimeCollectedMinor: 100 }),
    ]),
    accounts: [account(), account({ userId: 'b' })],
  };
  assert.ok(compareClusters(rich, lean) < 0);
});

// --- signup proximity -------------------------------------------------------

test('the closest signup gap is the fastest tell', () => {
  // The live case: 19:36 abandoned checkout, new account at 23:04 the same
  // evening. Three hours reads very differently from three years.
  const gap = closestSignupGapHours([
    account({ createdAt: '2026-08-12T06:42:04Z' }),
    account({ userId: 'b', createdAt: '2026-09-06T23:04:50Z' }),
    account({ userId: 'c', createdAt: '2026-09-07T02:04:50Z' }),
  ]);
  assert.equal(gap, 3);
});

test('a single account has no gap', () => {
  assert.equal(closestSignupGapHours([account()]), null);
  assert.equal(closestSignupGapHours([]), null);
});

test('an unparseable creation date does not fabricate a gap', () => {
  assert.equal(closestSignupGapHours([account({ createdAt: 'not a date' }), account({ userId: 'b' })]), null);
});

// --- the handoff ------------------------------------------------------------

test('the handoff catches what the signup gap misses', () => {
  // The live case. Signups are 25 days apart and read like nothing; the member
  // actually abandoned a full-price checkout at 19:36 and created the second
  // account at 23:04 the same evening.
  const old = account({ userId: 'user_old', email: 'old@example.com', createdAt: '2026-08-12T06:42:04Z' });
  const fresh = account({ userId: 'user_new', email: 'new@example.com', createdAt: '2026-09-06T23:04:50Z' });
  const events = new Map([
    ['user_old', [
      Date.parse('2026-08-12T06:42:30Z'),
      Date.parse('2026-09-06T19:36:39Z'), // the abandoned checkout
      Date.parse('2026-09-06T19:42:40Z'), // and the logout straight after
    ]],
    ['user_new', [Date.parse('2026-09-18T11:57:56Z')]],
  ]);

  assert.equal(closestSignupGapHours([old, fresh]), 616);
  const handoff = handoffGapHours([old, fresh], events);
  assert.equal(handoff?.hours, 3);
  assert.equal(handoff?.fromEmail, 'old@example.com');
  assert.equal(handoff?.toEmail, 'new@example.com');
});

test('activity AFTER the sibling was created is not a handoff', () => {
  // Otherwise every still-active account would look like it handed off to one
  // created years earlier.
  const first = account({ userId: 'user_1', email: 'one@example.com', createdAt: '2026-01-01T00:00:00Z' });
  const second = account({ userId: 'user_2', email: 'two@example.com', createdAt: '2026-01-02T00:00:00Z' });
  const events = new Map([
    ['user_1', [Date.parse('2026-06-01T00:00:00Z')]], // long after user_2 existed
    ['user_2', []],
  ]);
  assert.equal(handoffGapHours([first, second], events), null);
});

test('no events at all means no handoff to report', () => {
  assert.equal(handoffGapHours([account(), account({ userId: 'b' })], new Map()), null);
});
