import { NextRequest, NextResponse } from 'next/server';
import { registerUser, validateCsrf } from '@/core/serverAuth';
import type { TierId } from '@/core/auth';

const SELF_SIGNUP_TIERS: ReadonlySet<TierId> = new Set<TierId>(['basic', 'pro']);

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    tier?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  const requestedTier = body.tier as TierId | undefined;
  const tier: TierId = requestedTier && SELF_SIGNUP_TIERS.has(requestedTier) ? requestedTier : 'basic';

  if (!email || !password || password.length < 12) {
    return NextResponse.json({ error: 'Email and password (12+ chars) are required' }, { status: 400 });
  }

  try {
    const user = await registerUser(request, email, password, tier);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
