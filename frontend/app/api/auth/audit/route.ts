import { NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getDb } from '@/core/db';

export async function GET() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const rows = getDb()
    .prepare('SELECT id, type, user_id, actor_user_id, email, ip, message, created_at FROM audit_events ORDER BY created_at DESC LIMIT 200')
    .all() as Array<Record<string, unknown>>;

  return NextResponse.json({
    ok: true,
    events: rows.map((row) => ({
      id: row.id,
      type: row.type,
      userId: row.user_id,
      actorUserId: row.actor_user_id,
      email: row.email,
      ip: row.ip,
      message: row.message,
      createdAt: row.created_at,
    })),
  });
}
