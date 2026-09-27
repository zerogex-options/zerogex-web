/**
 * The y-domain for the Dealer Gamma Structure panel.
 *
 * Extracted from the chart component so it can be tested directly. It has now
 * put lines off the top of the panel twice, and a heuristic that decides
 * whether a chart is readable should not only be checkable by eye.
 */

/**
 * A y-domain that survives the close.
 *
 * Dealer gamma explodes as 0DTE time-to-expiry goes to zero, so the last
 * twenty minutes of a session routinely carry readings an order of magnitude
 * above everything before them. That spike is real, but on a linear axis it
 * sets the scale for the whole chart and flattens the other six hours into a
 * line sitting on zero: the session becomes unreadable in exchange for one
 * feature the reader can already see coming.
 *
 * So when that happens the domain is built from a high quantile of |value|
 * rather than the maximum, and the outliers run off the top. Nothing is
 * hidden: the caller renders a count of what is off scale and a control to
 * switch to the full range, because silently clipping a $3B print would be
 * its own kind of lie.
 *
 * But ONLY when that happens. A quantile cap applied unconditionally clips the
 * top 5% of every session, including ordinary ones with no spike at all, so
 * lines leave the top of the chart on a day where everything would have fit.
 * That is the common case and it simply looks broken. The cap is therefore
 * used only when the extreme sits far enough past the bulk that fitting it
 * would flatten the rest: under DOMAIN_OUTLIER_RATIO the chart shows
 * everything, and at or above it the bulk would be squashed into the middle
 * third of the panel and the clip earns its keep.
 */
export const DOMAIN_QUANTILE = 0.95;
export const DOMAIN_HEADROOM = 1.15;
export const DOMAIN_OUTLIER_RATIO = 3;

export interface DomainRow {
  stability: number | null;
  lean: number | null;
}

export interface RegimeDomain {
  domain: [number, number];
  /** Readings outside the domain. Zero whenever the chart fits everything. */
  clipped: number;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[idx];
}

export function robustDomain(rows: DomainRow[]): RegimeDomain {
  const values = rows
    .flatMap((r) => [r.stability, r.lean])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return { domain: [-1, 1], clipped: 0 };

  const magnitudes = values.map(Math.abs).sort((a, b) => a - b);
  const cap = quantile(magnitudes, DOMAIN_QUANTILE) * DOMAIN_HEADROOM;
  const max = magnitudes[magnitudes.length - 1];

  // Fit everything unless the extreme is far enough past the bulk that doing
  // so would flatten the session. This is the usual path: most days carry no
  // spike worth clipping for, and on those the chart should simply fit.
  if (cap <= 0 || max <= cap * DOMAIN_OUTLIER_RATIO) {
    const bound = Math.max(max * DOMAIN_HEADROOM, 1);
    return { domain: [-bound, bound], clipped: 0 };
  }

  const clipped = values.filter((v) => Math.abs(v) > cap).length;
  return { domain: [-cap, cap], clipped };
}

/**
 * A y-domain for a measure that cannot go negative, anchored at zero.
 *
 * Flip cushion is the absolute room before crossing, so it never prints below
 * zero. Handing it the symmetric domain above puts the whole session in the
 * top half of the panel and reserves the bottom half for a mirror image the
 * series can never visit, which halves the height available to the one thing
 * the chart is read for: how close the cushion came to the boundary.
 *
 * Zero stays on the axis rather than being cropped to the data, because on
 * this field zero IS the boundary; a cushion chart whose floor floated up to
 * the session's minimum would hide how much room was actually left.
 *
 * No quantile cap here. The question is the distance to zero, which stays
 * legible at the bottom of the axis however tall the top gets, so a spike can
 * simply compress the chart instead of being clipped out of it.
 */
export function nonNegativeDomain(values: (number | null | undefined)[]): [number, number] {
  const finite = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (finite.length === 0) return [0, 1];

  const hi = Math.max(1, Math.max(...finite) * DOMAIN_HEADROOM);
  // Defensive: a field that turned out to be signed after all would otherwise
  // have its negative half clipped away without a word.
  const lo = Math.min(0, Math.min(...finite) * DOMAIN_HEADROOM);
  return [lo, hi];
}
