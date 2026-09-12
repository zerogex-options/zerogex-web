import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowthStory } from '../core/growthStory.ts';
import { buildCohortReport, type CohortAuditInput, type CohortUserInput } from '../core/cohortRetention.ts';

// core/growthStory.ts is the arithmetic behind every headline on Admin →
// Monitoring → Growth. The cases below are the ones where a plausible-looking
// implementation silently reports the wrong business: mixing the two clocks,
// counting a scheduled cancellation as a loss, or letting an immature cohort
// dominate the "biggest leak" callout.

const NOW = '2026-09-12T00:00:00Z';
const DAY = 86_400_000;
const ago = (days: number, hour = 0) =>
  new Date(Date.parse(NOW) - days * DAY + hour * 3_600_000).toISOString();

const user = (
  id: string,
  createdAt: string,
  overrides: Partial<CohortUserInput> = {},
): CohortUserInput => ({
  id,
  email: `${id}@example.test`,
  createdAt,
  firstPaymentAt: null,
  currentStatus: null,
  currentTier: 'public',
  currentPriceId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  signupUtmSource: null,
  foundingRate: false,
  cadence: 'monthly',
  cadenceSource: 'current_price',
  ...overrides,
});

const paying = (id: string, createdAt: string, firstPaymentAt: string, overrides: Partial<CohortUserInput> = {}) =>
  user(id, createdAt, {
    firstPaymentAt,
    currentStatus: 'active',
    currentTier: 'pro',
    currentPriceId: 'price_pro',
    ...overrides,
  });

const sync = (id: string, at: string, status: string, tier: string, sub = `sub_${id}`): CohortAuditInput => ({
  userId: id,
  type: 'stripe_subscription_sync',
  createdAt: at,
  message: `Subscription ${sub} status=${status} tier=${tier} cancelAtPeriodEnd=false`,
});

const story = (users: CohortUserInput[], events: CohortAuditInput[], windowDays: 30 | 90 | 365 | null) =>
  buildGrowthStory(buildCohortReport(users, events, NOW), windowDays, NOW);

test('the ledger counts money moving in the window; the funnel follows who registered in it', () => {
  const result = story(
    [
      // Registered long ago, paid inside the window: ledger yes, funnel no.
      paying('oldtimer', ago(400), ago(10)),
      // Registered and paid inside the window: both.
      paying('recent', ago(20), ago(15)),
      // Registered inside the window, never paid: funnel only.
      user('browser', ago(5)),
    ],
    [
      sync('oldtimer', ago(10), 'active', 'pro'),
      sync('recent', ago(20), 'trialing', 'pro'),
      sync('recent', ago(15), 'active', 'pro'),
    ],
    30,
  );

  assert.equal(result.newPaid, 2, 'both first payments landed inside the window');
  assert.equal(result.funnel[0].value, 2, 'only the two accounts registered in the window');
  assert.equal(result.funnel[3].value, 1, 'only one of those has paid');
  assert.equal(result.payingNow, 2);
});

test('a scheduled cancellation is not yet a loss, but is reported as one coming', () => {
  const result = story(
    [
      paying('leaving', ago(90), ago(60), {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.parse(NOW) + 10 * DAY).toISOString(),
      }),
    ],
    [sync('leaving', ago(60), 'active', 'pro')],
    90,
  );

  assert.equal(result.payingNow, 1, 'prepaid access has not ended');
  assert.equal(result.scheduledToLeave, 1);
  assert.equal(result.lost, 0, 'a future access end is an intention, not a departure');
  assert.equal(result.newPaid, 1, 'the first payment did land inside the window');
  assert.equal(result.net, 1, 'net stays positive until the access actually ends');
});

test('losses are attributed by cause and scoped to the window they happened in', () => {
  const result = story(
    [
      paying('quit', ago(200), ago(180), { currentStatus: null, currentTier: 'public', currentPriceId: null }),
      paying('declined', ago(200), ago(150), { currentStatus: null, currentTier: 'public', currentPriceId: null }),
      paying('ancient', ago(700), ago(690), { currentStatus: null, currentTier: 'public', currentPriceId: null }),
    ],
    [
      sync('quit', ago(180), 'active', 'pro'),
      { userId: 'quit', type: 'stripe_cancellation_requested', createdAt: ago(40), message: 'Cancellation requested for sub sub_quit' },
      { userId: 'quit', type: 'stripe_subscription_deleted', createdAt: ago(35), message: 'Subscription sub_quit ended; tier reset to public' },
      sync('declined', ago(150), 'active', 'pro'),
      { userId: 'declined', type: 'stripe_payment_failed', createdAt: ago(50), message: 'Invoice in_1 payment failed for sub sub_declined (attempt 1)' },
      { userId: 'declined', type: 'stripe_subscription_deleted', createdAt: ago(45), message: 'Subscription sub_declined ended; tier reset to public' },
      sync('ancient', ago(690), 'active', 'pro'),
      { userId: 'ancient', type: 'stripe_subscription_deleted', createdAt: ago(600), message: 'Subscription sub_ancient ended; tier reset to public' },
    ],
    90,
  );

  assert.equal(result.lost, 2, 'the 600-day-old departure is outside the window');
  assert.equal(result.losses.voluntary, 1);
  assert.equal(result.losses.nonpayment, 1);
  assert.equal(result.losses.unknown, 0);
  assert.equal(result.losses.total, 2);
});

test('the 30-day stage reports against payers old enough to answer it', () => {
  const result = story(
    [
      paying('mature', ago(80), ago(75)),
      // Paid three days ago: cannot have a 30-day answer yet, and must not be
      // counted as a retention failure.
      paying('fresh', ago(5), ago(3)),
    ],
    [sync('mature', ago(75), 'active', 'pro'), sync('fresh', ago(3), 'active', 'pro')],
    90,
  );

  const retainedStage = result.funnel[4];
  assert.equal(retainedStage.eligible, 1, 'only the mature payer is measurable');
  assert.equal(retainedStage.value, 1);
  assert.equal(retainedStage.ofPrevious, 1);
  assert.equal(retainedStage.droppedFromPrevious, 0, 'an immature payer is not a loss');
});

test('the biggest leak is the largest real drop-off, and it is named in words', () => {
  const users = [
    ...Array.from({ length: 40 }, (_, i) => user(`lurker${i}`, ago(20))),
    ...Array.from({ length: 10 }, (_, i) => paying(`trialer${i}`, ago(20), ago(12))),
    ...Array.from({ length: 5 }, (_, i) => user(`trialonly${i}`, ago(20))),
  ];
  const events = [
    ...Array.from({ length: 10 }, (_, i) => sync(`trialer${i}`, ago(19), 'trialing', 'pro')),
    ...Array.from({ length: 10 }, (_, i) => sync(`trialer${i}`, ago(12), 'active', 'pro')),
    ...Array.from({ length: 5 }, (_, i) => sync(`trialonly${i}`, ago(19), 'trialing', 'pro')),
  ];
  const result = story(users, events, 30);

  assert.equal(result.funnel[0].value, 55);
  assert.equal(result.funnel[1].value, 15);
  assert.equal(result.funnel[2].value, 10, 'trial starters who paid');
  assert.equal(result.funnel[3].value, 10, 'paying customers in all');
  assert.equal(result.biggestLeak?.key, 'trial', '40 never-trialed beats 5 never-paid');
  assert.match(result.leakSentence ?? '', /40 registrations never started a trial/);
  assert.match(result.funnelSentence, /55 people who registered in the last 30 days/);
});

test('acquisition sources are folded, named, and ranked by paying customers', () => {
  const result = story(
    [
      paying('a', ago(20), ago(15), { signupUtmSource: 'x' }),
      user('b', ago(20), { signupUtmSource: 'Twitter' }),
      ...Array.from({ length: 6 }, (_, i) => user(`c${i}`, ago(20), { signupUtmSource: 'google' })),
      user('d', ago(20)),
    ],
    [sync('a', ago(15), 'active', 'pro')],
    30,
  );

  assert.deepEqual(
    result.sources.map((row) => [row.label, row.registered, row.paid]),
    [['X / Twitter', 2, 1], ['Google', 6, 0], ['Organic / direct / unattributed', 1, 0]],
    'x and Twitter fold together, and the one paying channel outranks the bigger one',
  );
});

test('an empty window states that plainly instead of dividing by zero', () => {
  const result = story([paying('old', ago(500), ago(490))], [sync('old', ago(490), 'active', 'pro')], 30);
  assert.equal(result.funnel[0].value, 0);
  assert.equal(result.funnel[1].ofPrevious, null);
  assert.equal(result.biggestLeak, null);
  assert.equal(result.leakSentence, null);
  assert.match(result.funnelSentence, /Nobody registered in the last 30 days/);
  assert.equal(result.payingNow, 1, 'current headcount is not scoped to the window');
});

test('never-paid accounts are not "new payers" on the all-time window', () => {
  // The regression this guards: `inWindow(null)` returned true when no window was
  // set, so `newPaid` counted every registration and the headline read
  // "1,166 new payers in" on a base of 137 real customers.
  const result = story(
    [paying('paid', ago(400), ago(390)), user('never1', ago(300)), user('never2', ago(200))],
    [sync('paid', ago(390), 'active', 'pro')],
    null,
  );
  assert.equal(result.newPaid, 1, 'one account has ever paid');
  assert.equal(result.registrationsAllTime, 3);
  assert.equal(result.everPaidAllTime, 1);
  assert.match(result.subhead, /1 first payment in/);
});

test('trial → paid uses only trial starters who paid', () => {
  const result = story(
    [
      paying('converted', ago(60), ago(50)),
      user('trialonly', ago(60)),
      paying('direct', ago(60), ago(50)),
      paying('direct2', ago(60), ago(50)),
    ],
    [
      sync('converted', ago(58), 'trialing', 'pro'), sync('converted', ago(50), 'active', 'pro'),
      sync('trialonly', ago(58), 'trialing', 'pro'),
      sync('direct', ago(50), 'active', 'pro'),
      sync('direct2', ago(50), 'active', 'pro'),
    ],
    90,
  );
  assert.equal(result.trialStarters, 2);
  assert.equal(result.trialStartersWhoPaid, 1);
  assert.equal(result.directToPaid, 2);
  assert.equal(result.trialToPaidRate, 0.5, 'not 3/2 = 150%');
  assert.match(result.funnelSentence, /plus 2 customers who paid without trialling/);
});
