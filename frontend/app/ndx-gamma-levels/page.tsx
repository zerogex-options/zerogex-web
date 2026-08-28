import GammaLevelsView, { gammaMetadata } from '../spx-gamma-levels/gammaLevels';

// Free, public, ~15-minute-delayed NDX gamma levels — NDX-first (title, H1,
// intro, Today's Read, share block, first-screen card order all lead with NDX),
// self-canonical to /ndx-gamma-levels. Shared view lives in ../spx-gamma-levels.
export const dynamic = 'force-static';
export const revalidate = 900;

export function generateMetadata() {
  return gammaMetadata('NDX');
}

export default function Page() {
  return <GammaLevelsView primary="NDX" />;
}
