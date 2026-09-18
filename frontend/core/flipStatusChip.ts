/**
 * The Gamma Chart's flip status chip — the small in-plot label that explains an
 * ABSENT flip line. Every other level simply isn't drawn when it isn't there;
 * the flip is the one whose absence is itself a question, because a trader
 * opening the chart expects a line and cannot tell whether it is off the
 * visible scale or was never resolved.
 *
 * Three stories, because a blank flip has three different causes and only one
 * of them is a data problem:
 *
 *   • off-scale   — the line exists, it is just outside the price range on
 *                   screen. Says where it is and how to bring it into view.
 *   • no-crossing — a strict SUBSET of the chain is selected and that subset
 *                   has no zero crossing. A finding about the book the trader
 *                   picked, not a miss; it will never resolve on a later
 *                   snapshot, and widening the Expiry filter is the fix.
 *   • unresolved  — the whole chain is on screen and the resolver still
 *                   declined to publish. This is the "wait for the next
 *                   snapshot" case, and the only one of the three that is.
 *
 * Splitting the middle case out matters because the chart's flip follows the
 * Expiry filter and the Dealer Positioning header's does not: with 0DTE picked
 * the chart can go blank while that header still shows a whole-chain level, and
 * the old copy explained that as a degraded snapshot. It is not — it is two
 * different books, and the chip now says so.
 *
 * Pure, so the copy can be pinned by tests without rendering the chart. The
 * explanations are deliberately the SAME ones the dashboard card and the Key
 * Levels strip carry (core/keyLevels.unresolvedLevelTooltip and
 * noFlipInScopeTooltip), so every surface that goes blank tells one story.
 */
import { noFlipInScopeTooltip, unresolvedLevelTooltip } from './keyLevels.ts';

/** The chip text the help pages promise a reader will see (reading-charts). */
export const FLIP_UNAVAILABLE_LABEL = 'FLIP UNAVAILABLE';

/**
 * The subset case. Names the scope rather than the failure, because the level
 * is not missing — the selected expirations genuinely have no crossing.
 */
export const FLIP_NO_CROSSING_LABEL = 'NO FLIP IN SELECTED EXPIRIES';

export type FlipStatusChipKind = 'unresolved' | 'no-crossing' | 'off-scale';

export interface FlipStatusChip {
  kind: FlipStatusChipKind;
  /**
   * Chip text: `FLIP UNAVAILABLE`, `NO FLIP IN SELECTED EXPIRIES`, or
   * `FLIP ↑ 22,600.00` toward the line.
   */
  label: string;
  /**
   * Hover copy. Unresolved: why nothing was published, and on ES / NQ which
   * chain the miss happened on. No-crossing: why a subset often has none, and
   * that widening the filter — not waiting — is what brings the line back.
   * Off-scale: where the line is and how to bring it into view.
   */
  tooltip: string;
  /**
   * True when the chip should carry the amber "?" mark the dashboard card and
   * the Key Levels strip put beside an empty level. Both blank-flip chips get
   * it: neither states a price, and each has something to explain. An
   * off-scale chip already states the price and the direction, so it explains
   * itself.
   */
  explain: boolean;
}

export interface FlipStatusChipInput {
  /** The resolved flip, or null when no level was published for this scope. */
  flip: number | null | undefined;
  /** Whether `flip` sits inside the price range currently on screen. */
  onScreen: boolean;
  /** Whether `flip` lies above the top of the visible range (else below). */
  aboveView: boolean;
  /** The chart's own price formatter, so the chip matches the axis tags. */
  formatPrice: (price: number) => string;
  /** The underlying on screen; names the backing chain for ES / NQ blanks. */
  symbol?: string | null;
  /**
   * True when the Expiry filter has a strict SUBSET of the chain on screen —
   * the scope whose flip is recomputed from the selected expirations alone.
   * Only consulted when `flip` is null: it decides WHICH blank-flip story the
   * chip tells, never whether one is told. Defaults to false, so a caller that
   * does not filter keeps the whole-chain wording.
   */
  filtered?: boolean;
}

/**
 * Returns the chip to draw, or null when the flip line is on screen and no
 * chip is needed.
 */
export function flipStatusChip(input: FlipStatusChipInput): FlipStatusChip | null {
  const { flip, onScreen, aboveView, formatPrice, symbol, filtered } = input;
  if (flip == null) {
    // The subset case first: when a filter is active it is the CAUSE, and
    // reading it as a declined publish would send the trader to wait for a
    // snapshot that cannot fix it.
    if (filtered) {
      return {
        kind: 'no-crossing',
        label: FLIP_NO_CROSSING_LABEL,
        tooltip: noFlipInScopeTooltip('Gamma Flip'),
        explain: true,
      };
    }
    return {
      kind: 'unresolved',
      label: FLIP_UNAVAILABLE_LABEL,
      tooltip: unresolvedLevelTooltip('Gamma Flip', symbol, 'flip'),
      explain: true,
    };
  }
  if (onScreen) return null;
  const price = formatPrice(flip);
  return {
    kind: 'off-scale',
    label: `FLIP ${aboveView ? '↑' : '↓'} ${price}`,
    tooltip:
      `The gamma flip sits at ${price}, outside the price range on screen. ` +
      'Zoom the price axis out (Price −, Shift+scroll, or drag the right-hand ' +
      'price scale) to bring it into view.',
    explain: false,
  };
}
