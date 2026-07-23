import type { Metadata } from 'next';

import { hasTierAccess } from '@/core/auth';
import { requireSession } from '@/core/serverAuth';
import ChartClient from './ChartClient';
import { loadChartSnapshot } from './snapshot';

/**
 * /chart is a dual-mode surface:
 *   • Subscribers (basic+) get the live, real-time chart (ChartClient with no
 *     snapshot — the component polls the API client-side).
 *   • Everyone else gets a ~15-minute-delayed server snapshot rendered as the
 *     same interactive chart. All the delayed data is fetched here on the server
 *     via ISR-cached serverApiGet, so the public client never touches the API
 *     and no real-time data leaks over the wire.
 *
 * Reading the session cookie (requireSession) makes this route render per
 * request; the underlying data fetches stay cached for ~15 minutes.
 */

// Whether the current visitor gets the live chart. Auth off (local dev) → treat
// everyone as a subscriber so the live chart shows. Auth on → live only for a
// signed-in member with at least basic tier. Shared by the page and
// generateMetadata so the <title> and the rendered mode never disagree.
async function resolveIsSubscriber(): Promise<boolean> {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === '1';
  if (!authEnabled) return true;
  try {
    const session = await requireSession();
    return !!session && hasTierAccess(session.user.tier, 'basic');
  } catch {
    return false;
  }
}

// Title/description are per-visitor: a subscriber viewing the LIVE chart must
// not get the public lead-magnet's "Free … (15-min delayed)" tab title. The
// delayed copy is kept verbatim for anonymous visitors (that page is the
// indexable free lead magnet), so SEO for the public route is unchanged.
export async function generateMetadata(): Promise<Metadata> {
  if (await resolveIsSubscriber()) {
    return {
      title: 'Gamma Chart — Live SPY Dealer Positioning | ZeroGEX',
      description:
        'The live ZeroGEX gamma chart: SPY, QQQ and SPX price with the Gamma Flip, Call/Put Walls, Max Pain and a real-time dealer-gamma structure rail drawn inline.',
    };
  }
  return {
    title: 'Free Gamma Chart — SPY Dealer Positioning (15-min delayed) | ZeroGEX',
    description:
      'A free, ~15-minute-delayed gamma chart for SPY: price with the Gamma Flip, Call/Put Walls, Max Pain and a live-style dealer-gamma structure rail drawn inline. Real-time and every symbol inside ZeroGEX.',
  };
}

export default async function GammaChartPage() {
  const isSubscriber = await resolveIsSubscriber();

  if (isSubscriber) {
    return <ChartClient snapshot={null} delayed={false} />;
  }

  // Anonymous: force delayed mode. Even if the snapshot fetch fails and returns
  // null, `delayed` keeps the client from polling real-time — it degrades to the
  // chart's empty state instead.
  const snapshot = await loadChartSnapshot('SPY', '5min');
  return <ChartClient snapshot={snapshot} delayed />;
}
