'use client';

import { Info } from 'lucide-react';
import TooltipWrapper from './TooltipWrapper';

import { useMemo } from 'react';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useForcedFlowLevels } from '@/hooks/useApiData';

interface ForcedFlowRailProps {
  symbol?: string;
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(value >= 1000 ? 0 : 2);
}

function formatSignedPrice(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

interface RailLevel {
  key: string;
  label: string;
  value: number;
  color: string;
}

export default function ForcedFlowRail({ symbol = 'SPY' }: ForcedFlowRailProps) {
  const chart = useChartTheme();
  const { data, loading, error } = useForcedFlowLevels(symbol, 15000);

  const levels = useMemo<RailLevel[]>(() => {
    if (!data) return [];
    const candidates: Array<RailLevel | null> = [
      data.gamma_flip != null
        ? { key: 'gamma', label: 'Gamma flip', value: data.gamma_flip, color: chart.warning }
        : null,
      data.charm_flip != null
        ? { key: 'charm', label: 'Charm flip', value: data.charm_flip, color: chart.series[2] }
        : null,
      data.vanna_flip != null
        ? { key: 'vanna', label: 'Vanna flip', value: data.vanna_flip, color: chart.series[3] }
        : null,
      data.zero_flow_level != null
        ? { key: 'zero', label: 'Zero-flow', value: data.zero_flow_level, color: chart.accent }
        : null,
    ];
    return candidates.filter((c): c is RailLevel => c != null && Number.isFinite(c.value));
  }, [data, chart.warning, chart.series, chart.accent]);

  const spot = data?.spot ?? null;
  const hasData = levels.length > 0 && spot != null && Number.isFinite(spot);

  // Vertical price domain spanning spot + every level, padded so nothing
  // pins to the very top/bottom edge.
  const { lo, hi } = useMemo(() => {
    if (!hasData || spot == null) return { lo: 0, hi: 1 };
    const values = [spot, ...levels.map((l) => l.value)];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.max(1, Math.abs(spot) * 0.01);
    const pad = span * 0.15;
    return { lo: min - pad, hi: max + pad };
  }, [hasData, spot, levels]);

  // Higher price -> higher on the rail (top = 0%).
  const posPct = (v: number) => (hi === lo ? 50 : ((hi - v) / (hi - lo)) * 100);

  // De-collided marker layout. When levels cluster near spot (charm flip and
  // zero-flow frequently sit right on it), their two-line labels overlap into
  // an unreadable smear. Place every marker at its true price position, then
  // enforce a minimum vertical gap so the labels stay legible; the price text
  // on each keeps it exact even where a dot is nudged off its raw pixel.
  const markers = useMemo(() => {
    if (!hasData || spot == null) return [];
    const MIN = 4;
    const MAX = 96;
    const GAP = 13; // ~two text lines in the 220px rail
    const raw = [
      {
        key: 'spot',
        label: 'Spot',
        price: formatPrice(spot),
        sub: null as string | null,
        subColor: undefined as string | undefined,
        color: chart.info,
        emphasized: true,
        value: spot,
      },
      ...levels.map((l) => ({
        key: l.key,
        label: l.label,
        price: formatPrice(l.value),
        sub: formatSignedPrice(l.value - spot) as string | null,
        subColor: (l.value - spot >= 0 ? chart.bull : chart.bear) as string | undefined,
        color: l.color,
        emphasized: false,
        value: l.value,
      })),
    ];
    const items = raw
      .map((m) => ({ ...m, top: Math.min(MAX, Math.max(MIN, posPct(m.value))) }))
      .sort((a, b) => a.top - b.top);
    // Push overlaps downward...
    for (let i = 1; i < items.length; i++) {
      if (items[i].top < items[i - 1].top + GAP) items[i].top = items[i - 1].top + GAP;
    }
    // ...then, if the stack overshot the bottom, slide it back up as a block.
    const overflow = items.length ? items[items.length - 1].top - MAX : 0;
    if (overflow > 0) {
      for (const it of items) it.top = Math.max(MIN, it.top - overflow);
      for (let i = 1; i < items.length; i++) {
        if (items[i].top < items[i - 1].top + GAP) items[i].top = items[i - 1].top + GAP;
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, spot, levels, lo, hi, chart.info, chart.bull, chart.bear]);

  const textColor = 'var(--text-primary)';

  return (
    <div
      className="rounded-2xl p-4 flex flex-col"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <h3 className="zg-h3 text-sm" style={{ color: textColor }}>
            Forced-Flow Rail
          </h3>
          <TooltipWrapper text="The key spot levels that frame the dealer-hedging regime, plotted against the current price. Gamma flip: where dealer gamma crosses zero — below it dealers amplify moves, above it they dampen them. Charm flip and Vanna flip: the prices where time-decay and vol-driven hedging change sign. Zero-flow level: the price at which total forced dealer flow is zero — the spot where dealers have nothing to hedge.">
            <Info size={14} />
          </TooltipWrapper>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center text-xs" style={{ minHeight: 200, color: chart.bear }}>
          {error === 'No data available yet' ? 'No levels yet.' : `Error: ${error}`}
        </div>
      ) : loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-xs" style={{ minHeight: 200, color: 'var(--text-secondary)' }}>
          Loading levels…
        </div>
      ) : !hasData || spot == null ? (
        <div className="flex flex-1 items-center justify-center text-xs" style={{ minHeight: 200, color: 'var(--text-secondary)' }}>
          No regime levels available.
        </div>
      ) : (
        // flex-1 so the track fills the card, which stretches to the height of
        // the reprice curve beside it — the rail no longer floats in the top
        // third with dead space below. Marker positions are percentages, so
        // they spread to whatever height the container gives us.
        <div className="relative flex-1" style={{ minHeight: 240 }}>
          {/* Vertical rail track. */}
          <div
            className="absolute top-0 bottom-0"
            style={{ left: 92, width: 2, backgroundColor: chart.gridLine, borderRadius: 1 }}
          />

          {/* Spot + regime levels, de-collided so clustered labels stay legible. */}
          {markers.map((m) => (
            <RailMarker
              key={m.key}
              top={m.top}
              label={m.label}
              price={m.price}
              sub={m.sub}
              subColor={m.subColor}
              color={m.color}
              emphasized={m.emphasized}
              trackLeft={92}
            />
          ))}
        </div>
      )}

      {data?.timestamp && hasData && (
        <div className="mt-2 text-right text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function RailMarker({
  top,
  label,
  price,
  sub,
  subColor,
  color,
  emphasized = false,
  trackLeft,
}: {
  top: number;
  label: string;
  price: string;
  sub: string | null;
  subColor?: string;
  color: string;
  emphasized?: boolean;
  trackLeft: number;
}) {
  const clampedTop = Math.min(96, Math.max(2, top));
  return (
    <div
      className="absolute flex items-center gap-2"
      style={{ top: `${clampedTop}%`, left: 0, right: 0, transform: 'translateY(-50%)' }}
    >
      {/* Left column: label + price, right-aligned to the track. */}
      <div className="text-right" style={{ width: trackLeft - 8 }}>
        <div
          className="text-[10px] uppercase tracking-wide leading-tight"
          style={{ color: 'var(--text-muted)', fontWeight: emphasized ? 700 : 600 }}
        >
          {label}
        </div>
        <div
          className="font-mono leading-tight"
          style={{ color, fontSize: emphasized ? 13 : 12, fontWeight: emphasized ? 800 : 700 }}
        >
          {price}
        </div>
      </div>
      {/* Dot on the track. */}
      <div
        style={{
          width: emphasized ? 12 : 9,
          height: emphasized ? 12 : 9,
          borderRadius: '50%',
          backgroundColor: color,
          border: `2px solid var(--bg-card)`,
          boxShadow: emphasized ? `0 0 6px ${color}` : undefined,
          flexShrink: 0,
        }}
      />
      {/* Right column: distance from spot. */}
      {sub != null && (
        <div className="font-mono text-[11px]" style={{ color: subColor ?? 'var(--text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
