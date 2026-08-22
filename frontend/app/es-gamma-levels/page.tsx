import GammaLevelsView, { gammaMetadata } from '../spx-gamma-levels/gammaLevels';

// Free, public, ~15-minute-delayed ES gamma levels — ES-first (title, H1,
// intro, Today's Read, share block, first-screen card order all lead with ES),
// self-canonical to /es-gamma-levels. Shared view lives in ../spx-gamma-levels.
//
// ES carries no options chain of its own here: the levels are SPX
// option-derived and converted to ES prices by the API using the live
// futures basis, which the page's intro and FAQ disclose.
export const dynamic = 'force-static';
export const revalidate = 900;

export const metadata = gammaMetadata('ES');

export default function Page() {
  return <GammaLevelsView primary="ES" />;
}
