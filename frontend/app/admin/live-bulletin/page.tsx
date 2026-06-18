import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import LiveBulletinClient from '@/app/live-bulletin/LiveBulletinClient';

export const dynamic = 'force-dynamic';

// Admin-only, watermark-free twin of /live-bulletin. Same generator and live
// data; the only difference is the omitted brand watermark. /admin/* is already
// admin-gated by middleware (ROUTE_ACCESS_RULES) — this re-checks the tier as
// defense in depth.
export default async function AdminLiveBulletinPage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <LiveBulletinClient watermark={false} />;
}
