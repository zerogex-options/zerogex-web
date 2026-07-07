import { OG_CONTENT_TYPE, OG_SIZE, ogAlt, renderGammaOgImage } from './gammaOgImage';

export const runtime = 'nodejs';
export const alt = ogAlt('SPX');
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderGammaOgImage('SPX');
}
