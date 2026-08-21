"use client";

/**
 * Pair Comparison — two premium, strike-aligned Net-GEX ladders side by side.
 *
 * Column 1 tracks the symbol selected in the app header (the global symbol
 * context); column 2 is free-select via its own dropdown, so you can compare
 * the dealer-gamma structure of any two of SPY / QQQ / SPX / NDX. Both stay
 * centered on the latest spot and update in realtime — or drop into Replay to
 * scrub the most-recent session and watch the gamma levels migrate minute by
 * minute, a single playhead driving both columns in lockstep.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import PairGammaHeatmap, { type HeatmapCell, type HeatmapColumnInput } from "@/components/PairGammaHeatmap";
import StrikeFilterToggle from "@/components/StrikeFilterToggle";
import SessionDeltaToggle from "@/components/SessionDeltaToggle";
import ExpirationMultiSelect from "@/components/ExpirationMultiSelect";
import PairReplayScrubber from "@/components/PairReplayScrubber";
import PairCandleChart from "@/components/PairCandleChart";
import GexUnitToggle from "@/components/GexUnitToggle";
import BetaBadge from "@/components/BetaBadge";
import TooltipWrapper from "@/components/TooltipWrapper";
import ChartCaption from "@/components/ChartCaption";
import { type ChartTimeframe } from "@/components/ChartTimeframeSelect";
import { useGammaLadderColumn, type GammaLadderColumnData } from "@/hooks/useGammaLadder";
import { useChartExpirations } from "@/hooks/useChartExpirations";
import { useSharedExpirations } from "@/hooks/useSharedExpirations";
import { usePairReplay, type PairReplayData, type ReplayFrame, type ReplayCandle } from "@/hooks/usePairReplay";
import { reconcileExpirations } from "@/core/expirationPersistence";
import { useGexUnit } from "@/core/GexUnitContext";
import { useStrikeFilter } from "@/core/StrikeFilterContext";
import { useSessionDelta } from "@/core/SessionDeltaContext";
import { useTimeframe, type UnderlyingSymbol } from "@/core/TimeframeContext";
import { SYMBOLS } from "@/core/symbols";

const TIMEFRAME_OPTIONS: Array<{ value: ChartTimeframe; label: string }> = [
  { value: "1min", label: "1m" },
  { value: "5min", label: "5m" },
  { value: "15min", label: "15m" },
  { value: "1hr", label: "1h" },
  { value: "1day", label: "1D" },
];

const INFO_TEXT =
  "Compare two symbols' dealer-gamma structure side by side. The left ladder follows your header symbol; " +
  "pick any of SPY / QQQ / SPX / NDX to compare on the right. Both stay centered on spot and strike-aligned, " +
  "with the Gamma Flip, Call/Put Walls and Max Pain marked. The Expiry filter scopes both ladders (and their " +
  "walls and flip) to one or more expirations — default All; Max Pain reads NA while filtered, as it has no " +
  "per-expiry-set equivalent. Session Δ overlays a small green up / red down triangle beside each strike's " +
  "Net GEX showing whether dealer gamma there has built or eroded since the 09:30 ET open, for the selected " +
  "expirations. Enter Replay to scrub the most-recent session " +
  "minute by minute (spot in replay is the underlying close for that minute; the change is vs the session open, " +
  "while live shows the day change from the prior close; replay is always the whole chain). The Strikes toggle " +
  "shows only strikes carrying " +
  "dealer gamma (Active) or every listed strike near spot (All) — Active keeps high-priced chains like NDX, " +
  "which list a fine grid but concentrate open interest on the round strikes, from reading as sparse. " +
  "Net GEX is a modeled estimate of dealer gamma by strike — decision-support context only, not investment advice.";

// Default "compare against" symbol for each header symbol — its like-pair, so a
// fresh visit opens on a meaningful comparison (SPY↔QQQ, SPX↔NDX).
const COMPARE_DEFAULT: Record<UnderlyingSymbol, UnderlyingSymbol> = {
  SPY: "QQQ",
  QQQ: "SPY",
  SPX: "NDX",
  NDX: "SPX",
};

// Last replay frame at-or-before a timestamp (frames are chronological ascending).
function frameAtOrBefore(frames: ReplayFrame[], targetTs: string | null): ReplayFrame | null {
  if (!frames.length || !targetTs) return frames[frames.length - 1] ?? null;
  const t = Date.parse(targetTs);
  let best: ReplayFrame | null = null;
  for (const f of frames) {
    if (Date.parse(f.timestamp) <= t) best = f;
    else break;
  }
  return best ?? frames[0];
}

function closeAtOrBefore(candles: ReplayCandle[], targetTs: string | null): number | null {
  if (!candles.length || !targetTs) return null;
  const t = Date.parse(targetTs);
  let best: number | null = null;
  for (const c of candles) {
    if (Date.parse(c.timestamp) <= t && c.close != null && Number.isFinite(c.close)) best = c.close;
    else if (Date.parse(c.timestamp) > t) break;
  }
  return best;
}

function firstOpen(candles: ReplayCandle[]): number | null {
  for (const c of candles) {
    if (c.open != null && Number.isFinite(c.open)) return c.open;
  }
  return null;
}

function frameToCells(frame: ReplayFrame | null): HeatmapCell[] {
  if (!frame) return [];
  const out: HeatmapCell[] = [];
  for (const s of frame.strikes ?? []) {
    if (s.strike != null && s.net_gex != null && Number.isFinite(s.strike)) {
      out.push({ strike: s.strike, net_gex: s.net_gex });
    }
  }
  return out;
}

// A styled native dropdown — this is literally the "dropdown at the top of the
// column" the design calls for; column 1's is wired to the global header symbol
// so changing it here also moves the app header.
function SymbolSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: UnderlyingSymbol;
  onChange: (s: UnderlyingSymbol) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as UnderlyingSymbol)}
        aria-label={ariaLabel}
        className="appearance-none font-mono font-bold"
        style={{
          fontSize: 14,
          letterSpacing: "0.04em",
          color: "var(--text-primary)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-control)",
          padding: "3px 22px 3px 8px",
          cursor: "pointer",
        }}
      >
        {SYMBOLS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown size={13} style={{ position: "absolute", right: 5, pointerEvents: "none", color: "var(--text-secondary)" }} />
    </div>
  );
}

// Compact timeframe segmented control for the candle charts — the zg-gc-seg
// idiom the Gamma Chart's toolbar uses.
function TimeframeSeg({ value, onChange }: { value: ChartTimeframe; onChange: (v: ChartTimeframe) => void }) {
  return (
    <div className="zg-gc-seg" role="tablist" aria-label="Candle timeframe">
      {TIMEFRAME_OPTIONS.map((t) => (
        <button
          key={t.value}
          type="button"
          className="zg-gc-seg-btn"
          data-active={t.value === value}
          onClick={() => onChange(t.value)}
          aria-pressed={t.value === value}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Build the replay-mode input for one column at the shared playhead timestamp.
function replayColumn(
  symbol: UnderlyingSymbol,
  replay: PairReplayData,
  cursorTs: string | null,
): GammaLadderColumnData {
  const frame = frameAtOrBefore(replay.frames, cursorTs);
  const spot = closeAtOrBefore(replay.candles, frame?.timestamp ?? cursorTs);
  const open = firstOpen(replay.candles);
  const changePercent = spot != null && open != null && open !== 0 ? ((spot - open) / open) * 100 : null;
  return {
    symbol,
    cells: frameToCells(frame),
    spot,
    gammaFlip: frame?.gamma_flip ?? null,
    callWall: frame?.call_wall ?? null,
    putWall: frame?.put_wall ?? null,
    maxPain: frame?.max_pain ?? null,
    changePercent,
    isPositive: changePercent != null ? changePercent >= 0 : undefined,
    loading: replay.loading && !frame,
    error: replay.error,
  };
}

export default function PairComparisonClient() {
  const { symbol: headerSymbol, setSymbol } = useTimeframe();
  const { gexUnit } = useGexUnit();

  const sym1 = headerSymbol;
  const [sym2, setSym2] = useState<UnderlyingSymbol>(() => COMPARE_DEFAULT[headerSymbol] ?? "QQQ");

  const [mode, setMode] = useState<"live" | "replay">("live");
  // Sticky: once replay is armed the session buffers stay mounted so toggling
  // Live⇄Replay is instant instead of refetching each time.
  const [replayArmed, setReplayArmed] = useState(false);
  // -1 is the "follow the latest frame" sentinel — it resolves to the most
  // recent minute until the user scrubs, so entering Replay opens on "now".
  const [cursor, setCursor] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [loop, setLoop] = useState(true);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("5min");
  // Ladder strike filter — a shared, persisted preference (see
  // StrikeFilterContext) so it stays in sync with the Gamma Exposure table and
  // survives reloads. The toggle UI lives in <StrikeFilterToggle/>.
  const { activeOnly } = useStrikeFilter();

  const liveEnabled = mode === "live";
  // Session-Δ overlay preference (shared with the dashboard ladder tile).
  const { showSessionDelta } = useSessionDelta();

  // Expiration filter — one tab-shared selection, reconciled PER SYMBOL (each
  // column only passes dates its own chain can serve). The page's selector
  // offers the union of the two chains so a date listed on either side stays
  // pickable; replay is always whole-chain, so the selector rests while
  // replaying (its fetches are live-gated too).
  const exp1 = useChartExpirations(sym1, liveEnabled);
  const exp2 = useChartExpirations(sym2, liveEnabled);
  const { selection: sharedExpirations, setSelection: setSharedExpirations } = useSharedExpirations();
  const expiryOptions = useMemo(
    () => Array.from(new Set([...exp1.available, ...exp2.available])).sort(),
    [exp1.available, exp2.available],
  );
  const expirySelected = useMemo(
    () => reconcileExpirations(sharedExpirations, expiryOptions),
    [sharedExpirations, expiryOptions],
  );

  const live1 = useGammaLadderColumn(sym1, liveEnabled, {
    expirations: exp1.selection,
    sessionDelta: showSessionDelta,
  });
  const live2 = useGammaLadderColumn(sym2, liveEnabled, {
    expirations: exp2.selection,
    sessionDelta: showSessionDelta,
  });
  const replay1 = usePairReplay(sym1, replayArmed, mode === "replay");
  const replay2 = usePairReplay(sym2, replayArmed, mode === "replay");

  // Master timeline — column 1's per-minute frames (fall back to column 2 if
  // column 1 has none). Both columns resolve their own frame at the shared ts.
  const timeline = useMemo(() => {
    const src = replay1.frames.length ? replay1.frames : replay2.frames;
    return src.map((f) => f.timestamp);
  }, [replay1.frames, replay2.frames]);

  const replayLoading = replay1.loading || replay2.loading;
  const replayError = replay1.error || replay2.error;
  const sessionDate = replay1.date ?? replay2.date;
  const isToday = replay1.isToday || replay2.isToday;

  const lastIdx = Math.max(0, timeline.length - 1);
  const effCursor = cursor < 0 ? lastIdx : Math.min(cursor, lastIdx);

  // Refs so the interval reads the latest cursor/loop without re-subscribing on
  // every scrub (which would reset the timer). Updated in passive effects.
  const cursorRef = useRef(cursor);
  const loopRef = useRef(loop);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // Auto-advance loop — the page owns it so one playhead drives both columns.
  // All setState lives in the interval callback body (not the effect body and
  // not inside another updater), so it never triggers the cascading-render or
  // impure-updater patterns. At the end it wraps to the open when Loop is on,
  // otherwise it stops.
  useEffect(() => {
    if (mode !== "replay" || !isPlaying || timeline.length === 0) return;
    const id = setInterval(() => {
      const cur = cursorRef.current < 0 ? timeline.length - 1 : cursorRef.current;
      if (cur + 1 >= timeline.length) {
        if (loopRef.current) setCursor(0);
        else setIsPlaying(false);
      } else {
        setCursor(cur + 1);
      }
    }, Math.max(40, Math.round(1000 / speed)));
    return () => clearInterval(id);
  }, [mode, isPlaying, speed, timeline.length]);

  const enterReplay = () => {
    setReplayArmed(true);
    setCursor(-1);
    setMode("replay");
  };
  const exitReplay = () => {
    setMode("live");
    setIsPlaying(false);
  };
  const togglePlay = () => {
    // Pressing Play from the end (or while following the latest) replays from
    // the session open rather than sitting parked on the final frame. Two plain
    // sequential setStates (not a setState nested in another updater) so a
    // StrictMode double-invoke can't double-queue the cursor reset.
    if (!isPlaying && (cursor < 0 || cursor >= lastIdx)) setCursor(0);
    setIsPlaying((p) => !p);
  };
  const step = (delta: number) => {
    setIsPlaying(false);
    setCursor(Math.max(0, Math.min(lastIdx, effCursor + delta)));
  };
  const scrub = (i: number) => {
    setIsPlaying(false);
    setCursor(i);
  };

  // Keep the two columns distinct: picking the other column's current symbol
  // swaps them rather than showing a symbol compared against itself. Column 1's
  // dropdown drives the global header symbol, so its swap moves the header too.
  const changeSym1 = (s: UnderlyingSymbol) => {
    if (s === sym2) setSym2(sym1);
    setSymbol(s);
  };
  const changeSym2 = (s: UnderlyingSymbol) => {
    if (s === sym1) setSymbol(sym2);
    setSym2(s);
  };

  const cursorTs = timeline[effCursor] ?? null;

  // The React Compiler auto-memoizes these granularly (replayColumn only
  // re-scans when its inputs actually change), so we keep the code plain.
  const leftData = mode === "live" ? live1 : replayColumn(sym1, replay1, cursorTs);
  const rightData = mode === "live" ? live2 : replayColumn(sym2, replay2, cursorTs);

  const leftInput: HeatmapColumnInput = {
    ...leftData,
    control: <SymbolSelect value={sym1} onChange={changeSym1} ariaLabel="Column 1 symbol (follows the header)" />,
  };
  const rightInput: HeatmapColumnInput = {
    ...rightData,
    control: <SymbolSelect value={sym2} onChange={changeSym2} ariaLabel="Column 2 symbol to compare" />,
  };

  return (
    <PageShell width="wide">
      {/* Hero — compact: the descriptive subtext now lives in the info tooltip. */}
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: "var(--color-brand-primary)" }} />
          <span className="zg-eyebrow" style={{ color: "var(--color-brand-primary)" }}>
            Dealer gamma · side by side
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <h1 className="zg-h1" style={{ margin: 0 }}>Pair Comparison</h1>
          <BetaBadge size="md" />
          <TooltipWrapper text={INFO_TEXT} placement="bottom" />
        </div>
      </header>

      {/* Global controls: candle timeframe · ladder strike filter · expiry
          filter · session-Δ overlay (left) · GEX unit (right) */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>Candles</span>
        <TimeframeSeg value={timeframe} onChange={setTimeframe} />
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>Strikes</span>
        <StrikeFilterToggle />
        <ExpirationMultiSelect
          options={expiryOptions}
          selected={expirySelected}
          onChange={setSharedExpirations}
          label="Expiry"
          disabled={expiryOptions.length === 0}
        />
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>Session Δ</span>
        <SessionDeltaToggle />
        <div className="flex items-center gap-2 ml-auto">
          <span className="zg-eyebrow" style={{ fontSize: 10 }}>GEX unit</span>
          <GexUnitToggle showHint={false} />
        </div>
      </div>

      {/* One rectangular instrument: narrow strike-aligned ladders on the left,
          the two candle charts stacked on the right to fill the space, and the
          replay transport spanning the bottom — one playhead drives all four. */}
      <div className="zg-feature-shell zg-gc-rise" style={{ overflow: "hidden" }}>
        <div className="flex flex-col lg:flex-row">
          {/* Left: the two gamma ladders. ~212px per column so the level
              legend, strike tags and the value column (with the Δ slot) fit
              without crowding; the candle charts flex into what remains. */}
          <div className="w-full lg:w-[425px] lg:flex-none border-b lg:border-b-0 lg:border-r border-[var(--border-default)]">
            <PairGammaHeatmap left={leftInput} right={rightInput} gexUnit={gexUnit} activeOnly={activeOnly} />
          </div>

          {/* Right: stacked candles — top = header symbol, bottom = compare
              symbol — scrubbing in lockstep with the ladders during Replay. */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="border-b border-[var(--border-default)]">
              <PairCandleChart
                symbol={sym1}
                timeframe={timeframe}
                embedded
                replay={{
                  active: mode === "replay",
                  candles: replay1.candles,
                  cursorTs,
                  loading: replay1.loading,
                  levels: { spot: leftData.spot, flip: leftData.gammaFlip, call: leftData.callWall, put: leftData.putWall, pain: leftData.maxPain },
                }}
              />
            </div>
            <PairCandleChart
              symbol={sym2}
              timeframe={timeframe}
              embedded
              replay={{
                active: mode === "replay",
                candles: replay2.candles,
                cursorTs,
                loading: replay2.loading,
                levels: { spot: rightData.spot, flip: rightData.gammaFlip, call: rightData.callWall, put: rightData.putWall, pain: rightData.maxPain },
              }}
            />
          </div>
        </div>

        {/* Replay transport — spans the full width; drives both ladders and both
            candle charts together. */}
        <PairReplayScrubber
          mode={mode}
          onEnterReplay={enterReplay}
          onExitReplay={exitReplay}
          frameCount={timeline.length}
          cursor={effCursor}
          onScrub={scrub}
          isPlaying={isPlaying}
          onPlayToggle={togglePlay}
          onStep={step}
          loop={loop}
          onLoopToggle={() => setLoop((l) => !l)}
          speed={speed}
          onSpeedChange={setSpeed}
          cursorTime={cursorTs}
          startTime={timeline[0] ?? null}
          endTime={timeline[timeline.length - 1] ?? null}
          sessionDate={sessionDate}
          isToday={isToday}
          loading={replayLoading}
          error={replayError}
        />
        <ChartCaption variant="strip" right="Pair / Gamma" />
      </div>
    </PageShell>
  );
}
