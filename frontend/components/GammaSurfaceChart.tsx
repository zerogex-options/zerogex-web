'use client';

/**
 * Gamma Surface — net dealer gamma across price (x) and time to settlement
 * (y), drawn as a 3D wireframe, with the ceiling (Call Wall), spot and floor
 * (Put Wall) laid on the floor of the scene and read out beside it.
 *
 * The surface is /api/gex/gamma-surface (see core/gammaSurface). It renders
 * by expiration: "All" by default, or any set picked in the Expiry control.
 * The selection is the chart's own — it opens on All every time — except
 * inside a My Dashboard pane that scopes its expirations, where it follows the
 * pane like every other widget there.
 *
 * The ceiling and floor are the walls every other chart draws for the same
 * selection — the whole-chain walls from /api/gex/summary for All, the
 * expiration-filtered strike-profile bucket for a subset (the same precedence
 * as the Gamma Chart's Playbook) — so the two can never disagree.
 */

import { useContext, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Info } from 'lucide-react';
import ExpandableCard, { useExpandedCard } from './ExpandableCard';
import ExpirationMultiSelect from './ExpirationMultiSelect';
import TooltipWrapper from './TooltipWrapper';
import ChartCaption from './ChartCaption';
import LoadingSpinner from './LoadingSpinner';
import { useMeasuredWidth } from './useMeasuredWidth';
import type { GammaSurfaceLevelLine } from './GammaSurfacePlot';
import { useTheme } from '@/core/ThemeContext';
import { useInDashboardWidget } from '@/core/dashboardWidget';
import { ExpirationScopeContext } from '@/core/expirationScope';
import { normalizeExpirations, reconcileExpirations } from '@/core/expirationPersistence';
import { expirationsParam } from '@/core/gexStrikeCharts';
import { GEX_UNIT_LABEL, gexScaleFactor, useGexUnit } from '@/core/GexUnitContext';
import { levelOrNull } from '@/core/levelValue';
import { etTodayDateKey } from '@/core/utils';
import {
  colorLimit,
  extremeAtPrice,
  formatGexDollars,
  formatGexTick,
  formatLevel,
  niceTicks,
  scaleProfiles,
  surfaceHours,
  surfaceTimeLabel,
  surfaceTimeTicks,
  traceAtPrice,
  zAxisRange,
} from '@/core/gammaSurface';
import { useApiData, useGammaSurface, useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import { lastGammaBucket } from '@/hooks/useGammaPlaybook';
import { useStrikeProfileTimeseries } from '@/hooks/useStrikeProfileTimeseries';
import { useZeroDteOption } from '@/hooks/useZeroDteOption';
import { useCoarsePointer } from '@/hooks/useIsMobile';

// plotly.js is heavy and not SSR-safe — load the 3D plot on the client only.
const GammaSurfacePlot = dynamic(() => import('./GammaSurfacePlot'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner />
    </div>
  ),
});

const TITLE_TOOLTIP =
  'Modeled net dealer gamma for the selected expirations, re-priced at every price and at every moment from now until the first selected expiration settles. Each point answers: if price is here at that time, how much gamma are dealers modeled to carry? Peaks are long gamma, where modeled hedging tends to dampen moves; troughs are short gamma, where it tends to amplify them. Same-day gamma sharpens into its settlement, so 0DTE walls rise toward the end of the time axis. Every contract counts at full weight (no horizon weighting), with its implied vol held where it is now. The lines along the base mark the ceiling (Call Wall), spot and floor (Put Wall) for the same selection - the usual reading of the walls, not a guarantee that price stops there - and the dashed line traces the surface at spot. Drag to rotate. Modeled from open interest, not observed positions.';

// Card widths (CSS px) below which the readout moves above the plot and the
// scene switches to its compact camera.
const SIDE_PANEL_MIN_WIDTH = 640;
const COMPACT_MAX_WIDTH = 520;

const PLOT_HEIGHT = 520;
const PLOT_HEIGHT_COMPACT = 340;
const PLOT_HEIGHT_MIN = 240;
const PLOT_HEIGHT_EXPANDED = 680;

// Level hues, following the reference look: a gold ceiling, the spot in the
// text color, a green floor.
const CEILING_COLOR = 'var(--color-warning)';
const SPOT_COLOR = 'var(--text-primary)';
const FLOOR_COLOR = 'var(--color-bull)';

const PALETTE_VARS = {
  ceiling: CEILING_COLOR,
  spot: SPOT_COLOR,
  floor: FLOOR_COLOR,
  text: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  grid: 'var(--border-default)',
  hoverBg: 'var(--color-chart-tooltip-bg)',
  hoverBorder: 'var(--border-default)',
} as const;

type ResolvedPalette = Record<keyof typeof PALETTE_VARS, string>;

const FALLBACK_PALETTE: ResolvedPalette = {
  ceiling: '#F59E0B',
  spot: '#E2E8F0',
  floor: '#22D982',
  text: '#E2E8F0',
  muted: '#94A3B8',
  grid: 'rgba(148,163,184,0.25)',
  hoverBg: '#0F172A',
  hoverBorder: '#334155',
};

// WebGL takes literal colors, not CSS custom properties: resolve each token
// through a probe element, which follows var() chains and any color syntax.
function resolvePalette(): ResolvedPalette {
  if (typeof document === 'undefined') return FALLBACK_PALETTE;
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const out = { ...FALLBACK_PALETTE };
  for (const key of Object.keys(PALETTE_VARS) as (keyof ResolvedPalette)[]) {
    probe.style.color = '';
    probe.style.color = PALETTE_VARS[key];
    const resolved = getComputedStyle(probe).color;
    if (resolved) out[key] = resolved;
  }
  probe.remove();
  return out;
}

function usePlotPalette(): ResolvedPalette {
  const { theme, palette } = useTheme();
  const [colors, setColors] = useState<ResolvedPalette>(FALLBACK_PALETTE);
  useEffect(() => {
    // A frame after a theme / palette switch, once the root's variables flip.
    const raf = requestAnimationFrame(() => setColors(resolvePalette()));
    return () => cancelAnimationFrame(raf);
  }, [theme, palette]);
  return colors;
}

interface GammaSurfaceChartProps {
  symbol: string;
}

export default function GammaSurfaceChart({ symbol }: GammaSurfaceChartProps) {
  // The chart's own expiration pick (All until changed) lives above the card,
  // so the page view and the expanded view show the same selection.
  const [ownSelection, setOwnSelection] = useState<string[]>([]);
  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <GammaSurfaceCard symbol={symbol} ownSelection={ownSelection} onOwnSelectionChange={setOwnSelection} />
    </ExpandableCard>
  );
}

// The card body. Rendered INSIDE ExpandableCard, which is what lets it read
// useExpandedCard() — the flag is provided to the card's children, not to the
// component that renders the card.
function GammaSurfaceCard({
  symbol,
  ownSelection,
  onOwnSelectionChange,
}: GammaSurfaceChartProps & {
  ownSelection: string[];
  onOwnSelectionChange: (next: string[]) => void;
}) {
  const expanded = useExpandedCard();
  // A dashboard tile drops the card's Expand button (core/dashboardWidget).
  const inWidget = useInDashboardWidget();
  const coarse = useCoarsePointer();
  const colors = usePlotPalette();
  const { gexUnit } = useGexUnit();
  const [measureRef, cardWidth] = useMeasuredWidth<HTMLDivElement>();
  // A 3D scene takes every touch on it (a vertical swipe rotates the surface
  // instead of scrolling the page), so on a touch screen it stays inert until
  // asked — the Premium Surface's pattern.
  const [touchActive, setTouchActive] = useState(false);

  // ── Expiration selection: All by default ──
  const todayKey = etTodayDateKey();
  const paneScope = useContext(ExpirationScopeContext);
  const rawSelection = paneScope ? paneScope.selection : ownSelection;
  const setSelection = (next: readonly string[]) =>
    paneScope ? paneScope.setSelection(next) : onOwnSelectionChange(normalizeExpirations(next));

  const { data: expirationList } = useApiData<string[] | null>(
    `/api/gex/expirations?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}&lookback_hours=168`,
    { refreshInterval: 60000 },
  );
  const available = useMemo(() => {
    const list = Array.isArray(expirationList) ? expirationList : [];
    return Array.from(
      new Set(list.filter((e): e is string => typeof e === 'string' && e >= todayKey)),
    ).sort();
  }, [expirationList, todayKey]);
  const selection = useMemo(
    () => reconcileExpirations(rawSelection, available, todayKey),
    [rawSelection, available, todayKey],
  );
  const param = expirationsParam(selection);
  const filtered = selection.length > 0;
  // The rolling 0DTE row only means something where the selection persists —
  // a dashboard pane. Here it would have nothing to roll into.
  const zeroDte = useZeroDteOption(available, todayKey);

  // ── Data ──
  const { data: surface, loading, error, errorStatus } = useGammaSurface(symbol, param);
  const { data: quote } = useMarketQuote(symbol, 1000);
  const { data: summary } = useGEXSummary(symbol, 30000, !filtered);
  const { buckets } = useStrikeProfileTimeseries(symbol, '5min', param, false, filtered);

  const filteredBucket = useMemo(() => (filtered ? lastGammaBucket(buckets) : null), [filtered, buckets]);
  // A subset's walls come from its own bucket and nothing else: until it
  // lands, no line — never the whole chain's walls under a subset's label.
  const ceiling = filtered ? levelOrNull(filteredBucket?.call_wall) : levelOrNull(summary?.call_wall);
  const floor = filtered ? levelOrNull(filteredBucket?.put_wall) : levelOrNull(summary?.put_wall);
  const spot = levelOrNull(quote?.close) ?? levelOrNull(surface?.spot);

  const narrow = cardWidth != null && cardWidth < SIDE_PANEL_MIN_WIDTH;
  const compact = cardWidth != null && cardWidth < COMPACT_MAX_WIDTH;
  // A narrow card's scene is as wide as the card and no taller, so its box
  // shrinks with the width instead of framing it in empty space.
  const plotHeight = expanded
    ? PLOT_HEIGHT_EXPANDED
    : compact && cardWidth != null
      ? Math.round(Math.min(PLOT_HEIGHT_COMPACT, Math.max(PLOT_HEIGHT_MIN, cardWidth * 0.85)))
      : PLOT_HEIGHT;

  // ── The plot's inputs ──
  const unitFactor = gexScaleFactor(gexUnit, surface?.spot);
  const model = useMemo(() => {
    if (!surface || !Array.isArray(surface.grid) || surface.grid.length < 2) return null;
    if (!Array.isArray(surface.profiles) || surface.profiles.length === 0) return null;
    const grid = surface.grid;
    const hours = surfaceHours(surface.times_days);
    const z = scaleProfiles(surface.profiles, unitFactor);
    const zRange = zAxisRange(z);
    const zTickValues = niceTicks(zRange[0], zRange[1], 5);
    const unitShort = gexUnit === 'point' ? '/ pt' : '/ 1%';
    const rowLabels = hours.map((h) => surfaceTimeLabel(surface.timestamp, h));
    const priceLabels = grid.map((p) => formatLevel(p));
    const hoverText = z.map((row, i) =>
      row.map(
        (v, j) => `${rowLabels[i]}<br>Price ${priceLabels[j]}<br>Net GEX ${formatGexDollars(v)} ${unitShort}`,
      ),
    );
    return {
      grid,
      hours,
      z,
      zRange,
      zTicks: { values: zTickValues, labels: zTickValues.map((v) => formatGexTick(v, zTickValues)) },
      colorLimit: colorLimit(z),
      hoverText,
      spanHours: hours[hours.length - 1] ?? 0,
    };
  }, [surface, unitFactor, gexUnit]);

  const timeTicks = useMemo(
    () => (model && surface ? surfaceTimeTicks(surface.timestamp, model.spanHours, compact ? 4 : 6) : null),
    [model, surface, compact],
  );

  const levels = useMemo<GammaSurfaceLevelLine[]>(() => {
    if (!model) return [];
    const out: GammaSurfaceLevelLine[] = [];
    if (onGrid(model.grid, floor)) {
      const trough = extremeAtPrice(model.grid, model.z, floor, 'min');
      out.push({
        price: floor,
        color: colors.floor,
        label: `Floor · Put Wall ${formatLevel(floor)}`,
        drop: trough && trough.value < 0 ? trough : null,
      });
    }
    if (onGrid(model.grid, spot)) {
      out.push({ price: spot, color: colors.spot, label: `Spot ${formatLevel(spot)}` });
    }
    if (onGrid(model.grid, ceiling)) {
      const peak = extremeAtPrice(model.grid, model.z, ceiling, 'max');
      out.push({
        price: ceiling,
        color: colors.ceiling,
        label: `Ceiling · Call Wall ${formatLevel(ceiling)}`,
        drop: peak && peak.value > 0 ? peak : null,
      });
    }
    return out;
  }, [model, floor, spot, ceiling, colors]);

  const spotTrace = useMemo(() => {
    if (!model || !onGrid(model.grid, spot)) return null;
    const trace = traceAtPrice(model.grid, model.z, spot);
    return trace ? { price: spot, z: trace, color: colors.spot } : null;
  }, [model, spot, colors]);

  const plotColors = useMemo(
    () => ({
      text: colors.text,
      muted: colors.muted,
      grid: colors.grid,
      hoverBg: colors.hoverBg,
      hoverBorder: colors.hoverBorder,
    }),
    [colors],
  );

  const zTitle = `Net GEX (${GEX_UNIT_LABEL[gexUnit]})`;
  const scopeLine = describeScope(surface, filtered);
  const plotInert = coarse && !expanded && !touchActive;

  const readout = [
    { key: 'ceiling', value: ceiling, label: 'Ceiling', detail: 'Call Wall', color: CEILING_COLOR },
    { key: 'spot', value: spot, label: 'Spot', detail: null, color: SPOT_COLOR },
    { key: 'floor', value: floor, label: 'Floor', detail: 'Put Wall', color: FLOOR_COLOR },
  ];

  return (
    <div
      ref={measureRef}
      className="rounded-2xl p-4 sm:p-6 h-full flex flex-col"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="zg-h3" style={{ color: 'var(--text-primary)' }}>
            Gamma Surface
          </h3>
          <TooltipWrapper text={TITLE_TOOLTIP}>
            <Info size={14} />
          </TooltipWrapper>
        </div>
        {/* Clear of the card's top-right Expand button, where there is one. */}
        <div className={expanded || inWidget ? '' : 'mr-9'}>
          <ExpirationMultiSelect
            options={available}
            selected={selection}
            onChange={setSelection}
            label="Expiry"
            disabled={available.length === 0}
            zeroDte={paneScope ? zeroDte : undefined}
          />
        </div>
      </div>
      <p className="mt-1 mb-3 text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
        {scopeLine}
      </p>

      {error && !surface ? (
        <div
          className="flex items-center justify-center text-center text-sm px-6"
          style={{ height: plotHeight, color: errorStatus === 404 ? 'var(--text-secondary)' : 'var(--color-bear)' }}
        >
          {errorStatus === 404
            ? filtered
              ? `${error}. The selected expiration may have already settled - pick another, or All.`
              : `No surface for ${symbol} right now: ${error}.`
            : `Could not load the gamma surface: ${error}`}
        </div>
      ) : loading && !surface ? (
        <div className="flex items-center justify-center" style={{ height: plotHeight }}>
          <LoadingSpinner />
        </div>
      ) : !model || !timeTicks ? (
        <div
          className="flex items-center justify-center text-sm"
          style={{ height: plotHeight, color: 'var(--text-secondary)' }}
        >
          No gamma surface available for {symbol}.
        </div>
      ) : (
        <div className={narrow ? 'flex flex-col gap-3' : 'grid grid-cols-[minmax(0,1fr)_150px] gap-4 items-center'}>
          {narrow && <LevelReadout items={readout} row />}
          <div className="relative min-w-0">
            <div style={{ pointerEvents: plotInert ? 'none' : 'auto' }}>
              <div style={{ height: plotHeight }}>
                <GammaSurfacePlot
                  grid={model.grid}
                  hours={model.hours}
                  z={model.z}
                  hoverText={model.hoverText}
                  timeTicks={timeTicks}
                  zRange={model.zRange}
                  zTicks={model.zTicks}
                  colorLimit={model.colorLimit}
                  zTitle={zTitle}
                  levels={levels}
                  spotTrace={spotTrace}
                  colors={plotColors}
                  height={plotHeight}
                  compact={compact}
                  scrollZoom={expanded}
                />
              </div>
            </div>
            {coarse && !expanded && (
              <button
                type="button"
                onClick={() => setTouchActive((v) => !v)}
                aria-pressed={touchActive}
                className="absolute right-0 top-0 min-h-8 rounded-full border px-3 text-xs font-semibold"
                style={{
                  borderColor: touchActive ? 'var(--color-warning)' : 'var(--border-default)',
                  backgroundColor: touchActive ? 'var(--color-warning-soft)' : 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }}
              >
                {touchActive ? 'Done' : 'Rotate & zoom'}
              </button>
            )}
          </div>
          {!narrow && <LevelReadout items={readout} />}
        </div>
      )}

      {surface?.timestamp && (
        <div className="mt-3 text-right text-[11px] shrink-0" style={{ color: 'var(--text-secondary)' }}>
          Snapshot: {new Date(surface.timestamp).toLocaleTimeString()}
        </div>
      )}
      <ChartCaption />
    </div>
  );
}

/** True when a level lies inside the surface's price range (so it can be drawn). */
function onGrid(grid: readonly number[], price: number | null): price is number {
  return price != null && grid.length > 0 && price >= grid[0] && price <= grid[grid.length - 1];
}

/** "All expirations · now → Wed 4:00 PM ET, when Oct 14 settles". */
function describeScope(
  surface: { expirations?: string[]; settling_expiration?: string; settles_at?: string; timestamp?: string } | null,
  filtered: boolean,
): string {
  if (!surface?.settles_at || !surface.timestamp || !surface.settling_expiration) {
    return filtered ? 'Selected expirations' : 'All expirations';
  }
  const count = surface.expirations?.length ?? 0;
  const which = filtered
    ? count === 1
      ? `${shortDate(surface.settling_expiration)} expiration`
      : `${count} expirations`
    : `All expirations (${count})`;
  const hours = (Date.parse(surface.settles_at) - Date.parse(surface.timestamp)) / 3_600_000;
  const end = surfaceTimeLabel(surface.timestamp, Number.isFinite(hours) ? hours : 0);
  return `${which} · now → ${end}, when ${shortDate(surface.settling_expiration)} settles`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Ceiling / spot / floor: a column beside the plot, or a row above it on a
 *  narrow card, where the wall name drops to its own line instead of
 *  truncating. */
function LevelReadout({
  items,
  row = false,
}: {
  items: { key: string; value: number | null; label: string; detail: string | null; color: string }[];
  row?: boolean;
}) {
  return (
    <div className={row ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-6'}>
      {items.map((item) => (
        <div key={item.key} className="min-w-0">
          <div
            className={`font-bold tabular-nums leading-none ${row ? 'text-lg' : 'text-3xl'}`}
            style={{ color: item.color }}
          >
            {formatLevel(item.value)}
          </div>
          <div className="mt-1 text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>
            {row ? (
              <>
                <div>{item.label}</div>
                {item.detail && <div>{item.detail}</div>}
              </>
            ) : item.detail ? (
              `${item.label} · ${item.detail}`
            ) : (
              item.label
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
