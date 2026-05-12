import { NextRequest, NextResponse } from 'next/server';
import { requireSession, setInitialLocalPassword, validateCsrf } from '@/core/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  try {
    const result = await setInitialLocalPassword(request, actor.user.id, password);
    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to set password';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
