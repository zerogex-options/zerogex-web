'use client';

/**
 * Panel widgets for the customizable dashboard. Thin wrappers that reuse the
 * site's existing feature components — either self-contained (they read the
 * active symbol from context and fetch their own data) or handed the one prop
 * they need (symbol / theme / a context-derived model).
 */

import { useMemo } from 'react';
import { Gauge } from 'lucide-react';

import MarketMakerExposures from '@/components/MarketMakerExposures';
import ProprietarySignalsSynthesis from '@/components/ProprietarySignalsSynthesis';
import VolatilityCard from '@/components/VolatilityCard';
import TradeBiasSection from '@/components/TradeBiasSection';
import UnderlyingCandlesChart from '@/components/UnderlyingCandlesChart';
import GammaPulsePanel from '@/components/GammaPulsePanel';
import SignalScorePanel from '@/components/SignalScorePanel';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import ConfluenceMatrix from '@/components/ConfluenceMatrix';
import MsiGauge from '@/components/MsiGauge';
import TodaysReadCard from '@/components/TodaysReadCard';
import WorldClocks from '@/components/WorldClocks';

import { useTimeframe } from '@/core/TimeframeContext';
import { getMarketSession } from '@/core/utils';
import { useBasicConfluenceMatrix, type SignalEventName } from '@/hooks/useApiData';
import { buildReportModel } from '@/app/live-bulletin/bulletinHelpers';
import { usePageT } from '@/core/LanguageContext';

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

// ── Gamma ───────────────────────────────────────────────────────────────────

export function GammaPulseWidget() {
  const { symbol } = useTimeframe();
  return (
    <WidgetCard href="/gamma-exposure" pad>
      <GammaPulsePanel symbol={symbol} />
    </WidgetCard>
  );
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
