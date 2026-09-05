"use client";

/**
 * Gamma Terminal (beta) — the Gamma Chart with two gamma ladders beside it.
 *
 * One screen, three instruments the site already ships, mounted together the
 * way a trading terminal lays them out:
 *
 *   • LEFT  — the Gamma Chart itself (`GammaTerminalChart`, the exact component
 *     /chart renders in live mode): candles with the Gamma Flip, Call/Put
 *     Walls, Max Pain, Pin Strike, GEX King and the gamma-structure rail, plus
 *     its own toolbar (symbol, timeframe, price style, overlays, Expiry filter,
 *     Rewind). Nothing about it is re-implemented here.
 *   • RIGHT — two strike-aligned Net-GEX ladders (`PairGammaHeatmap`, the same
 *     element Pair Comparison and the My Dashboard "Gamma Ladder" tile use).
 *
 * Symbols: the underlying is the app-wide symbol (`useTimeframe`), so the chart
 * and the FIRST ladder always agree — pick it from the ladder's dropdown, the
 * chart's own switcher, or the header, they are all the same state. The SECOND
 * ladder is free-select from every OTHER symbol; it opens on the primary's
 * like-pair (SPY↔QQQ, SPX↔NDX, ES↔NQ) and swaps rather than ever comparing a
 * symbol against itself.
 *
 * The chart's Expiry filter is tab-shared (useSharedExpirations), so it scopes
 * the ladders too — each column reconciles the selection to its own chain
 * (useChartExpirations), exactly as Pair Comparison does. The ladders are live;
 * the chart's Rewind does not drive them (Pair Comparison owns the replay
 * variant of the ladders). Strikes / Session Δ / Unit are ladder settings and
 * live on the ladder card.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import GammaTerminalChart from "@/components/GammaTerminalChart";
import PairGammaHeatmap, { type HeatmapColumnInput } from "@/components/PairGammaHeatmap";
import SymbolSelect from "@/components/SymbolSelect";
import StrikeFilterToggle from "@/components/StrikeFilterToggle";
import SessionDeltaToggle from "@/components/SessionDeltaToggle";
import GexUnitToggle from "@/components/GexUnitToggle";
import BetaBadge from "@/components/BetaBadge";
import TooltipWrapper from "@/components/TooltipWrapper";
import ChartCaption from "@/components/ChartCaption";
import { useGammaLadderColumn } from "@/hooks/useGammaLadder";
import { useChartExpirations } from "@/hooks/useChartExpirations";
import { useGexUnit } from "@/core/GexUnitContext";
import { useStrikeFilter } from "@/core/StrikeFilterContext";
import { useSessionDelta } from "@/core/SessionDeltaContext";
import { useTimeframe, type UnderlyingSymbol } from "@/core/TimeframeContext";
import { SYMBOLS, likePairFor } from "@/core/symbols";

const INFO_TEXT =
  "The Gamma Chart with two gamma ladders beside it. The chart is the same instrument as the Gamma Chart page — " +
  "candles with the Gamma Flip, Call/Put Walls, Max Pain, Pin Strike, GEX King and the gamma-structure rail — " +
  "with its own toolbar for symbol, timeframe, price style, overlays, Expiry filter and Rewind. The underlying you " +
  "pick (from the first ladder's dropdown, the chart's switcher or the header) drives the chart AND the first ladder; " +
  "the second ladder compares any other symbol and opens on the natural pair (SPY↔QQQ, SPX↔NDX, ES↔NQ). " +
  "Both ladders stay centered on spot and strike-aligned, with the Gamma Flip, Call/Put Walls and Max Pain marked " +
  "and the heaviest strike in view crowned. The chart's Expiry filter scopes the ladders too (Max Pain reads NA while filtered, " +
  "as it has no per-expiry-set equivalent). The ladders are live and do not follow the chart's Rewind clock. " +
  "Strikes shows only strikes carrying dealer gamma (Active) or every listed strike near spot (All); Session Δ " +
  "marks whether dealer gamma at each strike has built or eroded since the 09:30 ET open. " +
  "Gamma levels and Net GEX are modeled estimates of dealer positioning — decision-support context only, not investment advice.";

export default function GammaTerminalClient() {
  const { symbol: sym1, setSymbol } = useTimeframe();
  const { gexUnit } = useGexUnit();
  // Ladder settings — shared, persisted preferences (StrikeFilterContext,
  // SessionDeltaContext) so they stay in sync with Pair Comparison and the
  // dashboard ladder tile. The toggle UIs live on the ladder card below.
  const { activeOnly } = useStrikeFilter();
  const { showSessionDelta } = useSessionDelta();

  // The comparison ladder's symbol — free-select, never the primary. Kept as a
  // preference: when the primary moves onto it through a control this page
  // does not own (the chart's own switcher, the header picker), the two swap so
  // the comparison ladder shows the PREVIOUS primary rather than a duplicate.
  // Render-time state adjustment (the same pattern the chart uses for its view
  // key), not an effect, so the swapped ladder is what actually paints.
  const [sym2Pref, setSym2Pref] = useState<UnderlyingSymbol>(() => likePairFor(sym1));
  const [prevSym1, setPrevSym1] = useState<UnderlyingSymbol>(sym1);
  if (prevSym1 !== sym1) {
    setPrevSym1(sym1);
    if (sym2Pref === sym1) setSym2Pref(prevSym1);
  }
  const sym2: UnderlyingSymbol = sym2Pref === sym1 ? likePairFor(sym1) : sym2Pref;

  // Picking the comparison symbol as the primary swaps them (Pair Comparison
  // semantics); the primary itself is the app-wide symbol, so the chart and the
  // header follow in the same render.
  const changeSym1 = (s: UnderlyingSymbol) => {
    if (s === sym2) setSym2Pref(sym1);
    setSymbol(s);
  };
  const compareOptions = SYMBOLS.filter((s) => s !== sym1);

  // Expiration scope per column: the tab-shared selection the chart's Expiry
  // control writes, reconciled to each symbol's own chain so a date the other
  // chain doesn't list never leaks into that column's request.
  const exp1 = useChartExpirations(sym1, true);
  const exp2 = useChartExpirations(sym2, true);

  const left = useGammaLadderColumn(sym1, true, {
    expirations: exp1.selection,
    sessionDelta: showSessionDelta,
  });
  const right = useGammaLadderColumn(sym2, true, {
    expirations: exp2.selection,
    sessionDelta: showSessionDelta,
  });

  const leftInput: HeatmapColumnInput = {
    ...left,
    control: (
      <SymbolSelect
        value={sym1}
        onChange={changeSym1}
        ariaLabel="Underlying — drives the chart and this ladder"
      />
    ),
  };
  const rightInput: HeatmapColumnInput = {
    ...right,
    control: (
      <SymbolSelect
        value={sym2}
        onChange={setSym2Pref}
        options={compareOptions}
        ariaLabel="Comparison ladder symbol"
      />
    ),
  };

  return (
    <PageShell width="wide">
      {/* Hero — compact; the descriptive copy lives in the info tooltip. */}
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: "var(--color-brand-primary)" }} />
          <span className="zg-eyebrow" style={{ color: "var(--color-brand-primary)" }}>
            Proprietary · price + dealer gamma, side by side
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <h1 className="zg-h1" style={{ margin: 0 }}>Gamma Terminal</h1>
          <BetaBadge size="md" />
          <TooltipWrapper text={INFO_TEXT} placement="bottom" />
        </div>
      </header>

      {/* Terminal layout: the chart takes the width, the two ladders sit beside
          it on a wide screen (≥ xl) and stack under it below that — the chart
          keeps its own aspect ratio, so anything narrower would squeeze the
          candles into a strip. Top-aligned: the ladder card is as tall as its
          strike window, the chart as tall as its aspect ratio; neither is
          stretched to the other. */}
      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
        <div className="flex-1 min-w-0">
          <GammaTerminalChart />
        </div>

        {/* 425px on a wide screen: ~212px per column, the same budget Pair
            Comparison gives its ladders, so the header legend, strike tags and
            the value column (with the Δ slot) fit without crowding. */}
        <aside
          className="w-full xl:w-[425px] xl:flex-none zg-feature-shell zg-gc-rise"
          style={{ overflow: "hidden" }}
          aria-label="Gamma ladders"
        >
          <div>
            {/* Ladder settings — the same three toggles the dashboard ladder
                tile and Pair Comparison expose; symbol, timeframe and Expiry
                belong to the chart's toolbar. */}
            <div
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2">
                <span className="zg-eyebrow" style={{ fontSize: 10 }}>Strikes</span>
                <StrikeFilterToggle showHint={false} />
              </div>
              <div className="flex items-center gap-2">
                <span className="zg-eyebrow" style={{ fontSize: 10 }}>Session Δ</span>
                <SessionDeltaToggle showHint={false} />
              </div>
              <div className="flex items-center gap-2">
                <span className="zg-eyebrow" style={{ fontSize: 10 }}>Unit</span>
                <GexUnitToggle showHint={false} />
              </div>
            </div>

            <PairGammaHeatmap left={leftInput} right={rightInput} gexUnit={gexUnit} activeOnly={activeOnly} />
            <ChartCaption variant="strip" right="Terminal / Ladders" />
          </div>
        </aside>
      </div>

      <p className="mt-4" style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 820 }}>
        Gamma levels and Net GEX are modeled estimates of dealer positioning derived from the options chain and
        update throughout the session. They are decision-support context, not a guarantee of price behavior, and
        are not investment advice.
      </p>
    </PageShell>
  );
}
