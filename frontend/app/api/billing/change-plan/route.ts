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
import { subscriptionCouponIds } from '@/core/retentionOffer';

// Plan changes for a member who ALREADY has a subscription — the server-side
// destination of the /pricing "Switch to {tier}" CTA. Per (current plan, target
// plan, subscription status) it either:
//
//   • STARTS PAYING, in-app, for a trialing member moving onto a plan sold under
//     the money-back guarantee (Pro, or any quarterly/annual plan — see
//     core/billingPlans.ts). Two calls:
//       1. without `confirm`: price it. The response names what will be charged
//          TODAY (a live Stripe invoice preview, promo included) so the page can
//          ask the member to confirm. Nothing changes.
//       2. with `confirm: true`: end the trial and switch the price in ONE
//          update, with the reconciled coupons on that same update (the first
//          invoice is drawn and charged by it, so a reconcile that waited for
//          the webhook would be one invoice late), stamped money_back=1 so the
//          7-day guarantee covers the payment. payment_behavior
//          'error_if_incomplete' means a declined card changes NOTHING: the
//          member stays on their trial, instead of being dropped to past_due.
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

function stripeErrorMessage(err: unknown): { status: number; error: string } {
  const e = err as { type?: string; code?: string; decline_code?: string } | undefined;
  if (e?.type === 'StripeCardError') {
    return {
      status: 402,
      error:
        "Your card was declined, so nothing changed — you're still on your free trial. Update your card from the Account page and try again.",
    };
  }
  if (e?.code === 'subscription_payment_intent_requires_action' || e?.code === 'authentication_required') {
    return {
      status: 402,
      error:
        "Your bank needs to confirm this payment, which can't be done from here. Nothing changed — you're still on your free trial. Use Manage billing on the Account page to switch plans.",
    };
  }
  return { status: 502, error: "Couldn't switch plans just now. Nothing changed — please try again in a minute." };
}

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
    const discounts = planSwitchDiscounts({
      currentCouponIds: subscriptionCouponIds(subscription),
      newSku: { tier, cadence },
      foundingMemberStartedAt: row.founding_member_started_at,
      foundingLifetimeAppliedAt: row.founding_lifetime_applied_at,
    });
    // Null only for a founding member on the lifetime rate: their coupons are
    // left exactly as they are.
    const discountParam = discounts?.changed ? { discounts: discounts.keep.map((coupon) => ({ coupon })) } : {};

    if (!confirmed) {
      // Price it. Best-effort: a failed preview still lets the member confirm,
      // with the page quoting the plan's list price instead of an exact figure.
      let amountDue: number | null = null;
      let currency = 'usd';
      try {
        const preview = await previewNextInvoice(stripe, {
          subscription: subscription.id,
          customer: row.stripe_customer_id,
          items: [{ id: item.id, price: targetPriceId }],
          prorationBehavior: 'none',
          trialEnd: 'now',
          ...(discounts ? { discounts: discounts.keep.map((coupon) => ({ coupon })) } : {}),
        });
        amountDue = typeof preview.amount_due === 'number' ? preview.amount_due : null;
        currency = preview.currency ?? currency;
      } catch {
        amountDue = null;
      }
      return NextResponse.json({
        confirm: {
          tier,
          cadence,
          amountDue,
          amountFormatted: amountDue == null ? null : formatAmount(amountDue, currency),
        },
      });
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
        metadata: { money_back: '1' },
        ...discountParam,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'plan change failed';
      appendAuditEvent({
        type: 'billing_plan_switch_error',
        userId: actor.user.id,
        email: actor.user.email,
        ip: getClientIp(request),
        message: `Trial → paid switch ${fromLabel} → ${tier}/${cadence} on sub ${subscription.id} failed (trial left as it was): ${message}`,
      });
      const { status, error } = stripeErrorMessage(err);
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
        `(charged today, money-back guarantee; discounts ${discounts?.changed ? `set to [${discounts.keep.join(', ') || 'none'}]` : 'unchanged'})`,
    });

    // Same landing as a paid checkout: the banner restates the guarantee, and
    // trial_started=1 lets the dashboard re-poll the session while the webhook
    // syncs the new tier.
    return NextResponse.json({
      url: `${appUrl}/dashboard?trial_started=1&trial=money_back&upgraded=${tier}`,
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
