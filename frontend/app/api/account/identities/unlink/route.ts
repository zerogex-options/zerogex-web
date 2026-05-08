import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unlinkUserIdentity, validateCsrf, type OAuthProviderName } from '@/core/serverAuth';

const ALLOWED_PROVIDERS: OAuthProviderName[] = ['google', 'apple'];

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { provider?: unknown };
  const provider = body.provider;
  if (typeof provider !== 'string' || !ALLOWED_PROVIDERS.includes(provider as OAuthProviderName)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  try {
    unlinkUserIdentity(actor.user.id, provider as OAuthProviderName);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to unlink identity' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
