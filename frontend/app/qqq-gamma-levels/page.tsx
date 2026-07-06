import GammaLevelsView, { gammaMetadata } from '../spx-gamma-levels/gammaLevels';

// Free, public, ~15-minute-delayed QQQ gamma levels — QQQ-first (title, H1,
// intro, Today's Read, share block, first-screen card order all lead with QQQ),
// self-canonical to /qqq-gamma-levels. Shared view lives in ../spx-gamma-levels.
export const dynamic = 'force-static';
export const revalidate = 900;

export const metadata = gammaMetadata('QQQ');

export default function Page() {
  return <GammaLevelsView primary="QQQ" />;
}
