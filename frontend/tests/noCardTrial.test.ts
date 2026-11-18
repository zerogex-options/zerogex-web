import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  NO_CARD_TRIAL_METADATA_KEY,
  NO_CARD_TRIAL_SETTINGS,
  finishSwitchPath,
  finishSwitchTarget,
  hasPaymentMethodOnFile,
  inboxHadTrial,
  isNoCardTrialEnabled,
  needsCard,
  noCardTrialState,
  parseNoCardTrialFlag,
  qualifiesForNoCardTrial,
  startedWithoutCard,
  type FinishSwitchInput,
  type NoCardTrialRow,
} from '../core/noCardTrial.ts';
import {
  BILLABLE_TIERS,
  BILLING_CADENCES,
  parseTrialPlans,
  planHasFreeTrial,
  type Sku,
} from '../core/billingPlans.ts';
import { dict as pricingDict } from '../app/pricing/Client.i18n.ts';

// A source file, read rather than imported where it pulls in the server module
// graph or is a React component.
function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', ...segments), 'utf8');
}

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

// ---------------------------------------------------------------------------
// Finishing a switch after adding a card
// ---------------------------------------------------------------------------
//
// A no-card trialer who picks another plan is sent to add a card first. Stripe's
// add-a-card screen returns them to Pricing with that plan, and the page opens
// the switch's priced confirm step. It used to return to the Account page, which
// never mentioned the switch: one member tried Basic to Pro four times, added
// the card, and stayed on Basic.

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-12T05:51:32Z');
const BASIC_MONTHLY: Sku = { tier: 'basic', cadence: 'monthly' };
const PRO_MONTHLY: Sku = { tier: 'pro', cadence: 'monthly' };
const DEFAULT_TRIAL_PLANS = parseTrialPlans(undefined);

// The query string Next hands the Pricing page for a path.
function queryOf(pathAndQuery: string): Record<string, string> {
  return Object.fromEntries(new URL(pathAndQuery, 'https://zerogex.io').searchParams);
}

// A Basic monthly trialer with five days left, before the two-day Pro upgrade
// opens, back from adding a card on the way to Pro monthly.
function finish(over: Partial<FinishSwitchInput> = {}): Sku | null {
  return finishSwitchTarget({
    searchParams: queryOf(finishSwitchPath(PRO_MONTHLY)),
    isSellable: () => true,
    hasTrial: (sku) => planHasFreeTrial(sku, DEFAULT_TRIAL_PLANS),
    subscription: { status: 'trialing', current: BASIC_MONTHLY, trialEndMs: NOW + 120 * HOUR },
    nowMs: NOW,
    ...over,
  });
}

test('the add-a-card screen sends a switching member back to Pricing with their plan', () => {
  const url = new URL(finishSwitchPath({ tier: 'pro', cadence: 'annual' }), 'https://zerogex.io');
  assert.equal(url.pathname, '/pricing');
  // The page's own preselect: that card highlighted, that billing period picked.
  assert.equal(url.searchParams.get('plan'), 'pro');
  assert.equal(url.searchParams.get('cadence'), 'annual');
  assert.equal(url.searchParams.get('card_added'), '1');
});

test('back on Pricing, every switch a Basic monthly trialer can make opens again', () => {
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      if (tier === 'basic' && cadence === 'monthly') continue;
      const target: Sku = { tier, cadence };
      assert.deepEqual(finish({ searchParams: queryOf(finishSwitchPath(target)) }), target, `${tier}/${cadence}`);
    }
  }
});

test("in the trial's last two days Pro monthly opens too, as the switch that keeps the trial", () => {
  const lastDay = { status: 'trialing', current: BASIC_MONTHLY, trialEndMs: NOW + 20 * HOUR };
  assert.deepEqual(finish({ subscription: lastDay }), PRO_MONTHLY);
});

test('a plan in the URL that we do not sell is ignored', () => {
  const pro = queryOf(finishSwitchPath(PRO_MONTHLY));
  const cases: Array<[string, FinishSwitchInput['searchParams']]> = [
    ['unknown tier', { ...pro, plan: 'enterprise' }],
    ['admin tier', { ...pro, plan: 'admin' }],
    ['unknown period', { ...pro, cadence: 'weekly' }],
    ['upper case', { ...pro, plan: 'PRO' }],
    ['no tier', { card_added: '1', cadence: 'monthly' }],
    ['no period', { card_added: '1', plan: 'pro' }],
    // A repeated parameter is not something the switch wrote.
    ['repeated tier', { ...pro, plan: ['pro', 'basic'] }],
  ];
  for (const [label, searchParams] of cases) assert.equal(finish({ searchParams }), null, label);
  // A real plan that is not on sale right now (quarterly before its Stripe prices exist).
  assert.equal(
    finish({
      searchParams: queryOf(finishSwitchPath({ tier: 'pro', cadence: 'quarterly' })),
      isSellable: (sku) => sku.cadence !== 'quarterly',
    }),
    null,
  );
});

test('without the card-added marker, plan and cadence only preselect, as before', () => {
  assert.equal(finish({ searchParams: { plan: 'pro', cadence: 'monthly' } }), null);
  assert.equal(finish({ searchParams: { trial: '1', plan: 'pro', cadence: 'monthly' } }), null);
  assert.equal(finish({ searchParams: { plan: 'pro', cadence: 'monthly', card_added: 'yes' } }), null);
});

test('only while they are still on a trial that makes this switch in-app', () => {
  const trialing = (current: Sku | null) => ({ status: 'trialing', current, trialEndMs: NOW + 120 * HOUR });
  // The trial converted or ended in the meantime: a paying member's tier change
  // is the billing portal's, and is never opened on arrival.
  for (const status of ['active', 'past_due', 'canceled', null]) {
    assert.equal(finish({ subscription: { status, current: BASIC_MONTHLY, trialEndMs: null } }), null, String(status));
  }
  assert.equal(finish({ subscription: null }), null, 'no subscription');
  assert.equal(finish({ subscription: trialing(null) }), null, 'on a price we do not sell');
  assert.equal(finish({ subscription: trialing(PRO_MONTHLY) }), null, 'already on that plan');
  // A downgrade waits for the period end in the billing portal.
  assert.equal(
    finish({ searchParams: queryOf(finishSwitchPath(BASIC_MONTHLY)), subscription: trialing(PRO_MONTHLY) }),
    null,
    'a downgrade',
  );
  // Trial plan to trial plan, other than Basic to Pro at the same period, is the portal's too.
  const twoTrialPlans = parseTrialPlans('basic:monthly,basic:annual');
  assert.equal(
    finish({
      searchParams: queryOf(finishSwitchPath({ tier: 'basic', cadence: 'annual' })),
      hasTrial: (sku) => planHasFreeTrial(sku, twoTrialPlans),
    }),
    null,
    'trial plan to trial plan',
  );
});

test('the switch sends its add-a-card screen back to Pricing; Add a card elsewhere is unchanged', () => {
  const changePlan = readSource('app', 'api', 'billing', 'change-plan', 'route.ts');
  assert.match(changePlan, /afterAddCardUrl: `\$\{appUrl\}\$\{finishSwitchPath\(\{ tier, cadence \}\)\}`/);
  assert.doesNotMatch(changePlan, /\/account\?card_added=1/);
  // Labels the link on the Pricing page.
  assert.match(changePlan, /code: 'NEEDS_CARD'/);
  // The Account page's Add a card, where the dashboard banner and the trial-end
  // email also lead: back to the Account page, as before.
  const portal = readSource('app', 'api', 'billing', 'portal', 'route.ts');
  assert.match(portal, /afterAddCardUrl: `\$\{getAppUrl\(\)\}\/account\?card_added=1`/);
});

test('the Pricing page keeps the add-a-card link when the first step of a switch is refused', () => {
  // The first step is where a trial with no card is refused. It used to show
  // the reason and drop the link, so the member was told to add a card with
  // nothing to click.
  const client = readSource('app', 'pricing', 'Client.tsx');
  const firstStep = client.slice(client.indexOf('const startPlanChange'), client.indexOf('const handleChangePlan'));
  assert.match(firstStep, /requestPlanChange\(tier, planCadence, null\)/);
  assert.match(firstStep, /setErrorPortal\(portalLinkOf\(err\)\)/);
  // Every first step goes through it: the plan cards, the switch-to-Pro link
  // and the return from adding a card.
  assert.equal((client.match(/requestPlanChange\([^)]*, null\)/g) ?? []).length, 1, 'a first step that bypasses startPlanChange');
  assert.match(client, /void startPlanChange\(finishSwitch\.tier, finishSwitch\.cadence\)/);
});

test('the return and the add-a-card link read in every language', () => {
  const locales = Object.keys(pricingDict) as Array<keyof typeof pricingDict>;
  assert.ok(locales.length >= 5, 'expected the five shipped locales');
  for (const locale of locales) {
    const table = pricingDict[locale];
    for (const key of ['errorAddCard', 'cardAddedFinishSwitch', 'cardAddedFinishSwitchCta']) {
      assert.ok(table?.[key], `${String(locale)} is missing ${key}`);
    }
    assert.match(table?.cardAddedFinishSwitch ?? '', /\{plan\}/, `${String(locale)} must name the plan`);
  }
});
