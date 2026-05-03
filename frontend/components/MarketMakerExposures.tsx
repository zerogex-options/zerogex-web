'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Settings2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  useApiData,
  useGEXByStrike,
  useGEXSummary,
  useMarketQuote,
} from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { omitClosedMarketTimes } from '@/core/utils';

interface PriceBar {
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

type OpenInterestApiResponse = {
  spot_price?: number | string;
  contracts?: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  results?: Record<string, unknown>[];
};

interface OpenInterestRow {
  strike?: number | string;
  expiration?: string;
  option_type?: string | null;
  open_interest?: number | string | null;
  call_oi?: number | string | null;
  put_oi?: number | string | null;
}

interface StrikeAggregation {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
  callOi: number;
  putOi: number;
}

const TIMEFRAME_OPTIONS = ['1m', '5m', '15m', '1h', '1d'] as const;
type ChartTf = (typeof TIMEFRAME_OPTIONS)[number];

function tfToApi(tf: ChartTf): string {
  return tf === '1m' ? '1min' : tf === '5m' ? '5min' : tf === '15m' ? '15min' : tf === '1h' ? '1hr' : '1day';
}

function formatExposure(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

function niceStep(range: number, targetCount = 10): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / Math.max(1, targetCount);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  if (norm < 1.5) return 1 * magnitude;
  if (norm < 3.5) return 2 * magnitude;
  if (norm < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

// SVG layout constants — chosen to match the reference screenshot proportions.
const CW = 1200;
const CH = 720;
const PLOT_TOP = 24;
const PLOT_BOTTOM = CH - 72;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

const LEFT_X = 0;
const LEFT_W = 540;
const STRIKE_X = LEFT_X + LEFT_W;
const STRIKE_W = 64;
const GAP = 12;
const MID_X = STRIKE_X + STRIKE_W + GAP;
const MID_W = 280;
const RIGHT_X = MID_X + MID_W + GAP;
const RIGHT_W = CW - RIGHT_X;

const SPOT_LINE = '#06B6D4';
const KEY_LEVEL = '#F5C24A';
const FLIP_LINE = '#FFB44A';

export default function MarketMakerExposures() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  const isDark = theme === 'dark';
  const textPrimary = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const border = colors.muted;
  const subtle = colors.muted;
  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const [tf, setTf] = useState<ChartTf>('1m');
  const [withPrev, setWithPrev] = useState(true);

  // ── Data fetching (mirrors hooks used by UnderlyingCandlesChart, GexStrikeChart, GexWallsChart) ──
  const { data: gexSummary } = useGEXSummary(symbol, 5000);
  const { data: quote } = useMarketQuote(symbol, 1000);
  const { data: gexByStrike } = useGEXByStrike(symbol, 200, 10000, 'impact');
  const { data: openInterestData } = useApiData<OpenInterestApiResponse | OpenInterestRow[] | null>(
    `/api/market/open-interest?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval: 30000 },
  );
  const { data: priceBars } = useApiData<PriceBar[]>(
    `/api/market/historical?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}&timeframe=${tfToApi(tf)}&window_units=400`,
    { refreshInterval: 5000 },
  );

  const openInterestRows = useMemo<OpenInterestRow[]>(() => {
    if (!openInterestData) return [];
    if (Array.isArray(openInterestData)) return openInterestData;
    const p = openInterestData as Record<string, unknown>;
    for (const key of ['contracts', 'rows', 'data', 'items', 'results'] as const) {
      if (Array.isArray(p[key])) return p[key] as OpenInterestRow[];
    }
    return [];
  }, [openInterestData]);

  const oiByStrike = useMemo(() => {
    const grouped = new Map<number, { callOi: number; putOi: number }>();
    openInterestRows.forEach((row) => {
      const strike = Number(row.strike);
      if (!Number.isFinite(strike) || strike <= 0) return;
      const existing = grouped.get(strike) ?? { callOi: 0, putOi: 0 };
      const optionType = String(row.option_type || '').toUpperCase();
      const oi = Number(row.open_interest ?? 0);
      if (optionType.startsWith('C')) existing.callOi += oi;
      else if (optionType.startsWith('P')) existing.putOi += oi;
      else {
        existing.callOi += Number(row.call_oi ?? 0);
        existing.putOi += Number(row.put_oi ?? 0);
      }
      grouped.set(strike, existing);
    });
    return grouped;
  }, [openInterestRows]);

  const strikeAggregations = useMemo<StrikeAggregation[]>(() => {
    const grouped = new Map<number, StrikeAggregation>();
    (gexByStrike || []).forEach((row) => {
      const strike = Number(row.strike);
      if (!Number.isFinite(strike)) return;
      const existing = grouped.get(strike) ?? { strike, netGex: 0, callGex: 0, putGex: 0, callOi: 0, putOi: 0 };
      existing.netGex += Number(row.net_gex || 0);
      existing.callGex += Number(row.call_gex || 0);
      existing.putGex += Number(row.put_gex || 0);
      existing.callOi += Number(row.call_oi || 0);
      existing.putOi += Number(row.put_oi || 0);
      grouped.set(strike, existing);
    });
    if (oiByStrike.size > 0) {
      grouped.forEach((value, key) => {
        const oi = oiByStrike.get(key);
        if (oi) {
          value.callOi = oi.callOi;
          value.putOi = oi.putOi;
        }
      });
    }
    return Array.from(grouped.values()).sort((a, b) => b.strike - a.strike);
  }, [gexByStrike, oiByStrike]);

  const spot = useMemo(() => {
    const candidates = [quote?.close, gexSummary?.spot_price].filter((v) => Number.isFinite(Number(v)));
    return candidates.length > 0 ? Number(candidates[0]) : null;
  }, [quote, gexSummary]);

  const change = useMemo(() => {
    if (!quote) return null;
    const c = Number(quote.close);
    const o = Number(quote.open);
    if (!Number.isFinite(c) || !Number.isFinite(o) || o === 0) return null;
    return { value: c - o, pct: ((c - o) / o) * 100 };
  }, [quote]);

  const candles = useMemo(() => {
    const filtered = omitClosedMarketTimes(priceBars || [], (b) => b.timestamp);
    return filtered
      .map((b) => ({
        timestamp: b.timestamp,
        open: Number(b.open ?? b.close ?? 0),
        close: Number(b.close ?? b.open ?? 0),
        high: Number(b.high ?? b.close ?? 0),
        low: Number(b.low ?? b.close ?? 0),
      }))
      .filter((c) => Number.isFinite(c.open) && c.open > 0);
  }, [priceBars]);

  const yBounds = useMemo(() => {
    const prices: number[] = [];
    candles.forEach((c) => prices.push(c.high, c.low));
    if (spot != null) prices.push(spot);

    if (prices.length === 0 && strikeAggregations.length === 0) return null;

    if (spot != null && spot > 0) {
      const baseSpread = prices.length > 0
        ? Math.max(Math.max(...prices) - spot, spot - Math.min(...prices))
        : spot * 0.02;
      const halfRange = Math.max(baseSpread, spot * 0.012) * 1.6;
      return { yMin: spot - halfRange, yMax: spot + halfRange };
    }

    if (prices.length > 0) {
      const pMin = Math.min(...prices);
      const pMax = Math.max(...prices);
      const center = (pMin + pMax) / 2;
      const halfRange = Math.max((pMax - pMin) / 2, center * 0.02) * 1.4;
      return { yMin: center - halfRange, yMax: center + halfRange };
    }

    return {
      yMin: Math.min(...strikeAggregations.map((s) => s.strike)),
      yMax: Math.max(...strikeAggregations.map((s) => s.strike)),
    };
  }, [candles, strikeAggregations, spot]);

  const yForPrice = (price: number): number => {
    if (!yBounds) return PLOT_TOP;
    const { yMin, yMax } = yBounds;
    return PLOT_TOP + (1 - (price - yMin) / Math.max(1e-9, yMax - yMin)) * PLOT_HEIGHT;
  };

  const strikeLabels = useMemo(() => {
    if (!yBounds) return [];
    const { yMin, yMax } = yBounds;
    const step = niceStep(yMax - yMin, 11);
    const start = Math.ceil(yMin / step) * step;
    const labels: number[] = [];
    for (let v = start; v <= yMax; v += step) {
      labels.push(Number(v.toFixed(2)));
    }
    return labels;
  }, [yBounds]);

  const visibleStrikes = useMemo(() => {
    if (!yBounds) return [] as StrikeAggregation[];
    return strikeAggregations.filter((s) => s.strike >= yBounds.yMin && s.strike <= yBounds.yMax);
  }, [strikeAggregations, yBounds]);

  const gammaXMax = useMemo(() => {
    if (visibleStrikes.length === 0) return 1;
    return Math.max(
      1,
      ...visibleStrikes.map((s) => Math.max(Math.abs(s.callGex), Math.abs(s.putGex), Math.abs(s.netGex))),
    );
  }, [visibleStrikes]);

  const positionsXMax = useMemo(() => {
    if (visibleStrikes.length === 0) return 1;
    return Math.max(1, ...visibleStrikes.map((s) => Math.max(Math.abs(s.callOi), Math.abs(s.putOi))));
  }, [visibleStrikes]);

  const timeBounds = useMemo(() => {
    if (candles.length === 0) return null;
    const times = candles.map((c) => new Date(c.timestamp).getTime()).filter(Number.isFinite);
    if (times.length === 0) return null;
    return { tMin: Math.min(...times), tMax: Math.max(...times) };
  }, [candles]);

  const xForTime = (t: number): number => {
    if (!timeBounds) return LEFT_X;
    const { tMin, tMax } = timeBounds;
    const usableW = LEFT_W - 24;
    const ratio = (t - tMin) / Math.max(1, tMax - tMin);
    return LEFT_X + 12 + ratio * usableW;
  };

  const timeLabels = useMemo(() => {
    if (!timeBounds) return [] as Array<{ t: number; label: string }>;
    const { tMin, tMax } = timeBounds;
    const out: Array<{ t: number; label: string }> = [];
    const start = new Date(tMin);
    start.setHours(0, 0, 0, 0);
    for (let h = 9; h <= 16; h += 2) {
      const d = new Date(start);
      d.setHours(h);
      const t = d.getTime();
      if (t >= tMin && t <= tMax) {
        out.push({
          t,
          label: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(/\s/, ' '),
        });
      }
    }
    return out;
  }, [timeBounds]);

  const keyLevels = useMemo(() => {
    if (!yBounds) return [] as Array<{ y: number; price: number; color: string; emphasized?: boolean }>;
    const yFor = (price: number) =>
      PLOT_TOP + (1 - (price - yBounds.yMin) / Math.max(1e-9, yBounds.yMax - yBounds.yMin)) * PLOT_HEIGHT;
    const items: Array<{ y: number; price: number; color: string; emphasized?: boolean }> = [];
    const flip = gexSummary?.gamma_flip;
    if (flip != null && Number.isFinite(flip)) {
      items.push({ y: yFor(flip), price: flip, color: FLIP_LINE });
    }
    if (gexSummary?.call_wall != null && Number.isFinite(gexSummary.call_wall)) {
      items.push({ y: yFor(gexSummary.call_wall), price: gexSummary.call_wall, color: KEY_LEVEL });
    }
    if (spot != null) {
      items.push({ y: yFor(spot), price: spot, color: SPOT_LINE, emphasized: true });
    }
    if (gexSummary?.put_wall != null && Number.isFinite(gexSummary.put_wall)) {
      items.push({ y: yFor(gexSummary.put_wall), price: gexSummary.put_wall, color: KEY_LEVEL });
    }
    return items;
  }, [gexSummary, spot, yBounds]);

  const expiryLabel = useMemo(() => {
    const exps = new Set<string>();
    (gexByStrike || []).forEach((row) => {
      const exp = String(row.expiration || '').trim();
      if (exp) exps.add(exp);
    });
    return exps.size === 0 ? '—' : Array.from(exps).sort()[0];
  }, [gexByStrike]);

  const now = new Date();
  const dteLabel = (() => {
    if (!expiryLabel || expiryLabel === '—') return '—';
    const expDate = new Date(expiryLabel);
    if (Number.isNaN(expDate.getTime())) return '—';
    const days = Math.max(0, Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return `${days}d`;
  })();
  const todayLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const updatedLabel = useMemo(() => {
    const ts = quote?.timestamp || gexSummary?.timestamp;
    return ts ? new Date(ts).toLocaleTimeString() : '—';
  }, [quote, gexSummary]);

  if (!yBounds) {
    return (
      <div
        className="rounded-2xl p-12 text-center"
        style={{ backgroundColor: cardBg, border: `1px solid ${border}`, color: subtle }}
      >
        Loading market maker exposures…
      </div>
    );
  }

  const toolbarBtnStyle = (active = false): React.CSSProperties => ({
    border: `1px solid ${border}`,
    color: active ? textPrimary : subtle,
    backgroundColor: active ? 'var(--color-info-soft)' : 'transparent',
  });
  const toolbarBtnClass = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors';

  return (
    <div
      className="rounded-2xl"
      style={{ backgroundColor: cardBg, border: `1px solid ${border}`, overflow: 'hidden' }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${border}`, color: textPrimary }}
      >
        <div className="text-sm font-semibold tracking-wide">{symbol} Market Maker Exposures</div>
        <div className="flex items-center gap-3 text-xs" style={{ color: subtle }}>
          <span>↗</span>
          <span>⤢</span>
          <span>×</span>
        </div>
      </div>

      {/* Symbol + price banner */}
      <div className="flex items-baseline gap-3 px-5 pt-4" style={{ color: textPrimary }}>
        <span className="font-semibold text-base">{symbol}</span>
        <span className="font-bold text-2xl tabular-nums">{spot != null ? spot.toFixed(2) : '--'}</span>
        {change && (
          <span
            className="text-base font-semibold tabular-nums"
            style={{ color: change.value >= 0 ? colors.bullish : colors.bearish }}
          >
            {change.value >= 0 ? '+' : ''}
            {change.value.toFixed(2)} ({change.value >= 0 ? '+' : ''}
            {change.pct.toFixed(2)}%)
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3 pb-3">
        <button type="button" title="Date selector" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <ChevronLeft size={12} />
          <Calendar size={12} />
          <span>{todayLabel}</span>
          <ChevronRight size={12} />
        </button>
        <button type="button" title="Timeframe window" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <ChevronLeft size={12} />
          <span>Live</span>
          <Clock size={12} />
        </button>
        <button type="button" title="Front expiry" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <span>Expiry {expiryLabel}</span>
        </button>
        <button type="button" title="DTE" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <span>DTE {dteLabel}</span>
          <Clock size={12} />
        </button>
        <button type="button" title="Chart options" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <BarChart3 size={12} />
        </button>
        <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${border}` }}>
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTf(option)}
              className="px-2.5 py-1.5 text-xs font-semibold"
              style={{
                color: option === tf ? textPrimary : subtle,
                backgroundColor: option === tf ? 'var(--color-info-soft)' : 'transparent',
              }}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          type="button"
          title="Toggle previous session overlay"
          onClick={() => setWithPrev((v) => !v)}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(withPrev)}
        >
          <span>With Prev</span>
        </button>
        <button type="button" title="Zoom out" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <ZoomOut size={12} />
        </button>
        <button type="button" title="Zoom in" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <ZoomIn size={12} />
        </button>
        <button type="button" title="Play / replay" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <Play size={12} />
        </button>
        <button type="button" title="Settings" className={toolbarBtnClass} style={toolbarBtnStyle()}>
          <Settings2 size={12} />
        </button>
        <div className="ml-auto text-xs" style={{ color: subtle }}>
          Updated {updatedLabel}
        </div>
      </div>

      {/* Composite chart */}
      <div className="overflow-x-auto px-2 pb-2">
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
          style={{ minWidth: 760 }}
        >
          {/* Shared horizontal grid + strike labels */}
          {strikeLabels.map((p) => {
            const y = yForPrice(p);
            return (
              <g key={`grid-${p}`}>
                <line x1={LEFT_X} x2={STRIKE_X} y1={y} y2={y} stroke={gridStroke} />
                <line x1={MID_X} x2={MID_X + MID_W} y1={y} y2={y} stroke={gridStroke} />
                <line x1={RIGHT_X} x2={RIGHT_X + RIGHT_W} y1={y} y2={y} stroke={gridStroke} />
                <text
                  x={STRIKE_X + STRIKE_W / 2}
                  y={y + 3.5}
                  textAnchor="middle"
                  fontSize={11}
                  fill={subtle}
                  fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                >
                  {p.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* ── LEFT PANEL: candlestick price chart ── */}
          {candles.map((c, i) => {
            const x = xForTime(new Date(c.timestamp).getTime());
            const yO = yForPrice(c.open);
            const yC = yForPrice(c.close);
            const yH = yForPrice(c.high);
            const yL = yForPrice(c.low);
            const up = c.close >= c.open;
            const color = up ? colors.bullish : colors.bearish;
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(1, Math.abs(yO - yC));
            const candleW = 2.2;
            return (
              <g key={`cdl-${i}-${c.timestamp}`}>
                <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={1} />
                <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
              </g>
            );
          })}

          {/* Time axis labels */}
          {timeLabels.map((tl) => (
            <text
              key={`tlbl-${tl.t}`}
              x={xForTime(tl.t)}
              y={PLOT_BOTTOM + 18}
              textAnchor="middle"
              fontSize={11}
              fill={subtle}
            >
              {tl.label}
            </text>
          ))}

          {/* ── MIDDLE PANEL: Gamma horizontal bars ── */}
          <line
            x1={MID_X + MID_W / 2}
            x2={MID_X + MID_W / 2}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke={subtle}
            opacity={0.35}
          />
          {visibleStrikes.map((s) => {
            const y = yForPrice(s.strike);
            const barH = Math.max(2, Math.min(10, (PLOT_HEIGHT / Math.max(1, visibleStrikes.length)) * 0.55));
            const callW = (Math.abs(s.callGex) / gammaXMax) * (MID_W / 2);
            const putW = (Math.abs(s.putGex) / gammaXMax) * (MID_W / 2);
            return (
              <g key={`gex-${s.strike}`}>
                <circle cx={MID_X + MID_W / 2} cy={y} r={1.4} fill={subtle} opacity={0.55} />
                {s.callGex !== 0 && (
                  <rect
                    x={MID_X + MID_W / 2}
                    y={y - barH / 2}
                    width={Math.max(0, callW)}
                    height={barH}
                    fill={colors.bullish}
                    opacity={0.95}
                  />
                )}
                {s.putGex !== 0 && (
                  <rect
                    x={MID_X + MID_W / 2 - Math.max(0, putW)}
                    y={y - barH / 2}
                    width={Math.max(0, putW)}
                    height={barH}
                    fill={colors.bearish}
                    opacity={0.95}
                  />
                )}
              </g>
            );
          })}
          <text x={MID_X} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="start">
            -{formatExposure(gammaXMax)}
          </text>
          <text x={MID_X + MID_W / 2} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="middle">
            0
          </text>
          <text x={MID_X + MID_W} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="end">
            {formatExposure(gammaXMax)}
          </text>
          <text
            x={MID_X + MID_W / 2}
            y={PLOT_BOTTOM + 38}
            fontSize={11}
            fill={textPrimary}
            textAnchor="middle"
            fontWeight={600}
          >
            Gamma
          </text>

          {/* ── RIGHT PANEL: Positions horizontal bars ── */}
          <line
            x1={RIGHT_X + RIGHT_W / 2}
            x2={RIGHT_X + RIGHT_W / 2}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke={subtle}
            opacity={0.35}
          />
          {visibleStrikes.map((s) => {
            const y = yForPrice(s.strike);
            const barH = Math.max(2, Math.min(10, (PLOT_HEIGHT / Math.max(1, visibleStrikes.length)) * 0.55));
            const callW = (s.callOi / positionsXMax) * (RIGHT_W / 2);
            const putW = (s.putOi / positionsXMax) * (RIGHT_W / 2);
            return (
              <g key={`pos-${s.strike}`}>
                {s.callOi > 0 && (
                  <rect
                    x={RIGHT_X + RIGHT_W / 2}
                    y={y - barH / 2}
                    width={Math.max(0, callW)}
                    height={barH}
                    fill={colors.bullish}
                    opacity={0.95}
                  />
                )}
                {s.putOi > 0 && (
                  <rect
                    x={RIGHT_X + RIGHT_W / 2 - Math.max(0, putW)}
                    y={y - barH / 2}
                    width={Math.max(0, putW)}
                    height={barH}
                    fill={colors.bearish}
                    opacity={0.95}
                  />
                )}
              </g>
            );
          })}
          <text x={RIGHT_X} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="start">
            -{formatExposure(positionsXMax)}
          </text>
          <text x={RIGHT_X + RIGHT_W / 2} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="middle">
            0
          </text>
          <text x={RIGHT_X + RIGHT_W} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="end">
            {formatExposure(positionsXMax)}
          </text>
          <text
            x={RIGHT_X + RIGHT_W / 2}
            y={PLOT_BOTTOM + 38}
            fontSize={11}
            fill={textPrimary}
            textAnchor="middle"
            fontWeight={600}
          >
            Positions
          </text>

          {/* ── Shared horizontal price level lines (drawn last so they sit on top) ── */}
          {keyLevels.map((lvl, i) => (
            <g key={`lvl-${i}-${lvl.price}`}>
              <line
                x1={LEFT_X}
                x2={CW}
                y1={lvl.y}
                y2={lvl.y}
                stroke={lvl.color}
                strokeDasharray={lvl.emphasized ? '5 3' : '4 4'}
                strokeWidth={lvl.emphasized ? 1.4 : 1}
                opacity={0.85}
              />
              <text
                x={CW - 4}
                y={lvl.y - 3}
                fontSize={10}
                textAnchor="end"
                fill={lvl.color}
                fontWeight={600}
              >
                {lvl.price.toFixed(2)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Bottom strip */}
      <div
        className="flex items-center justify-between px-5 py-2 text-xs"
        style={{ borderTop: `1px solid ${border}`, color: subtle }}
      >
        <span>Powered by ZeroGEX</span>
        <span>Gamma / Positions</span>
      </div>
    </div>
  );
}
