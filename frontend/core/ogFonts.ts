import { readFileSync } from 'node:fs';
import path from 'node:path';

// The font every ImageResponse on the site draws with: the social cards
// (opengraph-image.tsx) and the /embed/image levels card.
//
// All of them were laid out in Noto Sans, which next/og used by default
// through Next 16.1. Next 16.2 changed that default to Geist, which sets
// wider, and "SPX Gamma Levels - Today" on the gamma-levels cards breaks onto
// a second line in it. Passing the old font explicitly keeps every card as it
// was. assets/og/noto-sans-v27-latin-regular.ttf is the exact file Next 16.1
// bundled (Noto Sans 2.007, SIL Open Font License).
//
// Not under app/fonts/: scripts/fetch-google-fonts.mjs deletes and rewrites
// those folders.
function loadNotoSans(): Buffer | null {
  try {
    return readFileSync(path.join(process.cwd(), 'assets/og/noto-sans-v27-latin-regular.ttf'));
  } catch (err) {
    // Without the file, fall back to next/og's own default font rather than
    // failing every image on the site.
    console.warn(`[ogFonts] Noto Sans not loaded, using the next/og default font: ${String(err)}`);
    return null;
  }
}

const notoSans = loadNotoSans();

/** Pass as the `fonts` option to every ImageResponse. */
export const OG_FONTS = notoSans
  ? [{ name: 'Noto Sans', data: notoSans, weight: 400 as const, style: 'normal' as const }]
  : undefined;
