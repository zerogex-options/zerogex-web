import 'server-only';

import { serverApiGet } from '@/core/api/serverFetch';
import { getMarketSession, isIndexSymbol } from '@/core/utils';
import { resolveDelayedQuote } from '@/core/delayedQuote';
import type { SessionClosesData } from '@/hooks/useApiData';
import type { PriceBar } from '@/hooks/useMarketHistorical';
import type { StrikeProfileStrike } from '@/hooks/useStrikeProfileTimeseries';
import type { ChartSnapshot } from '@/components/GammaTerminalChart';

// The whole point of the public /chart view: the data is fetched once per this
// window and shared across every anonymous visitor via the Next fetch cache, so
// what the public sees is 0–15 min stale and the client never touches the API.
const DELAY_SECONDS = 900;

// Enough bars for the default window plus room to pan/zoom back.
const WINDOW_UNITS = 180;

type ChartTimeframe = ChartSnapshot['timeframe'];

const symbolQ = (s: string) => `symbol=${encodeURIComponent(s)}&underlying=${encodeURIComponent(s)}`;

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

interface RawBar {
  timestamp?: string;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  price?: unknown;
  volume?: unknown;
  up_volume?: unknown;
  down_volume?: unknown;
}
interface RawProfile {
  profile?: Array<{ price: unknown; gex: unknown }>;
  gamma_flip?: unknown;
  call_wall?: unknown;
  put_wall?: unknown;
  net_gex_at_spot?: unknown;
}
interface RawSummary {
  max_pain?: unknown;
  net_gex?: unknown;
  gamma_flip?: unknown;
  call_wall?: unknown;
  put_wall?: unknown;
}
interface RawQuote {
  close?: unknown;
  session?: string | null;
  timestamp?: string | null;
  display_source?: string | null;
  futures_close?: unknown;
  futures_reference_close?: unknown;
}
interface RawTechnicals {
  bars?: Array<{ vwap_deviation?: { vwap?: unknown } }>;
}
interface RawStrikeRow {
  strike?: unknown;
  net_gamma?: unknown;
  call_oi?: unknown;
  put_oi?: unknown;
}
interface RawBucket {
  timestamp?: string;
  strikes?: RawStrikeRow[];
}

// Most-recent bucket that actually carries per-strike gamma (walk back so an
// empty after-hours tip doesn't blank the public rail). Mirrors the live
// chart's liveGexBucket selection.
function pickStrikeSurface(buckets: RawBucket[] | null | undefined): StrikeProfileStrike[] | null {
  if (!Array.isArray(buckets)) return null;
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const s = buckets[i]?.strikes;
    if (Array.isArray(s) && s.some((r) => { const g = num(r?.net_gamma); return g != null && g !== 0; })) {
      return s.map((r) => ({
        strike: num(r?.strike) ?? undefined,
        net_gamma: num(r?.net_gamma),
        call_oi: num(r?.call_oi),
        put_oi: num(r?.put_oi),
      }));
    }
  }
  return null;
}

/**
 * Build the frozen, ~15-min-delayed snapshot the public chart renders from.
 * Every fetch is ISR-cached for DELAY_SECONDS, so this is cheap under load and
 * genuinely delayed. Returns null only if there are no bars at all (the page
 * then shows the chart's own empty state).
 */
export async function loadChartSnapshot(
  symbol: string,
  timeframe: ChartTimeframe = '5min',
): Promise<ChartSnapshot | null> {
  const q = symbolQ(symbol);
  // ETFs opt into allow_futures for after-hours bars; cash indexes don't (they
  // freeze at the 16:00 close), matching the live chart.
  const futuresParam = isIndexSymbol(symbol) ? '' : '&allow_futures=1';
  const [barsRaw, profile, summary, quote, closes, technicals, buckets] = await Promise.all([
    serverApiGet<RawBar[]>(`/api/market/historical?${q}&timeframe=${encodeURIComponent(timeframe)}&window_units=${WINDOW_UNITS}${futuresParam}`, DELAY_SECONDS),
    serverApiGet<RawProfile>(`/api/gex/profile?${q}`, DELAY_SECONDS),
    serverApiGet<RawSummary>(`/api/gex/summary?${q}`, DELAY_SECONDS),
    serverApiGet<RawQuote>(`/api/market/quote?${q}`, DELAY_SECONDS),
    serverApiGet<SessionClosesData>(`/api/market/session-closes?${q}`, DELAY_SECONDS),
    serverApiGet<RawTechnicals>(`/api/technicals?${q}`, DELAY_SECONDS),
    // Per-strike surface for the rail (same density the live/rewind rail draws).
    serverApiGet<RawBucket[]>(`/api/gex/strike-profile-timeseries?${q}&timeframe=5min&window_units=3&expirations=all`, DELAY_SECONDS),
  ]);

  if (!Array.isArray(barsRaw) || barsRaw.length === 0) return null;

  const bars: PriceBar[] = barsRaw
    .filter((b): b is RawBar & { timestamp: string } => !!b && typeof b.timestamp === 'string')
    .map((b) => ({
      timestamp: b.timestamp,
      open: num(b.open) ?? undefined,
      high: num(b.high) ?? undefined,
      low: num(b.low) ?? undefined,
      close: num(b.close) ?? undefined,
      price: num(b.price) ?? undefined,
      volume: num(b.volume) ?? undefined,
      up_volume: num(b.up_volume),
      down_volume: num(b.down_volume),
    }))
    // /api/market/historical does NOT guarantee chronological order (the live
    // hook and the chart's aggregateBars both sort it defensively). Sort here
    // too, because we read `bars[bars.length - 1]` as the freshest bar for the
    // headline close + "as of" timestamp — without this, a newest-first feed
    // made the delayed quote latch onto the OLDEST bar in the window (a full
    // day stale, e.g. "as of yesterday 11:20") while the sorted chart looked
    // fine.
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const profilePoints = Array.isArray(profile?.profile)
    ? profile.profile
        .map((p) => ({ price: Number(p.price), gex: Number(p.gex) }))
        .filter((p) => Number.isFinite(p.price) && Number.isFinite(p.gex))
        .sort((a, b) => a.price - b.price)
    : [];

  const lastBar = bars[bars.length - 1];
  const vwapBars = technicals?.bars;
  const vwap =
    Array.isArray(vwapBars) && vwapBars.length > 0 ? num(vwapBars[vwapBars.length - 1]?.vwap_deviation?.vwap) : null;

  // Repair a stale cached quote so the public headline can't freeze on the prior
  // session's 4 PM close while the delayed candles show today's tape. During the
  // cash session this anchors price + "as of" to the freshest delayed bar; nights
  // / weekends / the futures swap keep the served quote (see resolveDelayedQuote).
  const repairedQuote = resolveDelayedQuote({
    quoteClose: num(quote?.close),
    quoteSession: quote?.session ?? null,
    quoteTimestamp: typeof quote?.timestamp === 'string' ? quote.timestamp : null,
    displaySource: quote?.display_source ?? null,
    lastBarClose: num(lastBar?.close) ?? num(lastBar?.price),
    lastBarTimestamp: lastBar?.timestamp ?? null,
    marketNow: getMarketSession(),
  });

  return {
    symbol,
    timeframe,
    generatedAt: lastBar?.timestamp ?? null,
    bars,
    quote: {
      close: repairedQuote.close,
      session: repairedQuote.session,
      timestamp: repairedQuote.timestamp,
      display_source: quote?.display_source ?? null,
      futures_close: num(quote?.futures_close),
      futures_reference_close: num(quote?.futures_reference_close),
    },
    sessionCloses: closes ?? null,
    gamma: {
      flip: num(profile?.gamma_flip) ?? num(summary?.gamma_flip),
      callWall: num(profile?.call_wall) ?? num(summary?.call_wall),
      putWall: num(profile?.put_wall) ?? num(summary?.put_wall),
      maxPain: num(summary?.max_pain),
      netGexAtSpot: num(profile?.net_gex_at_spot) ?? num(summary?.net_gex),
    },
    profile: profilePoints,
    strikes: pickStrikeSurface(buckets),
    vwap,
  };
}
