import { notFound } from 'next/navigation';
import { serverApiGet } from '@/core/api/serverFetch';
import { resolveSymbol } from '@/core/symbols';
import { projectedIndexSpot, sampleGexProfile, type HorizonKey } from '../../bulletinHelpers';
import SnapshotClient from './SnapshotClient';

// Public snapshot of the Live Bulletin card, sized for a headless-browser
// screenshot rather than for a human reader.  Powers the bulletin-tweet
// cron's PNG attachment — the Playwright helper visits this route, waits
// for ``data-bulletin-ready="true"``, and captures the ``[data-bulletin-
// card]`` element.
//
// Data flow: we SSR-fetch every field the card needs via ``serverApiGet``
// (which attaches ``ZEROGEX_API_TOKEN`` — the server-only bearer that
// bypasses per-user auth on the FastAPI backend).  The client component
// receives the numbers as props, so a headless / logged-out browser can
// render the card without ever hitting an API endpoint from the client
// side.  This is the same pattern the ``/replay/[symbol]/[date]`` page
// uses.
//
// Token-gated: since the paid /live-bulletin page requires a
// subscription, this route protects the same data behind a shared
// secret set in ``BULLETIN_SNAPSHOT_TOKEN``.  The cron reads the same
// value from its EnvironmentFile and passes it as ``?token=…``.
// Missing / mismatched tokens 404 rather than redirect, so nothing about
// this route is advertised to a casual scraper.  Unset in dev → route
// is open.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_HORIZONS = ['daily', 'weekly', 'monthly'] as const;

function coerceHorizon(raw: string | undefined): HorizonKey {
  return (VALID_HORIZONS as readonly string[]).includes(raw ?? '')
    ? (raw as HorizonKey)
    : 'daily';
}

// Minimal shape of the upstream endpoints — just the fields the
// GammaReportCard reads.  Kept in the page (server component) so the
// client bundle doesn't ship the whole GEXSummary row typedef.
interface GexSummaryResponse {
  timestamp?: string;
  symbol?: string;
  spot_price?: number | null;
  gamma_flip?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  max_pain?: number | null;
  net_gex?: number | null;
  net_gex_at_spot?: number | null;
  put_call_ratio?: number | null;
  total_call_gex?: number | null;
  total_put_gex?: number | null;
}

interface MarketQuoteResponse {
  symbol?: string;
  close?: number | null;
  session?: string | null;
  // Index->future display swap fields (present when INDEX_FUTURES_DISPLAY_ENABLED
  // and the symbol is a cash index outside the cash session).
  display_source?: string | null;
  data_symbol?: string | null; // future ticker for the badge, e.g. "ES"
  futures_close?: number | null; // @ES now
  futures_reference_close?: number | null; // @ES at the session's 16:00 print
}

interface SessionClosesResponse {
  current_session_close?: number | null;
  prior_session_close?: number | null;
}

interface VolatilityGaugeResponse {
  index?: number | null;
}

// Spot-shift dealer-gamma curve — sampled at the implied open so the Net GEX /
// posture reads on the same side of the flip as the projected spot.
interface GexProfileResponse {
  profile?: Array<{ price: number; gex: number }> | null;
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
  // QQQ's implied-vol input is VXN (Nasdaq-100); everything else uses VIX.
  const volIndex: 'VIX' | 'VXN' = symbol === 'QQQ' ? 'VXN' : 'VIX';

  // SSR the five data feeds in parallel.  Any individual failure
  // returns null and the card gracefully hides that field (matches
  // the paid page's behavior when a hook returns undefined).
  const [summary, quote, sessionCloses, volGauge, gexProfile] = await Promise.all([
    serverApiGet<GexSummaryResponse>(`/api/gex/summary?symbol=${symbol}`, 0),
    serverApiGet<MarketQuoteResponse>(`/api/market/quote?symbol=${symbol}`, 0),
    serverApiGet<SessionClosesResponse>(`/api/market/session-closes?symbol=${symbol}`, 0),
    serverApiGet<VolatilityGaugeResponse>(`/api/market/volatility?ticker=${volIndex}`, 0),
    serverApiGet<GexProfileResponse>(`/api/gex/profile?symbol=${symbol}`, 0),
  ]);

  const priorClose = sessionCloses?.current_session_close ?? null;
  // For a cash index outside the cash session, project the implied spot from
  // the future (matches the daily-forecast + bulletin-tweet projection) so
  // the screenshot never shows a frozen cash close labelled as a live SPX
  // quote.  Falls back to the cash close when not a futures swap.
  const projection = projectedIndexSpot(quote, priorClose);
  const spot = projection?.spot ?? quote?.close ?? summary?.spot_price ?? null;
  const vix = volGauge?.index ?? null;
  // When the spot is a futures-implied open, re-evaluate net GEX at that price
  // off the gex-profile curve so the posture matches the projected spot's side
  // of the flip (the summary's net_gex_at_spot is frozen at the cash spot).
  const impliedNetGex =
    projection != null ? sampleGexProfile(gexProfile?.profile, spot) : null;

  return (
    <SnapshotClient
      symbol={symbol}
      horizon={horizon}
      dateLabel={sp.date}
      watermark={watermark}
      volIndex={volIndex}
      summary={summary ?? null}
      spot={spot}
      spotIsProjected={projection != null}
      spotSourceLabel={projection?.sourceLabel ?? null}
      priorClose={priorClose}
      vix={vix}
      impliedNetGex={impliedNetGex}
      timestamp={summary?.timestamp ?? null}
    />
  );
}
