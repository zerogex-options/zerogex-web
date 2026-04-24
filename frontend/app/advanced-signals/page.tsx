'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  Compass,
  LayoutGrid,
  LineChart as LineChartIcon,
  Rocket,
  ShieldAlert,
  Table,
  Zap,
} from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import AdvancedSignalCard, { type AdvancedSignalContextRow } from '@/components/AdvancedSignalCard';
import ConfluenceMatrix from '@/components/ConfluenceMatrix';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import { useTimeframe } from '@/core/TimeframeContext';
import {
  useVolExpansionSignal,
  useEodPressureSignal,
  useSqueezeSetupSignal,
  useTrapDetectionSignal,
  useZeroDtePositionImbalanceSignal,
  useGammaVwapConfluenceSignal,
  useRangeBreakImminenceSignal,
  useConfluenceMatrix,
  type SignalEventName,
} from '@/hooks/useApiData';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  getNumber,
  formatSigned,
  formatPct,
  formatGexCompact,
  formatPrice,
  toTrend,
} from '@/core/signalHelpers';

const TABS = [
  { id: 'grid', label: 'Signal Grid', icon: LayoutGrid },
  { id: 'matrix', label: 'Confluence Matrix', icon: Table },
  { id: 'events', label: 'Event Timelines', icon: LineChartIcon },
] as const;

type TabId = (typeof TABS)[number]['id'];

const EVENT_SIGNAL_LABELS: Array<{ name: SignalEventName; label: string }> = [
  { name: 'vol_expansion', label: 'Volatility Expansion' },
  { name: 'eod_pressure', label: 'EOD Pressure' },
  { name: 'squeeze_setup', label: 'Squeeze Setup' },
  { name: 'trap_detection', label: 'Trap Detection' },
  { name: 'zero_dte_position_imbalance', label: '0DTE Position Imbalance' },
  { name: 'gamma_vwap_confluence', label: 'Gamma/VWAP Confluence' },
];

function isEodInactive(payload: Record<string, unknown>): string | null {
  const tr = getNumber(payload.time_ramp);
  const score = getNumber(payload.score);
  if (tr != null && tr === 0 && (score == null || score === 0)) {
    return 'Inactive — EOD window opens at 14:30 ET';
  }
  return null;
}

function isZeroDteInactive(payload: Record<string, unknown>): string | null {
  const ctx = asObject(payload.context_values) ?? {};
  const tod = getNumber(ctx.tod_multiplier);
  if (tod != null && tod === 0) return 'Inactive — 0DTE window closed';
  return null;
}

export default function AdvancedSignalsPage() {
  const { symbol } = useTimeframe();
  const [tab, setTab] = useState<TabId>('grid');

  const volExpansion = useVolExpansionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.volExpansionMs);
  const eodPressure = useEodPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.eodPressureMs);
  const squeezeSetup = useSqueezeSetupSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.squeezeSetupMs);
  const trapDetection = useTrapDetectionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.trapDetectionMs);
  const zeroDte = useZeroDtePositionImbalanceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.zeroDteImbalanceMs);
  const gammaVwap = useGammaVwapConfluenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gammaVwapConfluenceMs);
  const rangeBreak = useRangeBreakImminenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.rangeBreakImminenceMs);

  const matrix = useConfluenceMatrix(symbol, 120, PROPRIETARY_SIGNALS_REFRESH.confluenceMatrixMs);

  const cards = useMemo(() => {
    const volPayload = asObject(volExpansion.data) ?? {};
    const eodPayload = asObject(eodPressure.data) ?? {};
    const squeezePayload = asObject(squeezeSetup.data) ?? {};
    const trapPayload = asObject(trapDetection.data) ?? {};
    const zeroDtePayload = asObject(zeroDte.data) ?? {};
    const gvcPayload = asObject(gammaVwap.data) ?? {};
    const rbiPayload = asObject(rangeBreak.data) ?? {};

    const volRows: AdvancedSignalContextRow[] = [
      { label: 'Expansion (0–100)', value: formatSigned(getNumber(volPayload.expansion), 1) },
      { label: 'Direction score', value: formatSigned(getNumber(volPayload.direction_score), 1), tone: toTrend(volPayload.direction) },
      { label: 'Expected 5m move', value: `${(getNumber(volPayload.expected_5min_move_bps) ?? 0).toFixed(1)} bps` },
      { label: 'Net GEX', value: formatGexCompact(getNumber(asObject(volPayload.context_values)?.net_gex)) },
    ];

    const eodCtx = asObject(eodPayload.context_values) ?? {};
    const eodRows: AdvancedSignalContextRow[] = [
      { label: 'Pin target', value: formatPrice(getNumber(eodPayload.pin_target)) },
      { label: 'Pin distance', value: formatPct(getNumber(eodPayload.pin_distance_pct), 3) },
      { label: 'Time ramp', value: (getNumber(eodPayload.time_ramp) ?? 0).toFixed(2) },
      { label: 'Gamma regime', value: String(eodPayload.gamma_regime ?? '—') },
      { label: 'Calendar amp', value: (getNumber(eodCtx.calendar_amp) ?? 1).toFixed(2) + '×' },
    ];

    const sCtx = asObject(squeezePayload.context_values) ?? {};
    const squeezeRows: AdvancedSignalContextRow[] = [
      { label: 'Call flow z', value: formatSigned(getNumber(squeezePayload.call_flow_z), 2), tone: (getNumber(squeezePayload.call_flow_z) ?? 0) > 0 ? 'bullish' : 'neutral' },
      { label: 'Put flow z', value: formatSigned(getNumber(squeezePayload.put_flow_z), 2), tone: (getNumber(squeezePayload.put_flow_z) ?? 0) > 0 ? 'bearish' : 'neutral' },
      { label: 'Momentum z', value: formatSigned(getNumber(squeezePayload.momentum_z), 2) },
      { label: 'VIX regime', value: String(squeezePayload.vix_regime ?? '—') },
      { label: 'Accel ↑', value: sCtx.accel_up === true ? 'Yes' : 'No' },
      { label: 'Accel ↓', value: sCtx.accel_dn === true ? 'Yes' : 'No' },
    ];

    const tCtx = asObject(trapPayload.context_values) ?? {};
    const trapRows: AdvancedSignalContextRow[] = [
      { label: 'Resistance', value: formatPrice(getNumber(trapPayload.resistance_level)) },
      { label: 'Support', value: formatPrice(getNumber(trapPayload.support_level)) },
      { label: 'Buffer', value: formatPct(getNumber(trapPayload.breakout_buffer_pct), 3, false) },
      { label: 'Breakout ↑', value: trapPayload.breakout_up === true ? 'Yes' : 'No' },
      { label: 'Breakout ↓', value: trapPayload.breakout_down === true ? 'Yes' : 'No' },
      { label: 'Wall migrated ↑', value: trapPayload.wall_migrated_up === true ? 'Yes' : 'No' },
      { label: 'Gamma strengthening', value: tCtx.gamma_strengthening === true ? 'Yes' : 'No' },
    ];

    const zCtx = asObject(zeroDtePayload.context_values) ?? {};
    const zeroDteRows: AdvancedSignalContextRow[] = [
      { label: 'Flow imbalance', value: formatSigned(getNumber(zeroDtePayload.flow_imbalance), 2) },
      { label: 'Smart imbalance', value: formatSigned(getNumber(zeroDtePayload.smart_imbalance), 2) },
      { label: 'Signal', value: String(zeroDtePayload.signal ?? '—') },
      { label: 'ToD multiplier', value: (getNumber(zCtx.tod_multiplier) ?? 0).toFixed(2) },
      { label: 'Flow source', value: String(zCtx.flow_source ?? '—') },
    ];

    const gvcCtx = asObject(gvcPayload.context_values) ?? {};
    const gvcRows: AdvancedSignalContextRow[] = [
      { label: 'Confluence level', value: formatPrice(getNumber(gvcPayload.confluence_level)) },
      { label: 'Expected target', value: formatPrice(getNumber(gvcPayload.expected_target)) },
      { label: 'Cluster gap', value: formatPct(getNumber(gvcPayload.cluster_gap_pct), 3, false) },
      { label: 'Cluster quality', value: (getNumber(gvcCtx.cluster_quality) ?? 0).toFixed(2) },
      { label: 'Regime', value: String(gvcCtx.regime_direction ?? '—') },
    ];

    const rbiCtx = asObject(rbiPayload.context_values) ?? {};
    const rbiSkew = asObject(rbiCtx.skew) ?? {};
    const rbiDealer = asObject(rbiCtx.dealer) ?? {};
    const rbiTrap = asObject(rbiCtx.trap) ?? {};
    const rbiCompression = asObject(rbiCtx.compression) ?? {};
    const rbiRows: AdvancedSignalContextRow[] = [
      { label: 'Imminence', value: (getNumber(rbiPayload.imminence) ?? 0).toFixed(1) },
      { label: 'Label', value: String(rbiPayload.label ?? '—') },
      { label: 'Bias', value: formatSigned(getNumber(rbiPayload.bias), 2), tone: toTrend(rbiPayload.direction) },
      { label: 'Skew mag', value: (getNumber(rbiSkew.magnitude) ?? 0).toFixed(1) },
      { label: 'Dealer mag', value: (getNumber(rbiDealer.magnitude) ?? 0).toFixed(1) },
      { label: 'Trap side', value: String(rbiTrap.side ?? 'none') },
      { label: 'Compression mag', value: (getNumber(rbiCompression.magnitude) ?? 0).toFixed(1) },
    ];

    return [
      { payload: volPayload, title: 'Volatility Expansion', href: '/volatility-expansion', icon: Zap, threshold: 25, description: 'Short-gamma vol readiness × momentum direction.', rows: volRows, hook: volExpansion },
      { payload: eodPayload, title: 'EOD Pressure', href: '/eod-pressure', icon: CalendarClock, threshold: 25, description: 'Late-session pin/drift: charm + gamma-gated pin × time ramp.', rows: eodRows, hook: eodPressure, inactive: isEodInactive(eodPayload) },
      { payload: squeezePayload, title: 'Squeeze Setup', href: '/squeeze-setup', icon: Rocket, threshold: 25, description: 'Directional flow z × momentum × dealer-gamma posture.', rows: squeezeRows, hook: squeezeSetup },
      { payload: trapPayload, title: 'Trap Detection', href: '/trap-detection', icon: AlertTriangle, threshold: 25, description: 'Failed-breakout fades when dealer gamma reinforces reversal.', rows: trapRows, hook: trapDetection },
      { payload: zeroDtePayload, title: '0DTE Position Imbalance', href: '/0dte-position-imbalance', icon: Activity, threshold: 25, description: 'Same-day bucket-weighted flow tilt × time-of-day ramp.', rows: zeroDteRows, hook: zeroDte, inactive: isZeroDteInactive(zeroDtePayload) },
      { payload: gvcPayload, title: 'Gamma/VWAP Confluence', href: '/gamma-vwap-confluence', icon: Compass, threshold: 20, description: 'Multi-level magnet: flip + VWAP + max pain + max gamma + call wall.', rows: gvcRows, hook: gammaVwap },
      { payload: rbiPayload, title: 'Range Break Imminence', href: '/range-break-imminence', icon: ArrowLeftRight, threshold: 65, description: 'Regime-switch detector: skew + dealer Δ + trap + compression → 0–100 imminence.', rows: rbiRows, hook: rangeBreak },
    ];
  }, [volExpansion, eodPressure, squeezeSetup, trapDetection, zeroDte, gammaVwap, rangeBreak]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Advanced Signal Dashboard</h1>
        <TooltipWrapper
          text="Dashboard of seven advanced signals, plus cross-component confluence analysis. Six extend the composite MSI; Range Break Imminence is a standalone regime-switch detector. Each card below is a standalone detector; triggered cards are outlined. Switch tabs to inspect cross-signal confluence or per-signal event timelines."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_1fr] gap-6 items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={16} className="text-[var(--color-warning)]" />
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Signal Lens</div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Seven weighted detectors with directional triggers and pin-risk setups — six extending the composite
              MSI plus Range Break Imminence as a standalone regime-switch overlay. Outlined tiles have crossed
              their activation threshold — interpret each alongside the current regime.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-secondary)]">
              <span><span className="text-[var(--color-text-primary)] font-semibold">Symbol</span> {symbol}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cards.map((card) => {
              const score = getNumber(card.payload.score);
              const direction = String(card.payload.direction ?? 'neutral').toLowerCase();
              const color = direction === 'bullish' ? 'var(--color-bull)' : direction === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)';
              return (
                <div
                  key={card.title}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 flex flex-col gap-1"
                  style={{ borderColor: score != null && Math.abs(score) >= card.threshold ? color : 'var(--color-border)' }}
                >
                  <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{card.title}</div>
                  <div className="text-2xl font-black leading-none" style={{ color }}>
                    {score != null ? formatSigned(score, 1) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex gap-2 mt-6 border-b border-[var(--color-border)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                borderBottom: active ? '2px solid var(--color-warning)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'grid' && (
        <section className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((c) => (
              <AdvancedSignalCard
                key={c.title}
                title={c.title}
                href={c.href}
                icon={c.icon}
                snapshot={c.payload}
                triggerThreshold={c.threshold}
                contextRows={c.rows}
                description={c.description}
                inactiveLabel={('inactive' in c ? c.inactive : null) ?? null}
                loading={c.hook.loading && !c.hook.data}
                error={c.hook.error}
              />
            ))}
          </div>
        </section>
      )}

      {tab === 'matrix' && (
        <section className="mt-6">
          <ConfluenceMatrix data={matrix.data} />
          {matrix.error && <div className="mt-2 text-[11px] text-[var(--color-bear)]">Failed to load matrix: {matrix.error}</div>}
        </section>
      )}

      {tab === 'events' && (
        <section className="mt-6 space-y-6">
          {EVENT_SIGNAL_LABELS.map((s) => (
            <SignalEventsPanel key={s.name} signalName={s.name} symbol={symbol} title={s.label} />
          ))}
        </section>
      )}
    </div>
  );
}
