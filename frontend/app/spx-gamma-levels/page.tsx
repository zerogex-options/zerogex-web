import GammaLevelsView, { gammaMetadata } from './gammaLevels';

// Free, public, ~15-minute-delayed SPX gamma levels. The shared ticker-first
// view lives in ./gammaLevels; this route just fixes the primary symbol to SPX.
export const dynamic = 'force-static';
export const revalidate = 900;

export const metadata = gammaMetadata('SPX');

export default function Page() {
  return <GammaLevelsView primary="SPX" />;
}
