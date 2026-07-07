import { redirect } from 'next/navigation';
import { hasTierAccess, normalizeTier } from '@/core/auth';
import { requireSession } from '@/core/serverAuth';
import TradeWorkzClient from './TradeWorkzClient';

export const dynamic = 'force-dynamic';

/**
 * TradeWorkz™ dashboard — a multi-bot signaled-trading engine.
 *
 * Pro-tier gated (see `frontend/core/auth.ts` ROUTE_ACCESS_RULES). The
 * middleware layer already redirects unauthorized visitors to
 * /unauthorized, which shows an "Upgrade to unlock" pro CTA. This
 * server-side check is a belt-and-braces re-gate so an SSR path that
 * skips the middleware can't leak the page.
 *
 * Admin-only surfaces inside the dashboard (Seed / Test / Clear)
 * are further gated inside the client via useAuthSession().
 */
export default async function TradingSignalsPage() {
  const actor = await requireSession();
  if (!actor) {
    redirect('/login?next=/trading-signals');
  }
  const tier = normalizeTier(actor.user.tier);
  if (!hasTierAccess(tier, 'pro')) {
    redirect(`/unauthorized?required=pro&current=${tier}&path=/trading-signals`);
  }
  return <TradeWorkzClient />;
}
