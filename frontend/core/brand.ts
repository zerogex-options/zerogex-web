// Brand lockups — the single place that knows which logo file to serve.
//
// `make logo` deploys these into /public from assets/branding/*.png, cropping
// each export down to its artwork on the way in (scripts/trim-png.js). Because
// the deployed files carry no transparent margin, callers size them directly —
// set a height (or a max width) and the lockup fills it — instead of the old
// "render at 130% inside an overflow-hidden box" trick that existed to hide the
// padding baked into the previous SVG exports.
//
// Two lockups, each in a dark- and a light-theme variant:
//   logo  — crosshair, wordmark and tagline, roughly 3.6:1. Footer, nav.
//   title — crosshair and wordmark side by side, roughly 3.3:1. Header bars.
//
// The dark variant has the light wordmark (for dark backgrounds), the light
// variant the dark wordmark — matching the `isDark ? dark : light` reading at
// every call site.
//
// The pixel dimensions below are what `make logo` produces today; they feed
// next/image's intrinsic-size hint, so a re-export that changes the artwork's
// proportions should be reflected here (run `make logo` and read the sizes it
// prints). They only affect pre-load layout reservation, never the rendered
// size, which each call site sets in CSS.

export type BrandAsset = {
  src: string;
  width: number;
  height: number;
};

// Verified against what `make logo` prints, not against the previous export:
// the August re-export reshaped the full lockup from a stacked, near-square
// arrangement to a horizontal one, taking it from 1024x970 to 1024x288. The
// numbers here kept the old proportions, so next/image reserved roughly three
// times the height the artwork needs and the layout collapsed once it loaded.
// Re-read these from `make logo` after any re-export.
export const BRAND_LOGO: { dark: BrandAsset; light: BrandAsset } = {
  dark: { src: '/logo-dark.png', width: 1024, height: 288 },
  light: { src: '/logo-light.png', width: 1024, height: 287 },
};

export const BRAND_TITLE: { dark: BrandAsset; light: BrandAsset } = {
  dark: { src: '/title-dark.png', width: 1280, height: 390 },
  light: { src: '/title-light.png', width: 1280, height: 390 },
};

/** Stacked crosshair-over-wordmark lockup for the active theme. */
export function brandLogo(isDark: boolean): BrandAsset {
  return isDark ? BRAND_LOGO.dark : BRAND_LOGO.light;
}

/** Horizontal crosshair-and-wordmark lockup for the active theme. */
export function brandTitle(isDark: boolean): BrandAsset {
  return isDark ? BRAND_TITLE.dark : BRAND_TITLE.light;
}
