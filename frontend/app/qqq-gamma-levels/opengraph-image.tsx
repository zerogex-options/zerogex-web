import { OG_CONTENT_TYPE, OG_SIZE, ogAlt, renderGammaOgImage } from '../spx-gamma-levels/gammaOgImage';

export const runtime = 'nodejs';
export const alt = ogAlt('QQQ');
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderGammaOgImage('QQQ');
}
