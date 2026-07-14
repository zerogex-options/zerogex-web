import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import PageAnalyticsClient from './PageAnalyticsClient';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <PageAnalyticsClient />;
}
