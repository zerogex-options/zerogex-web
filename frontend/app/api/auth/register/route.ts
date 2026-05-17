import { NextRequest, NextResponse } from 'next/server';
import { registerUser, selfSignupTier, validateCsrf } from '@/core/serverAuth';

// Auth mutation route; never cache the response at the /api/ proxy.
export const dynamic = 'force-dynamic';

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
    // Tier is decided SERVER-side, never by the request body. Honoring a
    // client-supplied tier was a complete paywall bypass (anyone could
    // POST {tier:"pro"}). selfSignupTier() returns 'public' by default and
    // only 'basic' when the operator sets SELF_SIGNUP_DEFAULT_TIER=basic
    // (the pre-Stripe free-beta setting). 'pro' is never self-grantable;
    // paid tiers otherwise come solely from the Stripe webhook or an admin.
    const user = await registerUser(request, email, password, selfSignupTier());
    const response = NextResponse.json({ ok: true, user });
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
