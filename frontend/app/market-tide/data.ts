export type MarketTideLabel =
  | "strong_bullish"
  | "bullish"
  | "neutral"
  | "bearish"
  | "strong_bearish"
  | "insufficient_data";

export type MarketTideGammaLabel = "amplifying" | "neutral" | "dampening";

export interface MarketTideComponent {
  symbol: string;
  flow_score: number;
  gamma_score: number;
  amplifier: number;
  weight: number;
  contribution: number;
}

export interface MarketTideResponse {
  timestamp: string;
  score: number | null;
  label: MarketTideLabel;
  flow_direction: number;
  gamma_regime: number;
  gamma_label: MarketTideGammaLabel;
  bullish_breadth_pct: number;
  bearish_breadth_pct: number;
  neutral_breadth_pct: number;
  participation_pct: number;
  eligible_symbols: number;
  configured_symbols: number;
  stale_symbols: string[];
  /** Every eligible symbol, ranked by contribution (for the flow×gamma map).
   *  Optional: snapshots persisted before this field existed omit it, so
   *  consumers fall back to leaders+laggards via {@link tideComponents}. */
  components?: MarketTideComponent[];
  leaders: MarketTideComponent[];
  laggards: MarketTideComponent[];
}

export interface MarketTideHistoryPoint {
  timestamp: string;
  session_date: string;
  score: number | null;
  label: string;
  participation_pct: number;
  flow_direction: number | null;
  gamma_regime: number | null;
}

export type MarketTideHistoryMode = "intraday" | "daily";

export interface MarketTideHistoryResponse {
  window_minutes: number;
  mode: MarketTideHistoryMode | string;
  points: MarketTideHistoryPoint[];
}

const LABELS: Record<MarketTideLabel, string> = {
  strong_bullish: "Strong Bullish", bullish: "Bullish", neutral: "Neutral",
  bearish: "Bearish", strong_bearish: "Strong Bearish", insufficient_data: "Insufficient Data",
};

export const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export const formatNumber = (value: unknown, digits = 2): string => {
  const n = finite(value);
  return n == null ? "—" : n.toFixed(digits);
};
export const formatSigned = (value: unknown, digits = 6): string => {
  const n = finite(value);
  return n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
};
export const formatLabel = (label: unknown): string =>
  typeof label === "string" && label in LABELS
    ? LABELS[label as MarketTideLabel]
    : typeof label === "string" && label.trim()
      ? label.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Unknown";
export const markerPosition = (score: unknown): number | null => {
  const n = finite(score);
  return n == null ? null : ((Math.max(-100, Math.min(100, n)) + 100) / 200) * 100;
};
export const safePercent = (value: unknown): number => Math.max(0, Math.min(100, finite(value) ?? 0));
export function breadthWidths(values: unknown[]): number[] {
  const safe = values.map((value) => Math.max(0, finite(value) ?? 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  return total > 0 ? safe.map((value) => (value / total) * 100) : safe.map(() => 0);
}

/**
 * All eligible per-symbol rows for the flow×gamma map, ranked by contribution.
 * Prefers the full `components` array; falls back to merging leaders+laggards
 * so snapshots persisted before `components` existed still render every name.
 */
export function tideComponents(data: MarketTideResponse | null | undefined): MarketTideComponent[] {
  if (!data) return [];
  if (Array.isArray(data.components) && data.components.length > 0) return data.components;
  const seen = new Set<string>();
  const merged: MarketTideComponent[] = [];
  for (const row of [...(data.leaders ?? []), ...(data.laggards ?? [])]) {
    if (row && row.symbol && !seen.has(row.symbol)) {
      seen.add(row.symbol);
      merged.push(row);
    }
  }
  return merged.sort((a, b) => (finite(b.contribution) ?? 0) - (finite(a.contribution) ?? 0));
}

export type TideRegime = "squeeze" | "airpocket" | "capped" | "supported";

/** Which flow×gamma quadrant a symbol sits in (short gamma = amplifies). */
export function componentRegime(c: MarketTideComponent): TideRegime {
  const bullFlow = (finite(c.flow_score) ?? 0) >= 0;
  const shortGamma = (finite(c.gamma_score) ?? 0) < 0;
  if (shortGamma) return bullFlow ? "squeeze" : "airpocket";
  return bullFlow ? "capped" : "supported";
}

const REGIME_PHRASE: Record<TideRegime, string> = {
  squeeze: "Call flow into short gamma — primed to be pushed higher",
  airpocket: "Put flow into short gamma — vulnerable to a flush",
  capped: "Call flow, but dealers are long gamma — grind, capped",
  supported: "Put flow, but dealers are long gamma — dips absorbed",
};
export const regimePhrase = (c: MarketTideComponent): string => REGIME_PHRASE[componentRegime(c)];

// Index (institutional) vs ETF (retail/hedging) split detection — one of the
// most actionable reads the cross-market view surfaces.
const CORE_INDEX = new Set(["SPX", "NDX"]);
const CORE_ETF = new Set(["SPY", "QQQ"]);

export type ReadAccent = "bull" | "bear" | "gold" | "hot";
export interface MarketTideReadItem {
  icon: string;
  accent: ReadAccent;
  label: string;
  body: string;
}
export interface MarketTideRead {
  headline: string;
  /** the direction word inside `headline` to emphasize, e.g. "mildly bullish" */
  emphasis: string;
  shortGamma: boolean;
  items: MarketTideReadItem[];
}

/** Turn a Market Tide reading into a plain-English read + supporting points. */
export function buildRead(data: MarketTideResponse | null | undefined): MarketTideRead | null {
  if (!data) return null;
  const comps = tideComponents(data);
  const score = finite(data.score);
  if (score == null || data.label === "insufficient_data" || comps.length === 0) {
    return {
      headline: "Not enough fresh cross-market data to publish a read yet.",
      emphasis: "",
      shortGamma: false,
      items: [],
    };
  }
  const bullish = score >= 0;
  const mag = Math.abs(score);
  const strength = mag >= 60 ? "strongly " : mag >= 20 ? "decisively " : mag >= 5 ? "" : "mildly ";
  const dir = bullish ? "bullish" : "bearish";
  const emphasis = `${strength}${dir}`.trim();
  const shortGamma = comps.every((c) => (finite(c.gamma_score) ?? 0) < 0);
  const headline = shortGamma
    ? `Options flow is ${emphasis} — and every index is short gamma, so dealer hedging will amplify the move.`
    : `Options flow is ${emphasis} across the market.`;

  const ranked = [...comps].sort(
    (a, b) => (finite(b.contribution) ?? 0) - (finite(a.contribution) ?? 0),
  );
  const lead = ranked[0];
  const lag = ranked[ranked.length - 1];
  const leadShort = (finite(lead.gamma_score) ?? 0) < 0;
  const items: MarketTideReadItem[] = [
    {
      icon: "Γ",
      accent: "bear",
      label: `${lead.symbol} is the strongest lift`,
      body: `biggest positive contribution (${formatSigned(lead.contribution, 2)}) — ${
        (finite(lead.flow_score) ?? 0) > 0 ? "call" : "put"
      }-side flow ${leadShort ? "into short gamma, the setup most likely to run" : "with dealers long"}.`,
    },
  ];

  const idx = comps.filter((c) => CORE_INDEX.has(c.symbol));
  const etf = comps.filter((c) => CORE_ETF.has(c.symbol));
  const idxBull = idx.length > 0 && idx.every((c) => (finite(c.flow_score) ?? 0) > 0);
  const idxBear = idx.length > 0 && idx.every((c) => (finite(c.flow_score) ?? 0) < 0);
  const etfBull = etf.length > 0 && etf.every((c) => (finite(c.flow_score) ?? 0) > 0);
  const etfBear = etf.length > 0 && etf.every((c) => (finite(c.flow_score) ?? 0) < 0);
  if (idxBull && etfBear) {
    items.push({
      icon: "⇄",
      accent: "gold",
      label: "Index-vs-ETF split",
      body: "the index options (SPX, NDX) are catching call flow while the ETFs (SPY, QQQ) show put-side hedging — institutions leaning up, hedgers leaning down.",
    });
  } else if (idxBear && etfBull) {
    items.push({
      icon: "⇄",
      accent: "gold",
      label: "Index-vs-ETF split",
      body: "index options (SPX, NDX) show put flow while the ETFs (SPY, QQQ) catch call flow — defensive institutions against dip-buying flow.",
    });
  } else {
    items.push({
      icon: "⇄",
      accent: "gold",
      label: `${lag.symbol} is the biggest drag`,
      body: `most negative contribution (${formatSigned(lag.contribution, 2)}); a flip there would confirm or break the market read.`,
    });
  }

  items.push({
    icon: "◎",
    accent: "hot",
    label: "What flips it",
    body: `${
      bullish
        ? `if ${lag.symbol} flow eases toward zero, expect continuation; a deeper push there is the warning.`
        : `a turn up in ${lead.symbol} call flow would be the first sign the ebb is over.`
    }${shortGamma ? " Short gamma means whichever side wins, it moves faster." : ""}`,
  });

  return { headline, emphasis, shortGamma, items };
}
