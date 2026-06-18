import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import CommuniqueClient from './CommuniqueClient';

export const dynamic = 'force-dynamic';

export default async function AdminCommuniquePage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <CommuniqueClient />;
}
