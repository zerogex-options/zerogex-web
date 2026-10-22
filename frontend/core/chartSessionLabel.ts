/**
 * The Gamma Chart header's session chip, for the market session the quote
 * reports (MarketSession in core/types.ts).
 *
 * The chart used to match only "pre"/"premarket" and "ah"/"afterhours"/"post",
 * while the API sends "pre-market" and "after-hours", so extended hours fell
 * through to a gray chip spelling the raw value. Every session the API sends
 * is listed here. Extended hours and the futures swap take the coral the rest
 * of the app uses for session badges (components/SessionBadge.tsx); amber on
 * this chart means delayed data, which extended hours are not.
 */

export interface ChartSessionChip {
  label: string;
  color: string;
}

const CORAL = 'var(--color-brand-coral)';

export function chartSessionLabel(session: string | null | undefined): ChartSessionChip | null {
  if (!session) return null;
  const s = session.toLowerCase();
  if (s === 'open' || s === 'regular') return { label: '● LIVE', color: 'var(--color-bull)' };
  if (s === 'pre-market' || s === 'pre' || s === 'premarket') return { label: '○ PRE-MARKET', color: CORAL };
  if (s === 'after-hours' || s === 'ah' || s === 'afterhours' || s === 'post') {
    return { label: '○ AFTER HOURS', color: CORAL };
  }
  if (s === 'closed' || s === 'closed-weekend' || s === 'closed-holiday') {
    return { label: 'CLOSED', color: 'var(--text-muted)' };
  }
  if (s === 'futures') return { label: '◆ FUTURES', color: CORAL };
  if (s === 'halted') return { label: '▲ HALTED', color: 'var(--color-warning)' };
  return { label: session.toUpperCase(), color: 'var(--text-secondary)' };
}
