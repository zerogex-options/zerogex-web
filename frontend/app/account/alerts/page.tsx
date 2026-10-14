import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import WallAlertsClient from './WallAlertsClient';

export const dynamic = 'force-dynamic';

/**
 * Wall alerts — /account/alerts. Members create and manage alerts on Call/Put
 * Wall hits, breaks and holds (zerogex-oa src/alerts/, docs/design/wall-alerts.md).
 *
 * Reachable by any signed-in member, like the rest of /account: a lapsed member
 * still sees their saved alerts and why they are paused. Creating and editing
 * are Basic features, enforced where they are spent — the BFF gate on
 * /api/alerts (core/api/apiTierGate.ts) and the email worker's tier check.
 *
 * ``?symbol=SPX&side=put`` opens the editor prefilled, for the "Alert me"
 * links beside the walls elsewhere on the site.
 */
export default async function WallAlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireSession();
  if (!actor) {
    redirect('/login?next=/account/alerts');
  }
  const params = await searchParams;
  const pick = (key: string) => {
    const raw = params[key];
    return typeof raw === 'string' ? raw : null;
  };
  return (
    <WallAlertsClient
      tier={actor.user.tier}
      emailVerified={Boolean((actor.user as { emailVerified?: boolean }).emailVerified)}
      initialSymbol={pick('symbol')}
      initialSide={pick('side')}
    />
  );
}
