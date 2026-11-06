import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { requireSession, validateCsrf } from '@/core/serverAuth';
import { createBillingPortalSession, getAppUrl } from '@/core/stripe';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const db = getDb();
  const row = db
    .prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
    .get(actor.user.id) as { stripe_customer_id: string | null } | undefined;

  if (!row?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No Stripe customer on file. Subscribe to a plan first.' },
      { status: 400 },
    );
  }

  // { flow: 'add_card' } opens the portal straight on its add-a-card screen and
  // comes back with ?card_added=1: the no-card trial's way to keep the plan
  // (core/noCardTrial.ts). The webhook's setup_intent.succeeded path makes the
  // new card the subscription's default, so the trial converts at its end. Any
  // other body (or none, as every existing caller sends) opens the portal home.
  const body = (await request.json().catch(() => null)) as { flow?: unknown } | null;
  const addCard = body?.flow === 'add_card';

  const session = await createBillingPortalSession(
    row.stripe_customer_id,
    `${getAppUrl()}/account`,
    addCard ? { afterAddCardUrl: `${getAppUrl()}/account?card_added=1` } : {},
  );

  return NextResponse.json({ url: session.url });
}
