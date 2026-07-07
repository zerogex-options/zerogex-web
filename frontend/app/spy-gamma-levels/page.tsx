import GammaLevelsView, { gammaMetadata } from '../spx-gamma-levels/gammaLevels';

// Free, public, ~15-minute-delayed SPY gamma levels — SPY-first (title, H1,
// intro, Today's Read, share block, first-screen card order all lead with SPY),
// self-canonical to /spy-gamma-levels. Shared view lives in ../spx-gamma-levels.
export const dynamic = 'force-static';
export const revalidate = 900;

export const metadata = gammaMetadata('SPY');

export default function Page() {
  return <GammaLevelsView primary="SPY" />;
}
