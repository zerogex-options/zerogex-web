// The GEX heatmap's expiration scope (components/GammaHeatmapCanvas.tsx): the
// request it sends, the flip it may draw, and the DTE it reads out.
//
// The heatmap's Expiry menu used to be a no-op. It appended
// `&expiration=<date>` to /api/gex/heatmap, an endpoint that took no such
// parameter, so FastAPI dropped it and every cell kept summing every
// expiration while the toolbar read "Expiry <date> · DTE 0d". The API now takes
// `expirations` with the /api/gex/strike-profile-timeseries semantics ('all',
// or a sorted, comma-joined set of YYYY-MM-DD dates) and the menu is the
// tab-wide selection every other expiration filter shares
// (hooks/useChartExpirations), whose `param` is exactly that string.
//
// Pure, so the Node test runner can pin it (tests/heatmapExpirations.test.ts).

import { daysToExpiry } from './utils.ts';

/** The API path the heatmap polls. `expirationsParam` is useChartExpirations' `param`. */
export function heatmapRequestPath(args: {
  symbol: string;
  timeframe: string;
  windowUnits: number;
  expirationsParam: string;
}): string {
  const sym = encodeURIComponent(args.symbol);
  return (
    `/api/gex/heatmap?symbol=${sym}&underlying=${sym}` +
    `&timeframe=${encodeURIComponent(args.timeframe)}` +
    `&window_units=${args.windowUnits}` +
    `&expirations=${encodeURIComponent(args.expirationsParam || 'all')}`
  );
}

interface FlipRow {
  gamma_flip?: number | null;
}

function hasFlip(row: FlipRow): boolean {
  return row.gamma_flip != null && Number.isFinite(Number(row.gamma_flip));
}

/**
 * Which rows the heatmap's flip line is drawn from.
 *
 * The heatmap's own buckets come first. Under All they carry the whole-chain
 * flip, and when none of them resolved one the chart falls back to
 * /api/gex/historical's rows, which carry the same whole-chain flip on a
 * separate window.
 *
 * Under an expiration filter the API recomputes each bucket's flip from the
 * selected expirations' strikes and sends null where that set has no flip of
 * its own. /api/gex/historical only knows the whole chain, so falling back to
 * it would draw the whole chain's level over a subset's cells: the
 * contradiction the scoped flip exists to avoid. A filtered heatmap with no
 * flip draws no line.
 */
export function heatmapFlipRows<T extends FlipRow>(
  heatmapRows: readonly T[] | null | undefined,
  historicalRows: readonly T[] | null | undefined,
  filtered: boolean,
): readonly T[] {
  const own = heatmapRows ?? [];
  if (own.some(hasFlip) || filtered) return own;
  return historicalRows ?? [];
}

/**
 * The toolbar's DTE readout for the reconciled selection: "All" when every
 * expiration is in, "0d" for one date, and the range for several ("0–3d").
 */
export function heatmapDteLabel(selection: readonly string[], todayKey: string): string {
  if (selection.length === 0) return 'All';
  const days = selection
    .map((exp) => daysToExpiry(exp, todayKey))
    .filter((d): d is number => d != null && d >= 0);
  if (days.length === 0) return '—';
  const lo = Math.min(...days);
  const hi = Math.max(...days);
  return lo === hi ? `${lo}d` : `${lo}–${hi}d`;
}
