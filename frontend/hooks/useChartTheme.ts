'use client';

import { useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react';
import { useTheme } from '@/core/ThemeContext';

/**
 * Reads chart-relevant CSS variables from the document root at runtime.
 * Re-reads whenever the palette or mode changes so Recharts components
 * re-render with the correct colors.
 *
 * Usage:
 *   const chart = useChartTheme();
 *   <Bar fill={chart.bull} />
 *   <Line stroke={chart.accent} />
 *   <Tooltip contentStyle={{ background: chart.tooltipBg, color: chart.text }} />
 */
export interface ChartTheme {
  // Core semantic
  bull: string;
  bullSoft: string;
  bear: string;
  bearSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;

  // Palette accents
  accent: string;
  accentHot: string;
  accentSoft: string;
  gold: string;
  goldSoft: string;
  // Level hues, palette-independent — see CSS_VAR_MAP below.
  flip: string;
  maxpain: string;
  maroon: string;
  navy: string;
  emerald: string;
  emeraldSoft: string;
  hazy: string;
  hazySoft: string;

  // Chart 5-series
  series: [string, string, string, string, string];

  // Heat ramp
  heatLow: string;
  heatMid: string;
  heatHigh: string;

  // Surfaces
  bg: string;
  bgCard: string;
  bgHover: string;
  text: string;
  textDim: string;
  textMuted: string;
  border: string;
  borderStrong: string;

  // Chart chrome
  gridLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  axisText: string;
}

const CSS_VAR_MAP: Record<keyof Omit<ChartTheme, 'series'>, string> = {
  bull: '--color-bull',
  bullSoft: '--color-bull-soft',
  bear: '--color-bear',
  bearSoft: '--color-bear-soft',
  warning: '--color-warning',
  warningSoft: '--color-warning-soft',
  info: '--color-info',
  infoSoft: '--color-info-soft',
  accent: '--color-accent',
  accentHot: '--color-accent-hot',
  accentSoft: '--color-accent-soft',
  gold: '--color-gold',
  // Level hues held apart from the palette's accents so a level never reads as
  // a direction or as the live price — see the block in globals.css.
  flip: '--color-flip',
  maxpain: '--color-maxpain',
  goldSoft: '--color-gold-soft',
  maroon: '--color-maroon',
  navy: '--color-navy',
  emerald: '--color-emerald',
  emeraldSoft: '--color-emerald-soft',
  hazy: '--color-hazy',
  hazySoft: '--color-hazy-soft',
  heatLow: '--heat-low',
  heatMid: '--heat-mid',
  heatHigh: '--heat-high',
  bg: '--bg-main',
  bgCard: '--bg-card',
  bgHover: '--bg-hover',
  text: '--text-primary',
  textDim: '--text-secondary',
  textMuted: '--text-muted',
  border: '--border-default',
  borderStrong: '--border-strong',
  gridLine: '--color-grid-line',
  tooltipBg: '--color-chart-tooltip-bg',
  tooltipBorder: '--color-chart-tooltip-border',
  tooltipText: '--text-primary',
  axisText: '--text-secondary',
};

const SERIES_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'] as const;

function readCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readChartTheme(): ChartTheme {
  const out = {} as unknown as Record<string, unknown>;
  for (const [k, cssVar] of Object.entries(CSS_VAR_MAP)) {
    out[k] = readCssVar(cssVar);
  }
  out.series = SERIES_VARS.map(readCssVar) as [string, string, string, string, string];
  return out as unknown as ChartTheme;
}

// What the server renders with: it has no stylesheet to read.
const EMPTY_CHART_THEME: ChartTheme = (() => {
  const out = {} as unknown as Record<string, unknown>;
  for (const k of Object.keys(CSS_VAR_MAP)) out[k] = '';
  out.series = ['', '', '', '', ''];
  return out as unknown as ChartTheme;
})();

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Reactive hook — returns the current palette's chart colors.
 * Updates whenever the palette or theme changes.
 *
 * The first render is empty on the client too, and a layout effect fills the
 * real colors in before the browser paints. Reading them during that render
 * (as this hook used to) made the hydration pass disagree with the server's
 * empty-string colors; React does not repair mismatched attributes, so
 * server-rendered markup colored through this hook could stay uncolored.
 */
export function useChartTheme(): ChartTheme {
  const { theme, palette } = useTheme();
  const [chart, setChart] = useState<ChartTheme>(EMPTY_CHART_THEME);

  const refresh = useCallback(() => {
    setChart(readChartTheme());
  }, []);

  useIsomorphicLayoutEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Wait one frame after theme/palette change so the CSS variables
    // have actually flipped on the root element.
    const raf = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(raf);
  }, [theme, palette, refresh]);

  return chart;
}

/* ── Ink for a filled chip ────────────────────────────────────────────────────
 *
 * GammaTerminalChart's right-axis price tags are rects filled with a level's
 * own colour, with the price painted on top. That text used to be a flat
 * --text-inverse, which assumes the chip is dark. Half the level colours are
 * not: MAX PAIN's amber against a light theme's near-white --text-inverse came
 * out at 1.44:1, effectively unreadable.
 *
 * Contrast has to be measured against the CHIP, not the page, and the chip's
 * colour does not track the theme. Black and white are the optimal pair here:
 * whichever of the two a colour is further from is always at least 4.58:1 away,
 * so every chip clears AA for normal text. Softening either ink breaks that --
 * #0B0E12/#FFFFFF already drops two of this app's chips below 4.5:1 -- so these
 * are deliberately the pure values.
 */
const INK_DARK = '#000000';
const INK_LIGHT = '#FFFFFF';
/** Pre-hydration and whenever a colour cannot be parsed: the historical behaviour. */
const INK_FALLBACK = 'var(--text-inverse)';
/** Luminance where black and white are equally readable: (Y+0.05)^2 = 1.05*0.05. */
const INK_PIVOT = 0.1791;

type Rgba = [number, number, number, number];

function parseColor(raw: string): Rgba | null {
  const c = raw?.trim();
  if (!c) return null;
  const six = c.match(/^#([0-9a-f]{6})$/i);
  if (six) {
    const n = parseInt(six[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const three = c.match(/^#([0-9a-f]{3})$/i);
  if (three) {
    const [r, g, b] = three[1].split('');
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), 1];
  }
  const fn = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/i);
  if (fn) return [+fn[1], +fn[2], +fn[3], fn[4] === undefined ? 1 : +fn[4]];
  return null;
}

function relativeLuminance([r, g, b]: Rgba): number {
  const f = (v: number) => (v /= 255, v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function resolveInk(chip: string): string {
  if (typeof window === 'undefined') return INK_FALLBACK;
  const root = getComputedStyle(document.documentElement);
  // Custom properties resolve to their authored token text, so a value may
  // itself be another var() -- --color-positive: var(--color-bull), say.
  const deref = (v: string, depth = 0): string => {
    const m = v?.trim().match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
    return m && depth < 8 ? deref(root.getPropertyValue(m[1]), depth + 1) : (v ?? '').trim();
  };
  const colour = parseColor(deref(chip));
  if (!colour) return INK_FALLBACK;
  let solid = colour;
  if (colour[3] < 1) {
    // A translucent chip sits on the card, so judge the blend, not the swatch.
    const bg = parseColor(deref('var(--bg-card)'));
    if (!bg) return INK_FALLBACK;
    const a = colour[3];
    solid = [0, 1, 2].map((i) => colour[i] * a + bg[i] * (1 - a)).concat(1) as Rgba;
  }
  return relativeLuminance(solid) > INK_PIVOT ? INK_DARK : INK_LIGHT;
}

/**
 * Returns a function giving readable ink for text drawn on a filled chip of
 * the given colour, which may be a hex/rgba literal or a `var(--token)`.
 *
 * Resolution needs the live CSS variables, so it only starts after mount: the
 * server render and the hydrating render both get INK_FALLBACK and therefore
 * agree. Results are cached per palette/mode.
 */
export function useChipInk(): (chipColor: string) => string {
  const { theme, palette } = useTheme();
  const [generation, setGeneration] = useState(0); // 0 = not yet read from the DOM
  useEffect(() => {
    // One frame, so the root element's variables have actually flipped.
    const raf = requestAnimationFrame(() => setGeneration((g: number) => g + 1));
    return () => cancelAnimationFrame(raf);
  }, [theme, palette]);

  return useMemo(() => {
    if (generation === 0) return () => INK_FALLBACK;
    const cache = new Map<string, string>();
    return (chipColor: string) => {
      const hit = cache.get(chipColor);
      if (hit !== undefined) return hit;
      const ink = resolveInk(chipColor);
      cache.set(chipColor, ink);
      return ink;
    };
  }, [generation]);
}
