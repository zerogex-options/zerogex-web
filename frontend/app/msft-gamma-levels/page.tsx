import GammaLevelsView, { gammaMetadata } from '../spx-gamma-levels/gammaLevels';

// Free, public, ~15-minute-delayed MSFT gamma levels: Microsoft's stock, on the
// same template as /nvda-gamma-levels. MSFT-first (title, H1, intro, Today's
// Read, share block, first card), then the six market instruments' cards so it
// links into the cluster, self-canonical to /msft-gamma-levels. What a stock
// page leaves out, and why, is in ../spx-gamma-levels (GammaLevelsView,
// stockExtras) and core/symbols.ts (LEVELS_PAGE_STOCKS).
export const dynamic = 'force-static';
export const revalidate = 60; // FREE_REVALIDATE_SECONDS in core/freeDelay.ts; Next needs a literal here.

export function generateMetadata() {
  return gammaMetadata('MSFT');
}

export default function Page() {
  return <GammaLevelsView primary="MSFT" />;
}
