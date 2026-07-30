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
  leaders: MarketTideComponent[];
  laggards: MarketTideComponent[];
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
export function formatTimestamp(value: unknown): string {
  if (typeof value !== "string") return "Unavailable";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unavailable";
}
