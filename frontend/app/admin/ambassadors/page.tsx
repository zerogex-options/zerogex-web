import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import AmbassadorsAdminClient from './AmbassadorsAdminClient';

export const dynamic = 'force-dynamic';

// Admin-only, exactly like the other /admin/* pages: server-side session +
// tier==='admin' gate, with the API route re-checking on every request.
export default async function AdminAmbassadorsPage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <AmbassadorsAdminClient />;
}
