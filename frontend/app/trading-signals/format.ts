/**
 * Shared formatters used across the TradeWorkz dashboard. Centralized so a
 * value shown in the leaderboard reads identically in the drilldown, hover
 * tooltips, and CSV export (if we ever add one).
 */

export function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  // Two consistent branches: `$X.XXM` at or above $1,000,000, `$X.XXK`
  // everywhere below. Two decimals everywhere, so the same number reads
  // the same across NAV, P&L, and trade rows.
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}$${(abs / 1_000).toFixed(2)}K`;
}

export function fmtMoneyFull(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtSignedPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

export function fmtSignedMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const base = fmtMoney(Math.abs(value));
  return value >= 0 ? `+${base}` : `-${base}`;
}

export function fmtCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export function fmtRatio(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return (
    d.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
    }) +
    ' ' +
    d.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  );
}

/** Signed tone for a P&L number → CSS variable name. */
export function toneVar(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'var(--color-text-secondary)';
  }
  if (value > 0) return 'var(--color-bull)';
  if (value < 0) return 'var(--color-bear)';
  return 'var(--color-text-secondary)';
}
