import { NextRequest, NextResponse } from 'next/server';
import { normalizeTier } from '@/core/auth';
import { requireSession, updateUserTier, validateCsrf } from '@/core/serverAuth';

export async function PATCH(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; tier?: string };
  if (!body.email || !body.tier) {
    return NextResponse.json({ error: 'Email and tier are required' }, { status: 400 });
  }

  try {
    const result = await updateUserTier(
      actor.user.id,
      body.email,
      normalizeTier(body.tier),
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    );

    return NextResponse.json({ ok: true, user: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Role update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
