import GammaLevelsView, { gammaMetadata } from '../spx-gamma-levels/gammaLevels';

// Free, public, ~15-minute-delayed NVDA gamma levels: the first single-stock
// levels page. NVDA-first (title, H1, intro, Today's Read, share block, first
// card), then the six market instruments' cards so it links into the cluster,
// self-canonical to /nvda-gamma-levels. Shared view lives in
// ../spx-gamma-levels; what a stock page leaves out, and why, is noted there
// (GammaLevelsView) and in core/symbols.ts (LEVELS_PAGE_STOCKS).
export const dynamic = 'force-static';
export const revalidate = 60; // FREE_REVALIDATE_SECONDS in core/freeDelay.ts; Next needs a literal here.

export function generateMetadata() {
  return gammaMetadata('NVDA');
}

export default function Page() {
  return <GammaLevelsView primary="NVDA" />;
}
