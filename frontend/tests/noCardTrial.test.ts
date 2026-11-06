import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  NO_CARD_TRIAL_METADATA_KEY,
  NO_CARD_TRIAL_SETTINGS,
  hasPaymentMethodOnFile,
  inboxHadTrial,
  isNoCardTrialEnabled,
  needsCard,
  noCardTrialState,
  parseNoCardTrialFlag,
  qualifiesForNoCardTrial,
  startedWithoutCard,
  type NoCardTrialRow,
} from '../core/noCardTrial.ts';

// ---------------------------------------------------------------------------
// The switch
// ---------------------------------------------------------------------------

test('the flag is off unless BILLING_NO_CARD_TRIAL says on', () => {
  for (const on of ['1', 'true', 'TRUE', ' on ', 'yes']) assert.equal(parseNoCardTrialFlag(on), true, on);
  for (const off of [undefined, null, '', '0', 'false', 'off', 'no', 'maybe']) {
    assert.equal(parseNoCardTrialFlag(off), false, String(off));
  }
  assert.equal(isNoCardTrialEnabled({}), false);
  assert.equal(isNoCardTrialEnabled({ BILLING_NO_CARD_TRIAL: '1' }), true);
});

// ---------------------------------------------------------------------------
// Who gets it
// ---------------------------------------------------------------------------

const BASE = {
  enabled: true,
  trialDays: 7,
  standardTrialDays: 7,
  foundingDeferred: false,
  reactivationTrial: false,
  inboxHadTrial: false,
};

test('a first-time standard trial starts without a card when the flag is on', () => {
  assert.equal(qualifiesForNoCardTrial(BASE), true);
});

test('everything else keeps the card-first trial', () => {
  assert.equal(qualifiesForNoCardTrial({ ...BASE, enabled: false }), false, 'flag off');
  assert.equal(qualifiesForNoCardTrial({ ...BASE, trialDays: null }), false, 'no trial at all');
  assert.equal(qualifiesForNoCardTrial({ ...BASE, trialDays: 30 }), false, 'a longer trial');
  assert.equal(qualifiesForNoCardTrial({ ...BASE, foundingDeferred: true }), false, 'founding deferral');
  // Its email says "you add a card when you activate".
  assert.equal(qualifiesForNoCardTrial({ ...BASE, reactivationTrial: true }), false, 'reactivation trial');
  assert.equal(qualifiesForNoCardTrial({ ...BASE, inboxHadTrial: true }), false, 'inbox already had a trial');
});

const sibling = (email: string, over: Partial<{ paid: string | null; lapsed: number | null }> = {}) => ({
  email,
  paid_welcome_email_sent_at: over.paid === undefined ? '2026-10-01T00:00:00.000Z' : over.paid,
  subscription_lapsed: over.lapsed ?? 0,
});

test('another account on the same inbox that had a trial blocks the no-card trial', () => {
  // +tags and Gmail dots are one inbox.
  assert.equal(inboxHadTrial('jane.doe+2@gmail.com', [sibling('janedoe@gmail.com')]), true);
  assert.equal(inboxHadTrial('JaneDoe@googlemail.com', [sibling('jane.doe+old@gmail.com')]), true);
  assert.equal(inboxHadTrial('me+z@example.com', [sibling('me@example.com')]), true);
  // A lapsed (canceled) trial counts the same as a welcome stamp.
  assert.equal(inboxHadTrial('me+z@example.com', [sibling('me@example.com', { paid: null, lapsed: 1 })]), true);
});

test('a sibling that never held a subscription, or a different inbox, does not', () => {
  assert.equal(inboxHadTrial('jane+2@gmail.com', [sibling('jane@gmail.com', { paid: null, lapsed: 0 })]), false);
  // Dots only fold for Gmail: these are two different mailboxes.
  assert.equal(inboxHadTrial('j.doe@example.com', [sibling('jdoe@example.com')]), false);
  assert.equal(inboxHadTrial('jane@gmail.com', [sibling('jane@yahoo.com')]), false);
  assert.equal(inboxHadTrial('jane@gmail.com', []), false);
});

// ---------------------------------------------------------------------------
// What checkout asks Stripe for
// ---------------------------------------------------------------------------

test('a no-card trial is canceled by Stripe at its end when no card was added', () => {
  assert.deepEqual(NO_CARD_TRIAL_SETTINGS, { end_behavior: { missing_payment_method: 'cancel' } });
  assert.equal(startedWithoutCard({ [NO_CARD_TRIAL_METADATA_KEY]: '1' }), true);
  assert.equal(startedWithoutCard({ [NO_CARD_TRIAL_METADATA_KEY]: '0' }), false);
  assert.equal(startedWithoutCard({}), false);
  assert.equal(startedWithoutCard(null), false);
});

test('checkout only switches the card form off for a qualifying trial', () => {
  // Source-level guard: the two Stripe parameters that make a trial card-free
  // must stay behind the one decision. Read from the route rather than imported,
  // because the route pulls in the server module graph.
  const route = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'app', 'api', 'billing', 'checkout', 'route.ts'),
    'utf8',
  );
  assert.match(route, /noCardTrial \? \{ payment_method_collection: 'if_required' as const \} : \{\}/);
  assert.match(route, /noCardTrial \? \{ trial_settings: NO_CARD_TRIAL_SETTINGS \} : \{\}/);
  assert.match(route, /noCardTrial \? \{ \[NO_CARD_TRIAL_METADATA_KEY\]: '1' \} : \{\}/);
  assert.equal((route.match(/payment_method_collection:/g) ?? []).length, 1, 'payment_method_collection set in more than one place');
});

// ---------------------------------------------------------------------------
// Where a member is
// ---------------------------------------------------------------------------

const ROW: NoCardTrialRow = {
  stripe_subscription_id: 'sub_1',
  subscription_status: 'trialing',
  current_period_end: '2026-11-13T15:00:00.000Z',
  no_card_trial_subscription_id: 'sub_1',
  no_card_trial_card_added_at: null,
};

test('a running no-card trial without a card needs one', () => {
  assert.deepEqual(noCardTrialState(ROW), { trialEndIso: '2026-11-13T15:00:00.000Z', cardAdded: false });
  assert.equal(needsCard(ROW), true);
});

test('once a card is added it no longer needs one', () => {
  const row = { ...ROW, no_card_trial_card_added_at: '2026-11-10T12:00:00.000Z' };
  assert.deepEqual(noCardTrialState(row), { trialEndIso: '2026-11-13T15:00:00.000Z', cardAdded: true });
  assert.equal(needsCard(row), false);
});

test('outside the trial the marker means nothing', () => {
  assert.equal(noCardTrialState({ ...ROW, subscription_status: 'active' }), null, 'converted');
  assert.equal(noCardTrialState({ ...ROW, subscription_status: 'canceled' }), null, 'ended');
  assert.equal(noCardTrialState({ ...ROW, stripe_subscription_id: null }), null, 'no subscription');
  // A later subscription is not the one that started without a card.
  assert.equal(noCardTrialState({ ...ROW, stripe_subscription_id: 'sub_2' }), null, 'a different subscription');
  assert.equal(noCardTrialState({ ...ROW, no_card_trial_subscription_id: null }), null, 'a card-first trial');
  assert.equal(needsCard(null), false);
});

// ---------------------------------------------------------------------------
// Is there a card Stripe can charge?
// ---------------------------------------------------------------------------

function fakeStripe(opts: {
  customer?: { invoice_settings?: { default_payment_method?: string | null }; default_source?: string | null; deleted?: boolean };
  methods?: string[];
}) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      customers: {
        retrieve: async () => {
          calls.push('retrieve');
          return (opts.customer ?? { invoice_settings: { default_payment_method: null }, default_source: null }) as never;
        },
        listPaymentMethods: async () => {
          calls.push('list');
          return { data: (opts.methods ?? []).map((id) => ({ id })) } as never;
        },
      },
    },
  };
}

test('a default on the subscription answers without asking Stripe', async () => {
  const stripe = fakeStripe({});
  assert.equal(
    await hasPaymentMethodOnFile(stripe.client, { default_payment_method: 'pm_1', default_source: null }, 'cus_1'),
    true,
  );
  assert.deepEqual(stripe.calls, []);
});

test('a customer default, or any attached method, counts', async () => {
  const sub = { default_payment_method: null, default_source: null };
  assert.equal(
    await hasPaymentMethodOnFile(fakeStripe({ customer: { invoice_settings: { default_payment_method: 'pm_2' } } }).client, sub, 'cus_1'),
    true,
  );
  // Checkout leaves a trial's card attached with both default slots empty.
  assert.equal(await hasPaymentMethodOnFile(fakeStripe({ methods: ['pm_3'] }).client, sub, 'cus_1'), true);
  assert.equal(await hasPaymentMethodOnFile(fakeStripe({}).client, sub, 'cus_1'), false);
});
