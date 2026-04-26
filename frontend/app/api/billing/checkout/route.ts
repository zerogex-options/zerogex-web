import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { requireSession, validateCsrf } from '@/core/serverAuth';
import { getAppUrl, getStripe, isBillableTier, tierToPriceId } from '@/core/stripe';

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

  const body = (await request.json().catch(() => ({}))) as { tier?: unknown };
  if (!isBillableTier(body.tier)) {
    return NextResponse.json({ error: 'tier must be one of basic, pro' }, { status: 400 });
  }
  const tier = body.tier;

  const db = getDb();
  const row = db
    .prepare('SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?')
    .get(actor.user.id) as UserBillingRow | undefined;

  if (row?.stripe_subscription_id) {
    return NextResponse.json(
      { error: 'You already have an active subscription. Use the billing portal to change plans.' },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  let customerId = row?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: actor.user.email,
      metadata: { user_id: actor.user.id },
    });
    customerId = customer.id;
    db.prepare('UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?').run(
      customerId,
      new Date().toISOString(),
      actor.user.id,
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: actor.user.id,
    line_items: [{ price: tierToPriceId(tier), quantity: 1 }],
    success_url: `${appUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: actor.user.id, tier } },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
