/**
 * The Gamma Chart's flip status chip — the small in-plot label that explains an
 * ABSENT flip line. Every other level simply isn't drawn when it isn't there;
 * the flip is the one whose absence is itself a question, because a trader
 * opening the chart expects a line and cannot tell whether it is off the
 * visible scale or was never resolved.
 *
 * Pure, so the copy can be pinned by tests without rendering the chart. Kept
 * out of core/keyLevels because the off-scale story is the chart's alone; the
 * unresolved story is deliberately the SAME explainer the dashboard card and
 * the Key Levels strip carry (core/keyLevels.unresolvedLevelTooltip), so every
 * surface that goes blank tells one story.
 */
import { unresolvedLevelTooltip } from './keyLevels.ts';

/** The chip text the help pages promise a reader will see (reading-charts). */
export const FLIP_UNAVAILABLE_LABEL = 'FLIP UNAVAILABLE';

export type FlipStatusChipKind = 'unresolved' | 'off-scale';

export interface FlipStatusChip {
  kind: FlipStatusChipKind;
  /** Chip text: `FLIP UNAVAILABLE`, or `FLIP ↑ 22,600.00` toward the line. */
  label: string;
  /**
   * Hover copy. Unresolved: why nothing was published, and on ES / NQ which
   * chain the miss happened on. Off-scale: where the line is and how to bring
   * it into view.
   */
  tooltip: string;
  /**
   * True when the chip should carry the amber "?" mark the dashboard card and
   * the Key Levels strip put beside an empty level. Only the unresolved chip
   * gets it: an off-scale chip already states the price and the direction, so
   * it explains itself.
   */
  explain: boolean;
}

export interface FlipStatusChipInput {
  /** The resolved flip, or null when the backend declined to publish one. */
  flip: number | null | undefined;
  /** Whether `flip` sits inside the price range currently on screen. */
  onScreen: boolean;
  /** Whether `flip` lies above the top of the visible range (else below). */
  aboveView: boolean;
  /** The chart's own price formatter, so the chip matches the axis tags. */
  formatPrice: (price: number) => string;
  /** The underlying on screen; names the backing chain for ES / NQ blanks. */
  symbol?: string | null;
}

/**
 * Returns the chip to draw, or null when the flip line is on screen and no
 * chip is needed.
 */
export function flipStatusChip(input: FlipStatusChipInput): FlipStatusChip | null {
  const { flip, onScreen, aboveView, formatPrice, symbol } = input;
  if (flip == null) {
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
