import { redirect } from 'next/navigation';

import { requireSession } from '@/core/serverAuth';
import XPostReviewClient from './XPostReviewClient';

export const dynamic = 'force-dynamic';

export default async function AdminXPostPage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <XPostReviewClient />;
}
