import { NextResponse } from 'next/server';
import { listUserIdentities, requireSession, userHasPassword } from '@/core/serverAuth';

export async function GET() {
  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const identities = listUserIdentities(actor.user.id);
  return NextResponse.json({
    hasPassword: userHasPassword(actor.user.id),
    identities: identities.map((i) => ({ provider: i.provider, createdAt: i.createdAt })),
  });
}
