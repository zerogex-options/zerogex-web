// The free trial without a card: who gets it, how checkout asks Stripe for it,
// and what state a member is in once they have one.
//
// WHY. The Basic trial used to ask for a card before it started, and most free
// members never entered one: in November 2026, 997 verified members had never
// subscribed, and every email they got offered that same card-first trial. A
// trial that starts without a card asks for one only at the moment the member
// has a reason to keep what they have been using.
//
// HOW, with Stripe doing the hard parts:
//   • Checkout runs with payment_method_collection 'if_required'. A trial is $0
//     due today, so Checkout shows no card form at all.
//   • The subscription carries trial_settings.end_behavior.missing_payment_method
//     'cancel': at trial end, with no card, Stripe cancels it. That arrives as an
//     ordinary customer.subscription.deleted, which the webhook already turns
//     into "back on the free plan", and the cancellation alerts already skip as
//     silent churn (no reason captured).
//   • A member who adds a card does it in the billing portal's add-card flow.
//     Stripe confirms it with a SetupIntent, and the webhook's existing
//     setup_intent.succeeded path wires it as the default payment method on the
//     subscription and the customer (maybeWireDefaultPaymentMethod), so the
//     trial converts at its end like any other.
//
// WHO. Only a first-time trial at the standard length. Not the founding
// deferral (closed). Not the reactivation trial, whose email tells the member
// "you add a card when you activate". And not an account whose inbox has
// already had a trial under another address: canonicalEmail folds +tags and
// Gmail dots, which a card used to make pointless to farm and no card makes
// free. Those members get the card-first trial, as before.
//
// SWITCH. BILLING_NO_CARD_TRIAL=1 in frontend/.env.local, then a restart. Unset,
// nothing in this file changes any behavior.
//
// Pure apart from hasPaymentMethodOnFile, which reads through a Stripe client
// the caller passes in. No DB, no clock. tests/noCardTrial.test.ts.

import type Stripe from 'stripe';
import { isBillableTier, isBillingCadence, type Sku } from './billingPlans.ts';
import { canonicalEmail } from './moneyBackGuarantee.ts';
import { decidePlanSwitch } from './planSwitch.ts';

/** Subscription metadata key checkout stamps on a trial that started without a card. */
export const NO_CARD_TRIAL_METADATA_KEY = 'no_card_trial';

export function parseNoCardTrialFlag(raw: string | null | undefined): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}

/** Whether new standard trials start without a card. Off unless BILLING_NO_CARD_TRIAL says so. */
export function isNoCardTrialEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return parseNoCardTrialFlag(env.BILLING_NO_CARD_TRIAL);
}

export type NoCardTrialSibling = {
  email: string;
  paid_welcome_email_sent_at: string | null;
  subscription_lapsed: number | null;
};

/**
 * Whether another account on the same inbox has already held a subscription
 * (a trial included): the same rule checkout's once-per-account trial gate
 * applies, read across every account whose address folds to this one. Deleted
 * accounts count too, or deleting the old account would reset the trial.
 */
export function inboxHadTrial(
  email: string,
  otherAccounts: ReadonlyArray<NoCardTrialSibling>,
): boolean {
  const mine = canonicalEmail(email);
  return otherAccounts.some(
    (other) =>
      canonicalEmail(other.email) === mine &&
      (other.paid_welcome_email_sent_at != null || Number(other.subscription_lapsed ?? 0) === 1),
  );
}

/**
 * Does this checkout start its trial without a card? Every condition is one the
 * checkout route has already worked out for its own purposes.
 */
export function qualifiesForNoCardTrial(input: {
  enabled: boolean;
  // The trial checkout is granting, in days; null when it grants none.
  trialDays: number | null;
  // The standard trial length (checkout's TRIAL_PERIOD_DAYS).
  standardTrialDays: number;
  // The founding absolute trial_end is in play.
  foundingDeferred: boolean;
  // The extended reactivation trial is in play.
  reactivationTrial: boolean;
  // Another account on this inbox has already held a subscription.
  inboxHadTrial: boolean;
}): boolean {
  return (
    input.enabled &&
    input.trialDays === input.standardTrialDays &&
    !input.foundingDeferred &&
    !input.reactivationTrial &&
    !input.inboxHadTrial
  );
}

/** The trial_settings checkout puts on a no-card trial's subscription. */
export const NO_CARD_TRIAL_SETTINGS = {
  end_behavior: { missing_payment_method: 'cancel' },
} as const;

/** Did this subscription start as a no-card trial? */
export function startedWithoutCard(metadata: Record<string, string | undefined> | null | undefined): boolean {
  return metadata?.[NO_CARD_TRIAL_METADATA_KEY] === '1';
}

export type NoCardTrialRow = {
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  no_card_trial_subscription_id: string | null;
  no_card_trial_card_added_at: string | null;
};

export type NoCardTrialState = {
  // When the trial ends (a trialing subscription's period ends with its trial).
  trialEndIso: string | null;
  // A card has been added since the trial started, so it will convert.
  cardAdded: boolean;
};

/**
 * Where a member is in a no-card trial, from the users row alone; null when they
 * are not in one. Only the subscription the marker names, and only while it is
 * still trialing: once it converts or ends, the member is in the ordinary
 * states every other subscription uses.
 */
export function noCardTrialState(row: NoCardTrialRow | null | undefined): NoCardTrialState | null {
  if (!row?.stripe_subscription_id || !row.no_card_trial_subscription_id) return null;
  if (row.no_card_trial_subscription_id !== row.stripe_subscription_id) return null;
  if (row.subscription_status !== 'trialing') return null;
  return {
    trialEndIso: row.current_period_end ?? null,
    cardAdded: row.no_card_trial_card_added_at != null,
  };
}

/** Still needs a card to keep the plan after the trial. */
export function needsCard(row: NoCardTrialRow | null | undefined): boolean {
  const state = noCardTrialState(row);
  return state !== null && !state.cardAdded;
}

/**
 * Whether Stripe has anything to charge for this subscription: a default on the
 * subscription or the customer, or any payment method attached to the customer
 * (where Checkout leaves a card it collected for a trial, with both default
 * slots empty). Read live, for the moments a stale row would mislead: a card
 * added seconds ago whose webhook has not landed yet.
 */
// The two reads hasPaymentMethodOnFile makes, as a shape the Stripe client
// satisfies and a test can fake without building Stripe's list-promise type.
export type PaymentMethodReader = {
  customers: {
    retrieve(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer>;
    listPaymentMethods(customerId: string, params: { limit: number }): Promise<{ data: unknown[] }>;
  };
};

export async function hasPaymentMethodOnFile(
  stripe: PaymentMethodReader,
  subscription: Pick<Stripe.Subscription, 'default_payment_method' | 'default_source'>,
  customerId: string,
): Promise<boolean> {
  if (subscription.default_payment_method || subscription.default_source) return true;
  const customer = await stripe.customers.retrieve(customerId);
  if (!('deleted' in customer && customer.deleted)) {
    const live = customer as Stripe.Customer;
    if (live.invoice_settings?.default_payment_method || live.default_source) return true;
  }
  const methods = await stripe.customers.listPaymentMethods(customerId, { limit: 1 });
  return methods.data.length > 0;
}

// ---------------------------------------------------------------------------
// Finishing a switch after adding a card
// ---------------------------------------------------------------------------
//
// A member on a no-card trial who picks another plan is told to add a card
// first (app/api/billing/change-plan). Stripe's add-a-card screen used to send
// them back to the Account page, which said "Card added" and nothing about the
// switch, so finishing it meant remembering to go back to Pricing and click
// again. In November 2026 a member tried Basic to Pro four times, added the
// card, never went back, and canceled minutes after Basic's first charge.
//
// So that screen now returns to the Pricing page with the plan they picked, and
// the page opens the switch's confirm step, priced exactly as a click on the
// plan's card would. Nothing is charged until they confirm the amount shown.
// The Account page's own Add a card button still returns to the Account page.

/** Where Stripe's add-a-card screen returns a member who was switching to `target`. */
export function finishSwitchPath(target: Sku): string {
  const params = new URLSearchParams({ plan: target.tier, cadence: target.cadence, card_added: '1' });
  return `/pricing?${params.toString()}`;
}

export type FinishSwitchInput = {
  // The Pricing page's query string, as Next hands it to the page.
  searchParams: Record<string, string | string[] | undefined>;
  // core/stripe.ts isSkuSellable and skuHasFreeTrial.
  isSellable: (sku: Sku) => boolean;
  hasTrial: (sku: Sku) => boolean;
  // The member's subscription, from their users row (null without one): its
  // status, the plan its price maps to (null when we do not sell that price),
  // and when its trial ends.
  subscription: { status: string | null; current: Sku | null; trialEndMs: number | null } | null;
  nowMs: number;
};

/**
 * The switch to open for a member back from adding a card, or null. The plan
 * comes from the URL, so it counts only after the checks the switch itself
 * makes: a tier and billing period we sell, on sale right now. And only while
 * the member is still on their trial and the switch is one the Pricing page
 * prices and confirms in-app (core/planSwitch.ts): never the plan they are
 * already on, never a hand-off to the billing portal.
 */
export function finishSwitchTarget(input: FinishSwitchInput): Sku | null {
  // A repeated parameter arrives as an array: not something we wrote.
  const param = (key: string): string | null => {
    const value = input.searchParams[key];
    return typeof value === 'string' ? value : null;
  };
  if (param('card_added') !== '1') return null;
  const tier = param('plan');
  const cadence = param('cadence');
  if (!isBillableTier(tier) || !isBillingCadence(cadence)) return null;
  const target: Sku = { tier, cadence };
  if (!input.isSellable(target)) return null;

  const sub = input.subscription;
  if (!sub?.current || sub.status !== 'trialing') return null;
  const decision = decidePlanSwitch({
    currentTier: sub.current.tier,
    currentCadence: sub.current.cadence,
    targetTier: tier,
    targetCadence: cadence,
    targetHasTrial: input.hasTrial(target),
    status: sub.status,
    // Only a paying plan can be paused, and this one is still a trial.
    paused: false,
    trialEndMs: sub.trialEndMs,
    nowMs: input.nowMs,
  });
  return decision.kind === 'in_app_start_paid' || decision.kind === 'in_app_upgrade' ? target : null;
}
