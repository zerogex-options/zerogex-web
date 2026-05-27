// CSS `left` for a centered indicator (pair with translateX(-50%)) on a pill-shaped spectrum bar, insetting the extremes so the indicator sits in the bar's straight section at pct=0/100 instead of overhanging the rounded caps.
export function spectrumIndicatorLeft(pct: number, barHeightPx: number, indicatorWidthPx: number): string {
  const insetPx = (barHeightPx + indicatorWidthPx) / 2;
  const offsetPx = insetPx - (pct * 2 * insetPx) / 100;
  return `calc(${pct}% + ${offsetPx}px)`;
}
