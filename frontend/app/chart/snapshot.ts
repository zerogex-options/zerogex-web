import 'server-only';

import { serverApiGet } from '@/core/api/serverFetch';
import type { SessionClosesData } from '@/hooks/useApiData';
import type { PriceBar } from '@/hooks/useMarketHistorical';
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
  const [barsRaw, profile, summary, quote, closes, technicals] = await Promise.all([
    serverApiGet<RawBar[]>(`/api/market/historical?${q}&timeframe=${encodeURIComponent(timeframe)}&window_units=${WINDOW_UNITS}`, DELAY_SECONDS),
    serverApiGet<RawProfile>(`/api/gex/profile?${q}`, DELAY_SECONDS),
    serverApiGet<RawSummary>(`/api/gex/summary?${q}`, DELAY_SECONDS),
    serverApiGet<RawQuote>(`/api/market/quote?${q}`, DELAY_SECONDS),
    serverApiGet<SessionClosesData>(`/api/market/session-closes?${q}`, DELAY_SECONDS),
    serverApiGet<RawTechnicals>(`/api/technicals?${q}`, DELAY_SECONDS),
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
    }));

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

  return {
    symbol,
    timeframe,
    generatedAt: lastBar?.timestamp ?? null,
    bars,
    quote: {
      close: num(quote?.close) ?? num(lastBar?.close) ?? num(lastBar?.price),
      session: quote?.session ?? null,
      timestamp: quote?.timestamp ?? lastBar?.timestamp ?? null,
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
    vwap,
  };
}
