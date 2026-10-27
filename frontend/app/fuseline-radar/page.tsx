'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import PanelSurface from '@/components/layout/Panel';
import { FilterBar, FilterChip, FilterDivider, FilterGroup, FilterToggle } from '@/components/controls/Filters';
import RadarChart, { type LadderRow } from '@/components/fuseline/RadarChart';
import StrikeDrawer from '@/components/fuseline/StrikeDrawer';
import PlanInputs from '@/components/fuseline/PlanInputs';
import { useApiData } from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import { useStrikeProfileTimeseries, type StrikeProfileBucket } from '@/hooks/useStrikeProfileTimeseries';
import { useRadarSettings, type UpdateMode } from '@/hooks/useRadarSettings';
import { etTodayDateKey } from '@/core/utils';
import { safeTimeLabel } from '@/core/flowSeriesCharts';
import {
  CHANGE_WINDOWS,
  ROUTE_ZONE_TEXT,
  anchorCrossed,
  buildTerrain,
  describeBasisSource,
  formatGamma,
  formatSizeDelta,
  formatStrike,
  nextRelevantStrike,
  planLevels,
  planProblems,
  provisionalThreshold,
  rollCandles,
  routeReady,
  routeZone,
  sessionBounds,
  sizeContext,
  strikeChange,
  targetPassed,
  viewRange,
  type ChangeWindow,
  type Instrument,
  type PlanLevels,
  type StrikeChange,
} from '@/core/fuselineRadar';

/**
 * Fuseline Radar: Plus3 Forecasting's trade-centered view of the gamma
 * terrain, Layout A.
 *
 * One trade at a time: a Fuse, a direction, one or two targets. The candles
 * stay a conventional chart; the plan is drawn on them; the ladder to the
 * right shares the price scale and shows, per strike, how big the modeled net
 * gamma is and how it changed over the chosen window. A click opens one
 * strike's history underneath.
 *
 * Price is always live. The gamma terrain updates on the trader's chosen
 * cadence and can be paused for inspection, and the page says plainly which
 * of the two is frozen. A hidden tab polls nothing.
 */

const MODE_MS: Record<UpdateMode, number> = { manual: 0, '1m': 60_000, '5m': 300_000 };
const MODE_TEXT: Record<UpdateMode, string> = { manual: 'Manual', '1m': 'Live, every 1 min', '5m': 'Live, every 5 min' };
/** One-minute buckets fetched per read: the 20-minute window plus slack. */
const TERRAIN_MINUTES = 25;
const CANDLE_MINUTES = 4;
const MIN = 60_000;

interface SummaryWithProjection {
  projection?: {
    basis_ratio?: number | null;
    basis_source?: string | null;
    basis_observed_at?: string | null;
  } | null;
}

function subscribeVisibility(cb: () => void) {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
}

function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== 'hidden', () => true);
}

function useClock(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const timeEt = (ms: number | null) => (ms == null ? '--:--' : safeTimeLabel(new Date(ms).toISOString()));

export default function FuselineRadarPage() {
  const [settings, update] = useRadarSettings();
  const visible = usePageVisible();
  const clock = useClock(30_000);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [refreshedFor, setRefreshedFor] = useState<number | null>(null);

  // ---- The ES/SPX ratio: the API's own, from a projected ES read. ----
  const { data: esSummary } = useApiData<SummaryWithProjection>('/api/gex/summary?symbol=ES', {
    refreshInterval: 60_000,
    enabled: visible,
  });
  const proj = esSummary?.projection;
  const ratio = proj?.basis_ratio && proj.basis_ratio > 0 ? proj.basis_ratio : null;
  const basisSource = describeBasisSource(proj?.basis_source ?? null);
  const esUnavailable = settings.display === 'ES' && ratio == null;
  // Never draw SPX terrain on an ES axis without a ratio: fall back to SPX.
  const display: Instrument = settings.display === 'ES' && ratio != null ? 'ES' : 'SPX';
  const toDisplay = (spx: number) => (display === 'ES' && ratio != null ? spx * ratio : spx);

  // ---- Price: always live, in the display instrument. ----
  const { rows: bars, loading: barsLoading } = useMarketHistorical(display, '1min', false, visible);

  // ---- Terrain: per-strike net gamma, one-minute buckets, on the chosen cadence. ----
  const terrainQ = useApiData<StrikeProfileBucket[]>(
    `/api/gex/strike-profile-timeseries?symbol=SPX&underlying=SPX&timeframe=1min&window_units=${TERRAIN_MINUTES}&expirations=all`,
    { refreshInterval: MODE_MS[settings.mode], enabled: visible && !paused },
  );
  const terrain = useMemo(() => buildTerrain(terrainQ.data), [terrainQ.data]);
  const latestBucket = useMemo(() => {
    const rows = terrainQ.data ?? [];
    let best: StrikeProfileBucket | null = null;
    for (const b of rows) if (!best || Date.parse(b.timestamp) > Date.parse(best.timestamp)) best = b;
    return best;
  }, [terrainQ.data]);
  const nowT = terrain.times.length ? terrain.times[terrain.times.length - 1] : null;
  const ctx = useMemo(() => sizeContext(terrain), [terrain]);
  const threshold = provisionalThreshold(ctx.maxAbs, settings.window);
  const pctFloor = 0.05 * ctx.maxAbs;

  // The 0DTE slice, only while a strike's drawer is open (for its expiry mix).
  const zeroQ = useApiData<StrikeProfileBucket[]>(
    `/api/gex/strike-profile-timeseries?symbol=SPX&underlying=SPX&timeframe=1min&window_units=1&expirations=${etTodayDateKey()}`,
    { refreshInterval: MODE_MS[settings.mode], enabled: selected != null && visible && !paused },
  );
  // The selected strike's session history, five-minute buckets.
  const history = useStrikeProfileTimeseries('SPX', '5min', 'all', paused, selected != null && visible);

  // ---- The session clock and candles. ----
  const lastBarT = bars.length ? Date.parse(bars[bars.length - 1].timestamp) : null;
  const { open, close } = sessionBounds(lastBarT ?? nowT ?? clock);
  const candles = useMemo(() => rollCandles(bars, open, close, CANDLE_MINUTES), [bars, open, close]);
  const lastCandle = candles.length ? candles[candles.length - 1] : null;
  const spot = lastCandle?.c ?? (latestBucket?.close != null ? toDisplay(Number(latestBucket.close)) : null);
  const xFrom = open;
  const xTo = Math.min(close, Math.max(open + 90 * MIN, (lastCandle?.t ?? open) + 30 * MIN));

  // ---- The plan, in display coordinates. ----
  const plan = settings.plan;
  const direction = plan.direction;
  const problems = planProblems(plan);
  const canConvert = plan.instrument === display || ratio != null;
  const levels: PlanLevels = canConvert
    ? planLevels(plan, display, ratio ?? 1)
    : { fuse: null, t1: null, t2: null };
  const route =
    routeReady(plan) && canConvert && spot != null && levels.fuse != null && levels.t1 != null
      ? { fuse: levels.fuse, t1: levels.t1, t2: levels.t2, spot }
      : null;

  // ---- Ladder rows. Cheap enough to rebuild each render: a few hundred strikes. ----
  const rows: LadderRow[] = (() => {
    const out: LadderRow[] = [];
    terrain.byStrike.forEach((series, k) => {
      const c = strikeChange(series, terrain.times, settings.window, threshold, pctFloor);
      if (c.now == null) return;
      const price = display === 'ES' && ratio != null ? k * ratio : k;
      const zone = route ? routeZone(price, route, direction) : null;
      const share = ctx.share.get(k) ?? 0;
      out.push({
        k,
        price,
        label: formatStrike(k, display, ratio ?? 1),
        now: c.now,
        then: c.then,
        state: c.state,
        sizeDelta: c.sizeDelta,
        faded: zone === 'behind' || zone === 'beyond' || share < 0.03,
        next: false,
      });
    });
    out.sort((a, b) => a.price - b.price);
    if (route) {
      const nextK = nextRelevantStrike(
        out.map((r) => ({ k: r.k, price: r.price, share: ctx.share.get(r.k) ?? 0 })),
        route,
        direction,
      );
      for (const r of out) r.next = r.k === nextK;
    }
    return out;
  })();

  // Reference levels from the newest bucket: names live here, change lives in the ladder.
  const refs = (
    [
      ['Gamma flip', latestBucket?.gamma_flip],
      ['Call wall', latestBucket?.call_wall],
      ['Put wall', latestBucket?.put_wall],
      ['Pin', latestBucket?.pin_strike],
    ] as [string, unknown][]
  )
    .map(([name, v]) => ({ name, value: v == null || v === '' ? null : Number(v) }))
    .filter((r): r is { name: string; value: number } => r.value != null && Number.isFinite(r.value))
    .map((r) => ({ name: r.name, price: toDisplay(r.value) }));

  const yRange = viewRange(settings.view, levels, spot ?? rows[Math.floor(rows.length / 2)]?.price ?? 0, direction, settings.widePoints);

  const coordPair = (k: number) =>
    ratio == null
      ? `SPX ${k} strike`
      : display === 'ES'
        ? `ES ${(k * ratio).toFixed(2)} · SPX ${k} strike`
        : `SPX ${k} strike · ES ${(k * ratio).toFixed(2)}`;

  const describeRow = (r: LadderRow) => {
    const word =
      r.state === 'strengthening' ? '▲ strengthening' : r.state === 'weakening' ? '▼ weakening' : r.state === 'steady' ? 'within the threshold' : 'change unavailable';
    const rank = ctx.rank.get(r.k);
    const share = ctx.share.get(r.k) ?? 0;
    const zone = route ? ROUTE_ZONE_TEXT[routeZone(r.price, route, direction)] : null;
    return (
      <>
        <div className="font-semibold">{coordPair(r.k)}</div>
        <div>Modeled net gamma <span className="tabular-nums">{formatGamma(r.now)}</span></div>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          {settings.window} min: {r.sizeDelta != null ? `${formatSizeDelta(r.sizeDelta)} in size, ` : ''}{word}
        </div>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          {rank ? `#${rank} of ${ctx.rank.size} today · ` : ''}{Math.round(share * 100)}% of gross
        </div>
        <div style={{ color: 'var(--color-text-secondary)' }}>{zone ? `${zone} · ` : ''}Click for history</div>
      </>
    );
  };

  // ---- The selected strike's drawer. ----
  const drawer = (() => {
    if (selected == null) return null;
    const series = terrain.byStrike.get(selected);
    const changes = Object.fromEntries(
      CHANGE_WINDOWS.map((w) => [w, strikeChange(series, terrain.times, w, provisionalThreshold(ctx.maxAbs, w), pctFloor)]),
    ) as Record<ChangeWindow, StrikeChange>;
    const now = changes[1].now ?? (series ? series[series.length - 1] : null);
    const price = toDisplay(selected);
    const zeroRow = zeroQ.data?.[zeroQ.data.length - 1]?.strikes?.find((s) => Number(s.strike) === selected);
    let zeroDteShare: number | null = null;
    if (zeroQ.data && now != null) {
      const zero = zeroRow?.net_gamma == null ? 0 : Number(zeroRow.net_gamma);
      const later = now - zero;
      const gross = Math.abs(zero) + Math.abs(later);
      zeroDteShare = gross > 0 ? Math.abs(zero) / gross : null;
    }
    const hist = (history.buckets ?? [])
      .map((b) => {
        const row = b.strikes?.find((s) => Number(s.strike) === selected);
        const v = row?.net_gamma == null ? null : Number(row.net_gamma);
        return { t: Date.parse(b.timestamp), v };
      })
      .filter((p): p is { t: number; v: number } => Number.isFinite(p.t) && p.v != null && Number.isFinite(p.v) && p.t >= open);
    if (now != null && nowT != null && (!hist.length || nowT > hist[hist.length - 1].t)) hist.push({ t: nowT, v: now });
    const rank = ctx.rank.get(selected);
    const share = ctx.share.get(selected) ?? 0;
    const zone = route ? ROUTE_ZONE_TEXT[routeZone(price, route, direction)] : 'No route set';
    const fromSpot = spot != null ? `${price - spot >= 0 ? '+' : ''}${(price - spot).toFixed(2)} pts from spot` : '';
    const subtitle =
      ratio == null
        ? 'ES equivalent unavailable'
        : display === 'ES'
          ? `SPX ${selected} strike × ${ratio.toFixed(5)}`
          : `ES ${(selected * ratio).toFixed(2)} at × ${ratio.toFixed(5)}`;
    return (
      <StrikeDrawer
        title={display === 'ES' && ratio != null ? `ES ${(selected * ratio).toFixed(2)}` : `SPX ${selected}`}
        subtitle={subtitle}
        now={now}
        changes={changes}
        windowMin={settings.window}
        rankText={rank ? `#${rank} of ${ctx.rank.size} strikes · ${Math.round(share * 100)}% of gross` : 'Unavailable'}
        zeroDteShare={zeroDteShare}
        routeText={[zone, fromSpot].filter(Boolean).join(' · ')}
        history={hist}
        nowT={nowT}
        onClose={() => setSelected(null)}
      />
    );
  })();

  // ---- Status lines. ----
  const crossed = route ? anchorCrossed(route.spot, route.fuse, direction) : false;
  const t1Passed = route ? targetPassed(route.spot, route.t1, direction) : false;
  const inSession = clock >= open && clock < close;
  const staleMinutes = nowT != null ? Math.floor((clock - nowT) / MIN) : null;
  const stale = !paused && inSession && staleMinutes != null && staleMinutes >= 5;
  const noNewObservation = refreshedFor != null && !terrainQ.loading && nowT === refreshedFor;
  const basisWhen = proj?.basis_observed_at ? timeEt(Date.parse(proj.basis_observed_at)) : null;

  const coordLine = (() => {
    if (esUnavailable) return 'The ES/SPX ratio is unavailable right now, so the radar is showing SPX. Your plan is unchanged.';
    if (ratio == null) return 'Showing SPX.';
    const how = `× ${ratio.toFixed(5)} (${basisSource.text}${basisWhen ? `, ${basisWhen} ET` : ''})`;
    if (display === 'ES') return `Gamma terrain is SPX-derived, carried to ES at ${how}. Your plan levels are shown as entered.`;
    return plan.instrument === 'ES'
      ? `Your ES plan is shown in SPX at ÷ ${ratio.toFixed(5)} (${basisSource.text}). Nothing needs re-entering.`
      : 'Showing SPX, the terrain’s own coordinates.';
  })();

  return (
    <PageShell>
      <PageHeader
        title="Fuseline Radar"
        beta
        sub={
          <>
            Your trade&rsquo;s route through modeled gamma: the Fuse, your targets, and how the terrain along the way is
            changing. Concept by Plus3 Forecasting.
          </>
        }
        tooltip="Enter a Fuse, a direction and one or two targets. The ladder beside the chart shows each strike's modeled net gamma on the chart's own price scale: blue positive, amber negative, the outline where it stood at the start of the change window. Purple marks your plan. Click a strike for its history. Modeled from open interest, so intraday change is the book repricing as price, time and volatility move, not positions opening or closing."
      />

      <PanelSurface className="mt-6">
        <div className="flex flex-col gap-3">
          <PlanInputs plan={plan} ratio={ratio} onChange={(p) => update({ plan: p })} />
          <FilterBar>
            <FilterGroup label="Show">
              {(['ES', 'SPX'] as const).map((i) => (
                <FilterChip key={i} active={settings.display === i} onClick={() => update({ display: i })}>{i}</FilterChip>
              ))}
            </FilterGroup>
            <FilterDivider />
            <FilterGroup label="View">
              <FilterChip active={settings.view === 'AB'} onClick={() => update({ view: 'AB' })}>A to B</FilterChip>
              <FilterChip active={settings.view === 'ABC'} onClick={() => update({ view: 'ABC' })}>A to B to C</FilterChip>
              <FilterChip active={settings.view === 'WIDE'} onClick={() => update({ view: 'WIDE' })}>Wide</FilterChip>
              {settings.view === 'WIDE' && (
                <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <input
                    id="fr-wide"
                    type="number"
                    min={10}
                    max={1000}
                    step={10}
                    value={settings.widePoints}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n >= 10 && n <= 1000) update({ widePoints: n });
                    }}
                    className="w-16 rounded-md border px-1.5 py-0.5 text-xs tabular-nums max-sm:text-base"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'transparent', color: 'var(--color-text-primary)' }}
                  />
                  pts
                </label>
              )}
            </FilterGroup>
            <FilterDivider />
            <FilterGroup label="Change over">
              {CHANGE_WINDOWS.map((w) => (
                <FilterChip key={w} active={settings.window === w} onClick={() => update({ window: w })}>{w} min</FilterChip>
              ))}
            </FilterGroup>
            <FilterDivider />
            <FilterToggle active={settings.showReference} onChange={(v) => update({ showReference: v })}>Reference levels</FilterToggle>
            <FilterToggle active={settings.showLadder} onChange={(v) => update({ showLadder: v })}>Ladder</FilterToggle>
          </FilterBar>
          <p className="text-xs" style={{ color: esUnavailable || (ratio != null && basisSource.flag) ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
            {coordLine}
          </p>
          {problems.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{problems.join(' ')}</p>
          )}
          {route && crossed && (
            <p className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>
              Anchor crossed: spot is on the other side of the Fuse from your {direction} route. Route under review.
            </p>
          )}
          {route && !crossed && t1Passed && (
            <p className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
              Target 1 passed. {levels.t2 != null ? 'The remaining route runs to Target 2.' : 'No Target 2 is set.'}
            </p>
          )}
        </div>
      </PanelSurface>

      <div
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-2.5 text-xs"
        style={{ borderColor: paused || stale ? 'var(--color-warning)' : 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
        aria-label="Freshness"
      >
        <span>
          {paused ? (
            <><strong style={{ color: 'var(--color-warning)' }}>Paused</strong> · gamma frozen at {timeEt(nowT)} ET · chart price stays live</>
          ) : (
            <><strong style={{ color: 'var(--color-text-primary)' }}>{MODE_TEXT[settings.mode]}</strong> · gamma as of {timeEt(nowT)} ET</>
          )}
          {stale && <span style={{ color: 'var(--color-warning)' }}> · {staleMinutes} min old</span>}
        </span>
        <FilterGroup>
          {(['manual', '1m', '5m'] as const).map((m) => (
            <FilterChip key={m} active={settings.mode === m} onClick={() => update({ mode: m })}>
              {m === 'manual' ? 'Manual' : m === '1m' ? 'Every 1 min' : 'Every 5 min'}
            </FilterChip>
          ))}
        </FilterGroup>
        <button
          type="button"
          onClick={() => { setRefreshedFor(nowT); if (paused) setPaused(false); terrainQ.refetch(); }}
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ borderColor: 'var(--border-default)', color: 'var(--color-text-primary)' }}
        >
          Refresh now
        </button>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ borderColor: paused ? 'var(--color-warning)' : 'var(--border-default)', color: 'var(--color-text-primary)' }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        {noNewObservation && <span>No new reading since {timeEt(nowT)} ET.</span>}
        {terrainQ.error && <span style={{ color: 'var(--color-warning)' }}>Gamma data unavailable: {terrainQ.error}</span>}
      </div>

      <PanelSurface className="mt-4">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          <span><i className="mr-1.5 inline-block h-2 w-3 rounded-sm align-[-1px]" style={{ backgroundColor: 'var(--color-gamma-pos)' }} />Positive gamma</span>
          <span><i className="mr-1.5 inline-block h-2 w-3 rounded-sm align-[-1px]" style={{ backgroundColor: 'var(--color-gamma-neg)' }} />Negative gamma</span>
          <span><i className="mr-1.5 inline-block h-2 w-3 rounded-sm border align-[-1px]" style={{ borderColor: 'var(--color-text-secondary)' }} />{settings.window} min ago</span>
          <span>▲▼ strengthening / weakening</span>
          <span><i className="mr-1.5 inline-block h-0.5 w-3.5 align-[3px]" style={{ backgroundColor: 'var(--color-king)' }} />Your plan</span>
          {settings.showReference && <span>Dotted: reference levels</span>}
          <span>{CANDLE_MINUTES}-min candles · {display}</span>
        </div>
        {!lastCandle && !barsLoading && !terrainQ.loading ? (
          <p className="py-10 text-center text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
            No regular-session bars yet. The radar fills in from 09:30 ET.
          </p>
        ) : (
          <RadarChart
            candles={candles}
            xFrom={xFrom}
            xTo={xTo}
            nowT={nowT}
            candleMinutes={CANDLE_MINUTES}
            yRange={yRange}
            levels={levels}
            spot={spot}
            refs={settings.showReference ? refs : []}
            rows={rows}
            maxAbs={ctx.maxAbs}
            showLadder={settings.showLadder}
            windowMin={settings.window}
            display={display}
            selected={selected}
            onSelect={setSelected}
            describeRow={describeRow}
          />
        )}
      </PanelSurface>

      {drawer}

      <div className="mt-4 flex flex-col gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <p>
          Gamma is modeled from open interest, which updates once a day. Intraday strengthening or weakening is the
          same book repricing as price, time and volatility move, mostly as price moves nearer to or farther from a
          strike. It is not positions opening or closing, and a large concentration does not guarantee a pin or a
          reaction. Nothing here is a trade recommendation.
        </p>
        <p>
          The change threshold and the next-strike marker are provisional until the adjustable lens is built. Sizes are
          ranked against every tracked strike today, so zooming or moving a target never changes them.
        </p>
        <p>Concept and product specification: Plus3 Forecasting.</p>
      </div>
    </PageShell>
  );
}
