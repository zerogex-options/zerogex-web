'use client';

import { useEffect, useState, useCallback } from 'react';
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

/**
 * Reactive hook — returns the current palette's chart colors.
 * Updates whenever the palette or theme changes.
 */
export function useChartTheme(): ChartTheme {
  const { theme, palette } = useTheme();
  const [chart, setChart] = useState<ChartTheme>(() => readChartTheme());

  const refresh = useCallback(() => {
    setChart(readChartTheme());
  }, []);

  useEffect(() => {
    // Wait one frame after theme/palette change so the CSS variables
    // have actually flipped on the root element.
    const raf = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(raf);
  }, [theme, palette, refresh]);

  return chart;
}
