import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  enforceSignupRateLimit,
  getClientIp,
  issueCsrfCookie,
  REFERRAL_COOKIE_NAME,
  registerAndStartSession,
  selfSignupTier,
  validateCsrf,
} from '@/core/serverAuth';

// Auth mutation route; never cache the response at the /api/ proxy.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const limit = enforceSignupRateLimit(ip);
  if (!limit.allowed) {
    const response = NextResponse.json(
      { error: `Too many signup attempts. Retry in ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
    response.headers.set('Retry-After', String(limit.retryAfterSeconds));
    return response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    ref?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  // Referral code: prefer the value posted with the form, fall back to the
  // zgx_ref cookie dropped when the user first landed on a ?ref= link.
  const referralCode =
    (typeof body.ref === 'string' && body.ref.length > 0 ? body.ref : null) ??
    request.cookies.get(REFERRAL_COOKIE_NAME)?.value ??
    null;

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
    //
    // Post-cutover we ALSO auto-login the new account — the registration
    // form is the entry point for paid signup, and bouncing through /login
    // afterwards breaks the register→checkout flow.
    const session = await registerAndStartSession(
      request,
      email,
      password,
      selfSignupTier(),
      referralCode,
    );
    const response = NextResponse.json({
      ok: true,
      user: session.user,
      expiresAt: session.expiresAt,
    });
    response.headers.set('Cache-Control', 'no-store, private');
    attachSessionCookie(response, session.token);
    issueCsrfCookie(response, session.csrfToken);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
