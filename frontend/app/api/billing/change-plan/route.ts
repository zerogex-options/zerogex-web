import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { appendAuditEvent, getClientIp, requireSession, validateCsrf } from '@/core/serverAuth';
import {
  createBillingPortalSession,
  getAppUrl,
  getStripe,
  isBillableTier,
  isBillingCadence,
  isSkuSellable,
  priceIdToSku,
  skuHasFreeTrial,
  skuToPriceId,
} from '@/core/stripe';
import { decidePlanSwitch } from '@/core/planSwitch';
import { planSwitchDiscounts } from '@/core/switchDiscounts';
import { previewNextInvoice } from '@/core/stripeInvoicePreview';
import { hasPriorMoneyBackRefund } from '@/core/moneyBackServer';
import {
  attachedCouponIds,
  describeDiscountsParam,
  discountsParam,
  readAttachedDiscounts,
} from '@/core/subscriptionDiscounts';

// Plan changes for a member who ALREADY has a subscription — the server-side
// destination of the /pricing "Switch to {tier}" CTA. Per (current plan, target
// plan, subscription status) it either:
//
//   • STARTS PAYING, in-app, for a trialing member moving onto a plan sold under
//     the money-back guarantee (Pro, or any quarterly/annual plan — see
//     core/billingPlans.ts). Two calls:
//       1. without `confirm`: price it. The response names what will be charged
//          TODAY (a live Stripe invoice preview, promo included) so the page can
//          ask the member to confirm. Nothing changes. No price, no confirm: a
//          failed preview is an error, never a charge for an unnamed amount.
//       2. with `confirm: true` and `expectedAmountDue` (the amount the member
//          was shown): re-price, and refuse with the new quote if it moved (a
//          promo window closing in between, say). Only then end the trial and
//          switch the price in ONE update, with the reconciled coupons on that
//          same update (the first invoice is drawn and charged by it, so a
//          reconcile that waited for the webhook would be one invoice late),
//          stamped money_back=1 so the 7-day guarantee covers the payment.
//          payment_behavior 'error_if_incomplete' means a declined card
//          changes NOTHING: the member stays on their trial, instead of being
//          dropped to past_due. A card that needs the bank's confirmation (3-D
//          Secure) cannot be approved from here, so that member is handed the
//          billing portal, which can.
//
//   • UPGRADES a trialing member in-app to another TRIAL plan (only possible
//     when BILLING_TRIAL_PLANS names more than one), keeping the trial — the
//     original behaviour of this route.
//
//   • hands off to the Stripe billing portal for everything else — paid members
//     (mid-cycle prorations) and downgrades (scheduled at period end).
//
// The local users row is deliberately NOT updated with the new price: leaving
// the webhook's pre-UPDATE snapshot on the OLD price is what lets its
// maybeReconcileDiscountOnPlanSwitch recognize the switch, find the discounts
// already correct, and no-op.

type UserBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  founding_member_started_at: string | null;
  founding_lifetime_applied_at: string | null;
};

// One in-flight trial conversion per subscription in this process: a double
// click must not send two updates that each end the trial. (PM2 runs a single
// Next process; the second click gets a 409 and the page's own busy state
// covers the rest.)
const inFlight = new Set<string>();

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// Error codes meaning "the bank must confirm this payment" (3-D Secure / SCA).
// Checked BEFORE the generic card-error branch: authentication_required arrives
// as a card error, and "declined — update your card" is the wrong advice for a
// card that is fine but needs approving.
const AUTHENTICATION_CODES = new Set([
  'authentication_required',
  'invoice_payment_intent_requires_action',
  'payment_intent_action_required',
  'payment_intent_authentication_failure',
  'subscription_payment_intent_requires_action',
]);

type SwitchFailure = 'authentication' | 'card' | 'rejected' | 'unknown';

function classifySwitchFailure(err: unknown): SwitchFailure {
  const e = err as
    | { type?: string; code?: string; decline_code?: string; raw?: { code?: string; decline_code?: string } }
    | undefined;
  const code = e?.code ?? e?.raw?.code;
  const decline = e?.decline_code ?? e?.raw?.decline_code;
  if ((code && AUTHENTICATION_CODES.has(code)) || decline === 'authentication_required') return 'authentication';
  if (e?.type === 'StripeCardError') return 'card';
  // Stripe refused the request itself: nothing was applied.
  if (e?.type === 'StripeInvalidRequestError') return 'rejected';
  // A timeout, a connection drop or a Stripe-side 5xx: the update may or may
  // not have gone through, so the member must not be told "nothing changed".
  return 'unknown';
}

const SWITCH_FAILURE_COPY: Record<SwitchFailure, { status: number; error: string }> = {
  authentication: {
    status: 402,
    error:
      "Your bank needs to confirm this payment, which can't be done from this page. Nothing changed — you're still on your free trial. Continue in the billing portal to approve it there.",
  },
  card: {
    status: 402,
    error:
      "Your card was declined, so nothing changed — you're still on your free trial. Update your card from the Account page and try again.",
  },
  rejected: {
    status: 502,
    error: "Couldn't switch plans just now. Nothing changed — please try again in a minute.",
  },
  unknown: {
    status: 502,
    error:
      "We couldn't confirm the switch went through. Check your plan on the Account page before trying again — it shows the change if it was made.",
  },
};

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (actor.user.tier === 'admin') {
    return NextResponse.json({ error: 'Admin accounts cannot subscribe.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    tier?: unknown;
    cadence?: unknown;
    confirm?: unknown;
    // With confirm: the amount (minor units) the member was shown and agreed to.
    expectedAmountDue?: unknown;
  };
  if (!isBillableTier(body.tier)) {
    return NextResponse.json({ error: 'tier must be one of basic, pro' }, { status: 400 });
  }
  if (!isBillingCadence(body.cadence)) {
    return NextResponse.json({ error: 'cadence must be one of monthly, quarterly, annual' }, { status: 400 });
  }
  const tier = body.tier;
  const cadence = body.cadence;
  const confirmed = body.confirm === true;
  if (!isSkuSellable({ tier, cadence })) {
    return NextResponse.json(
      { error: 'That plan is not available right now. Please choose another billing period.' },
      { status: 400 },
    );
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT stripe_customer_id, stripe_subscription_id, founding_member_started_at, founding_lifetime_applied_at
         FROM users WHERE id = ?`,
    )
    .get(actor.user.id) as UserBillingRow | undefined;

  if (!row?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No Stripe customer on file. Subscribe to a plan first.' },
      { status: 400 },
    );
  }

  const appUrl = getAppUrl();
  const stripe = getStripe();

  // No subscription on file: nothing to change in place. In practice the pricing
  // page only calls this for members with an active subscription; if we get here
  // anyway, open the portal so the member is never dead-ended.
  if (!row.stripe_subscription_id) {
    const session = await createBillingPortalSession(row.stripe_customer_id, `${appUrl}/account`);
    return NextResponse.json({ url: session.url });
  }

  const targetPriceId = skuToPriceId({ tier, cadence });

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
      expand: ['items.data.price', 'discounts'],
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach billing just now. Please try again in a minute." },
      { status: 502 },
    );
  }

  const item = subscription.items.data[0];
  const currentPriceId = item?.price?.id ?? null;
  const currentSku = currentPriceId ? priceIdToSku(currentPriceId) : null;

  const decision = decidePlanSwitch({
    currentTier: currentSku?.tier ?? null,
    currentCadence: currentSku?.cadence ?? null,
    targetTier: tier,
    targetCadence: cadence,
    targetHasTrial: skuHasFreeTrial({ tier, cadence }),
    status: subscription.status,
  });

  if (decision.kind === 'noop') {
    return NextResponse.json({ error: "You're already on this plan." }, { status: 400 });
  }

  const fromLabel = currentSku ? `${currentSku.tier}/${currentSku.cadence}` : 'unknown';

  // -------------------------------------------------------------------------
  // Trial → a plan sold under the money-back guarantee: start paying now.
  // -------------------------------------------------------------------------
  if (decision.kind === 'in_app_start_paid' && item) {
    // Read with its discounts expanded above, so this is the real set; if it
    // somehow is not, stop rather than reconcile coupons we cannot see.
    const attached = readAttachedDiscounts(subscription);
    if (!attached) {
      return NextResponse.json(
        { error: "Couldn't read your current plan just now. Nothing changed — please try again in a minute." },
        { status: 502 },
      );
    }
    const discounts = planSwitchDiscounts({
      currentCouponIds: attachedCouponIds(attached),
      newSku: { tier, cadence },
      foundingMemberStartedAt: row.founding_member_started_at,
      foundingLifetimeAppliedAt: row.founding_lifetime_applied_at,
    });
    // Only when the set actually changes (null for a founding member on the
    // lifetime rate, whose coupons are left exactly as they are). Existing
    // discounts are passed by id so they keep their end dates, and an emptied
    // set is sent as '' so it really clears (core/subscriptionDiscounts.ts).
    const discountParam = discounts?.changed ? discountsParam(discounts.keep, attached) : undefined;

    // What switching charges TODAY: a live preview with exactly the items, trial
    // end and discounts of the update below.
    let quote: { amountDue: number; currency: string } | null = null;
    try {
      const preview = await previewNextInvoice(stripe, {
        subscription: subscription.id,
        customer: row.stripe_customer_id,
        items: [{ id: item.id, price: targetPriceId }],
        prorationBehavior: 'none',
        trialEnd: 'now',
        ...(discountParam !== undefined ? { discounts: discountParam } : {}),
      });
      if (typeof preview.amount_due === 'number' && preview.currency) {
        quote = { amountDue: preview.amount_due, currency: preview.currency };
      }
    } catch {
      quote = null;
    }
    if (!quote) {
      return NextResponse.json(
        { error: "Couldn't price this switch just now, so nothing changed. Please try again in a minute." },
        { status: 502 },
      );
    }
    // One refund per customer: someone who has already used theirs is not
    // promised (or stamped for) the guarantee again, exactly as at checkout.
    const guaranteeUsed = hasPriorMoneyBackRefund({
      userId: actor.user.id,
      email: actor.user.email,
      cardFingerprint: null,
      subscriptionId: subscription.id,
    });
    const confirmQuote = {
      tier,
      cadence,
      amountDue: quote.amountDue,
      currency: quote.currency,
      amountFormatted: formatAmount(quote.amountDue, quote.currency),
      guarantee: !guaranteeUsed,
    };

    if (!confirmed) {
      return NextResponse.json({ confirm: confirmQuote });
    }
    // Charge only the amount the member was shown.
    if (body.expectedAmountDue !== quote.amountDue) {
      return NextResponse.json(
        {
          error: `The price changed since you looked: switching now charges ${confirmQuote.amountFormatted}. Please review it before confirming.`,
          confirm: confirmQuote,
        },
        { status: 409 },
      );
    }

    if (inFlight.has(subscription.id)) {
      return NextResponse.json({ error: 'Your plan change is already being processed.' }, { status: 409 });
    }
    inFlight.add(subscription.id);
    try {
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: targetPriceId }],
        // End the free trial now: the new plan is billed today, and the
        // money-back guarantee runs from this payment.
        trial_end: 'now',
        // Nothing to prorate out of a trial.
        proration_behavior: 'none',
        // A declined (or authentication-required) payment fails the whole
        // update, leaving the trial exactly as it was.
        payment_behavior: 'error_if_incomplete',
        // Starting to pay implies staying — clear any pending cancellation.
        cancel_at_period_end: false,
        ...(guaranteeUsed ? {} : { metadata: { money_back: '1' } }),
        ...(discountParam !== undefined ? { discounts: discountParam } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'plan change failed';
      const failure = classifySwitchFailure(err);
      appendAuditEvent({
        type: 'billing_plan_switch_error',
        userId: actor.user.id,
        email: actor.user.email,
        ip: getClientIp(request),
        message:
          `Trial → paid switch ${fromLabel} → ${tier}/${cadence} on sub ${subscription.id} failed (${failure}; ` +
          `${failure === 'unknown' ? 'outcome unknown — check the subscription' : 'trial left as it was'}): ${message}`,
      });
      const { status, error } = SWITCH_FAILURE_COPY[failure];
      if (failure === 'authentication') {
        // The portal can collect the bank's confirmation; hand the member there.
        try {
          const session = await createBillingPortalSession(row.stripe_customer_id, `${appUrl}/account`);
          return NextResponse.json({ error, portalUrl: session.url }, { status });
        } catch {
          return NextResponse.json({ error }, { status });
        }
      }
      return NextResponse.json({ error }, { status });
    } finally {
      inFlight.delete(subscription.id);
    }

    appendAuditEvent({
      type: 'billing_plan_switch_in_app',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message:
        `Trial ended for paid switch ${fromLabel} → ${tier}/${cadence} on sub ${subscription.id} ` +
        `(charged ${confirmQuote.amountFormatted} today as quoted, ` +
        `${guaranteeUsed ? 'no guarantee — refund already used' : 'money-back guarantee'}; discounts ` +
        `${discountParam !== undefined ? `set to [${describeDiscountsParam(discountParam, attached)}]` : 'unchanged'})`,
    });

    // Same landing as a paid checkout: the banner restates the guarantee, and
    // trial_started=1 lets the dashboard re-poll the session while the webhook
    // syncs the new tier.
    return NextResponse.json({
      url: `${appUrl}/dashboard?trial_started=1&trial=${guaranteeUsed ? 'none' : 'money_back'}&upgraded=${tier}`,
    });
  }

  // -------------------------------------------------------------------------
  // Trial → another trial plan: swap the price, keep the trial.
  // -------------------------------------------------------------------------
  if (decision.kind === 'in_app_upgrade' && item) {
    try {
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: targetPriceId }],
        // Trial members are never charged on this switch, and we never prorate:
        // the new price simply takes over at trial end.
        proration_behavior: 'none',
        // Upgrading implies staying — clear any pending cancellation.
        cancel_at_period_end: false,
        // Deliberately DO NOT set trial_end: leaving it untouched keeps the
        // subscription 'trialing' until the existing trial end, so no charge lands
        // today. This is the portal's continue_trial behavior, made explicit and
        // guaranteed here regardless of the portal configuration.
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'plan change failed';
      appendAuditEvent({
        type: 'billing_plan_switch_error',
        userId: actor.user.id,
        email: actor.user.email,
        ip: getClientIp(request),
        message: `In-app upgrade to ${tier}/${cadence} on sub ${subscription.id} failed: ${message}`,
      });
      return NextResponse.json(
        { error: "Couldn't apply the upgrade just now. Please try again in a minute." },
        { status: 502 },
      );
    }

    // The promo coupon swap is handled by the webhook's
    // maybeReconcileDiscountOnPlanSwitch on the resulting
    // customer.subscription.updated, which detects old price != new price — the
    // same path a portal switch uses, and in time because the trial continues.
    appendAuditEvent({
      type: 'billing_plan_switch_in_app',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: `In-app upgrade ${fromLabel} → ${tier}/${cadence} on sub ${subscription.id} (trialing; trial preserved, no charge today)`,
    });

    return NextResponse.json({ url: `${appUrl}/dashboard?upgraded=${tier}` });
  }

  // Paid member or downgrade: the Stripe billing portal handles proration and
  // schedule-at-period-end downgrades; the webhook reconciles the coupon on the
  // resulting switch. Same destination as before this route existed.
  const session = await createBillingPortalSession(row.stripe_customer_id, `${appUrl}/account`);
  return NextResponse.json({ url: session.url });
}
