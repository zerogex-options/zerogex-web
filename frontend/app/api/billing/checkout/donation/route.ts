import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getStripe } from '@/core/stripe';
import { getGivingTotals } from '@/core/giving';

export const dynamic = 'force-dynamic';

// Returns the donation amount associated with a freshly-completed Checkout
// Session. The /account page hits this on ?checkout=success&session_id=... to
// surface "Your subscription just contributed $X.XX to Folds of Honor" — a
// one-shot read, no caching.
//
// We compute the donation from the subscription's recurring price (not the
// session's amount_total, which is $0 during a trial). This keeps the
// confirmation honest about the first billing cycle's contribution rather
// than implying $0 was donated because the trial was free.
export async function GET(request: NextRequest) {
  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions
    .retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price'],
    })
    .catch(() => null);

  if (!session) {
    return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 });
  }
  if (session.client_reference_id !== actor.user.id) {
    return NextResponse.json({ error: 'Not authorized for this session' }, { status: 403 });
  }

  const subscription = session.subscription;
  if (!subscription || typeof subscription === 'string') {
    return NextResponse.json({ error: 'Subscription not yet provisioned' }, { status: 404 });
  }

  const item = subscription.items.data[0];
  const price = item?.price;
  if (!price || !price.unit_amount) {
    return NextResponse.json({ error: 'Price not found on subscription' }, { status: 404 });
  }

  const { pledgePct, partner } = getGivingTotals();
  const baseAmountUsd = price.unit_amount / 100;
  const donationUsd = Number(((baseAmountUsd * pledgePct) / 100).toFixed(2));

  const response = NextResponse.json({
    pledgePct,
    partner,
    baseAmountUsd,
    donationUsd,
    interval: price.recurring?.interval ?? 'month',
    currency: price.currency.toUpperCase(),
  });
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
