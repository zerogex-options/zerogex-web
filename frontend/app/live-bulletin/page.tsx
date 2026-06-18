import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import { hasTierAccess } from '@/core/auth';
import LiveBulletinClient from './LiveBulletinClient';

export const dynamic = 'force-dynamic';

// Paid feature (Basic+). Middleware already enforces the same rule via
// ROUTE_ACCESS_RULES; this is defense-in-depth so the live dealer-gamma data
// is never rendered for an under-tier session even if middleware is bypassed.
export default async function LiveBulletinPage() {
  const actor = await requireSession();
  if (!actor) {
    redirect('/login?next=/live-bulletin');
  }
  if (!hasTierAccess(actor.user.tier, 'basic')) {
    redirect(`/unauthorized?required=basic&current=${actor.user.tier}&path=/live-bulletin`);
  }
  return <LiveBulletinClient />;
}
