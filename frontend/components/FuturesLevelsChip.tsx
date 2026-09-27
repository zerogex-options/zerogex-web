import type { CSSProperties } from 'react';
import { futuresLevelsExplainer, futuresLevelsLabel } from '@/core/symbols';

/**
 * "Implied from SPX" chip for a future's dealer levels.
 *
 * ES / NQ have no options book: every level on an ES view is the SPX level
 * carried onto the futures axis at fair value (see futuresLevelsLabel in
 * core/symbols.ts). Each surface that draws ES / NQ levels mounts this beside
 * them, so the projection is disclosed wherever the numbers appear. Renders
 * nothing for a cash symbol, so call sites can mount it unconditionally.
 *
 * The explanation rides on `title`, like the neighboring chips in the rows it
 * sits in. The chip text is itself the disclosure, so it still holds on touch.
 */
export default function FuturesLevelsChip({
  symbol,
  className = 'zg-chip',
  style,
}: {
  symbol: string | null | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const label = futuresLevelsLabel(symbol);
  const explainer = futuresLevelsExplainer(symbol);
  if (!label || !explainer) return null;
  return (
    <span className={className} style={{ fontSize: 10, ...style }} title={explainer}>
      {label}
    </span>
  );
}
