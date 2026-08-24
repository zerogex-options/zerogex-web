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
 */

import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ChartSnapshot } from './GammaTerminalChart';
import { useGammaPlaybook, type GammaPlaybookRead } from '@/hooks/useGammaPlaybook';
import { buildKeyLevels, keyLevelsRegime, type KeyLevel } from '@/core/keyLevels';
import {
  PIN_STRIKE_TOOLTIP,
  classifyPinStrength,
  pinStrengthLabel,
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
    </div>
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
  className = '',
}: {
  read: GammaPlaybookRead;
  className?: string;
}) {
  // The Pin's strength copy and its confidence thresholds live in
  // core/pinStrike; composing them here is what keeps the level model itself
  // free of runtime imports (and unit-testable under the Node runner).
  const pinStrength = classifyPinStrength(read.pinStrike, read.pinConfidence);
  const levels = buildKeyLevels({
    spot: read.spot,
    spotChange: read.spotChange,
    spotChangePercent: read.spotChangePercent,
    flip: read.flip,
    pin: {
      strike: read.pinStrike,
      note: pinStrength === 'none' ? null : `Pin strength: ${pinStrengthLabel(pinStrength)}`,
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
        <span className="zg-eyebrow" style={{ color: 'var(--text-primary)' }}>
          Key Levels
        </span>
        <span className="zg-eyebrow truncate" style={{ fontSize: 10 }}>
          {read.symbol} · {read.expirationLabel}
        </span>
        {regime && (
          <span
            className="zg-chip"
            style={{
              // Reuses the site's existing bull/bear tone for the regime — the
              // colour-coded regime system is a separate track, not this one.
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
  return <KeyLevelsBoard read={read} className={className} />;
}
