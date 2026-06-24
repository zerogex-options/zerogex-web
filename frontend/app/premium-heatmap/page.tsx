'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePremiumSurface } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import BetaBadge from '@/components/BetaBadge';
import TooltipWrapper from '@/components/TooltipWrapper';

// plotly.js is heavy and not SSR-safe — load the surface only on the client.
const PremiumSurfacePlot = dynamic(() => import('./PremiumSurfacePlot'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ height: 560 }}>
      <LoadingSpinner />
    </div>
  ),
});

const TITLE_TOOLTIP =
  'A 3D surface of option time value. X = strike, Y = days to expiration, ' +
  'Z = premium minus intrinsic value (the extrinsic / time component of the ' +
  'mid quote, floored at $0). Use the symbol selector in the header to change ' +
  'the underlying.';

const DTE_OPTIONS = [7, 14, 30, 60, 90, 180];
const STRIKE_OPTIONS = [15, 21, 31, 51, 71];

/**
 * Linearly interpolate a single expiration row across the strike axis to fill
 * interior null gaps (strikes that exist for other expirations but not this
 * one). Leading/trailing nulls are left as-is — extrapolating beyond the
 * observed strikes would invent values — and Plotly's connectgaps bridges
 * those edges. Returns a copy; the input is untouched.
 */
function interpolateRowGaps(row: (number | null)[]): (number | null)[] {
  const out = row.slice();
  let prev = -1;
  for (let k = 0; k < out.length; k++) {
    if (out[k] == null) continue;
    if (prev >= 0 && k - prev > 1) {
      const v0 = out[prev] as number;
      const v1 = out[k] as number;
      for (let j = prev + 1; j < k; j++) {
        out[j] = v0 + (v1 - v0) * ((j - prev) / (k - prev));
      }
    }
    prev = k;
  }
  return out;
}

export default function PremiumHeatmapPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();

  const [optionType, setOptionType] = useState<'C' | 'P'>('C');
  const [dteMax, setDteMax] = useState(60);
  const [strikeCount, setStrikeCount] = useState(31);

  const { data, loading, error } = usePremiumSurface(symbol, optionType, {
    dteMax,
    strikeCount,
  });

  // Reshape the response into the (dte × strike) matrix Plotly's surface wants.
  // The response's top-level `strikes` is the union of every expiration's
  // strikes. Index options mix strike increments across expirations (weeklies
  // at $1, monthlies at $5), so any single expiration row is sparse on that
  // union axis. A surface face needs four non-null corners, so a sparse grid
  // renders as axes-with-no-mesh — we fill each row's interior gaps by linear
  // interpolation across strikes and let Plotly's connectgaps bridge the edges.
  const plot = useMemo(() => {
    if (!data || !data.surface?.length || !data.strikes?.length) return null;

    const strikes = data.strikes;
    const strikeIndex = new Map(strikes.map((s, i) => [s, i]));

    const slices = data.surface;
    const dtes = slices.map((s) => s.dte);
    const expirationLabels = slices.map((s) => s.expiration);

    let filledCells = 0;
    const z: (number | null)[][] = slices.map((slice) => {
      const row: (number | null)[] = new Array(strikes.length).fill(null);
      for (const sp of slice.strikes) {
        const idx = strikeIndex.get(sp.strike);
        if (idx !== undefined && sp.extrinsic != null) {
          row[idx] = sp.extrinsic;
          filledCells++;
        }
      }
      return interpolateRowGaps(row);
    });

    // A surface needs at least a 2×2 grid to render meaningfully.
    const hasGrid = strikes.length >= 2 && dtes.length >= 2;
    // Distinguishes "render problem" from "API returned rows but no usable
    // premiums" (e.g. a snapshot with empty quotes) so the UI can say which.
    const hasData = filledCells > 0;
    return { strikes, dtes, expirationLabels, z, hasGrid, hasData };
  }, [data]);

  const muted = theme === 'dark' ? colors.muted : colors.dark;
  const inputBorder = theme === 'dark' ? colors.borderDark : colors.borderLight;
  const inputBg = theme === 'dark' ? colors.cardDark : colors.cardLight;
  const inputColor = theme === 'dark' ? colors.light : colors.dark;

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 13,
    borderRadius: 6,
    border: `1px solid ${inputBorder}`,
    backgroundColor: inputBg,
    color: inputColor,
    cursor: 'pointer',
    outline: 'none',
    minWidth: 110,
  };

  const showError = error && error !== 'No data available yet';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h1 className="text-3xl font-bold">Premium Heat Map</h1>
        <BetaBadge size="md" />
        <TooltipWrapper text={TITLE_TOOLTIP} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>
      <p className="text-sm mb-6" style={{ color: muted }}>
        Extrinsic (time) value surface for{' '}
        <span style={{ color: inputColor, fontWeight: 600 }}>{symbol}</span> {' '}
        {optionType === 'C' ? 'calls' : 'puts'} — premium minus intrinsic value across
        strikes and expirations.
      </p>

      {/* ── Controls ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: muted }}>Type</span>
          <select
            value={optionType}
            onChange={(e) => setOptionType(e.target.value as 'C' | 'P')}
            style={selectStyle}
            aria-label="Option type"
          >
            <option value="C">Calls</option>
            <option value="P">Puts</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: muted }}>Max DTE</span>
          <select
            value={dteMax}
            onChange={(e) => setDteMax(Number(e.target.value))}
            style={selectStyle}
            aria-label="Maximum days to expiration"
          >
            {DTE_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: muted }}>Strikes</span>
          <select
            value={strikeCount}
            onChange={(e) => setStrikeCount(Number(e.target.value))}
            style={selectStyle}
            aria-label="Number of strikes around spot"
          >
            {STRIKE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} strikes</option>
            ))}
          </select>
        </div>

        {data && (
          <div className="text-sm ml-auto" style={{ color: muted }}>
            Spot{' '}
            <span style={{ color: inputColor, fontWeight: 600 }}>
              ${data.spot_price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* ── Surface ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: inputBorder, backgroundColor: `${inputBg}80` }}
      >
        {showError ? (
          <ErrorMessage message={error} />
        ) : loading && !data ? (
          <div className="flex items-center justify-center" style={{ height: 560 }}>
            <LoadingSpinner />
          </div>
        ) : !plot ? (
          <div
            className="flex items-center justify-center text-sm"
            style={{ height: 560, color: muted }}
          >
            No options premium data available for {symbol} {optionType === 'C' ? 'calls' : 'puts'} yet.
          </div>
        ) : !plot.hasGrid ? (
          <div
            className="flex items-center justify-center text-sm"
            style={{ height: 560, color: muted }}
          >
            Not enough strikes/expirations to render a surface — try widening Max DTE or strike count.
          </div>
        ) : !plot.hasData ? (
          <div
            className="flex items-center justify-center text-sm text-center px-6"
            style={{ height: 560, color: muted }}
          >
            The snapshot returned strikes and expirations for {symbol}{' '}
            {optionType === 'C' ? 'calls' : 'puts'}, but no usable premium quotes
            (bid/ask/mid/last) — so there are no time-value points to plot. This usually
            means the latest option-chain snapshot has empty quotes.
          </div>
        ) : (
          <PremiumSurfacePlot
            strikes={plot.strikes}
            dtes={plot.dtes}
            z={plot.z}
            expirationLabels={plot.expirationLabels}
            optionType={optionType}
            spot={data!.spot_price}
            theme={theme}
            height={560}
          />
        )}
      </div>
    </div>
  );
}
