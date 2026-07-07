import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import NotificationsClient from './NotificationsClient';

export const dynamic = 'force-dynamic';

/**
 * Central place for the user to manage which TradeWorkz bots they
 * follow and which channels + conviction threshold each subscription
 * uses. Any authenticated user can reach it — the underlying follow
 * records exist independent of tier (a Basic user's follows survive an
 * upgrade to Pro), so the page always renders as long as they're
 * signed in.
 */
export default async function AccountNotificationsPage() {
  const actor = await requireSession();
  if (!actor) {
    redirect('/login?next=/account/notifications');
  }
  return <NotificationsClient />;
}
