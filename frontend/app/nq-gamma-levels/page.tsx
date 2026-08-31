import GammaLevelsView, { gammaMetadata } from '../spx-gamma-levels/gammaLevels';

// Free, public, ~15-minute-delayed NQ gamma levels — NQ-first (title, H1,
// intro, Today's Read, share block, first-screen card order all lead with NQ),
// self-canonical to /nq-gamma-levels. Shared view lives in ../spx-gamma-levels.
//
// NQ carries no options chain of its own here: the levels are NDX
// option-derived and converted to NQ prices by the API using the live
// futures basis, which the page's intro and FAQ disclose.
export const dynamic = 'force-static';
export const revalidate = 900;

export function generateMetadata() {
  return gammaMetadata('NQ');
}

export default function Page() {
  return <GammaLevelsView primary="NQ" />;
}
