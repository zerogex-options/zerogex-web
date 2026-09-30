import type { CSSProperties } from 'react';
import { futuresLevelsExplainer, futuresLevelsLabel, futuresReplayExplainer } from '@/core/symbols';

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
 * A replay passes `variant="replay"`: there the candles are implied from the
 * index too, so the live explanation's "the price is ES's own" would be false.
 */
export default function FuturesLevelsChip({
  symbol,
  variant = 'live',
  className = 'zg-chip',
  style,
}: {
  symbol: string | null | undefined;
  variant?: 'live' | 'replay';
  className?: string;
  style?: CSSProperties;
}) {
  const label = futuresLevelsLabel(symbol);
  const explainer =
    variant === 'replay' ? futuresReplayExplainer(symbol) : futuresLevelsExplainer(symbol);
  if (!label || !explainer) return null;
  return (
    <span className={className} style={{ fontSize: 10, ...style }} title={explainer}>
      {label}
    </span>
  );
}
