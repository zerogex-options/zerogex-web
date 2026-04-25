import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { requireSession, validateCsrf } from '@/core/serverAuth';
import { getAppUrl, getStripe } from '@/core/stripe';

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

  const session = await getStripe().billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${getAppUrl()}/account`,
  });

  return NextResponse.json({ url: session.url });
}
