import { notFound } from 'next/navigation';
import { resolveSymbol } from '@/core/symbols';
import type { HorizonKey } from '../../bulletinHelpers';
import SnapshotClient from './SnapshotClient';

// Public snapshot of the Live Bulletin card, sized for a headless-browser
// screenshot rather than for a human reader.  Powers the bulletin-tweet
// cron's PNG attachment — the Playwright helper visits this route, waits
// for ``data-bulletin-ready="true"``, and captures the ``[data-bulletin-
// card]`` element.
//
// Token-gated: since the paid /live-bulletin page requires a subscription,
// this route protects the same data behind a shared secret set in
// ``BULLETIN_SNAPSHOT_TOKEN``.  The cron reads the same value from its
// EnvironmentFile and passes it as ``?token=…``.  Missing / mismatched
// tokens 404 rather than redirect, so nothing about this route is
// advertised to a casual scraper.
//
// When ``BULLETIN_SNAPSHOT_TOKEN`` is unset (dev / initial rollout), the
// route is open — safer than crashing on first hit.  Setting the env var
// in production locks it down.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_HORIZONS = ['daily', 'weekly', 'monthly'] as const;

function coerceHorizon(raw: string | undefined): HorizonKey {
  return (VALID_HORIZONS as readonly string[]).includes(raw ?? '')
    ? (raw as HorizonKey)
    : 'daily';
}

export default async function SnapshotPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{
    token?: string;
    horizon?: string;
    date?: string;
    watermark?: string;
  }>;
}) {
  const { symbol: rawSymbol } = await params;
  const sp = await searchParams;

  const expected = process.env.BULLETIN_SNAPSHOT_TOKEN?.trim();
  if (expected && sp.token !== expected) {
    // 404 rather than 401 so scrapers see nothing to probe.
    notFound();
  }

  const symbol = resolveSymbol(rawSymbol);
  const horizon = coerceHorizon(sp.horizon);
  const watermark = sp.watermark !== '0'; // default on; ``?watermark=0`` disables

  return (
    <SnapshotClient
      symbol={symbol}
      horizon={horizon}
      dateLabel={sp.date}
      watermark={watermark}
    />
  );
}
