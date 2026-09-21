import type { Metadata } from 'next';

import { hasTierAccess } from '@/core/auth';
import { requireSession } from '@/core/serverAuth';
import { sameIndexPairFor } from '@/core/symbols';
import ChartClient from './ChartClient';
import { loadChartSnapshot, loadLadderSnapshot } from './snapshot';

/**
 * The Gamma Terminal — this site's flagship surface, and a dual-mode one:
 *   • Subscribers (basic+) get the live, real-time terminal (ChartClient with
 *     no snapshots — the components poll the API client-side).
 *   • Everyone else gets a ~15-minute-delayed server snapshot rendered as the
 *     same interactive terminal: the chart AND both gamma ladders. All the
 *     delayed data is fetched here on the server via ISR-cached serverApiGet,
 *     so the public client never touches the API and no real-time data leaks
 *     over the wire.
 *
 * Reading the session cookie (requireSession) makes this route render per
 * request; the underlying data fetches stay cached for ~15 minutes.
 *
 * /gamma-terminal, the members-only beta this page absorbed, 301s here (see
 * next.config.ts).
 */

// The public preview's pair: SPY's tape and book, read against the same
// index's other book. Identical to what the live terminal opens on, so the
// free view is the real product rather than a reduced diagram of it.
const PUBLIC_SYMBOL = 'SPY';

// Whether the current visitor gets the live terminal. Auth off (local dev) →
// treat everyone as a subscriber so the live view shows. Auth on → live only
// for a signed-in member with at least basic tier. Shared by the page and
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

// Title/description are per-visitor: a subscriber viewing the LIVE terminal must
// not get the public lead-magnet's "Free … (15-min delayed)" tab title. The
// delayed copy keeps the free page's shape and its "gamma chart" phrasing (that
// page is the indexable free lead magnet and the term it has always ranked on),
// so SEO for the public route is unchanged by the fold.
export async function generateMetadata(): Promise<Metadata> {
  if (await resolveIsSubscriber()) {
    return {
      title: 'Gamma Terminal — Live SPY Gamma Chart + Strike Ladders | ZeroGEX',
      description:
        'The live ZeroGEX Gamma Terminal: SPY, QQQ, SPX, NDX, ES and NQ price with the Gamma Flip, Call/Put Walls, Max Pain and GEX ribbons, beside two strike-aligned Net GEX ladders or the dealer-gamma structure rail.',
      alternates: { canonical: '/chart' },
    };
  }
  // Self-canonical in both modes. This is a public, indexable lead magnet (the
  // free delayed terminal) and until now was the one public page with no
  // canonical at all — the likeliest source of the "Duplicate without
  // user-selected canonical" row in Search Console, since the same page is
  // reachable with query strings and via the symbol picker.
  return {
    title: 'Free Gamma Chart — SPY Dealer Positioning (15-min delayed) | ZeroGEX',
    description:
      'A free, ~15-minute-delayed gamma chart for SPY: price with the Gamma Flip, Call/Put Walls, Max Pain and the dealer-gamma book beside it — two Net GEX strike ladders or the structure rail. Real-time and every symbol inside ZeroGEX.',
    alternates: { canonical: '/chart' },
  };
}

export default async function GammaTerminalPage() {
  const isSubscriber = await resolveIsSubscriber();

  if (isSubscriber) {
    return <ChartClient snapshot={null} delayed={false} ladders={null} />;
  }

  // Anonymous: force delayed mode. Even if a snapshot fetch fails and returns
  // null, `delayed` keeps the client from polling real-time — it degrades to
  // each instrument's empty state instead.
  //
  // All three share one Next fetch cache, and the primary ladder's requests are
  // byte-identical to three of the chart snapshot's, so the pair of ladders
  // costs one extra symbol's worth of fetches per 15-minute window across all
  // anonymous visitors — not per visitor.
  const compareSymbol = sameIndexPairFor(PUBLIC_SYMBOL);
  const [snapshot, primary, compare] = await Promise.all([
    loadChartSnapshot(PUBLIC_SYMBOL, '5min'),
    loadLadderSnapshot(PUBLIC_SYMBOL),
    loadLadderSnapshot(compareSymbol),
  ]);
  return <ChartClient snapshot={snapshot} delayed ladders={{ primary, compare }} />;
}
