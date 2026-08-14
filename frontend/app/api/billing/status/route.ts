import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { attachSessionCookie, getSessionFromRequest } from '@/core/serverAuth';

export const dynamic = 'force-dynamic';

// Subscription states where the customer still has a subscription on file but a
// payment problem is blocking access — recoverable by updating the card in the
// billing portal (unlike 'canceled', which needs a fresh checkout). A trial-end
// charge failure lands the subscription in 'past_due'.
const PAYMENT_ISSUE_STATUSES = new Set(['past_due', 'unpaid', 'incomplete']);

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
              cancel_at_period_end, retention_offer_claimed_at, paused_until
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
      }
    | undefined;

  const status = row?.subscription_status ?? null;
  const hasSubscription = !!row?.stripe_subscription_id;
  // Only a payment issue while the subscription is still on file (recoverable
  // via the portal). Once Stripe deletes it, stripe_subscription_id is cleared
  // and the right path is a fresh checkout, not the portal.
  const paymentIssue = hasSubscription && status != null && PAYMENT_ISSUE_STATUSES.has(status);

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
  });
  // User-specific payload; same no-store rationale as the other account routes.
  response.headers.set('Cache-Control', 'no-store, private');
  if (session.rotatedToken) attachSessionCookie(response, session.rotatedToken);
  return response;
}
