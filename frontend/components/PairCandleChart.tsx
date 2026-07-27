"use client";

/**
 * PairCandleChart — a plain, props-driven candlestick + volume chart.
 *
 * Forked from UnderlyingCandlesChart so the Ticker-Pair Comparison page can
 * stack two candle charts (one per ticker in the pair) with NO gamma overlays
 * and NO card/timeframe chrome. It is "the Gamma Chart without the levels
 * marked and the gamma chart on the right": the exact same hand-rolled SVG
 * hollow-OHLC candles + stacked up/down volume, driven entirely by the
 * `symbol` and `timeframe` props (unlike UnderlyingCandlesChart, which reads
 * the app-wide symbol/timeframe from context and wraps itself in a titled
 * ExpandableCard). The page owns the shared timeframe control, so this
 * component renders just the instrument.
 */

import { useMemo, useState, type MouseEvent } from "react";
import { useMarketQuote } from "@/hooks/useApiData";
import { useMarketHistorical } from "@/hooks/useMarketHistorical";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import { omitClosedMarketTimes } from "@/core/utils";
import { type ChartTimeframe } from "./ChartTimeframeSelect";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileScrollableChart from "./MobileScrollableChart";

interface CandleBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  upVolume: number;
  downVolume: number;
}

// How many aggregated candles to render. Mirrors TimeframeContext.getMaxDataPoints().
const MAX_POINTS = 90;

function niceStep(value: number): number {
  if (value <= 0 || !Number.isFinite(value)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / exp;
  if (norm < 1.5) return 1 * exp;
  if (norm < 3) return 2 * exp;
  if (norm < 7) return 5 * exp;
  return 10 * exp;
}

interface NiceAxis {
  ticks: number[];
  niceMin: number;
  niceMax: number;
  step: number;
}

function niceAxis(min: number, max: number, targetTicks: number): NiceAxis {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    const center = Number.isFinite(min) ? min : 0;
    return { ticks: [center], niceMin: center, niceMax: center + 1, step: 1 };
  }
  const step = niceStep((max - min) / Math.max(1, targetTicks - 1));
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const count = Math.max(1, Math.round((niceMax - niceMin) / step) + 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) ticks.push(niceMin + i * step);
  return { ticks, niceMin, niceMax, step };
}

function priceLabel(p: number, step: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return `$${p.toFixed(decimals)}`;
}

function volumeLabel(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const m = v / 1_000_000;
    return Number.isInteger(m) ? `${m.toFixed(0)}M` : `${m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = v / 1_000;
    return Number.isInteger(k) ? `${k.toFixed(0)}K` : `${k.toFixed(1)}K`;
  }
  return `${Math.round(v)}`;
}

function aggregateBars(
  data: CandleBar[],
  bucketMinutes: number,
  maxPoints: number,
): CandleBar[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, CandleBar[]>();

  sorted.forEach((bar) => {
    const t = new Date(bar.timestamp).getTime();
    const bucket = Math.floor(t / bucketMs) * bucketMs;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(bar);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-maxPoints)
    .map(([bucket, bars]) => {
      const upVolume = bars.reduce((sum, b) => sum + b.upVolume, 0);
      const downVolume = bars.reduce((sum, b) => sum + b.downVolume, 0);
      return {
        timestamp: new Date(bucket).toISOString(),
        open: bars[0].open,
        close: bars[bars.length - 1].close,
        high: Math.max(...bars.map((b) => b.high)),
        low: Math.min(...bars.map((b) => b.low)),
        volume: upVolume + downVolume,
        upVolume,
        downVolume,
      };
    });
}

interface PairCandleChartProps {
  symbol: string;
  timeframe: ChartTimeframe;
  /** Optional label override for the chart heading (defaults to the symbol). */
  label?: string;
}

export default function PairCandleChart({ symbol, timeframe, label }: PairCandleChartProps) {
  const isMobile = useIsMobile();
  const { data: quote } = useMarketQuote(symbol, 1000);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const intervalMinutes =
    timeframe === "1min" ? 1 : timeframe === "5min" ? 5 : timeframe === "15min" ? 15 : timeframe === "1hr" ? 60 : 1440;

  const { rows: dataAll, loading, error } = useMarketHistorical(symbol, timeframe);
  const data = useMemo(() => dataAll.slice(-MAX_POINTS), [dataAll]);

  // Stage 1 — aggregate the historical rows (independent of the live tick).
  const historicalBars = useMemo(() => {
    const filtered = omitClosedMarketTimes(data || [], (d) => d.timestamp);
    const seed = filtered[0]?.close ?? filtered[0]?.price ?? 0;

    const normalized = filtered.reduce(
      (acc, d) => {
        const close = d.close ?? d.price ?? acc.prevClose;
        const open = d.open ?? acc.prevClose;
        const high = d.high ?? Math.max(open, close);
        const low = d.low ?? Math.min(open, close);
        const volume = d.volume ?? 0;
        const apiUp = d.up_volume ?? null;
        const apiDown = d.down_volume ?? null;
        const up = close >= open;
        const upVolume = apiUp !== null && apiDown !== null ? apiUp : up ? volume : 0;
        const downVolume = apiUp !== null && apiDown !== null ? apiDown : up ? 0 : volume;

        acc.rows.push({
          timestamp: d.timestamp,
          open,
          high,
          low,
          close,
          volume: upVolume + downVolume,
          upVolume,
          downVolume,
        });
        acc.prevClose = close;
        return acc;
      },
      { rows: [] as CandleBar[], prevClose: seed },
    );

    return aggregateBars(normalized.rows, intervalMinutes, MAX_POINTS);
  }, [data, intervalMinutes]);

  // Stage 2 — reconcile the live quote with the historical tip bar. Same
  // bucket-scoped, monotonic-widening, history-authoritative rules as
  // UnderlyingCandlesChart (see that file for the full rationale).
  const bars = useMemo(() => {
    if (historicalBars.length === 0) return historicalBars;
    const liveClose = quote?.close ?? null;
    if (liveClose == null || !quote?.session || quote.session === "closed") {
      return historicalBars;
    }
    const tip = historicalBars[historicalBars.length - 1];
    const bucketMs = intervalMinutes * 60 * 1000;
    const tipStartMs = new Date(tip.timestamp).getTime();
    if (!Number.isFinite(tipStartMs)) return historicalBars;
    const tipEndMs = tipStartMs + bucketMs;

    const quoteTsMs = quote.timestamp ? new Date(quote.timestamp).getTime() : NaN;
    if (!Number.isFinite(quoteTsMs) || quoteTsMs < tipStartMs || quoteTsMs >= tipEndMs) {
      return historicalBars;
    }
    if (liveClose === tip.close) return historicalBars;

    const patched = historicalBars.slice();
    patched[patched.length - 1] = {
      ...tip,
      close: liveClose,
      high: Math.max(tip.high, liveClose),
      low: Math.min(tip.low, liveClose),
    };
    return patched;
  }, [historicalBars, quote, intervalMinutes]);

  const dateMarkers = useMemo(() => {
    const markers: Array<{ index: number; label: string; key: string }> = [];
    let previousDateKey = "";
    bars.forEach((bar, index) => {
      const dt = new Date(bar.timestamp);
      const dateKey = dt.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      if (dateKey === previousDateKey) return;
      previousDateKey = dateKey;
      markers.push({
        index,
        key: bar.timestamp,
        label: dt.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
        }),
      });
    });
    return markers;
  }, [bars]);

  const width = 1100;
  const height = timeframe === "1day" ? 580 : 520;
  const padLeft = 66;
  const padRight = 28;
  const padTop = 24;
  const priceAreaBottom = 360;
  const volumeAreaTop = 384;
  const volumeAreaBottom = 476;

  const dateMarkersForLabels = useMemo(() => {
    if (dateMarkers.length <= 1) return dateMarkers;
    const minGap = isMobile ? 80 : 52;
    const filtered: Array<{ index: number; label: string; key: string }> = [];
    let lastLabeledX = Number.NEGATIVE_INFINITY;
    dateMarkers.forEach((marker) => {
      const x =
        padLeft +
        marker.index * ((width - padLeft - padRight) / Math.max(1, bars.length - 1));
      if (x - lastLabeledX < minGap) return;
      filtered.push(marker);
      lastLabeledX = x;
    });
    return filtered;
  }, [bars.length, dateMarkers, isMobile]);

  const labeledDateMarkerKeys = useMemo(
    () => new Set(dateMarkersForLabels.map((marker) => marker.key)),
    [dateMarkersForLabels],
  );

  const heading = label ?? quote?.symbol ?? symbol;

  if (loading && bars.length === 0) {
    return (
      <div className="rounded-lg p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
        <LoadingSpinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
        <ErrorMessage message={error} />
      </div>
    );
  }
  if (bars.length === 0) {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
      >
        No {symbol} timeseries data available
      </div>
    );
  }

  const minPrice = Math.min(...bars.map((b) => b.low));
  const maxPrice = Math.max(...bars.map((b) => b.high));
  const maxVol = Math.max(...bars.map((b) => b.volume), 0);
  const priceAxis = niceAxis(minPrice, maxPrice, 5);
  const volumeAxis = niceAxis(0, maxVol, 4);
  const xStep = (width - padLeft - padRight) / Math.max(1, bars.length - 1);
  const candleWidth = Math.max(3, Math.min(10, xStep * 0.6));

  const yPrice = (p: number) =>
    padTop +
    (1 - (p - priceAxis.niceMin) / Math.max(1e-9, priceAxis.niceMax - priceAxis.niceMin)) *
      (priceAreaBottom - padTop);
  const yVol = (v: number) =>
    volumeAreaBottom - (v / Math.max(1, volumeAxis.niceMax)) * (volumeAreaBottom - volumeAreaTop);

  const fallbackIdx = Math.max(0, bars.length - 1);
  const resolvedIdx = hoveredIdx !== null ? Math.max(0, Math.min(fallbackIdx, hoveredIdx)) : fallbackIdx;
  const hovered = bars[resolvedIdx] ?? null;

  const handleChartMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    if (bars.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPx = event.clientX - rect.left;
    const xView = (xPx / Math.max(1, rect.width)) * width;
    const idx = Math.round((xView - padLeft) / Math.max(1e-9, xStep));
    const clamped = Math.max(0, Math.min(bars.length - 1, idx));
    setHoveredIdx(clamped);
  };

  const isLive = quote?.session && quote.session !== "closed";

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{heading}</h3>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              color: isLive ? "var(--color-bull)" : "var(--text-muted)",
              backgroundColor: isLive ? "var(--color-bull-soft)" : "var(--color-surface-subtle)",
            }}
          >
            {isLive ? "LIVE" : "CLOSED"}
          </span>
          {quote?.close != null && (
            <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
              ${quote.close.toFixed(2)}
            </span>
          )}
        </div>
        {hovered && (
          <div
            className="text-[11px] rounded px-2 py-1 font-mono pointer-events-none whitespace-nowrap"
            style={{
              backgroundColor: "var(--color-chart-tooltip-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-chart-tooltip-text)",
            }}
          >
            O {hovered.open.toFixed(2)} · H {hovered.high.toFixed(2)} · L {hovered.low.toFixed(2)} · C {hovered.close.toFixed(2)}
          </div>
        )}
      </div>
      <MobileScrollableChart>
        <div className="relative w-full">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMinYMin meet"
            style={{ aspectRatio: `${width} / ${height}` }}
            className="block w-full"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <text
              x="16"
              y={(padTop + priceAreaBottom) / 2}
              transform={`rotate(-90, 16, ${(padTop + priceAreaBottom) / 2})`}
              fontSize="11"
              fill={"var(--text-secondary)"}
            >
              Price
            </text>

            {priceAxis.ticks.map((price) => {
              const y = yPrice(price);
              if (y < padTop - 0.5 || y > priceAreaBottom + 0.5) return null;
              return (
                <g key={`p-${price}`}>
                  <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke={"var(--text-secondary)"} opacity={0.2} />
                  <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill={"var(--text-secondary)"}>
                    {priceLabel(price, priceAxis.step)}
                  </text>
                </g>
              );
            })}

            <text
              x="16"
              y={(volumeAreaTop + volumeAreaBottom) / 2}
              transform={`rotate(-90, 16, ${(volumeAreaTop + volumeAreaBottom) / 2})`}
              fontSize="11"
              fill={"var(--text-secondary)"}
            >
              Volume
            </text>

            {volumeAxis.ticks.map((vol) => {
              const y = yVol(vol);
              if (y < volumeAreaTop - 0.5 || y > volumeAreaBottom + 0.5) return null;
              return (
                <g key={`v-${vol}`}>
                  <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke={"var(--text-secondary)"} opacity={0.12} />
                  <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill={"var(--text-secondary)"}>
                    {volumeLabel(vol)}
                  </text>
                </g>
              );
            })}

            {bars.map((b, i) => {
              const x = padLeft + i * xStep;
              const prevClose = i > 0 ? bars[i - 1].close : b.open;
              const isUp = b.close > prevClose;
              const isHollow = b.close > b.open;
              const c = isUp ? "var(--color-bull)" : "var(--color-bear)";
              const openY = yPrice(b.open);
              const closeY = yPrice(b.close);
              const highY = yPrice(b.high);
              const lowY = yPrice(b.low);
              const bodyY = Math.min(openY, closeY);
              const bodyH = Math.max(1, Math.abs(openY - closeY));

              const upTopY = yVol(b.upVolume + b.downVolume);
              const upBottomY = yVol(b.downVolume);
              const downTopY = yVol(b.downVolume);
              const downBottomY = volumeAreaBottom;

              return (
                <g key={b.timestamp}>
                  <rect
                    x={x - Math.max(candleWidth, xStep * 1.4) / 2}
                    y={padTop}
                    width={Math.max(candleWidth, xStep * 1.4)}
                    height={volumeAreaBottom - padTop}
                    fill="transparent"
                  />
                  <line x1={x} x2={x} y1={highY} y2={Math.min(openY, closeY)} stroke={c} strokeWidth={1} />
                  <line x1={x} x2={x} y1={Math.max(openY, closeY)} y2={lowY} stroke={c} strokeWidth={1} />
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyY}
                    width={candleWidth}
                    height={bodyH}
                    fill={isHollow ? "transparent" : c}
                    stroke={c}
                    strokeWidth={1}
                  />
                  {b.downVolume > 0 && (
                    <rect
                      x={x - candleWidth / 2}
                      y={downTopY}
                      width={candleWidth}
                      height={Math.max(1, downBottomY - downTopY)}
                      fill={"var(--color-bear)"}
                      opacity={0.75}
                    />
                  )}
                  {b.upVolume > 0 && (
                    <rect
                      x={x - candleWidth / 2}
                      y={upTopY}
                      width={candleWidth}
                      height={Math.max(1, upBottomY - upTopY)}
                      fill={"var(--color-bull)"}
                      opacity={0.75}
                    />
                  )}
                  {timeframe !== "1day" && i % Math.ceil(bars.length / (isMobile ? 4 : 8)) === 0 && (
                    <text
                      x={x}
                      y={volumeAreaBottom + 16}
                      fontSize={isMobile ? "8" : "10"}
                      textAnchor="middle"
                      fill={"var(--text-primary)"}
                    >
                      {new Date(b.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </text>
                  )}
                </g>
              );
            })}

            {dateMarkers.map((marker) => {
              const x = padLeft + marker.index * xStep;
              const showLabel = labeledDateMarkerKeys.has(marker.key);
              return (
                <g key={`date-marker-${marker.key}`}>
                  <line x1={x} x2={x} y1={padTop} y2={volumeAreaBottom} stroke={"var(--text-secondary)"} opacity={0.22} />
                  {showLabel ? (
                    timeframe === "1day" ? (
                      <text
                        x={x + 6}
                        y={volumeAreaBottom + 40}
                        fontSize="10"
                        textAnchor="start"
                        fill={"var(--text-secondary)"}
                        transform={`rotate(-90, ${x + 6}, ${volumeAreaBottom + 40})`}
                      >
                        {marker.label}
                      </text>
                    ) : (
                      <text x={x + 4} y={volumeAreaBottom + 28} fontSize="10" textAnchor="start" fill={"var(--text-secondary)"}>
                        {marker.label}
                      </text>
                    )
                  ) : null}
                </g>
              );
            })}

            {hovered && (
              <line
                x1={padLeft + resolvedIdx * xStep}
                x2={padLeft + resolvedIdx * xStep}
                y1={padTop}
                y2={volumeAreaBottom}
                stroke={"var(--text-secondary)"}
                opacity={0.5}
                strokeDasharray="3,3"
                pointerEvents="none"
              />
            )}

            <line x1={padLeft} x2={width - padRight} y1={priceAreaBottom} y2={priceAreaBottom} stroke={"var(--text-secondary)"} opacity={0.35} />
            <line x1={padLeft} x2={width - padRight} y1={volumeAreaBottom} y2={volumeAreaBottom} stroke={"var(--text-secondary)"} opacity={0.6} />
          </svg>
        </div>
      </MobileScrollableChart>
    </div>
  );
}
