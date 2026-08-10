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
  priceIdToSku,
  skuToPriceId,
} from '@/core/stripe';
import { decidePlanSwitch } from '@/core/planSwitch';

// Plan changes for a member who ALREADY has a subscription — the server-side
// destination of the /pricing "Switch to {tier}" CTA. Its job is to decide, per
// (current plan, target plan, subscription status), whether to:
//
//   • perform an in-app UPGRADE for a trialing member (basic → pro at the same
//     cadence): swap the subscription price, PRESERVE the free trial (no charge
//     today), and let the Stripe webhook's maybeReconcileDiscountOnPlanSwitch
//     apply the correct promo coupon before the trial-end invoice — exactly as it
//     already does for a portal-driven switch. This is the fix for the "I tried
//     to upgrade to Pro at the promo rate but was unable to" case: the generic
//     billing portal neither showed the promo nor (depending on its config)
//     offered the switch, dead-ending trialing members who wanted to move up; or
//
//   • hand off to the Stripe billing portal for everything else — paid members
//     (mid-cycle prorations), downgrades (scheduled at period end), and cadence
//     changes — which is precisely today's behavior, so this route only ever ADDS
//     a working upgrade path, never removes one.
//
// Discounts are deliberately NOT touched here. Not mirroring the new price locally
// either is intentional: it leaves the webhook's pre-UPDATE price snapshot showing
// the OLD price, so the switch is detected and the promo coupon reconciled on the
// resulting customer.subscription.updated — the same, already-proven path a portal
// switch takes.

type UserBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
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
  };
  if (!isBillableTier(body.tier)) {
    return NextResponse.json({ error: 'tier must be one of basic, pro' }, { status: 400 });
  }
  if (!isBillingCadence(body.cadence)) {
    return NextResponse.json({ error: 'cadence must be one of monthly, annual' }, { status: 400 });
  }
  const tier = body.tier;
  const cadence = body.cadence;

  const db = getDb();
  const row = db
    .prepare('SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?')
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

  let targetPriceId: string;
  try {
    targetPriceId = skuToPriceId({ tier, cadence });
  } catch {
    return NextResponse.json(
      { error: `That plan is not available right now (${tier}/${cadence}).` },
      { status: 500 },
    );
  }

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
      expand: ['items.data.price'],
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
    status: subscription.status,
  });

  if (decision.kind === 'noop') {
    return NextResponse.json({ error: "You're already on this plan." }, { status: 400 });
  }

  if (decision.kind === 'in_app_upgrade' && item) {
    try {
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: targetPriceId }],
        // Trial members are never charged on a switch, and we never prorate: the
        // new (Pro) price simply takes over at trial end.
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

    // The promo coupon swap (basic promo → pro promo) is handled by the webhook's
    // maybeReconcileDiscountOnPlanSwitch on the resulting customer.subscription.updated,
    // which detects old price != new price — the same path a portal switch uses.
    appendAuditEvent({
      type: 'billing_plan_switch_in_app',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: `In-app upgrade ${currentSku ? `${currentSku.tier}/${currentSku.cadence}` : 'unknown'} → ${tier}/${cadence} on sub ${subscription.id} (trialing; trial preserved, no charge today)`,
    });

    return NextResponse.json({ url: `${appUrl}/dashboard?upgraded=${tier}` });
  }

  // Paid member, downgrade, or cadence change: the Stripe billing portal handles
  // proration and schedule-at-period-end downgrades; the webhook reconciles the
  // coupon on the resulting switch. Same destination as before this route existed.
  const session = await createBillingPortalSession(row.stripe_customer_id, `${appUrl}/account`);
  return NextResponse.json({ url: session.url });
}
