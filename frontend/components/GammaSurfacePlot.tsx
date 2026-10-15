'use client';

import { useEffect, useRef } from 'react';

/** A level drawn along the base of the scene, the whole length of the time axis. */
export interface GammaSurfaceLevelLine {
  price: number;
  color: string;
  /** Hover name, e.g. "Call Wall 7,845". */
  label: string;
  /**
   * Where the level meets the surface (row = index into `hours`): a vertical
   * drop line rises from the base to that point, as under the Call Wall's peak.
   */
  drop?: { row: number; value: number } | null;
}

export interface GammaSurfacePlotProps {
  /** Hypothetical prices (x). */
  grid: number[];
  /** Hours from the snapshot (y), one per row of `z`. */
  hours: number[];
  /** z[i][j] at (hours[i], grid[j]), already in the display unit. */
  z: number[][];
  /** Hover text per cell, same shape as `z`. */
  hoverText: string[][];
  timeTicks: { values: number[]; labels: string[] };
  zRange: [number, number];
  zTicks: { values: number[]; labels: string[] };
  /** |value| the colors saturate at (core/gammaSurface colorLimit). */
  colorLimit: number;
  zTitle: string;
  /** Call Wall, Gamma Flip, spot and Put Wall lines. */
  levels: GammaSurfaceLevelLine[];
  /** The surface along spot, drawn dashed over the mesh. */
  spotTrace: { price: number; z: number[]; color: string } | null;
  /** Resolved colors — WebGL cannot read CSS custom properties. */
  colors: { text: string; muted: string; grid: string; hoverBg: string; hoverBorder: string };
  height: number;
  /** Phone layout: the camera stands further back so the axes fit. */
  compact?: boolean;
  /** Mouse-wheel zoom. Off in-page (the wheel scrolls the page past the chart). */
  scrollZoom?: boolean;
}

// Plasma: deep violet (short gamma) through magenta (zero) to gold (long
// gamma) — the look of the surface this chart was modeled on. The scale runs
// symmetric about zero, so warm is always long and cool always short.
const COLORSCALE: [number, string][] = [
  [0, '#0d0887'],
  [0.15, '#47039f'],
  [0.3, '#7301a8'],
  [0.45, '#9c179e'],
  [0.5, '#bd3786'],
  [0.6, '#d8576b'],
  [0.72, '#ed7953'],
  [0.85, '#fb9f3a'],
  [1, '#f0f921'],
];

// Wireframe density across the price and time axes.
const PRICE_LINES = 32;
const TIME_LINES = 16;
const Z_CONTOURS = 14;

/**
 * Imperative, client-only Plotly 3D surface (the same pattern as the Premium
 * Surface): plotly.js is heavy and not SSR-safe, so it is imported inside the
 * effect, and updates go through Plotly.react with a constant uirevision so a
 * data refresh keeps the member's camera.
 */
export default function GammaSurfacePlot({
  grid,
  hours,
  z,
  hoverText,
  timeTicks,
  zRange,
  zTicks,
  colorLimit,
  zTitle,
  levels,
  spotTrace,
  colors,
  height,
  compact = false,
  scrollZoom = false,
}: GammaSurfacePlotProps) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || grid.length < 2 || hours.length < 1) return;

    let purged = false;
    let plotly: typeof import('plotly.js-dist-min').default | null = null;
    let resizeObserver: ResizeObserver | null = null;

    // A single row is a line, not a surface: repeat it a hair later so the
    // mesh still draws (only when the settlement is already upon us).
    const ys = hours.length > 1 ? hours : [hours[0], hours[0] + 1 / 60];
    const zs = hours.length > 1 ? z : [z[0], z[0]];
    const texts = hours.length > 1 ? hoverText : [hoverText[0], hoverText[0]];
    const yEnd = ys[ys.length - 1];
    const priceSpan = grid[grid.length - 1] - grid[0];
    const [zLow, zTop] = zRange;
    const zSpan = zTop - zLow;
    // Level lines sit a hair above the base so the projected contours never
    // draw over them.
    const baseZ = zLow + zSpan * 0.004;

    const font = { color: colors.text, family: 'ui-sans-serif, system-ui, -apple-system, sans-serif' };
    const axisCommon = {
      color: colors.muted,
      gridcolor: colors.grid,
      zeroline: false,
      showbackground: false,
      showspikes: false,
      tickfont: { color: colors.muted, size: compact ? 9 : 10 },
    };
    const axisTitle = (text: string) => ({ text, font: { color: colors.muted, size: compact ? 10 : 11 } });

    const surface = {
      type: 'surface',
      x: grid,
      y: ys,
      z: zs,
      // hoverinfo 'text', not a hovertemplate: Plotly's 3D surface reads a
      // template's %{text} with the grid index transposed (blank labels past
      // the row count), while the plain text label is looked up correctly.
      text: texts,
      hoverinfo: 'text',
      colorscale: COLORSCALE,
      cmin: -colorLimit,
      cmax: colorLimit,
      showscale: false,
      // A dim, lit fill under unlit full-strength contour lines: the mesh reads
      // as a bright wireframe over a shaded sheet, like the reference look.
      opacity: 0.88,
      lighting: { ambient: 0.42, diffuse: 0.32, specular: 0.02, roughness: 1, fresnel: 0 },
      contours: {
        x: {
          show: true,
          usecolormap: true,
          width: 1,
          highlight: false,
          start: grid[0],
          end: grid[grid.length - 1],
          size: priceSpan / PRICE_LINES,
        },
        y: {
          show: true,
          usecolormap: true,
          width: 1,
          highlight: false,
          start: ys[0],
          end: yEnd,
          size: (yEnd - ys[0]) / TIME_LINES || 1,
        },
        z: {
          show: true,
          usecolormap: true,
          width: 2,
          highlight: false,
          project: { z: true },
          start: zLow,
          end: zTop,
          size: zSpan / Z_CONTOURS,
        },
      },
    };

    const traces: Record<string, unknown>[] = [surface];
    for (const level of levels) {
      traces.push({
        type: 'scatter3d',
        mode: 'lines',
        x: [level.price, level.price],
        y: [ys[0], yEnd],
        z: [baseZ, baseZ],
        line: { color: level.color, width: compact ? 5 : 7 },
        hovertemplate: `${level.label}<extra></extra>`,
        showlegend: false,
      });
      if (level.drop) {
        const y = ys[Math.min(level.drop.row, ys.length - 1)];
        traces.push({
          type: 'scatter3d',
          mode: 'lines+markers',
          x: [level.price, level.price],
          y: [y, y],
          z: [baseZ, level.drop.value],
          line: { color: level.color, width: compact ? 3 : 4 },
          marker: { size: [0, compact ? 3 : 4], color: level.color },
          hovertemplate: `${level.label}<extra></extra>`,
          showlegend: false,
        });
      }
    }
    if (spotTrace) {
      // Lifted a touch off the mesh so it reads over the surface, not through it.
      const lift = zSpan * 0.01;
      const traceZ = hours.length > 1 ? spotTrace.z : [spotTrace.z[0], spotTrace.z[0]];
      traces.push({
        type: 'scatter3d',
        mode: 'lines',
        x: ys.map(() => spotTrace.price),
        y: ys,
        z: traceZ.map((v) => v + lift),
        line: { color: spotTrace.color, width: compact ? 3 : 4, dash: 'dash' },
        hoverinfo: 'skip',
        showlegend: false,
      });
    }

    const layout = {
      autosize: true,
      height,
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font,
      showlegend: false,
      hoverlabel: {
        bgcolor: colors.hoverBg,
        bordercolor: colors.hoverBorder,
        font: { color: colors.text, size: 12, family: font.family },
      },
      // Constant: a data refresh (or a new expiration pick) keeps the member's
      // camera instead of snapping back to the opening view.
      uirevision: 'gamma-surface',
      scene: {
        bgcolor: 'rgba(0,0,0,0)',
        dragmode: 'turntable',
        xaxis: {
          ...axisCommon,
          title: axisTitle('Price'),
          tickformat: grid[grid.length - 1] >= 1000 ? ',.0f' : ',.2f',
          nticks: compact ? 4 : 6,
        },
        yaxis: {
          ...axisCommon,
          title: axisTitle(compact ? 'Time' : 'Time (ET)'),
          range: [ys[0], yEnd],
          tickmode: 'array',
          tickvals: timeTicks.values,
          ticktext: timeTicks.labels,
        },
        zaxis: {
          ...axisCommon,
          // No room for a rotated title beside the ticks on a phone; the
          // dollar ticks and the hover carry the unit there.
          title: axisTitle(compact ? '' : zTitle),
          range: [zLow, zTop],
          tickmode: 'array',
          tickvals: zTicks.values,
          ticktext: zTicks.labels,
        },
        aspectmode: 'manual',
        // Time runs across the view and price recedes into it, so the level
        // lines lie side by side in front of the surface.
        aspectratio: { x: 1.2, y: 1.6, z: 0.75 },
        // A phone's scene is ~350px wide: the camera stands further back there
        // so the axis labels stay inside it.
        camera: compact
          ? { eye: { x: 2.0, y: -2.6, z: 1.55 }, center: { x: -0.12, y: 0, z: -0.24 } }
          : { eye: { x: 1.3, y: -1.72, z: 1.02 }, center: { x: 0, y: 0, z: -0.24 } },
      },
    };

    const config = { responsive: true, displaylogo: false, displayModeBar: false, scrollZoom };

    import('plotly.js-dist-min')
      .then((mod) => {
        if (purged || !elRef.current) return;
        plotly = mod.default;
        return plotly.react(elRef.current, traces, layout, config);
      })
      .then(() => {
        if (purged || !elRef.current || !plotly) return;
        resizeObserver = new ResizeObserver(() => {
          if (plotly && elRef.current) plotly.Plots.resize(elRef.current);
        });
        resizeObserver.observe(elRef.current);
      })
      .catch(() => {
        /* the card shows its own empty / error states */
      });

    return () => {
      purged = true;
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [
    grid,
    hours,
    z,
    hoverText,
    timeTicks,
    zRange,
    zTicks,
    colorLimit,
    zTitle,
    levels,
    spotTrace,
    colors,
    height,
    compact,
    scrollZoom,
  ]);

  // Plotly's 3D camera claims every wheel event over its canvas — it calls
  // preventDefault even with scrollZoom off — which would trap the page's
  // scroll under the cursor on a chart mid-page. In-page, the wheel is stopped
  // on its way down to the canvas, so the page scrolls straight past; the
  // expanded view (scrollZoom) leaves it to zoom the scene.
  useEffect(() => {
    const el = elRef.current;
    if (!el || scrollZoom) return;
    const passToPage = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener('wheel', passToPage, { capture: true, passive: true });
    return () => el.removeEventListener('wheel', passToPage, { capture: true });
  }, [scrollZoom]);

  // Purge once, on unmount — not on every data refresh, so Plotly.react can
  // diff the update in place and the camera stays where the member left it.
  useEffect(() => {
    const el = elRef.current;
    return () => {
      if (el) {
        import('plotly.js-dist-min')
          .then((mod) => mod.default.purge(el))
          .catch(() => {});
      }
    };
  }, []);

  return <div ref={elRef} style={{ width: '100%', height }} />;
}
