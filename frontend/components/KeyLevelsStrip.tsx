'use client';

/**
 * KeyLevelsStrip — the dealer-positioning levels, at a glance, above the fold.
 *
 * The levels a trader actually acts on (Gamma Flip, Pin Strike, Call Wall, Put
 * Wall, Max Pain) were only readable by scrolling down to the Gamma Chart and
 * reading them off the plot — which on a phone means scrolling past the whole
 * page header first. This is the same information in the wall cards' own
 * format, compressed to a strip that fits at the top of the page.
 *
 * It is NOT a second source of truth. Every value comes from useGammaPlaybook,
 * the hook that already resolves exactly the levels the chart is drawing for
 * the symbol and expirations the trader picked — including the expiration-
 * filtered book, where the served whole-chain summary would disagree with the
 * lines on the plot. Change the symbol or the expiry filter anywhere and the
 * strip moves with the chart, because there is no separate state to move.
 *
 * The same component is the Key Levels widget on My Dashboard: inside a pane it
 * reads that pane's scoped symbol/expiration contexts, so a split board's two
 * halves show two different books. Rendering is shared verbatim rather than
 * reimplemented — one strip, two mounts.
 *
 * It also FLIPS between underlyings in place: hover-revealed arrows at the
 * sides on a pointer device, a horizontal swipe on touch. A flip is not a
 * private mode — it calls the same setSymbol the chart's own symbol switcher
 * calls, so the strip can never end up describing a different book from the
 * chart under it, and inside a My Dashboard pane the pane's TimeframeSymbolScope
 * turns that same call into "retarget this half", leaving the other one alone.
 */

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { ChartSnapshot } from './GammaTerminalChart';
import { useGammaPlaybook, type GammaPlaybookRead } from '@/hooks/useGammaPlaybook';
import { usePinStability } from '@/hooks/useApiData';
import { useTimeframe, type UnderlyingSymbol } from '@/core/TimeframeContext';
import { SYMBOLS } from '@/core/symbols';
import {
  buildKeyLevels,
  flipDirectionBetween,
  flipSymbol,
  keyLevelsRegime,
  type KeyLevel,
} from '@/core/keyLevels';
import {
  PIN_STRIKE_TOOLTIP,
  classifyPinStrength,
  pinStrengthLabel,
  pinStabilityNote,
} from '@/core/pinStrike';

/**
 * Smallest card that still reads. The grid fits as many as the width allows, so
 * this number decides the phone layout as much as the desktop one, and 120 is
 * where both land well: a 390px handset gets two columns wide enough for the
 * whole "+$4.58 / +0.75%" distance line (three columns clipped it), while a
 * three-quarter-width dashboard widget still fits all six across in one row.
 */
const MIN_CARD_PX = 120;

/**
 * The full native-tooltip text for one card: what the level is, how far it sits
 * from spot, and any extra metadata (the Pin's strength). Carried on `title`
 * rather than an Info affordance per card — six info dots would defeat the
 * point of a compact strip, and the wall cards keep the same copy.
 */
function cardTitle(level: KeyLevel): string {
  const lines = [`${level.label}: ${level.valueLabel}`];
  if (level.distance) lines.push(level.distance.label);
  else if (level.emptyNote) lines.push(level.emptyNote);
  if (level.note) lines.push(level.note);
  if (level.subnote) lines.push(level.subnote);
  lines.push(level.tooltip);
  return lines.join('\n');
}

function KeyLevelCard({ level, loading }: { level: KeyLevel; loading: boolean }) {
  const resolved = level.value != null;
  // A level that hasn't landed yet reads as an instrument warming up; one that
  // landed as "unresolved" reads as the book being degraded, and says which.
  const pending = loading && !resolved;

  return (
    <div className="zg-panel min-w-0 px-3 py-2.5" title={cardTitle(level)}>
      <div className="zg-eyebrow truncate" style={{ fontSize: 10 }}>
        {level.label}
      </div>
      {pending ? (
        <div className="zg-skeleton-line mt-1.5 h-4 w-3/4" />
      ) : (
        <div
          className="zg-metric mt-1 truncate"
          style={{ fontSize: 17, color: resolved ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          {level.valueLabel}
        </div>
      )}
      {pending ? (
        <div className="zg-skeleton-line mt-1.5 h-2.5 w-1/2" />
      ) : level.distance ? (
        <div
          // Wraps rather than truncates: a clipped "+0.7…" is worse than a
          // second line, and the percent is the half a trader compares across
          // levels. The relation word ("above spot") lives in the card's title
          // instead — the arrow and the sign already carry it here.
          className="mt-0.5 flex items-start gap-1 font-semibold leading-tight"
          style={{
            fontSize: 10.5,
            color: level.distance.isAbove ? 'var(--color-bull)' : 'var(--color-bear)',
          }}
        >
          {level.distance.isAbove ? (
            <TrendingUp size={11} strokeWidth={2.5} className="shrink-0 translate-y-px" />
          ) : (
            <TrendingDown size={11} strokeWidth={2.5} className="shrink-0 translate-y-px" />
          )}
          <span>{`${level.distance.deltaLabel} / ${level.distance.pctLabel}`}</span>
        </div>
      ) : (
        <div
          className="mt-0.5 font-semibold leading-tight"
          style={{ fontSize: 10.5, color: 'var(--text-muted)' }}
        >
          {level.emptyNote}
        </div>
      )}
      {/* The Pin's session path. Rendered rather than tucked into the card
          title because a pin that migrates while a trader watches reads as a
          level that failed unless the movement is stated where they are
          already looking -- the strength note above it lives in the title,
          which is exactly how it went unnoticed. */}
      {!pending && level.subnote && (
        <div
          className="mt-0.5 truncate leading-tight"
          style={{ fontSize: 10, color: 'var(--text-muted)' }}
          title={level.subnote}
        >
          {level.subnote}
        </div>
      )}
    </div>
  );
}

/**
 * What the strip needs to offer a flip: where each arrow goes, and what to do
 * when one is taken. Resolved by the caller (which owns the symbol list and the
 * setter) so the board itself stays presentational.
 */
export type KeyLevelsFlip = {
  /**
   * The ring the strip flips around. Passed whole rather than as two
   * precomputed ends because the board needs it to work out which way a symbol
   * change moved — including one made from outside the strip entirely.
   */
  symbols: readonly string[];
  onFlip: (symbol: string) => void;
};

type FlipDirection = 'prev' | 'next';

/** Minimum horizontal travel before a touch drag counts as a flip. */
const SWIPE_MIN_PX = 44;
/**
 * How much more horizontal than vertical that travel has to be. A finger
 * scrolling the page drifts sideways; without this the strip would swap the
 * symbol out from under someone who was only scrolling past it.
 */
const SWIPE_AXIS_RATIO = 1.5;

function FlipArrow({
  direction,
  symbol,
  onActivate,
}: {
  direction: FlipDirection;
  symbol: string;
  onActivate: () => void;
}) {
  const label = `Show key levels for ${symbol}`;
  return (
    <button
      type="button"
      className={`zg-kl-arrow zg-kl-arrow--${direction}`}
      onClick={onActivate}
      aria-label={label}
      title={label}
    >
      {direction === 'prev' ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
    </button>
  );
}

/**
 * The shared rendering primitive: the header line plus the card grid, driven by
 * a resolved read. Kept separate from the fetching so the strip and the widget
 * (and anything later) render byte-identical output from the same input.
 *
 * The grid is auto-fit rather than a fixed column count, so one component
 * covers every place it lands: six across on a desktop strip or a wide widget,
 * two on a phone — where all six still sit above the fold, which is the whole
 * point — and two inside a quarter-width dashboard widget.
 */
export function KeyLevelsBoard({
  read,
  flip = null,
  className = '',
}: {
  read: GammaPlaybookRead;
  /** Omit (or pass null) for a strip with nowhere to flip to. */
  flip?: KeyLevelsFlip | null;
  className?: string;
}) {
  const prevSymbol = flip ? flipSymbol(flip.symbols, read.symbol, -1) : null;
  const nextSymbol = flip ? flipSymbol(flip.symbols, read.symbol, 1) : null;
  const canFlip = flip != null && prevSymbol != null && nextSymbol != null;

  // Which way the incoming symbol slides in from, worked out during render from
  // the symbol change itself (the useApiData "reset on prop change" idiom).
  // Deriving it beats remembering which control was used: the direction lands
  // in the same render as the new symbol, so it can never animate one way while
  // showing a symbol that moved the other, and a change made from the page's
  // own symbol picker animates correctly too.
  const [seen, setSeen] = useState<{ symbol: string; direction: FlipDirection }>({
    symbol: read.symbol,
    direction: 'next',
  });
  if (seen.symbol !== read.symbol) {
    // React's "adjust state while rendering" escape hatch: it discards this
    // pass and re-runs immediately, so the committed render carries the new
    // symbol and its direction together — which is the whole point, since a
    // direction that lands a render later would never restart the animation.
    setSeen({
      symbol: read.symbol,
      direction: flipDirectionBetween(flip?.symbols ?? [], seen.symbol, read.symbol),
    });
  }
  const direction = seen.direction;

  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const goto = useCallback(
    (dir: FlipDirection) => {
      const target = dir === 'next' ? nextSymbol : prevSymbol;
      if (!flip || !target) return;
      flip.onFlip(target);
    },
    [flip, nextSymbol, prevSymbol],
  );

  // Touch only: a mouse drag across the strip is a text selection (and, in My
  // Dashboard's edit mode, the start of a tile drag), never a flip.
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || !canFlip) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;
      // Dragging left pulls the next symbol in from the right, as any carousel.
      goto(dx < 0 ? 'next' : 'prev');
    },
    [canFlip, goto],
  );

  // The browser takes the pointer back when it decides the gesture was a
  // scroll; that must abandon the swipe rather than resolve it on release.
  const onPointerCancel = useCallback(() => {
    swipeStart.current = null;
  }, []);

  // The Pin's strength copy and its confidence thresholds live in
  // core/pinStrike; composing them here is what keeps the level model itself
  // free of runtime imports (and unit-testable under the Node runner).
  const pinStrength = classifyPinStrength(read.pinStrike, read.pinConfidence);
  // Polls on its own slow cadence: a whole-session reduction can only change
  // when the analytics cycle writes a frame. Skipped on the delayed public
  // snapshot, which is a frozen moment with no session path behind it.
  const { data: pinStability } = usePinStability(read.symbol, 60000, !read.delayed);
  const levels = buildKeyLevels({
    // Carried so an unresolved level can name the chain it came from: an ES/NQ
    // blank is an SPX/NDX snapshot with no publishable crossing, not a gap in
    // the futures data.
    symbol: read.symbol,
    spot: read.spot,
    spotChange: read.spotChange,
    spotChangePercent: read.spotChangePercent,
    flip: read.flip,
    pin: {
      strike: read.pinStrike,
      note: pinStrength === 'none' ? null : `Pin strength: ${pinStrengthLabel(pinStrength)}`,
      subnote: pinStabilityNote(pinStability),
      absentLabel: pinStrengthLabel('none'),
      tooltip: PIN_STRIKE_TOOLTIP,
    },
    callWall: read.callWall,
    putWall: read.putWall,
    maxPain: read.maxPain,
  });
  const regime = keyLevelsRegime(read.longGamma);

  return (
    <section className={className} aria-label={`Key levels for ${read.symbol}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* The underlying is the loudest thing in this line, and everything
            around it is demoted to a label. It is what the arrows and the swipe
            change, so it has to be the token the eye is already on when it
            changes — otherwise the first flip reads as the numbers jumping for
            no reason. It carries the same entry animation as the cards, so the
            symbol visibly moves with them. */}
        <span className="zg-eyebrow" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Key Levels
        </span>
        <span
          key={read.symbol}
          className="zg-kl-symbol"
          data-flip={canFlip ? direction : undefined}
        >
          {read.symbol}
        </span>
        <span className="zg-eyebrow truncate" style={{ fontSize: 10 }}>
          · {read.expirationLabel}
        </span>
        {regime && (
          <span
            className="zg-chip"
            style={{
              // Reuses the site's existing bull/bear tone for the regime — the
              // color-coded regime system is a separate track, not this one.
              ['--chip-color' as string]: regime.long ? 'var(--color-bull)' : 'var(--color-bear)',
              fontSize: 10,
            }}
            title={regime.detail}
          >
            {regime.label}
          </span>
        )}
        {read.delayed && (
          <span
            className="zg-chip"
            style={{ ['--chip-color' as string]: 'var(--color-warning)', fontSize: 10 }}
            title="This public preview is a frozen snapshot, roughly 15 minutes behind the live book."
          >
            ~15-min delayed
          </span>
        )}
      </div>

      <div
        className="zg-kl-flip"
        onPointerDown={canFlip ? onPointerDown : undefined}
        onPointerUp={canFlip ? onPointerUp : undefined}
        onPointerCancel={canFlip ? onPointerCancel : undefined}
      >
        {canFlip && prevSymbol && (
          <FlipArrow direction="prev" symbol={prevSymbol} onActivate={() => goto('prev')} />
        )}
        <div
          // Keyed on the symbol so the entry animation restarts on every flip
          // (a CSS animation only replays on a fresh element).
          key={read.symbol}
          className="zg-kl-cards"
          data-flip={canFlip ? direction : undefined}
          style={{
            display: 'grid',
            gap: 8,
            gridTemplateColumns: `repeat(auto-fit, minmax(${MIN_CARD_PX}px, 1fr))`,
          }}
        >
          {levels.map((level) => (
            <KeyLevelCard key={level.id} level={level} loading={read.loading} />
          ))}
        </div>
        {canFlip && nextSymbol && (
          <FlipArrow direction="next" symbol={nextSymbol} onActivate={() => goto('next')} />
        )}
      </div>
    </section>
  );
}

/**
 * The page-level strip. Pass the delayed snapshot on the public /chart route so
 * it renders frozen server data and does zero client fetching, exactly like the
 * chart it sits above.
 */
export default function KeyLevelsStrip({
  snapshot = null,
  delayed = false,
  className = '',
}: {
  snapshot?: ChartSnapshot | null;
  delayed?: boolean;
  className?: string;
}) {
  const read = useGammaPlaybook({ snapshot, delayed });
  const { setSymbol } = useTimeframe();

  // No flipping on the delayed public view: switching symbols needs data the
  // frozen snapshot does not carry, which is the same reason the chart below
  // it fixes its own symbol picker there.
  const flip: KeyLevelsFlip | null = read.delayed
    ? null
    : { symbols: SYMBOLS, onFlip: (symbol) => setSymbol(symbol as UnderlyingSymbol) };

  return <KeyLevelsBoard read={read} flip={flip} className={className} />;
}
