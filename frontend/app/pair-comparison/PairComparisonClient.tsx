"use client";

/**
 * Ticker-Pair Comparison — compares the two "like" index/ETF pairs
 * (SPY↔SPX and QQQ↔NDX) side by side.
 *
 * Layout (desktop): two stacked candlestick charts on the left (one per ticker
 * in the pair — the Gamma Chart's candles without the levels/gamma rail), and
 * two center-pinned, row-aligned single-column Net-GEX heatmaps on the right.
 */

import { useMemo, useState } from "react";
import PageShell from "@/components/layout/PageShell";
import PairCandleChart from "@/components/PairCandleChart";
import PairGammaHeatmap, { type HeatmapColumnInput, type HeatmapCell } from "@/components/PairGammaHeatmap";
import ChartTimeframeSelect, { type ChartTimeframe } from "@/components/ChartTimeframeSelect";
import GexUnitToggle from "@/components/GexUnitToggle";
import { useApiData, useGEXSummary } from "@/hooks/useApiData";
import { useGexUnit } from "@/core/GexUnitContext";

const PAIRS = {
  "SPY-SPX": ["SPY", "SPX"] as const,
  "QQQ-NDX": ["QQQ", "NDX"] as const,
};
type PairKey = keyof typeof PAIRS;
const PAIR_KEYS = Object.keys(PAIRS) as PairKey[];

interface HeatmapBucket {
  timestamp: string;
  heatmap?: HeatmapCell[];
}

// Walk back to the most recent bucket that actually carries per-strike gamma so
// an empty after-hours tip doesn't blank the column (mirrors the chart snapshot).
function latestHeatmap(buckets: HeatmapBucket[] | null | undefined): HeatmapCell[] {
  if (!Array.isArray(buckets)) return [];
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const h = buckets[i]?.heatmap;
    if (Array.isArray(h) && h.length > 0) return h;
  }
  return [];
}

function heatmapUrl(symbol: string): string {
  const s = encodeURIComponent(symbol);
  // Small window — we only need the freshest per-strike column. `expiration`
  // omitted => whole-chain aggregate, matching the /gex-heatmap default.
  return `/api/gex/heatmap?symbol=${s}&underlying=${s}&timeframe=5min&window_units=6`;
}

export default function PairComparisonClient() {
  const [pair, setPair] = useState<PairKey>("SPY-SPX");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("5min");
  const { gexUnit } = useGexUnit();

  const [sym1, sym2] = PAIRS[pair];

  // Levels (spot / flip / walls / max pain) come from the summary endpoint;
  // the per-strike Net GEX column comes from the heatmap endpoint.
  const { data: sum1 } = useGEXSummary(sym1, 5000);
  const { data: sum2 } = useGEXSummary(sym2, 5000);
  const { data: hm1, loading: hm1Loading, error: hm1Error } = useApiData<HeatmapBucket[]>(heatmapUrl(sym1), {
    refreshInterval: 5000,
  });
  const { data: hm2, loading: hm2Loading, error: hm2Error } = useApiData<HeatmapBucket[]>(heatmapUrl(sym2), {
    refreshInterval: 5000,
  });

  const leftInput: HeatmapColumnInput = useMemo(
    () => ({
      symbol: sym1,
      cells: latestHeatmap(hm1),
      spot: sum1?.spot_price ?? null,
      gammaFlip: sum1?.gamma_flip ?? null,
      callWall: sum1?.call_wall ?? null,
      putWall: sum1?.put_wall ?? null,
      maxPain: sum1?.max_pain ?? null,
      loading: hm1Loading,
      error: hm1Error,
    }),
    [sym1, hm1, sum1, hm1Loading, hm1Error],
  );

  const rightInput: HeatmapColumnInput = useMemo(
    () => ({
      symbol: sym2,
      cells: latestHeatmap(hm2),
      spot: sum2?.spot_price ?? null,
      gammaFlip: sum2?.gamma_flip ?? null,
      callWall: sum2?.call_wall ?? null,
      putWall: sum2?.put_wall ?? null,
      maxPain: sum2?.max_pain ?? null,
      loading: hm2Loading,
      error: hm2Error,
    }),
    [sym2, hm2, sum2, hm2Loading, hm2Error],
  );

  return (
    <PageShell width="wide">
      <h1 className="zg-h1 mb-2">Pair Comparison</h1>
      <p className="mb-6" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: 760 }}>
        Compare the two &quot;like&quot; pairs — SPY↔SPX and QQQ↔NDX — on one screen. Candles for each
        ticker on the left; a Net-GEX-by-strike heatmap for each on the right, centered on spot and aligned
        strike-for-strike so you can read the two chains against each other. Spot, the Gamma Flip, the
        Call/Put Walls and Max Pain are marked with arrows carrying each level&apos;s value.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="pair-select" className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Pair
          </label>
          <select
            id="pair-select"
            value={pair}
            onChange={(e) => setPair(e.target.value as PairKey)}
            className="px-3 py-2 rounded-lg border text-sm font-semibold"
            style={{
              backgroundColor: "var(--color-surface-subtle)",
              borderColor: "var(--color-border)",
              color: "var(--text-primary)",
            }}
          >
            {PAIR_KEYS.map((k) => (
              <option key={k} value={k}>
                {k.replace("-", " ↔ ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Candles
          </span>
          <ChartTimeframeSelect value={timeframe} onChange={setTimeframe} className="mb-0" />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            GEX unit
          </span>
          <GexUnitToggle />
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: two stacked candlestick charts */}
        <div className="xl:w-[45%] flex flex-col gap-6 min-w-0">
          <PairCandleChart symbol={sym1} timeframe={timeframe} />
          <PairCandleChart symbol={sym2} timeframe={timeframe} />
        </div>

        {/* Right: two aligned single-column Net-GEX heatmaps */}
        <div className="xl:flex-1 min-w-0">
          <div
            className="rounded-lg p-4 overflow-x-auto"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}
          >
            <PairGammaHeatmap left={leftInput} right={rightInput} gexUnit={gexUnit} />
          </div>
        </div>
      </div>

      <p className="mt-6" style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 820 }}>
        Net GEX is a modeled estimate of dealer gamma by strike derived from the options chain; the two columns
        are aligned by strike offset from each ticker&apos;s spot-nearest strike, not by absolute price. Decision-support
        context only — not a guarantee of price behavior, and not investment advice.
      </p>
    </PageShell>
  );
}
