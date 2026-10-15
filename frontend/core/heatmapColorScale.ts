/**
 * The GEX heatmap's color scale (components/GammaHeatmapCanvas.tsx): net GEX,
 * normalized to a signed ratio in [-1, 1], to a color.
 *
 * Light themes keep the original navy → warm white → orange scale.
 *
 * Dark themes get their own. On a dark card the light scale ran backwards:
 * zero GEX was a warm white, so the strikes with nothing on them were the
 * brightest thing on the chart; the strongest negative walls were a navy that
 * sank into the card; and the strongest positive walls came out darker than
 * zero. A member refunded over how the heatmap looked next to other platforms.
 *
 * The dark scale puts zero a shade below the card and brightens each side with
 * |GEX|: orange for positive, violet for negative. Violet stays clear of the
 * green/red candles and the blue flip line drawn on top. The two sides are
 * matched in OKLab lightness at each stop (0.42 / 0.68 / 0.86), so a +X wall
 * and a -X wall carry equal weight.
 *
 * Pure: no React, no DOM.
 */

export type RGB = { r: number; g: number; b: number };

export const blend = (a: RGB, b: RGB, t: number): RGB => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

/** `#rgb` or `#rrggbb`; null for anything else (rgb(), var(), empty). */
export function parseHexColor(value: string | null | undefined): RGB | null {
  const v = value?.trim() ?? '';
  const six = v.match(/^#([0-9a-f]{6})$/i);
  if (six) {
    const n = parseInt(six[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const three = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (three) {
    const [r, g, b] = [three[1], three[2], three[3]].map((d) => parseInt(d + d, 16));
    return { r, g, b };
  }
  return null;
}

// ── Light ──
const LIGHT_NEGATIVE: RGB = { r: 44, g: 72, b: 117 }; // navy
const LIGHT_ZERO: RGB = { r: 255, g: 246, b: 237 }; // warm white
const LIGHT_POSITIVE: RGB = { r: 255, g: 133, b: 49 }; // orange

function lightColor(ratio: number): RGB {
  if (ratio >= 0) return blend(LIGHT_ZERO, LIGHT_POSITIVE, Math.min(1, ratio));
  return blend(LIGHT_NEGATIVE, LIGHT_ZERO, Math.min(1, 1 + ratio));
}

// ── Dark ──
/** Zero is the card times this: a shade darker, so it reads as "nothing here". */
export const DARK_ZERO_SHADE = 0.78;
/** The default palette's dark card, for when the real one can't be read. */
const FALLBACK_DARK_CARD: RGB = { r: 18, g: 40, b: 60 }; // #12283C
/** Where each arm's colors sit along |ratio|, after zero at 0. */
const DARK_STOPS = [0.35, 0.7, 1] as const;
export const DARK_POSITIVE: readonly RGB[] = [
  { r: 123, g: 55, b: 2 }, // #7B3702
  { r: 231, g: 116, b: 18 }, // #E77412
  { r: 255, g: 197, b: 124 }, // #FFC57C
];
export const DARK_NEGATIVE: readonly RGB[] = [
  { r: 85, g: 61, b: 128 }, // #553D80
  { r: 166, g: 125, b: 242 }, // #A67DF2
  { r: 215, g: 199, b: 254 }, // #D7C7FE
];

export function darkZeroColor(card: RGB): RGB {
  return {
    r: Math.round(card.r * DARK_ZERO_SHADE),
    g: Math.round(card.g * DARK_ZERO_SHADE),
    b: Math.round(card.b * DARK_ZERO_SHADE),
  };
}

function darkArm(zero: RGB, arm: readonly RGB[], t: number): RGB {
  const x = Math.min(1, Math.max(0, t));
  let from = zero;
  let start = 0;
  for (let i = 0; i < DARK_STOPS.length; i++) {
    if (x <= DARK_STOPS[i]) return blend(from, arm[i], (x - start) / (DARK_STOPS[i] - start));
    from = arm[i];
    start = DARK_STOPS[i];
  }
  return arm[arm.length - 1];
}

/**
 * The color function for one render. `cardColor` is the theme's --bg-card;
 * only the dark scale uses it.
 */
export function heatmapColorScale(isDark: boolean, cardColor?: string | null): (ratio: number) => RGB {
  if (!isDark) return lightColor;
  const zero = darkZeroColor(parseHexColor(cardColor) ?? FALLBACK_DARK_CARD);
  return (ratio) => (ratio >= 0 ? darkArm(zero, DARK_POSITIVE, ratio) : darkArm(zero, DARK_NEGATIVE, -ratio));
}

const rgbCss = (c: RGB) => `rgb(${c.r},${c.g},${c.b})`;

/**
 * The same scale as a CSS gradient, negative (left) → positive (right), for
 * the narrow layout's legend bar. The dark midpoint is mixed from --bg-card in
 * CSS, so the bar follows a theme or palette change without a re-read.
 */
export function heatmapLegendGradientCss(isDark: boolean): string {
  if (!isDark) {
    const stops: string[] = [];
    for (let i = 0; i <= 8; i++) stops.push(`${rgbCss(lightColor(-1 + (2 * i) / 8))} ${(i / 8) * 100}%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }
  const pct = (ratio: number) => `${((ratio + 1) / 2) * 100}%`;
  const zero = `color-mix(in srgb, var(--bg-card) ${DARK_ZERO_SHADE * 100}%, black)`;
  const stops = [
    ...DARK_STOPS.map((s, i) => `${rgbCss(DARK_NEGATIVE[i])} ${pct(-s)}`).reverse(),
    `${zero} 50%`,
    ...DARK_STOPS.map((s, i) => `${rgbCss(DARK_POSITIVE[i])} ${pct(s)}`),
  ];
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
