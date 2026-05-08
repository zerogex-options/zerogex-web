import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import MonitoringClient from './MonitoringClient';

export const dynamic = 'force-dynamic';

export default async function AdminMonitoringPage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <MonitoringClient />;
}
