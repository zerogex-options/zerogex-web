// The /api/gex/summary payload and the formatting the public pages apply to it.
//
// Shared by the free gamma-levels pages (app/spx-gamma-levels/gammaLevels.tsx)
// and the education pages that now quote the same delayed reading
// (app/education/spx-net-gamma-exposure-today), so a level is never printed
// two different ways on two pages that Google may show side by side. Pure
// module — no server-only import — so the formatters are safe anywhere.

export interface GexSummary {
  timestamp: string;
  symbol: string;
  spot_price: number;
  total_call_gex: number;
  total_put_gex: number;
  net_gex: number;
  net_gex_at_spot?: number | null;
  gamma_flip?: number | null;
  max_pain?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  put_call_ratio?: number | null;
  // Pin Strike — reachable 0DTE strike with the strongest modeled positive
  // (restoring) dealer gamma into expiration. Null when no meaningful pin.
  pin_strike?: number | null;
  pin_score?: number | null;
  pin_confidence?: number | null;
  pin_strike_reason?: string | null;
}

/** Index/ETF price convention: whole numbers at four figures, else two decimals. */
export function fmtPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return value.toFixed(0);
  return value.toFixed(2);
}

/** Signed dollar-gamma magnitude: +$1.23B, −$850.0M, +$12K. */
export function fmtNetGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '−';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** "Sep 4, 2026, 3:45 PM EDT" — the snapshot clock every public page prints. */
export function fmtTimestampET(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}

/** "a, b, and c" — for the prose sentences that list whichever levels exist. */
export function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * "The call wall is at 5850, the put wall is at 5790, and max pain is at 5800."
 * — whichever of the three the snapshot carries, as one quotable sentence, or
 * '' when it has none. Each clause keeps its own verb so any subset still reads.
 */
export function levelsSentence(data: Pick<GexSummary, 'call_wall' | 'put_wall' | 'max_pain'>): string {
  const parts: string[] = [];
  if (data.call_wall != null) parts.push(`the call wall is at ${fmtPrice(data.call_wall)}`);
  if (data.put_wall != null) parts.push(`the put wall is at ${fmtPrice(data.put_wall)}`);
  if (data.max_pain != null) parts.push(`max pain is at ${fmtPrice(data.max_pain)}`);
  if (parts.length === 0) return '';
  const joined = joinList(parts);
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
}
