import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import AmbassadorClient from './AmbassadorClient';

export const dynamic = 'force-dynamic';

// Ambassador area lives under /account (minimum tier: public — any logged-in
// user can reach the route). The page itself is gated at the DATA layer: the
// client fetches /api/account/ambassador, which returns the dashboard ONLY for
// the session user's own ambassador profile, and renders an "invite-only"
// message for everyone else. So a non-ambassador who navigates here sees no
// ambassador data.
export default async function AmbassadorPage() {
  const actor = await requireSession();
  if (!actor) redirect('/login?next=/account/ambassador');
  return <AmbassadorClient />;
}
