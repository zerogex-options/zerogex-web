import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { attachSessionCookie, getSessionFromRequest } from '@/core/serverAuth';
import { lengthenOffers } from '@/core/planSwitch';
import { isSkuSellable, priceIdToSku } from '@/core/stripe';
import { isUnstartedSubscriptionStatus } from '@/core/billingUser';

export const dynamic = 'force-dynamic';

// Subscription states where the customer still has a subscription on file but a
// payment problem is blocking access — recoverable by updating the card in the
// billing portal (unlike 'canceled', which needs a fresh checkout). A trial-end
// charge failure lands the subscription in 'past_due'. A first payment that
// never went through ('incomplete') is not one of these: there is no
// subscription to rescue, and the way back is a fresh checkout (see
// isUnstartedSubscriptionStatus).
const PAYMENT_ISSUE_STATUSES = new Set(['past_due', 'unpaid']);

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauth = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    unauth.headers.set('Cache-Control', 'no-store, private');
    return unauth;
  }

  const row = getDb()
    .prepare(
      `SELECT stripe_subscription_id, subscription_status, current_period_end,
              cancel_at_period_end, retention_offer_claimed_at, paused_until, stripe_price_id
       FROM users WHERE id = ?`,
    )
    .get(session.user.id) as
    | {
        stripe_subscription_id: string | null;
        subscription_status: string | null;
        current_period_end: string | null;
        cancel_at_period_end: number | null;
        retention_offer_claimed_at: string | null;
        paused_until: string | null;
        stripe_price_id: string | null;
      }
    | undefined;

  const status = row?.subscription_status ?? null;
  const hasSubscription = !!row?.stripe_subscription_id && !isUnstartedSubscriptionStatus(status);
  // Only a payment issue while the subscription is still on file (recoverable
  // via the portal). Once Stripe deletes it, stripe_subscription_id is cleared
  // and the right path is a fresh checkout, not the portal.
  const paymentIssue = hasSubscription && status != null && PAYMENT_ISSUE_STATUSES.has(status);
  const paused = row?.paused_until != null;
  const currentPlan = hasSubscription && row?.stripe_price_id ? priceIdToSku(row.stripe_price_id) : null;

  const response = NextResponse.json({
    status,
    hasSubscription,
    paymentIssue,
    currentPeriodEnd: row?.current_period_end ?? null,
    // Drives the in-app cancellation retention flow (components/CancelRetentionModal):
    // whether a cancel is already scheduled, and whether the one-shot 25%-off save
    // offer is still claimable.
    cancelAtPeriodEnd: Number(row?.cancel_at_period_end ?? 0) === 1,
    retentionOfferClaimed: row?.retention_offer_claimed_at != null,
    // ISO auto-resume instant when the subscription is paused, else null. Drives
    // the account page's "paused until X" + Resume affordance.
    pausedUntil: row?.paused_until ?? null,
    // The plan the member is on, when its price maps to one we sell.
    currentPlan,
    // Longer billing periods the member can switch to in-app, longest first;
    // the cancel flow offers them next to the 25% off.
    planOffers: lengthenOffers({ current: currentPlan, status, paused, isSellable: isSkuSellable }),
    // A break the cancel flow can offer: only a live, unpaused subscription.
    canPause: (status === 'active' || status === 'trialing') && !paused,
  });
  // User-specific payload; same no-store rationale as the other account routes.
  response.headers.set('Cache-Control', 'no-store, private');
  if (session.rotatedToken) attachSessionCookie(response, session.rotatedToken);
  return response;
}
