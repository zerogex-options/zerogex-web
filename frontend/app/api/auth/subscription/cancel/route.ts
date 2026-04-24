import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { normalizeTier } from '@/core/auth';
import { requireSession, validateCsrf } from '@/core/serverAuth';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const currentTier = normalizeTier(actor.user.tier);
  if (currentTier === 'admin') {
    return NextResponse.json({ error: 'Admin accounts cannot cancel their subscription here' }, { status: 400 });
  }

  const targetTier = 'starter';
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET tier = ?, updated_at = ? WHERE id = ?').run(targetTier, now, actor.user.id);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `audit_${randomBytes(12).toString('hex')}`,
    'subscription_cancel',
    actor.user.id,
    actor.user.id,
    actor.user.email,
    ip,
    `Subscription cancelled: ${currentTier} → ${targetTier}`,
    now,
  );

  return NextResponse.json({ ok: true, user: { email: actor.user.email, tier: targetTier } });
}
