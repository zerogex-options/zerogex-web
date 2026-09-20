"use client";

/**
 * The Gamma Terminal's instrument block: the Gamma Chart, plus ONE of two
 * price-aligned readings of dealer gamma beside it.
 *
 *   • LADDERS — two strike-aligned Net-GEX ladders (`PairGammaHeatmap`, the
 *     same element Pair Comparison and the My Dashboard "Gamma Ladder" tile
 *     mount) pinned to the tape. The chart drops its own gamma rail
 *     (`hideRail`) and gives that column's width to the candles, holds spot at
 *     the vertical center of the tape (`centerPriceOnSpot`) and reports where
 *     that is (`onGeometry`); the ladders clip their rows to the card and
 *     slide the spot row onto the same y. The first ladder follows the chart's
 *     underlying; the second compares any OTHER symbol and opens on the same
 *     index's other book (SPY↔SPX, ES→SPX, QQQ↔NDX, NQ→NDX).
 *   • STRIKE PANEL — the chart's own gamma-structure rail, drawn in its column
 *     beside the y-axis with the four views it has always had (Silhouette /
 *     Net / Split / Combined) and the on-bar $ labels toggle. This is what the
 *     page rendered before the Gamma Chart and the Gamma Terminal were folded
 *     into one surface, and no reader lost it in the fold.
 *
 * The two are alternatives, not a stack: both answer "where is dealer gamma
 * concentrated relative to price", one as a pair of books beside the tape and
 * one as a silhouette inside it, and running both at once would spend the
 * width twice on the same question.
 *
 * ── Modes ──
 * `delayed` is the public, ~15-minute-delayed view. Everything on screen then
 * comes from frozen server snapshots (`snapshot` for the chart, `ladders` for
 * the two columns) and NOTHING polls: the ladder hooks are handed `enabled:
 * false`, the expiration hooks likewise, and the symbol dropdowns are frozen
 * at the pair the snapshot covers. That is what lets this page stay a public,
 * indexable lead magnet without leaking real-time data or Basic-gated
 * endpoints to an anonymous browser.
 *
 * ── Preferences ──
 * The chosen view persists. So do the chart's own view preferences, under a
 * per-view storage scope: the strike panel keeps the keys /chart has always
 * written and the ladders keep the Gamma Terminal's, so a reader of either
 * former page finds their saved chart exactly as they left it. The chart is
 * keyed on the view so switching remounts it against the right scope rather
 * than letting one view's toolbar state bleed into the other's keys.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import GammaTerminalChart, {
  type ChartGeometry,
  type ChartSnapshot,
  type RewindState,
} from "@/components/GammaTerminalChart";
import PairGammaHeatmap, { ROW_H, type HeatmapColumnInput, type LadderFit } from "@/components/PairGammaHeatmap";
import SymbolSelect from "@/components/SymbolSelect";
import StrikeFilterToggle from "@/components/StrikeFilterToggle";
import SessionDeltaToggle from "@/components/SessionDeltaToggle";
import GexUnitToggle from "@/components/GexUnitToggle";
import ChartCaption from "@/components/ChartCaption";
import { useGammaLadderColumn } from "@/hooks/useGammaLadder";
import { useChartExpirations } from "@/hooks/useChartExpirations";
import { useGexUnit } from "@/core/GexUnitContext";
import { useStrikeFilter } from "@/core/StrikeFilterContext";
import { useSessionDelta } from "@/core/SessionDeltaContext";
import { useTimeframe, type UnderlyingSymbol } from "@/core/TimeframeContext";
import { SYMBOLS, sameIndexPairFor } from "@/core/symbols";
import type { LadderSnapshot } from "./snapshot";

export type TerminalView = "ladders" | "panel";

/** The two frozen ladder columns the public view renders instead of polling. */
export interface LadderSnapshots {
  primary: LadderSnapshot | null;
  compare: LadderSnapshot | null;
}

const VIEW_STORAGE_KEY = "zg.gammaTerminal.view.v1";
const isView = (v: unknown): v is TerminalView => v === "ladders" || v === "panel";

// The side-by-side layout (chart | ladders) engages at Tailwind's xl breakpoint;
// below it the ladders stack under the chart and keep their natural height.
const WIDE_QUERY = "(min-width: 1280px)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const readWide = () => window.matchMedia(WIDE_QUERY).matches;
const readWideServer = () => false;

const FROZEN_SYMBOL_TITLE =
  "The free preview is a frozen ~15-minute-delayed snapshot of this pair. Members pick any underlying, live.";

/** A frozen snapshot column in the shape PairGammaHeatmap takes, or an empty
 *  column that renders the ladder's own "no data" state when the fetch failed. */
function snapshotColumn(snap: LadderSnapshot | null, symbol: string): Omit<HeatmapColumnInput, "control"> {
  if (!snap) {
    return {
      symbol,
      cells: [],
      spot: null,
      gammaFlip: null,
      callWall: null,
      putWall: null,
      maxPain: null,
      loading: false,
      error: null,
    };
  }
  return {
    ...snap,
    positioningKind: "reachback" as const,
    // Δ-since-open needs a second per-symbol fetch the delayed view does not
    // make, so the triangles are simply absent rather than wrong.
    sessionBaseline: null,
    loading: false,
    error: null,
  };
}

export default function TerminalSurface({
  snapshot = null,
  delayed = false,
  ladders = null,
}: {
  snapshot?: ChartSnapshot | null;
  delayed?: boolean;
  ladders?: LadderSnapshots | null;
}) {
  const live = !delayed;
  const { symbol: ctxSymbol, setSymbol } = useTimeframe();
  const wide = useSyncExternalStore(subscribeWide, readWide, readWideServer);

  // The view, restored from localStorage after mount (server and first client
  // render use the default, so there is no hydration mismatch — the same
  // one-time reconciliation the chart does for its own preferences).
  const [view, setView] = useState<TerminalView>("ladders");
  const [viewHydrated, setViewHydrated] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_STORAGE_KEY);
      if (isView(raw)) setView(raw);
    } catch {
      /* storage unavailable */
    }
    setViewHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!viewHydrated) return;
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* storage unavailable */
    }
  }, [view, viewHydrated]);
  const laddersView = view === "ladders";

  // Alignment: the chart reports its tape geometry (CSS px from its card's top
  // edge); the ladder card is given the chart's height, and the ladders' own
  // wrapper is measured so the fit can be expressed from the ladder's top.
  const [geometry, setGeometry] = useState<ChartGeometry | null>(null);
  const onGeometry = useCallback((g: ChartGeometry) => setGeometry(g), []);
  // The chart's replay clock: while rewinding, both ladders show the book as
  // of this moment instead of the live tip.
  const [rewind, setRewind] = useState<RewindState>({ active: false, time: null });
  const onRewind = useCallback((state: RewindState) => setRewind(state), []);
  const rewindTime = rewind.active ? rewind.time : null;
  const laddersRef = useRef<HTMLDivElement | null>(null);
  const [ladderBox, setLadderBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const el = laddersRef.current;
    if (!el || !wide || !laddersView) return;
    const ro = new ResizeObserver(() => setLadderBox({ top: el.offsetTop, height: el.getBoundingClientRect().height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide, laddersView, geometry?.height]);
  // Both cards share a top edge (same flex row), so a y from the chart card's
  // top is a y from the ladder card's top; subtract the ladders' own offset.
  const fit: LadderFit | null =
    wide && laddersView && geometry && geometry.spotY != null && ladderBox
      ? { spotY: geometry.spotY - ladderBox.top, bottom: ladderBox.height }
      : null;
  // Enough strikes each side to fill the band from any anchor.
  const maxSide = fit ? Math.max(20, Math.ceil(fit.bottom / ROW_H) + 1) : 20;
  const { gexUnit } = useGexUnit();
  // Ladder settings — shared, persisted preferences (StrikeFilterContext,
  // SessionDeltaContext) so they stay in sync with Pair Comparison and the
  // dashboard ladder tile. The toggle UIs live on the ladder card below.
  const { activeOnly } = useStrikeFilter();
  const { showSessionDelta } = useSessionDelta();

  // The chart's underlying. Live, it is the app-wide symbol, so the chart, the
  // first ladder, the header picker and the Key Levels strip above all agree.
  // Delayed, the snapshot decides: the frozen data covers exactly one pair and
  // the context symbol (which the header still lets a reader change) must not
  // be able to mislabel it.
  const snapSym1 = (ladders?.primary?.symbol ?? snapshot?.symbol ?? "SPY") as UnderlyingSymbol;
  const sym1: UnderlyingSymbol = delayed ? snapSym1 : ctxSymbol;

  // The comparison ladder's symbol — free-select, never the primary. Defaults to
  // the primary's same-index counterpart (SPY↔SPX, ES→SPX, QQQ↔NDX, NQ→NDX), so
  // the terminal opens on one underlying seen through two books rather than on
  // the cross-index like-pair. Kept as a preference: when the primary moves onto
  // it through a control this page does not own (the chart's own switcher, the
  // header picker), the two swap so the comparison ladder shows the PREVIOUS
  // primary rather than a duplicate. Render-time state adjustment (the same
  // pattern the chart uses for its view key), not an effect, so the swapped
  // ladder is what actually paints.
  const [sym2Pref, setSym2Pref] = useState<UnderlyingSymbol>(() => sameIndexPairFor(sym1));
  const [prevSym1, setPrevSym1] = useState<UnderlyingSymbol>(sym1);
  if (prevSym1 !== sym1) {
    setPrevSym1(sym1);
    if (sym2Pref === sym1) setSym2Pref(prevSym1);
  }
  const sym2: UnderlyingSymbol = delayed
    ? ((ladders?.compare?.symbol ?? sameIndexPairFor(sym1)) as UnderlyingSymbol)
    : sym2Pref === sym1
      ? sameIndexPairFor(sym1)
      : sym2Pref;

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
  // chain doesn't list never leaks into that column's request. Live only — the
  // delayed view has no Expiry control and must issue no requests.
  const exp1 = useChartExpirations(sym1, live);
  const exp2 = useChartExpirations(sym2, live);

  // Polled only while the ladders are the view being shown AND the page is
  // live: the strike panel answers the same question from the chart's own
  // data, so leaving two ladder columns polling behind it would be pure load.
  const laddersEnabled = live && laddersView;
  const leftLive = useGammaLadderColumn(sym1, laddersEnabled, {
    expirations: exp1.selection,
    sessionDelta: showSessionDelta,
    rewindTime,
  });
  const rightLive = useGammaLadderColumn(sym2, laddersEnabled, {
    expirations: exp2.selection,
    sessionDelta: showSessionDelta,
    rewindTime,
  });
  const left = delayed ? snapshotColumn(ladders?.primary ?? null, sym1) : leftLive;
  const right = delayed ? snapshotColumn(ladders?.compare ?? null, sym2) : rightLive;

  const leftInput: HeatmapColumnInput = {
    ...left,
    control: (
      <SymbolSelect
        value={sym1}
        onChange={changeSym1}
        disabled={delayed}
        disabledTitle={FROZEN_SYMBOL_TITLE}
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
        disabled={delayed}
        disabledTitle={FROZEN_SYMBOL_TITLE}
        ariaLabel="Comparison ladder symbol"
      />
    ),
  };

  return (
    <div className="mb-8">
      {/* View switch. Sits above the instrument rather than inside the chart's
          own toolbar because it decides the page's layout, not a chart overlay. */}
      <div className="flex items-center gap-2 mb-3">
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>Beside the tape</span>
        <div className="zg-gc-seg" role="tablist" aria-label="Dealer-gamma view beside the chart">
          {([
            ["ladders", "Gamma Ladders", "Two strike-aligned Net-GEX ladders pinned to the tape: the chart's underlying and any other symbol, both centered on spot with the Gamma Flip, Call/Put Walls and Max Pain marked."],
            ["panel", "Strike Panel", "The chart's own gamma-structure rail in the column beside the price axis — net dealer gamma by price, as a smoothed silhouette or per-strike Net / Split / Combined bars."],
          ] as Array<[TerminalView, string, string]>).map(([v, label, title]) => (
            <button
              key={v}
              type="button"
              className="zg-gc-seg-btn"
              data-active={view === v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              title={title}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal layout: the chart takes the width, the two ladders sit beside
          it on a wide screen (≥ xl) and stack under it below that — the chart
          keeps its own aspect ratio, so anything narrower would squeeze the
          candles into a strip. Top-aligned: the ladder card is as tall as its
          strike window, the chart as tall as its aspect ratio; neither is
          stretched to the other. In Strike Panel view the chart is alone and
          takes the full width with its rail column back. */}
      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Keyed on the view: each view persists the chart's toolbar under its
              own storage scope, and a remount is what makes the chart re-read
              the right one instead of writing this view's state to the other
              view's keys. */}
          <GammaTerminalChart
            key={view}
            snapshot={snapshot}
            delayed={delayed}
            hideRail={laddersView}
            centerPriceOnSpot={laddersView}
            storageScope={laddersView ? "terminal" : undefined}
            overlayDefaults={laddersView ? { ribbons: true } : undefined}
            onGeometry={laddersView ? onGeometry : undefined}
            onRewind={laddersView ? onRewind : undefined}
          />
        </div>

        {/* 372px on a wide screen — a little over the two columns' 175px floors,
            so the header legend, strike tags and the value column fit while
            the tape keeps as much width as possible. The card takes the
            chart's exact height once the chart has reported it; the ladders
            fill the space between the controls and the caption and clip. */}
        {laddersView && (
          <aside
            className="relative w-full xl:w-[372px] xl:flex-none zg-feature-shell zg-gc-rise flex flex-col"
            style={{ overflow: "hidden", height: wide && geometry ? geometry.height : undefined }}
            aria-label="Gamma ladders"
          >
            <div className="flex flex-col min-h-0 flex-1">
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
                {/* Session Δ needs a per-symbol session-open frame the delayed
                    snapshot does not carry, so the toggle is simply not offered
                    on the public view rather than shown doing nothing. */}
                {live && (
                  <div className="flex items-center gap-2">
                    <span className="zg-eyebrow" style={{ fontSize: 10 }}>Session Δ</span>
                    <SessionDeltaToggle showHint={false} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="zg-eyebrow" style={{ fontSize: 10 }}>Unit</span>
                  <GexUnitToggle showHint={false} />
                </div>
              </div>

              <div ref={laddersRef} className="flex-1 min-h-0" style={{ overflow: "hidden" }}>
                <PairGammaHeatmap left={leftInput} right={rightInput} gexUnit={gexUnit} activeOnly={activeOnly} fit={fit} maxSide={maxSide} />
              </div>
              <ChartCaption variant="strip" right={delayed ? "Terminal / Ladders · ~15-min delayed" : "Terminal / Ladders"} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
