import { NextRequest, NextResponse } from 'next/server';
import { registerUser, validateCsrf } from '@/core/serverAuth';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';

  if (!email || !password || password.length < 12) {
    return NextResponse.json({ error: 'Email and password (12+ chars) are required' }, { status: 400 });
  }

  try {
    // Self-signup ALWAYS creates a free 'public' account. Paid tiers
    // (basic/pro) are granted exclusively by the verified Stripe webhook
    // (syncSubscriptionToUser) after checkout, or by an admin. Honoring a
    // client-supplied tier here was a complete paywall bypass — anyone
    // could POST {tier:"pro"} and receive premium access without paying.
    const user = await registerUser(request, email, password, 'public');
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
