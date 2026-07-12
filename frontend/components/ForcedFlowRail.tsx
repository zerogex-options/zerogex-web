'use client';

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

  const textColor = 'var(--text-primary)';

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="zg-h3 text-sm" style={{ color: textColor }}>
          Forced-Flow Rail
        </h3>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
      </div>

      {error ? (
        <div className="flex items-center justify-center h-[200px] text-xs" style={{ color: chart.bear }}>
          {error === 'No data available yet' ? 'No levels yet.' : `Error: ${error}`}
        </div>
      ) : loading && !data ? (
        <div className="flex items-center justify-center h-[200px] text-xs" style={{ color: 'var(--text-secondary)' }}>
          Loading levels…
        </div>
      ) : !hasData || spot == null ? (
        <div className="flex items-center justify-center h-[200px] text-xs" style={{ color: 'var(--text-secondary)' }}>
          No regime levels available.
        </div>
      ) : (
        <div className="relative" style={{ height: 220 }}>
          {/* Vertical rail track. */}
          <div
            className="absolute top-0 bottom-0"
            style={{ left: 92, width: 2, backgroundColor: chart.gridLine, borderRadius: 1 }}
          />

          {/* Spot marker — the reference the levels are read against. */}
          <RailMarker
            top={posPct(spot)}
            label="Spot"
            price={formatPrice(spot)}
            sub={null}
            color={chart.info}
            emphasized
            trackLeft={92}
          />

          {/* Regime levels. */}
          {levels.map((l) => (
            <RailMarker
              key={l.key}
              top={posPct(l.value)}
              label={l.label}
              price={formatPrice(l.value)}
              sub={formatSignedPrice(l.value - spot)}
              subColor={l.value - spot >= 0 ? chart.bull : chart.bear}
              color={l.color}
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
