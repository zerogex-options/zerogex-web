'use client';

import { useEffect, useRef } from 'react';
import { colors } from '@/core/colors';

interface PremiumSurfacePlotProps {
  /** Strike axis (x). */
  strikes: number[];
  /** Days-to-expiration axis (y), one per expiration row of `z`. */
  dtes: number[];
  /** z[i][j] = extrinsic value at (dtes[i], strikes[j]); null = gap. */
  z: (number | null)[][];
  /** Human-readable expiration date per y row (for hover). */
  expirationLabels: string[];
  optionType: 'C' | 'P';
  spot: number;
  theme: 'dark' | 'light';
  height?: number;
}

/**
 * Imperative, client-only Plotly 3D surface. plotly.js is heavy and not
 * SSR-safe, so it's dynamically imported inside the effect and the chart is
 * driven through Plotly.react (diffing) rather than the react-plotly.js
 * wrapper (which has peer-dependency friction with React 19).
 */
export default function PremiumSurfacePlot({
  strikes,
  dtes,
  z,
  expirationLabels,
  optionType,
  spot,
  theme,
  height = 560,
}: PremiumSurfacePlotProps) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let purged = false;
    // Holds the Plotly module so the resize handler and cleanup can reach it.
    let plotly: typeof import('plotly.js-dist-min').default | null = null;

    const isDark = theme === 'dark';
    const fontColor = isDark ? colors.light : colors.dark;
    const gridColor = isDark ? 'rgba(255,211,128,0.16)' : 'rgba(0,0,0,0.12)';

    // 2D customdata mirroring z, carrying the expiration label for hover.
    const customdata = z.map((row) => row.map(() => ''));
    for (let i = 0; i < z.length; i++) {
      for (let j = 0; j < z[i].length; j++) {
        customdata[i][j] = expirationLabels[i] ?? '';
      }
    }

    const data = [
      {
        type: 'surface',
        x: strikes,
        y: dtes,
        z,
        customdata,
        connectgaps: false,
        colorscale: 'Viridis',
        colorbar: {
          title: { text: 'Extrinsic ($)', font: { color: fontColor } },
          tickfont: { color: fontColor },
          outlinewidth: 0,
          thickness: 14,
          len: 0.7,
        },
        contours: {
          z: { show: true, usecolormap: true, highlightcolor: '#ffffff', project: { z: true } },
        },
        hovertemplate:
          'Strike: %{x}<br>' +
          'Exp: %{customdata} (%{y} DTE)<br>' +
          'Extrinsic: $%{z:.2f}<extra></extra>',
      },
    ];

    const layout = {
      autosize: true,
      height,
      margin: { l: 0, r: 0, t: 10, b: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: fontColor },
      scene: {
        xaxis: {
          title: { text: 'Strike' },
          gridcolor: gridColor,
          zerolinecolor: gridColor,
          color: fontColor,
        },
        yaxis: {
          title: { text: 'Days to Expiration' },
          gridcolor: gridColor,
          zerolinecolor: gridColor,
          color: fontColor,
        },
        zaxis: {
          title: { text: 'Premium − Intrinsic ($)' },
          gridcolor: gridColor,
          zerolinecolor: gridColor,
          color: fontColor,
          rangemode: 'tozero',
        },
        camera: { eye: { x: 1.6, y: -1.5, z: 0.9 } },
        aspectratio: { x: 1.3, y: 1, z: 0.7 },
      },
    };

    const config = { responsive: true, displaylogo: false, displayModeBar: true };

    let resizeObserver: ResizeObserver | null = null;

    import('plotly.js-dist-min')
      .then((mod) => {
        if (purged || !elRef.current) return;
        plotly = mod.default;
        return plotly.react(elRef.current, data, layout, config);
      })
      .then(() => {
        if (purged || !elRef.current || !plotly) return;
        resizeObserver = new ResizeObserver(() => {
          if (plotly && elRef.current) plotly.Plots.resize(elRef.current);
        });
        resizeObserver.observe(elRef.current);
      })
      .catch(() => {
        /* swallow — the page shows its own empty/error states */
      });

    return () => {
      purged = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (plotly && el) plotly.purge(el);
    };
  }, [strikes, dtes, z, expirationLabels, optionType, spot, theme, height]);

  return <div ref={elRef} style={{ width: '100%', height }} />;
}
