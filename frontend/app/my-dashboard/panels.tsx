'use client';

/**
 * Panel widgets for the customizable dashboard. Thin wrappers that reuse the
 * site's existing feature components — either self-contained (they read the
 * active symbol from context and fetch their own data) or handed the one prop
 * they need (symbol / theme / a context-derived model).
 */

import { useMemo } from 'react';
import { Gauge, ListOrdered } from 'lucide-react';

import MarketMakerExposures from '@/components/MarketMakerExposures';
import ProprietarySignalsSynthesis from '@/components/ProprietarySignalsSynthesis';
import VolatilityCard from '@/components/VolatilityCard';
import TradeBiasSection from '@/components/TradeBiasSection';
import UnderlyingCandlesChart from '@/components/UnderlyingCandlesChart';
import GammaTerminalChart from '@/components/GammaTerminalChart';
import GammaPulsePanel from '@/components/GammaPulsePanel';
import GexProfileChart from '@/components/GexProfileChart';
import GexWallsChart from '@/components/GexWallsChart';
import GammaHeatmapCanvas from '@/components/GammaHeatmapCanvas';
import GexUnitToggle from '@/components/GexUnitToggle';
import StrikeFilterToggle from '@/components/StrikeFilterToggle';
import SessionDeltaToggle from '@/components/SessionDeltaToggle';
import ExpirationMultiSelect from '@/components/ExpirationMultiSelect';
import { GammaLadder } from '@/components/PairGammaHeatmap';
import OptionsFlowChart from '@/components/OptionsFlowChart';
import SignalScorePanel from '@/components/SignalScorePanel';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import ConfluenceMatrix from '@/components/ConfluenceMatrix';
import MsiGauge from '@/components/MsiGauge';
import TodaysReadCard from '@/components/TodaysReadCard';
import WorldClocks from '@/components/WorldClocks';
import HeadlinesWire from '@/components/HeadlinesWire';

import { useTimeframe } from '@/core/TimeframeContext';
import { useGexUnit } from '@/core/GexUnitContext';
import { useStrikeFilter } from '@/core/StrikeFilterContext';
import { useSessionDelta } from '@/core/SessionDeltaContext';
import { getMarketSession, etTodayDateKey } from '@/core/utils';
import {
  useApiData,
  useBasicConfluenceMatrix,
  useGEXByStrike,
  useGEXSummary,
  useMarketQuote,
  type SignalEventName,
} from '@/hooks/useApiData';
import { useGammaLadderColumn } from '@/hooks/useGammaLadder';
import { useChartExpirations } from '@/hooks/useChartExpirations';
import { useStrikeProfileTimeseries } from '@/hooks/useStrikeProfileTimeseries';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { reconcileExpirations } from '@/core/expirationPersistence';
import { buildReportModel } from '@/app/live-bulletin/bulletinHelpers';
import { usePageT } from '@/core/LanguageContext';
import {
  chartExpirationOptions as deriveChartExpirationOptions,
  chartStrikeData as deriveChartStrikeData,
  expirationsParam,
  normalizeOpenInterestPayload,
  openInterestRows,
  openInterestSpotPrice,
  perExpirationStrikeData as derivePerExpirationStrikeData,
  strikeExpirationOptions,
  toProfileStrikeData,
  type OpenInterestApiResponse,
} from '@/core/gexStrikeCharts';

import { WidgetCard } from './primitives';
import { useMyDashboardData } from './DashboardData';
import { dict } from './panels.i18n';

// ── Overview ──────────────────────────────────────────────────────────────

export function TodaysReadPanel() {
  const { symbol, gex, quote, sessionCloses, vol, volIndex } = useMyDashboardData();
  const model = useMemo(
    () =>
      buildReportModel({
        symbol,
        spot: quote?.close ?? gex?.spot_price ?? null,
        priorClose: sessionCloses?.current_session_close ?? null,
        summary: gex ?? null,
        vix: vol?.index ?? null,
        volIndex,
        horizon: 'daily',
      }),
    [symbol, quote?.close, gex, sessionCloses?.current_session_close, vol?.index, volIndex],
  );
  return <TodaysReadCard model={model} />;
}

export function DealerExposuresPanel() {
  // Full (non-compact) view: candle + gamma + open-interest/positions panels,
  // matching /gex-strike-profile. It carries its own bordered card + title bar
  // and fullscreen control, so it renders bare (no extra WidgetCard chrome).
  return (
    <div className="h-full">
      <MarketMakerExposures />
    </div>
  );
}

export function PriceActionPanel() {
  const t = usePageT(dict);
  return (
    <WidgetCard href="/intraday-tools" hrefLabel={t('technicals')} pad>
      <UnderlyingCandlesChart />
    </WidgetCard>
  );
}

// The flagship price + dealer-gamma instrument. Carries its own bordered card,
// header and controls, so — like DealerExposuresPanel — it renders bare.
export function GammaChartPanel() {
  return (
    <div className="h-full">
      <GammaTerminalChart />
    </div>
  );
}

// ── Gamma ───────────────────────────────────────────────────────────────────

export function GammaPulseWidget() {
  const { symbol } = useTimeframe();
  return (
    <WidgetCard href="/gamma-exposure" pad>
      <GammaPulsePanel symbol={symbol} />
    </WidgetCard>
  );
}

// The "Gamma Exposure by Strike" chart from /gamma-exposure. It feeds
// GexProfileChart the exact same inputs the page does — the shared derivations
// in core/gexStrikeCharts keep the widget and the page chart in lockstep — and
// follows the tab-wide shared expiration selection so it moves together with any
// other expiration-filtering chart on the board. GexProfileChart carries its own
// card + header + expand control, so it renders bare (no WidgetCard chrome).
export function GammaByStrikePanel() {
  const { symbol } = useTimeframe();
  const { data: gexData } = useGEXSummary(symbol, 5000);
  const { data: gexByStrike } = useGEXByStrike(symbol, 200, 10000, 'impact');
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { selection: sharedExpirations, setSelection: setSharedExpirations } = useSharedExpirations();

  const todayKey = etTodayDateKey();
  const expirationOptions = useMemo(() => strikeExpirationOptions(gexByStrike), [gexByStrike]);
  const chartExpirationOptions = useMemo(
    () => deriveChartExpirationOptions(expirationOptions, todayKey),
    [expirationOptions, todayKey],
  );
  const chartSelectedExpirations = useMemo(
    () => reconcileExpirations(sharedExpirations, chartExpirationOptions),
    [sharedExpirations, chartExpirationOptions],
  );
  const profileStrikeData = useMemo(
    () =>
      toProfileStrikeData(
        deriveChartStrikeData(gexByStrike, chartSelectedExpirations, chartExpirationOptions),
      ),
    [gexByStrike, chartSelectedExpirations, chartExpirationOptions],
  );
  const perExpirationData = useMemo(
    () => derivePerExpirationStrikeData(gexByStrike, chartExpirationOptions),
    [gexByStrike, chartExpirationOptions],
  );

  // Call/Put Wall reference lines come from the latest strike-profile bucket,
  // scoped to the chart's expiration selection (pinned to '5min' to share the
  // cache MarketMakerExposures populates by default — wall values are snapshots,
  // so the bucket cadence doesn't affect them, only cache reuse).
  const { buckets } = useStrikeProfileTimeseries(
    symbol,
    '5min',
    expirationsParam(chartSelectedExpirations),
  );
  const { chartCallWall, chartPutWall } = useMemo(() => {
    if (buckets.length === 0) {
      return { chartCallWall: undefined, chartPutWall: undefined };
    }
    const latest = buckets[buckets.length - 1];
    const cw = Number(latest?.call_wall);
    const pw = Number(latest?.put_wall);
    return {
      chartCallWall: Number.isFinite(cw) ? cw : undefined,
      chartPutWall: Number.isFinite(pw) ? pw : undefined,
    };
  }, [buckets]);

  return (
    <div className="h-full">
      <GexProfileChart
        symbol={symbol}
        strikeData={profileStrikeData}
        spotPrice={quoteData?.close}
        gammaFlip={gexData?.gamma_flip}
        callWall={chartCallWall}
        putWall={chartPutWall}
        expirationOptions={chartExpirationOptions}
        selectedExpirations={chartSelectedExpirations}
        onSelectedExpirationsChange={setSharedExpirations}
        perExpirationData={perExpirationData}
        todayKey={todayKey}
      />
    </div>
  );
}

// The "Open Interest by Strike" chart from /gamma-exposure. GexWallsChart owns
// its own expiration multiselect (via the shared store) and card chrome, so the
// wrapper only has to hand it the open-interest snapshot, a live spot price, and
// the by-strike aggregate fallback — then render bare.
export function OpenInterestByStrikePanel() {
  const { symbol } = useTimeframe();
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: gexByStrike } = useGEXByStrike(symbol, 200, 10000, 'impact');
  const { data: openInterestData } = useApiData<
    OpenInterestApiResponse | Record<string, unknown>[] | null
  >(`/api/market/open-interest?symbol=${symbol}&underlying=${symbol}`, { refreshInterval: 30000 });

  const openInterestPayload = useMemo(
    () => normalizeOpenInterestPayload(openInterestData),
    [openInterestData],
  );
  const normalizedOpenInterest = useMemo(
    () => openInterestRows(openInterestPayload),
    [openInterestPayload],
  );
  const spotFromOi = useMemo(
    () => openInterestSpotPrice(openInterestPayload),
    [openInterestPayload],
  );

  // Prefer the live WS quote while the session is open (it ticks every second);
  // fall back to the open-interest snapshot's spot off-hours, when quote.close
  // would sit flat and the OI snapshot is the more meaningful reference.
  const spotPrice =
    quoteData?.close != null &&
    Number.isFinite(quoteData.close) &&
    quoteData.close > 0 &&
    quoteData.session != null &&
    quoteData.session !== 'closed'
      ? quoteData.close
      : spotFromOi;

  return (
    <div className="h-full">
      <GexWallsChart
        openInterestData={normalizedOpenInterest}
        spotPrice={spotPrice}
        byStrikeFallback={gexByStrike || []}
      />
    </div>
  );
}

// The GEX Heatmap timeseries from /gex-heatmap. GammaHeatmapCanvas is entirely
// self-contained — it reads the active symbol, theme and GEX unit from context
// and sizes its canvas to whatever width it's given — so the wrapper only adds
// the page's GEX-unit pill above it (the canvas legend and tooltip read that
// preference) and otherwise renders bare: the canvas carries its own card,
// title bar and toolbar, and drops its fullscreen control inside a tile.
export function GexHeatmapPanel() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex justify-end">
        <GexUnitToggle showHint={false} />
      </div>
      <GammaHeatmapCanvas />
    </div>
  );
}

// The ladder's header control slot. Pair Comparison puts its per-column symbol
// dropdown here; a tile follows the board's symbol (or its pane's), so it reads
// as a plain label — retargeting is a board-level action, not a per-tile one.
function LadderSymbolTag({ symbol }: { symbol: string }) {
  return (
    <span
      className="font-mono font-bold"
      style={{ fontSize: 14, letterSpacing: '0.04em', color: 'var(--text-primary)' }}
    >
      {symbol}
    </span>
  );
}

// One column of the Pair Comparison ladder — the same component and the same
// feeds (useGammaLadderColumn), for the board's symbol. Its display
// preferences ride along so the tile is the full instrument rather than a
// read-only copy: Strikes (active-only vs every listed strike), the GEX unit,
// the expiration filter and the Session-Δ overlay are all global preferences,
// so changing any of them here moves the ladder, the pair page and the
// by-strike table together.
export function GammaLadderPanel() {
  const { symbol } = useTimeframe();
  const { gexUnit } = useGexUnit();
  const { activeOnly } = useStrikeFilter();
  const { showSessionDelta } = useSessionDelta();
  const t = usePageT(dict);
  const expirations = useChartExpirations(symbol, true);
  const column = useGammaLadderColumn(symbol, true, {
    expirations: expirations.selection,
    sessionDelta: showSessionDelta,
  });
  const ladderColumn = useMemo(
    () => ({ ...column, control: <LadderSymbolTag symbol={symbol} /> }),
    [column, symbol],
  );

  return (
    <WidgetCard
      title={t('gammaLadder')}
      icon={ListOrdered}
      href="/pair-comparison"
      hrefLabel={t('comparePair')}
      pad={false}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <StrikeFilterToggle showHint={false} />
        <ExpirationMultiSelect
          options={expirations.available}
          selected={expirations.selection}
          onChange={expirations.setSelection}
          label="Expiry"
          disabled={expirations.available.length === 0}
        />
        <SessionDeltaToggle showHint={false} />
        <GexUnitToggle showHint={false} />
      </div>
      <GammaLadder column={ladderColumn} gexUnit={gexUnit} activeOnly={activeOnly} />
    </WidgetCard>
  );
}

// ── Options Flow ──────────────────────────────────────────────────────────────

// The "Options Flow" chart from /flow-analysis. Handed no session or basis prop,
// it renders its own selectors for both alongside the underlying-price toggle,
// and fetches its own session rows — so a tile is the full instrument, not a
// read-only copy of the page's. It carries its own card chrome, so it renders
// bare (no WidgetCard).
export function OptionsFlowPanel() {
  return <OptionsFlowChart className="h-full" />;
}

// ── Signals ─────────────────────────────────────────────────────────────────

export function SignalsSynthesisPanel() {
  const t = usePageT(dict);
  return (
    <WidgetCard title={t('proprietarySignals')} fill minHeight={440}>
      <ProprietarySignalsSynthesis />
    </WidgetCard>
  );
}

export function TradeBiasPanel() {
  const t = usePageT(dict);
  return (
    <WidgetCard title={t('tradeBias')}>
      <TradeBiasSection compact />
    </WidgetCard>
  );
}

export function ConfluencePanel() {
  const { symbol } = useTimeframe();
  const { data } = useBasicConfluenceMatrix(symbol, 120, 30000);
  const t = usePageT(dict);
  return (
    <WidgetCard title={t('confluenceMatrix')} href="/basic-signals" pad={false}>
      <div className="overflow-x-auto p-3">
        <ConfluenceMatrix data={data} />
      </div>
    </WidgetCard>
  );
}

export function CompositeScorePanel() {
  const { signalScore } = useMyDashboardData();
  const t = usePageT(dict);
  const raw = signalScore?.composite_score ?? signalScore?.score ?? signalScore?.normalized_score;
  const score = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  const direction = signalScore?.direction;
  return (
    <WidgetCard title={t('compositeScore')} icon={Gauge}>
      <div className="flex items-center justify-center py-1">
        <MsiGauge
          score={score}
          size={240}
          label={t('compositeScore')}
          subLabel={direction ? direction.toUpperCase() : undefined}
        />
      </div>
    </WidgetCard>
  );
}

// ── Pro signal widgets ────────────────────────────────────────────────────────

export function SignalScoreWidget() {
  const { symbol } = useTimeframe();
  // SignalScorePanel carries its own feature-shell chrome + title, so it renders
  // bare (no outer WidgetCard border) to avoid nested panels.
  return (
    <div className="h-full">
      <SignalScorePanel symbol={symbol} />
    </div>
  );
}

function SignalEventsWidget({
  signalName,
  title,
  href,
}: {
  signalName: SignalEventName;
  title: string;
  href?: string;
}) {
  const { symbol } = useTimeframe();
  return (
    <WidgetCard href={href} pad={false}>
      <div className="p-3">
        <SignalEventsPanel signalName={signalName} symbol={symbol} title={title} />
      </div>
    </WidgetCard>
  );
}

export function VolExpansionEventsWidget() {
  const t = usePageT(dict);
  return (
    <SignalEventsWidget
      signalName="vol_expansion"
      title={t('volExpansionTimeline')}
      href="/advanced-signals"
    />
  );
}

export function EodPressureEventsWidget() {
  const t = usePageT(dict);
  return (
    <SignalEventsWidget
      signalName="eod_pressure"
      title={t('eodPressureTimeline')}
      href="/advanced-signals"
    />
  );
}

// ── Volatility ────────────────────────────────────────────────────────────────

export function VolatilityPanel() {
  const t = usePageT(dict);
  return (
    <WidgetCard title={t('volatilityMonitor')} fill minHeight={320}>
      <VolatilityCard stacked />
    </WidgetCard>
  );
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export function WorldClocksPanel() {
  const { theme } = useMyDashboardData();
  const t = usePageT(dict);
  return (
    <WidgetCard title={t('worldClocks')}>
      <div className="flex items-center justify-center py-2">
        <WorldClocks theme={theme} session={getMarketSession()} />
      </div>
    </WidgetCard>
  );
}

export function TopHeadlinesPanel() {
  const { theme } = useMyDashboardData();
  const t = usePageT(dict);
  // fill + a fixed minHeight give the crawl a stable frame to scroll within;
  // pad={false} lets the dense wire rows run edge-to-edge like a real ticker.
  return (
    <WidgetCard title={t('topHeadlines')} pad={false} fill minHeight={360}>
      <HeadlinesWire theme={theme} />
    </WidgetCard>
  );
}
