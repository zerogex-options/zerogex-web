'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Clock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
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

function tfWindow(tf: ChartTf): number {
  // Always fetch enough bars to cover ~2 trading sessions so the "With Prev"
  // toggle never has to refire the request.
  return tf === '1m' ? 800 : tf === '5m' ? 200 : tf === '15m' ? 80 : tf === '1h' ? 30 : 60;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 1.43; // ≈ 1/0.7

const DEFAULTS = {
  tf: '1m' as ChartTf,
  withPrev: false,
  selectedExpiry: 'all',
  zoomMul: 1.6,
  paused: false,
  gexMode: 'split' as 'split' | 'net',
  showOiDots: true,
  showGrid: true,
};

export default function MarketMakerExposures() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  const isDark = theme === 'dark';
  const textPrimary = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const border = colors.muted;
  const subtle = colors.muted;
  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const popoverBg = isDark ? '#0f2935' : '#FFFFFF';

  // ── User-controlled view state ──
  const [tf, setTf] = useState<ChartTf>(DEFAULTS.tf);
  const [withPrev, setWithPrev] = useState<boolean>(DEFAULTS.withPrev);
  const [selectedExpiry, setSelectedExpiry] = useState<string>(DEFAULTS.selectedExpiry);
  const [zoomMul, setZoomMul] = useState<number>(DEFAULTS.zoomMul);
  const [paused, setPaused] = useState<boolean>(DEFAULTS.paused);
  const [gexMode, setGexMode] = useState<'split' | 'net'>(DEFAULTS.gexMode);
  const [showOiDots, setShowOiDots] = useState<boolean>(DEFAULTS.showOiDots);
  const [showGrid, setShowGrid] = useState<boolean>(DEFAULTS.showGrid);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [expiryOpen, setExpiryOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const resetAll = () => {
    setTf(DEFAULTS.tf);
    setWithPrev(DEFAULTS.withPrev);
    setSelectedExpiry(DEFAULTS.selectedExpiry);
    setZoomMul(DEFAULTS.zoomMul);
    setPaused(DEFAULTS.paused);
    setGexMode(DEFAULTS.gexMode);
    setShowOiDots(DEFAULTS.showOiDots);
    setShowGrid(DEFAULTS.showGrid);
  };

  const expiryRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expiryOpen && !settingsOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (expiryOpen && !expiryRef.current?.contains(target)) setExpiryOpen(false);
      if (settingsOpen && !settingsRef.current?.contains(target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expiryOpen, settingsOpen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // ── Pause-aware polling intervals (passing 0 disables the interval after the initial fetch) ──
  const summaryInterval = paused ? 0 : 5000;
  const quoteInterval = paused ? 0 : 1000;
  const strikeInterval = paused ? 0 : 10000;
  const oiInterval = paused ? 0 : 30000;
  const priceInterval = paused ? 0 : 5000;

  // ── Data fetching (mirrors hooks used by UnderlyingCandlesChart, GexStrikeChart, GexWallsChart) ──
  const { data: gexSummary } = useGEXSummary(symbol, summaryInterval);
  const { data: quote } = useMarketQuote(symbol, quoteInterval);
  const { data: gexByStrike } = useGEXByStrike(symbol, 200, strikeInterval, 'impact');
  const { data: openInterestData } = useApiData<OpenInterestApiResponse | OpenInterestRow[] | null>(
    `/api/market/open-interest?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval: oiInterval },
  );
  const { data: priceBars } = useApiData<PriceBar[]>(
    `/api/market/historical?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}&timeframe=${tfToApi(tf)}&window_units=${tfWindow(tf)}`,
    { refreshInterval: priceInterval },
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

  const availableExpirations = useMemo(() => {
    const exps = new Set<string>();
    (gexByStrike || []).forEach((row) => {
      const exp = String(row.expiration || '').trim();
      if (exp) exps.add(exp);
    });
    openInterestRows.forEach((row) => {
      const exp = String(row.expiration || '').trim();
      if (exp) exps.add(exp);
    });
    return Array.from(exps).sort();
  }, [gexByStrike, openInterestRows]);

  const filteredGexByStrike = useMemo(() => {
    if (selectedExpiry === 'all') return gexByStrike || [];
    return (gexByStrike || []).filter((row) => String(row.expiration || '') === selectedExpiry);
  }, [gexByStrike, selectedExpiry]);

  const filteredOiByStrike = useMemo(() => {
    const grouped = new Map<number, { callOi: number; putOi: number }>();
    const source = selectedExpiry === 'all'
      ? openInterestRows
      : openInterestRows.filter((row) => String(row.expiration || '') === selectedExpiry);
    source.forEach((row) => {
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
  }, [openInterestRows, selectedExpiry]);

  const strikeAggregations = useMemo<StrikeAggregation[]>(() => {
    const grouped = new Map<number, StrikeAggregation>();
    filteredGexByStrike.forEach((row) => {
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
    if (filteredOiByStrike.size > 0) {
      grouped.forEach((value, key) => {
        const oi = filteredOiByStrike.get(key);
        if (oi) {
          value.callOi = oi.callOi;
          value.putOi = oi.putOi;
        }
      });
    }
    return Array.from(grouped.values()).sort((a, b) => b.strike - a.strike);
  }, [filteredGexByStrike, filteredOiByStrike]);

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

  const allCandles = useMemo(() => {
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

  const nyDateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [],
  );

  const todaySessionDate = useMemo(() => {
    if (allCandles.length === 0) return '';
    return nyDateFmt.format(new Date(allCandles[allCandles.length - 1].timestamp));
  }, [allCandles, nyDateFmt]);

  const visibleCandles = useMemo(() => {
    if (allCandles.length === 0 || !todaySessionDate) return allCandles;
    if (withPrev) return allCandles;
    return allCandles.filter((c) => nyDateFmt.format(new Date(c.timestamp)) === todaySessionDate);
  }, [allCandles, withPrev, todaySessionDate, nyDateFmt]);

  const yBounds = useMemo(() => {
    const prices: number[] = [];
    visibleCandles.forEach((c) => prices.push(c.high, c.low));
    if (spot != null) prices.push(spot);

    if (prices.length === 0 && strikeAggregations.length === 0) return null;

    if (spot != null && spot > 0) {
      const baseSpread = prices.length > 0
        ? Math.max(Math.max(...prices) - spot, spot - Math.min(...prices))
        : spot * 0.02;
      const halfRange = Math.max(baseSpread, spot * 0.012) * zoomMul;
      return { yMin: spot - halfRange, yMax: spot + halfRange };
    }

    if (prices.length > 0) {
      const pMin = Math.min(...prices);
      const pMax = Math.max(...prices);
      const center = (pMin + pMax) / 2;
      const halfRange = Math.max((pMax - pMin) / 2, center * 0.02) * zoomMul;
      return { yMin: center - halfRange, yMax: center + halfRange };
    }

    return {
      yMin: Math.min(...strikeAggregations.map((s) => s.strike)),
      yMax: Math.max(...strikeAggregations.map((s) => s.strike)),
    };
  }, [visibleCandles, strikeAggregations, spot, zoomMul]);

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
    if (visibleCandles.length === 0) return null;
    const times = visibleCandles.map((c) => new Date(c.timestamp).getTime()).filter(Number.isFinite);
    if (times.length === 0) return null;
    return { tMin: Math.min(...times), tMax: Math.max(...times) };
  }, [visibleCandles]);

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
    const span = tMax - tMin;
    const oneDay = 24 * 60 * 60 * 1000;
    if (span <= oneDay * 1.5) {
      // Intraday: hourly labels
      const start = new Date(tMin);
      start.setHours(0, 0, 0, 0);
      for (let day = 0; day < 3; day++) {
        for (let h = 9; h <= 16; h += 2) {
          const d = new Date(start);
          d.setDate(d.getDate() + day);
          d.setHours(h);
          const t = d.getTime();
          if (t >= tMin && t <= tMax) {
            out.push({
              t,
              label: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(/\s/, ' '),
            });
          }
        }
      }
    } else {
      // Multi-day: date labels
      const step = Math.max(oneDay, span / 6);
      for (let t = tMin; t <= tMax; t += step) {
        const d = new Date(t);
        out.push({ t, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
      }
    }
    return out;
  }, [timeBounds]);

  const keyLevels = useMemo(() => {
    if (!yBounds) return [] as Array<{ y: number; price: number; color: string; label: string; emphasized?: boolean }>;
    const yFor = (price: number) =>
      PLOT_TOP + (1 - (price - yBounds.yMin) / Math.max(1e-9, yBounds.yMax - yBounds.yMin)) * PLOT_HEIGHT;
    const items: Array<{ y: number; price: number; color: string; label: string; emphasized?: boolean }> = [];
    const flip = gexSummary?.gamma_flip;
    if (flip != null && Number.isFinite(flip)) {
      items.push({ y: yFor(flip), price: flip, color: FLIP_LINE, label: 'Gamma Flip' });
    }
    if (gexSummary?.call_wall != null && Number.isFinite(gexSummary.call_wall)) {
      items.push({ y: yFor(gexSummary.call_wall), price: gexSummary.call_wall, color: KEY_LEVEL, label: 'Call Wall' });
    }
    if (spot != null) {
      items.push({ y: yFor(spot), price: spot, color: SPOT_LINE, label: 'Spot', emphasized: true });
    }
    if (gexSummary?.put_wall != null && Number.isFinite(gexSummary.put_wall)) {
      items.push({ y: yFor(gexSummary.put_wall), price: gexSummary.put_wall, color: KEY_LEVEL, label: 'Put Wall' });
    }
    return items;
  }, [gexSummary, spot, yBounds]);

  // ── Hover tracking for tooltips/crosshair ──
  const containerRef = useRef<HTMLDivElement | null>(null);
  type HoverState = {
    pxX: number;
    pxY: number;
    svgX: number;
    svgY: number;
    panel: 'left' | 'middle' | 'right' | null;
  };
  const [hover, setHover] = useState<HoverState | null>(null);

  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const pxX = e.clientX - containerRect.left;
    const pxY = e.clientY - containerRect.top;
    const svgX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * CW;
    const svgY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * CH;
    let panel: HoverState['panel'] = null;
    if (svgY >= PLOT_TOP && svgY <= PLOT_BOTTOM) {
      if (svgX >= LEFT_X && svgX <= LEFT_X + LEFT_W) panel = 'left';
      else if (svgX >= MID_X && svgX <= MID_X + MID_W) panel = 'middle';
      else if (svgX >= RIGHT_X && svgX <= RIGHT_X + RIGHT_W) panel = 'right';
    }
    setHover({ pxX, pxY, svgX, svgY, panel });
  };

  // Linear scans — cheap enough to compute on every render without useMemo, and
  // avoids tripping the manual-memoization lint rule on the inline closures.
  const hoveredCandle = (() => {
    if (!hover || hover.panel !== 'left' || !timeBounds || visibleCandles.length === 0) return null;
    let best: (typeof visibleCandles)[number] | null = null;
    let bestDist = Infinity;
    for (const c of visibleCandles) {
      const cx = xForTime(new Date(c.timestamp).getTime());
      const dist = Math.abs(cx - hover.svgX);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best;
  })();

  const hoveredStrike = (() => {
    if (!hover || (hover.panel !== 'middle' && hover.panel !== 'right') || visibleStrikes.length === 0) return null;
    let best: (typeof visibleStrikes)[number] | null = null;
    let bestDist = Infinity;
    for (const s of visibleStrikes) {
      const sy = yForPrice(s.strike);
      const dist = Math.abs(sy - hover.svgY);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  })();

  const expiryDisplay = selectedExpiry === 'all' ? 'All' : selectedExpiry;
  const dteSourceExpiry = selectedExpiry !== 'all' ? selectedExpiry : availableExpirations[0];
  const now = new Date();
  const dteLabel = (() => {
    if (!dteSourceExpiry) return '—';
    const expDate = new Date(dteSourceExpiry);
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

  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        borderRadius: 0,
        overflow: 'auto',
        backgroundColor: cardBg,
        border: 'none',
      }
    : {
        backgroundColor: cardBg,
        border: `1px solid ${border}`,
        overflow: 'hidden',
      };

  const popoverStyle: React.CSSProperties = {
    backgroundColor: popoverBg,
    border: `1px solid ${border}`,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  };

  const isPrevSession = (ts: string): boolean => {
    if (!todaySessionDate) return false;
    return nyDateFmt.format(new Date(ts)) !== todaySessionDate;
  };

  return (
    <div className="rounded-2xl" style={containerStyle}>
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${border}`, color: textPrimary }}
      >
        <div className="text-sm font-semibold tracking-wide">{symbol} Market Maker Exposures</div>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
          className="rounded-md p-1.5 transition-colors hover:bg-[color:var(--color-info-soft)]"
          style={{ color: subtle }}
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
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
        {paused && (
          <span
            className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ color: colors.warning, backgroundColor: 'rgba(245, 158, 11, 0.16)' }}
          >
            Paused
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3 pb-3">
        {/* Date label (informational, no nav — historical date selection requires a backend date param) */}
        <div className={toolbarBtnClass} style={toolbarBtnStyle()} title="Current trading date">
          <Clock size={12} />
          <span>{todayLabel}</span>
        </div>

        {/* Expiry dropdown */}
        <div ref={expiryRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setExpiryOpen((v) => !v);
              setSettingsOpen(false);
            }}
            className={toolbarBtnClass}
            style={toolbarBtnStyle(selectedExpiry !== 'all')}
            title="Filter by expiration"
            disabled={availableExpirations.length === 0}
          >
            <span>Expiry {expiryDisplay}</span>
            <ChevronDown size={12} />
          </button>
          {expiryOpen && (
            <div
              className="absolute top-full left-0 mt-1 rounded-md py-1 z-30"
              style={{ ...popoverStyle, minWidth: 160, maxHeight: 260, overflowY: 'auto' }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedExpiry('all');
                  setExpiryOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[color:var(--color-info-soft)]"
                style={{
                  color: selectedExpiry === 'all' ? textPrimary : subtle,
                  fontWeight: selectedExpiry === 'all' ? 600 : 400,
                }}
              >
                All expirations
              </button>
              {availableExpirations.map((exp) => (
                <button
                  key={exp}
                  type="button"
                  onClick={() => {
                    setSelectedExpiry(exp);
                    setExpiryOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[color:var(--color-info-soft)]"
                  style={{
                    color: selectedExpiry === exp ? textPrimary : subtle,
                    fontWeight: selectedExpiry === exp ? 600 : 400,
                  }}
                >
                  {exp}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DTE label (auto-derived) */}
        <div className={toolbarBtnClass} style={toolbarBtnStyle()} title="Days to expiry (front month or selected)">
          <span>DTE {dteLabel}</span>
        </div>

        {/* Gamma display mode toggle */}
        <button
          type="button"
          onClick={() => setGexMode((m) => (m === 'split' ? 'net' : 'split'))}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(gexMode === 'net')}
          title={`Gamma mode: ${gexMode === 'split' ? 'Call/Put split' : 'Net only'} (click to toggle)`}
        >
          <BarChart3 size={12} />
          <span>{gexMode === 'split' ? 'Split' : 'Net'}</span>
        </button>

        {/* Timeframe selector */}
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

        {/* With Prev */}
        <button
          type="button"
          title="Overlay the previous trading session's candles"
          onClick={() => setWithPrev((v) => !v)}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(withPrev)}
        >
          <span>With Prev</span>
        </button>

        {/* Zoom out */}
        <button
          type="button"
          title="Zoom out (wider strike/price range)"
          onClick={() => setZoomMul((v) => clamp(v * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
          disabled={zoomMul >= ZOOM_MAX - 1e-6}
        >
          <ZoomOut size={12} />
        </button>

        {/* Zoom in */}
        <button
          type="button"
          title="Zoom in (tighter strike/price range)"
          onClick={() => setZoomMul((v) => clamp(v / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
          disabled={zoomMul <= ZOOM_MIN + 1e-6}
        >
          <ZoomIn size={12} />
        </button>

        {/* Pause / Play */}
        <button
          type="button"
          title={paused ? 'Resume live updates' : 'Pause live updates'}
          onClick={() => setPaused((v) => !v)}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(paused)}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>

        {/* Reset all */}
        <button
          type="button"
          title="Reset all settings to default"
          onClick={resetAll}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
        >
          <RotateCcw size={12} />
        </button>

        {/* Settings */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setSettingsOpen((v) => !v);
              setExpiryOpen(false);
            }}
            title="Display settings"
            className={toolbarBtnClass}
            style={toolbarBtnStyle(settingsOpen)}
          >
            <Settings2 size={12} />
          </button>
          {settingsOpen && (
            <div
              className="absolute top-full right-0 mt-1 rounded-md py-2 z-30"
              style={{ ...popoverStyle, minWidth: 200 }}
            >
              <label className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-[color:var(--color-info-soft)]" style={{ color: textPrimary }}>
                <input
                  type="checkbox"
                  checked={showOiDots}
                  onChange={(e) => setShowOiDots(e.target.checked)}
                />
                <span>Show OI dots</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-[color:var(--color-info-soft)]" style={{ color: textPrimary }}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                <span>Show grid lines</span>
              </label>
              <div className="border-t mt-1 pt-1" style={{ borderColor: border }}>
                <button
                  type="button"
                  onClick={() => {
                    resetAll();
                    setSettingsOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[color:var(--color-info-soft)] flex items-center gap-2"
                  style={{ color: textPrimary }}
                >
                  <RotateCcw size={12} />
                  <span>Reset all settings</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto text-xs" style={{ color: subtle }}>
          Updated {updatedLabel}
        </div>
      </div>

      {/* Composite chart */}
      <div ref={containerRef} className="relative overflow-x-auto px-2 pb-2">
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
          style={{ minWidth: 760 }}
          onMouseMove={onSvgMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Shared horizontal grid + strike labels */}
          {strikeLabels.map((p) => {
            const y = yForPrice(p);
            return (
              <g key={`grid-${p}`}>
                {showGrid && (
                  <>
                    <line x1={LEFT_X} x2={STRIKE_X} y1={y} y2={y} stroke={gridStroke} />
                    <line x1={MID_X} x2={MID_X + MID_W} y1={y} y2={y} stroke={gridStroke} />
                    <line x1={RIGHT_X} x2={RIGHT_X + RIGHT_W} y1={y} y2={y} stroke={gridStroke} />
                  </>
                )}
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
          {visibleCandles.map((c, i) => {
            const x = xForTime(new Date(c.timestamp).getTime());
            const yO = yForPrice(c.open);
            const yC = yForPrice(c.close);
            const yH = yForPrice(c.high);
            const yL = yForPrice(c.low);
            const up = c.close >= c.open;
            const color = up ? colors.bullish : colors.bearish;
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(1, Math.abs(yO - yC));
            const isHovered = hoveredCandle?.timestamp === c.timestamp;
            const candleW = isHovered ? 4 : 2.2;
            const opacity = isPrevSession(c.timestamp) ? 0.35 : 1;
            return (
              <g key={`cdl-${i}-${c.timestamp}`} opacity={opacity}>
                <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={isHovered ? 1.6 : 1} />
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
            const isHovered = hoveredStrike?.strike === s.strike && hover?.panel === 'middle';
            const barOpacity = isHovered ? 1 : hoveredStrike && hover?.panel === 'middle' ? 0.55 : 0.95;
            if (gexMode === 'net') {
              const w = (Math.abs(s.netGex) / gammaXMax) * (MID_W / 2);
              const positive = s.netGex >= 0;
              return (
                <g key={`gex-${s.strike}`}>
                  {showOiDots && (
                    <circle cx={MID_X + MID_W / 2} cy={y} r={1.4} fill={subtle} opacity={0.55} />
                  )}
                  {s.netGex !== 0 && (
                    <rect
                      x={positive ? MID_X + MID_W / 2 : MID_X + MID_W / 2 - Math.max(0, w)}
                      y={y - barH / 2}
                      width={Math.max(0, w)}
                      height={barH}
                      fill={positive ? colors.bullish : colors.bearish}
                      opacity={barOpacity}
                    />
                  )}
                </g>
              );
            }
            const callW = (Math.abs(s.callGex) / gammaXMax) * (MID_W / 2);
            const putW = (Math.abs(s.putGex) / gammaXMax) * (MID_W / 2);
            return (
              <g key={`gex-${s.strike}`}>
                {showOiDots && (
                  <circle cx={MID_X + MID_W / 2} cy={y} r={1.4} fill={subtle} opacity={0.55} />
                )}
                {s.callGex !== 0 && (
                  <rect
                    x={MID_X + MID_W / 2}
                    y={y - barH / 2}
                    width={Math.max(0, callW)}
                    height={barH}
                    fill={colors.bullish}
                    opacity={barOpacity}
                  />
                )}
                {s.putGex !== 0 && (
                  <rect
                    x={MID_X + MID_W / 2 - Math.max(0, putW)}
                    y={y - barH / 2}
                    width={Math.max(0, putW)}
                    height={barH}
                    fill={colors.bearish}
                    opacity={barOpacity}
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
            Gamma {gexMode === 'split' ? '(Call / Put)' : '(Net)'}
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
            const isHovered = hoveredStrike?.strike === s.strike && hover?.panel === 'right';
            const barOpacity = isHovered ? 1 : hoveredStrike && hover?.panel === 'right' ? 0.55 : 0.95;
            return (
              <g key={`pos-${s.strike}`}>
                {s.callOi > 0 && (
                  <rect
                    x={RIGHT_X + RIGHT_W / 2}
                    y={y - barH / 2}
                    width={Math.max(0, callW)}
                    height={barH}
                    fill={colors.bullish}
                    opacity={barOpacity}
                  />
                )}
                {s.putOi > 0 && (
                  <rect
                    x={RIGHT_X + RIGHT_W / 2 - Math.max(0, putW)}
                    y={y - barH / 2}
                    width={Math.max(0, putW)}
                    height={barH}
                    fill={colors.bearish}
                    opacity={barOpacity}
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
          {(() => {
            // Filter to in-bounds levels and stagger their labels vertically so
            // overlapping pills always remain readable. The line itself stays
            // at the original y; a thin leader connects it to the offset pill.
            const inBounds = keyLevels.filter((lvl) => lvl.y >= PLOT_TOP && lvl.y <= PLOT_BOTTOM);
            const sorted = [...inBounds].sort((a, b) => a.y - b.y);
            const PILL_H = 16;
            const MIN_GAP = PILL_H + 2;
            const minY = PLOT_TOP + PILL_H / 2;
            const maxY = PLOT_BOTTOM - PILL_H / 2;
            const positioned = sorted.map((lvl) => ({ ...lvl, labelY: lvl.y }));

            // Top-down: never let a label sit above the previous one's bottom edge.
            for (let i = 0; i < positioned.length; i++) {
              if (i === 0) {
                positioned[i].labelY = Math.max(minY, positioned[i].labelY);
              } else {
                positioned[i].labelY = Math.max(positioned[i].labelY, positioned[i - 1].labelY + MIN_GAP);
              }
            }
            // Bottom-up: clamp to plot bottom and push earlier labels up if needed.
            for (let i = positioned.length - 1; i >= 0; i--) {
              if (positioned[i].labelY > maxY) positioned[i].labelY = maxY;
              if (i > 0 && positioned[i - 1].labelY > positioned[i].labelY - MIN_GAP) {
                positioned[i - 1].labelY = positioned[i].labelY - MIN_GAP;
              }
            }

            return positioned.map((lvl, i) => {
              const text = `${lvl.label} ${lvl.price.toFixed(2)}`;
              const pillW = Math.max(72, text.length * 5.6);
              const pillX = CW - pillW - 2;
              const lineEndX = pillX - 8;
              const offset = Math.abs(lvl.labelY - lvl.y) > 0.5;
              return (
                <g key={`lvl-${i}-${lvl.price}`}>
                  <line
                    x1={LEFT_X}
                    x2={lineEndX}
                    y1={lvl.y}
                    y2={lvl.y}
                    stroke={lvl.color}
                    strokeDasharray={lvl.emphasized ? '5 3' : '4 4'}
                    strokeWidth={lvl.emphasized ? 1.4 : 1}
                    opacity={0.85}
                  />
                  {offset && (
                    <line
                      x1={lineEndX}
                      x2={pillX}
                      y1={lvl.y}
                      y2={lvl.labelY}
                      stroke={lvl.color}
                      strokeWidth={1}
                      opacity={0.65}
                    />
                  )}
                  <rect
                    x={pillX}
                    y={lvl.labelY - PILL_H / 2}
                    width={pillW}
                    height={PILL_H}
                    rx={3}
                    fill={lvl.color}
                    opacity={lvl.emphasized ? 1 : 0.92}
                  />
                  <text
                    x={pillX + pillW / 2}
                    y={lvl.labelY + 3.5}
                    fontSize={10}
                    textAnchor="middle"
                    fill="#0b1620"
                    fontWeight={700}
                  >
                    {text}
                  </text>
                </g>
              );
            });
          })()}

          {/* ── Crosshair (drawn after levels so it overlays everything) ── */}
          {hover && hover.panel && (
            <g pointerEvents="none">
              <line
                x1={LEFT_X}
                x2={CW}
                y1={hover.svgY}
                y2={hover.svgY}
                stroke={subtle}
                strokeDasharray="3 3"
                opacity={0.55}
              />
              {hover.panel === 'left' && hoveredCandle && (
                <line
                  x1={xForTime(new Date(hoveredCandle.timestamp).getTime())}
                  x2={xForTime(new Date(hoveredCandle.timestamp).getTime())}
                  y1={PLOT_TOP}
                  y2={PLOT_BOTTOM}
                  stroke={subtle}
                  strokeDasharray="3 3"
                  opacity={0.55}
                />
              )}
              {(hover.panel === 'middle' || hover.panel === 'right') && hoveredStrike && (
                <line
                  x1={LEFT_X}
                  x2={CW}
                  y1={yForPrice(hoveredStrike.strike)}
                  y2={yForPrice(hoveredStrike.strike)}
                  stroke={subtle}
                  strokeDasharray="3 3"
                  opacity={0.75}
                />
              )}
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hover && (hoveredCandle || hoveredStrike) && (() => {
          const TOOLTIP_W = 200;
          const placeRight = hover.svgX < CW * 0.65;
          const tooltipLeft = placeRight ? hover.pxX + 14 : Math.max(8, hover.pxX - TOOLTIP_W - 14);
          const tooltipTop = Math.max(8, hover.pxY - 12);
          return (
            <div
              className="absolute z-20 pointer-events-none rounded-md px-3 py-2 text-xs"
              style={{
                left: tooltipLeft,
                top: tooltipTop,
                width: TOOLTIP_W,
                backgroundColor: popoverBg,
                border: `1px solid ${border}`,
                color: textPrimary,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              }}
            >
              {hover.panel === 'left' && hoveredCandle && (
                <>
                  <div className="font-semibold mb-1">
                    {new Date(hoveredCandle.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="font-mono tabular-nums">
                    O {hoveredCandle.open.toFixed(2)} &nbsp; H {hoveredCandle.high.toFixed(2)}
                  </div>
                  <div className="font-mono tabular-nums">
                    L {hoveredCandle.low.toFixed(2)} &nbsp; C {hoveredCandle.close.toFixed(2)}
                  </div>
                  <div
                    className="font-mono tabular-nums mt-1"
                    style={{
                      color: hoveredCandle.close >= hoveredCandle.open ? colors.bullish : colors.bearish,
                    }}
                  >
                    {hoveredCandle.close - hoveredCandle.open >= 0 ? '+' : ''}
                    {(hoveredCandle.close - hoveredCandle.open).toFixed(2)} (
                    {(((hoveredCandle.close - hoveredCandle.open) / Math.max(1e-9, hoveredCandle.open)) * 100).toFixed(2)}%)
                  </div>
                </>
              )}
              {hover.panel === 'middle' && hoveredStrike && (
                <>
                  <div className="font-semibold mb-1">Strike ${hoveredStrike.strike.toFixed(2)}</div>
                  {gexMode === 'split' ? (
                    <>
                      <div className="font-mono tabular-nums" style={{ color: colors.bullish }}>
                        Call GEX: {formatExposure(hoveredStrike.callGex)}
                      </div>
                      <div className="font-mono tabular-nums" style={{ color: colors.bearish }}>
                        Put GEX: {formatExposure(hoveredStrike.putGex)}
                      </div>
                      <div className="font-mono tabular-nums mt-1" style={{ color: subtle }}>
                        Net: {formatExposure(hoveredStrike.netGex)}
                      </div>
                    </>
                  ) : (
                    <div
                      className="font-mono tabular-nums"
                      style={{ color: hoveredStrike.netGex >= 0 ? colors.bullish : colors.bearish }}
                    >
                      Net GEX: {formatExposure(hoveredStrike.netGex)}
                    </div>
                  )}
                </>
              )}
              {hover.panel === 'right' && hoveredStrike && (
                <>
                  <div className="font-semibold mb-1">Strike ${hoveredStrike.strike.toFixed(2)}</div>
                  <div className="font-mono tabular-nums" style={{ color: colors.bullish }}>
                    Call OI: {hoveredStrike.callOi.toLocaleString()}
                  </div>
                  <div className="font-mono tabular-nums" style={{ color: colors.bearish }}>
                    Put OI: {hoveredStrike.putOi.toLocaleString()}
                  </div>
                  <div className="font-mono tabular-nums mt-1" style={{ color: subtle }}>
                    Net: {(hoveredStrike.callOi - hoveredStrike.putOi).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Legend strip */}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2 text-xs"
        style={{ borderTop: `1px solid ${border}`, color: subtle }}
      >
        <span className="flex items-center gap-1.5" title="Current spot price for the underlying">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={SPOT_LINE} strokeDasharray="5 3" strokeWidth="1.6" />
          </svg>
          <span style={{ color: textPrimary }}>Spot</span>
        </span>
        <span className="flex items-center gap-1.5" title="Price where dealer net gamma flips sign — above it dealers dampen volatility, below it they amplify it">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={FLIP_LINE} strokeDasharray="4 4" strokeWidth="1.2" />
          </svg>
          <span style={{ color: textPrimary }}>Gamma Flip</span>
        </span>
        <span className="flex items-center gap-1.5" title="Strike with the heaviest call OI — tends to act as resistance">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={KEY_LEVEL} strokeDasharray="4 4" strokeWidth="1.2" />
          </svg>
          <span style={{ color: textPrimary }}>Call Wall</span>
        </span>
        <span className="flex items-center gap-1.5" title="Strike with the heaviest put OI — tends to act as support">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={KEY_LEVEL} strokeDasharray="4 4" strokeWidth="1.2" />
          </svg>
          <span style={{ color: textPrimary }}>Put Wall</span>
        </span>
        <span className="ml-auto">Hover any panel for details</span>
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
