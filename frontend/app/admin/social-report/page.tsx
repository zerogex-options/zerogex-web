import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import SocialReportClient from './SocialReportClient';

export const dynamic = 'force-dynamic';

export default async function AdminSocialReportPage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <SocialReportClient />;
}
