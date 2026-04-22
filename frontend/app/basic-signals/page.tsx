'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  LayoutGrid,
  LineChart as LineChartIcon,
  ScatterChart,
  Scale,
  ShieldAlert,
  Table,
  Waves,
} from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import ErrorMessage from '@/components/ErrorMessage';
import AdvancedSignalCard, { type AdvancedSignalContextRow } from '@/components/AdvancedSignalCard';
import ConfluenceMatrix from '@/components/ConfluenceMatrix';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import { useTimeframe } from '@/core/TimeframeContext';
import {
  useBasicSignalsBundle,
  useTapeFlowBiasSignal,
  useSkewDeltaSignal,
  useVannaCharmFlowSignal,
  useDealerDeltaPressureSignal,
  useGexGradientSignal,
  usePositioningTrapSignal,
  useBasicConfluenceMatrix,
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
} from '@/core/signalHelpers';

const TABS = [
  { id: 'grid', label: 'Signal Grid', icon: LayoutGrid },
  { id: 'matrix', label: 'Confluence Matrix', icon: Table },
  { id: 'events', label: 'Event Timelines', icon: LineChartIcon },
] as const;

type TabId = (typeof TABS)[number]['id'];

const EVENT_SIGNAL_LABELS: Array<{ name: SignalEventName; label: string }> = [
  { name: 'tape_flow_bias', label: 'Tape Flow Bias' },
  { name: 'skew_delta', label: 'Skew Delta' },
  { name: 'vanna_charm_flow', label: 'Vanna/Charm Flow' },
  { name: 'dealer_delta_pressure', label: 'Dealer Delta Pressure' },
  { name: 'gex_gradient', label: 'GEX Gradient' },
  { name: 'positioning_trap', label: 'Positioning Trap' },
];

export default function BasicSignalsPage() {
  const { symbol } = useTimeframe();
  const [tab, setTab] = useState<TabId>('grid');

  const bundle = useBasicSignalsBundle(symbol, PROPRIETARY_SIGNALS_REFRESH.basicBundleMs);
  const tapeFlow = useTapeFlowBiasSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.tapeFlowBiasMs);
  const skew = useSkewDeltaSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.skewDeltaMs);
  const vc = useVannaCharmFlowSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.vannaCharmFlowMs);
  const ddp = useDealerDeltaPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.dealerDeltaPressureMs);
  const gexGrad = useGexGradientSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gexGradientMs);
  const posTrap = usePositioningTrapSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.positioningTrapMs);

  const matrix = useBasicConfluenceMatrix(symbol, 120, PROPRIETARY_SIGNALS_REFRESH.basicConfluenceMatrixMs);

  const bundlePayload = useMemo(() => asObject(bundle.data) ?? {}, [bundle.data]);
  const bundleSignals = useMemo(() => asObject(bundlePayload.signals) ?? {}, [bundlePayload.signals]);

  const cards = useMemo(() => {
    const tapePayload = asObject(tapeFlow.data) ?? {};
    const skewPayload = asObject(skew.data) ?? {};
    const vcPayload = asObject(vc.data) ?? {};
    const ddpPayload = asObject(ddp.data) ?? {};
    const gexPayload = asObject(gexGrad.data) ?? {};
    const trapPayload = asObject(posTrap.data) ?? {};

    const tapeCtx = asObject(tapePayload.context_values) ?? {};
    const tapeRows: AdvancedSignalContextRow[] = [
      { label: 'Call net premium', value: formatGexCompact(getNumber(tapePayload.call_net_premium)) },
      { label: 'Put net premium', value: formatGexCompact(getNumber(tapePayload.put_net_premium)) },
      { label: 'Call buy prem', value: formatGexCompact(getNumber(tapeCtx.call_buy_premium)) },
      { label: 'Put buy prem', value: formatGexCompact(getNumber(tapeCtx.put_buy_premium)) },
      { label: 'Source', value: String(tapePayload.source ?? tapeCtx.source ?? '—') },
    ];

    const skewCtx = asObject(skewPayload.context_values) ?? {};
    const skewRows: AdvancedSignalContextRow[] = [
      { label: 'OTM put IV', value: formatPct(getNumber(skewPayload.otm_put_iv), 2, false) },
      { label: 'OTM call IV', value: formatPct(getNumber(skewPayload.otm_call_iv), 2, false) },
      { label: 'Spread', value: formatSigned(getNumber(skewPayload.spread), 4) },
      { label: 'Deviation', value: formatSigned(getNumber(skewPayload.deviation), 4) },
      { label: 'Baseline', value: formatSigned(getNumber(skewCtx.baseline), 3) },
    ];

    const vcCtx = asObject(vcPayload.context_values) ?? {};
    const vcRows: AdvancedSignalContextRow[] = [
      { label: 'Vanna total', value: formatGexCompact(getNumber(vcPayload.vanna_total)) },
      { label: 'Charm total', value: formatGexCompact(getNumber(vcPayload.charm_total)) },
      { label: 'Charm amp', value: (getNumber(vcPayload.charm_amplification) ?? 1).toFixed(2) + '×' },
      { label: 'Source', value: String(vcPayload.source ?? vcCtx.source ?? '—') },
    ];

    const ddpCtx = asObject(ddpPayload.context_values) ?? {};
    const ddpRows: AdvancedSignalContextRow[] = [
      { label: 'Dealer net delta', value: formatGexCompact(getNumber(ddpPayload.dealer_net_delta_estimated)) },
      { label: 'DNI normalized', value: formatSigned(getNumber(ddpPayload.dni_normalized), 3) },
      { label: 'Source', value: String(ddpPayload.source ?? ddpCtx.source ?? '—') },
    ];

    const gexCtx = asObject(gexPayload.context_values) ?? {};
    const gexRows: AdvancedSignalContextRow[] = [
      { label: 'Above spot Γ', value: formatGexCompact(getNumber(gexPayload.above_spot_gamma_abs)) },
      { label: 'Below spot Γ', value: formatGexCompact(getNumber(gexPayload.below_spot_gamma_abs)) },
      { label: 'Asymmetry', value: formatSigned(getNumber(gexPayload.asymmetry), 3) },
      { label: 'Wing fraction', value: formatPct(getNumber(gexPayload.wing_fraction), 1, false) },
      { label: 'Strike count', value: String(getNumber(gexCtx.strike_count) ?? '—') },
    ];

    const trapCtx = asObject(trapPayload.context_values) ?? {};
    const trapRows: AdvancedSignalContextRow[] = [
      { label: 'Smart imbalance', value: formatSigned(getNumber(trapPayload.smart_imbalance), 3) },
      { label: 'Momentum (5-bar)', value: formatPct(getNumber(trapPayload.momentum_5bar), 3) },
      { label: 'Put/Call ratio', value: (getNumber(trapCtx.put_call_ratio) ?? 0).toFixed(2) },
      { label: 'Close', value: formatPrice(getNumber(trapCtx.close)) },
      { label: 'Gamma flip', value: formatPrice(getNumber(trapCtx.gamma_flip)) },
      { label: 'Net GEX', value: formatGexCompact(getNumber(trapCtx.net_gex)) },
    ];

    return [
      {
        key: 'tape_flow_bias',
        payload: tapePayload,
        title: 'Tape Flow Bias',
        href: '/tape-flow-bias',
        icon: Waves,
        threshold: 25,
        description: 'Aggressive-vs-passive option-tape premium imbalance (calls bought + puts sold = bullish).',
        rows: tapeRows,
        hook: tapeFlow,
      },
      {
        key: 'skew_delta',
        payload: skewPayload,
        title: 'Skew Delta',
        href: '/skew-delta',
        icon: Scale,
        threshold: 25,
        description: 'Short-dated OTM put-vs-call IV spread as deviation from baseline. Fear gauge.',
        rows: skewRows,
        hook: skew,
      },
      {
        key: 'vanna_charm_flow',
        payload: vcPayload,
        title: 'Vanna/Charm Flow',
        href: '/vanna-charm-flow',
        icon: Activity,
        threshold: 25,
        description: 'Second-order greek dealer-hedging pressure. Morning vanna lift, afternoon charm fade.',
        rows: vcRows,
        hook: vc,
      },
      {
        key: 'dealer_delta_pressure',
        payload: ddpPayload,
        title: 'Dealer Delta Pressure',
        href: '/dealer-delta-pressure',
        icon: Compass,
        threshold: 25,
        description: "Estimated dealer net delta (inverted: positive = dealers short delta = bullish).",
        rows: ddpRows,
        hook: ddp,
      },
      {
        key: 'gex_gradient',
        payload: gexPayload,
        title: 'GEX Gradient',
        href: '/gex-gradient',
        icon: ScatterChart,
        threshold: 25,
        description: 'Above-vs-below-spot gamma asymmetry, regime-aware (short vs long gamma).',
        rows: gexRows,
        hook: gexGrad,
      },
      {
        key: 'positioning_trap',
        payload: trapPayload,
        title: 'Positioning Trap',
        href: '/positioning-trap',
        icon: AlertTriangle,
        threshold: 25,
        description: 'Crowded positioning × flow × momentum × gamma — classic squeeze / flush setup.',
        rows: trapRows,
        hook: posTrap,
      },
    ];
  }, [tapeFlow, skew, vc, ddp, gexGrad, posTrap]);

  // Fallback to bundle data when per-signal endpoints haven't loaded
  const cardsWithBundleFallback = useMemo(() => {
    return cards.map((card) => {
      const existingScore = getNumber(card.payload.score);
      if (existingScore != null) return card;

      const entry = asObject(bundleSignals[card.key as keyof typeof bundleSignals]);
      if (!entry) return card;

      return {
        ...card,
        payload: { ...entry, ...card.payload },
      };
    });
  }, [cards, bundleSignals]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Basic Signal Dashboard</h1>
        <TooltipWrapper
          text="Six independent, continuous directional reads of market microstructure sitting outside the composite MSI. None dominates — the value is in their agreement (conviction) or disagreement (divergence, trap risk). Drill into any tile for detail."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {bundle.error && <ErrorMessage message={bundle.error} onRetry={bundle.refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_1fr] gap-6 items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={16} className="text-[var(--color-warning)]" />
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Microstructure Lens</div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Basic signals run at weight = 0 — they do not feed the composite MSI. Use them as an early cross-check:
              when flow-side signals diverge from structure signals, a regime shift is usually underway.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-secondary)]">
              <span><span className="text-[var(--color-text-primary)] font-semibold">Symbol</span> {symbol}</span>
              {bundlePayload.underlying ? (
                <span><span className="text-[var(--color-text-primary)] font-semibold">Series</span> {String(bundlePayload.underlying)}</span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cardsWithBundleFallback.map((card) => {
              const score = getNumber(card.payload.score);
              const direction = String(card.payload.direction ?? 'neutral').toLowerCase();
              const color = direction === 'bullish' ? 'var(--color-bull)' : direction === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)';
              return (
                <div
                  key={card.key}
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
            {cardsWithBundleFallback.map((c) => (
              <AdvancedSignalCard
                key={c.title}
                title={c.title}
                href={c.href}
                icon={c.icon}
                snapshot={c.payload}
                triggerThreshold={c.threshold}
                contextRows={c.rows}
                description={c.description}
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
