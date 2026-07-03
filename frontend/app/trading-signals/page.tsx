import { redirect } from 'next/navigation';
import { requireSession } from '@/core/serverAuth';
import TradeWorkzClient from './TradeWorkzClient';

export const dynamic = 'force-dynamic';

/**
 * TradeWorkz™ dashboard — a multi-bot signaled-trading engine that
 * replaces the legacy /trading-signals blotter. Admin-tier only until
 * customer rollout.
 *
 * The tier gate is enforced twice on purpose: once here (server-side
 * redirect for direct navigations) and once in `frontend/core/auth.ts`
 * `ROUTE_ACCESS_RULES` (Next.js middleware / proxy). Belt-and-braces so
 * an SSR path that skips the proxy can't leak the page to a non-admin.
 */
export default async function TradingSignalsPage() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    redirect('/');
  }
  return <TradeWorkzClient />;
}
