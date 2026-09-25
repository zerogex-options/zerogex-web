// Readable ink for text painted in a level's own color.
//
// The Gamma Chart names each level (FLIP, CALL WALL, PIN, ...) in a small chip
// on the level's line. The name is painted in the level's color so that the
// color alone says which level it is, before anyone reads 9.5px text. When
// the names went to --text-primary a member wrote in: with every name in one
// ink, each tiny label has to be read, where before it could be recognized.
//
// The reason they went to --text-primary was real, though. Painted as-is, a
// level color cleared 4.5:1 on its chip in only 105 of 192 palette/level
// combinations, down to 2.36:1, and nearly all of the failures were in light
// mode: the amber, teal and sky blue that read well on a dark card are too
// pale on a cream one.
//
// So this keeps the color and moves only its lightness. A color that already
// clears 4.5:1 comes back untouched, which on the default dark theme is every
// level but one. A color that does not is lightened (on a dark card) or
// darkened (on a light one) in OKLCH, holding its hue, just far enough to clear
// 4.5:1. Chroma is kept wherever sRGB can hold it and reduced only where it
// cannot, so a darkened amber is a deeper amber, not a different color.
//
// Pure, so tests can import it; the chart reaches it through useLevelInk.

export type Rgb = [number, number, number];

/** WCAG AA for normal-size text, which is what a 9.5px label is. */
export const LEVEL_INK_MIN_CONTRAST = 4.5;

/** Luminance where black and white are equally readable: (Y+0.05)^2 = 1.05*0.05. */
const POLE_PIVOT = 0.1791;

const toLinear = (v: number) => ((v /= 255), v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function toHex(c: Rgb): string {
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Text drawn at `opacity` over `bg`, as the browser composites it. */
function composite(c: Rgb, bg: Rgb, opacity: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(c[i] * opacity + bg[i] * (1 - opacity))) as Rgb;
}

// ── OKLab (Björn Ottosson) ───────────────────────────────────────────────────
function toOklab([r, g, b]: Rgb): Rgb {
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab to linear sRGB, unclamped, so the caller can tell when it left the gamut. */
function oklabToLinear([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (lin: Rgb) => lin.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

function encode(lin: Rgb): Rgb {
  return lin.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
  }) as Rgb;
}

/** The color at OKLab lightness `L` with hue `h`, at the most chroma up to `C` that sRGB can show. */
function atLightness(L: number, C: number, h: number): Rgb {
  const at = (c: number) => oklabToLinear([L, c * Math.cos(h), c * Math.sin(h)]);
  if (inGamut(at(C))) return encode(at(C));
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(at(mid))) lo = mid;
    else hi = mid;
  }
  return encode(at(lo));
}

/**
 * The color to paint `color` text in on a `bg` chip: `color` itself when it
 * already clears 4.5:1 there, otherwise the nearest lighter or darker shade of
 * the same hue that does. `opacity` is for text drawn translucent; contrast is
 * then judged on what the reader sees, the text composited over the chip.
 */
export function readableLevelInk(color: Rgb, bg: Rgb, opacity = 1): Rgb {
  const seen = (c: Rgb) => contrastRatio(composite(c, bg, opacity), bg);
  if (seen(color) >= LEVEL_INK_MIN_CONTRAST) return color;

  // Move away from the card: toward white on a dark one, toward black on a
  // light one. At the pole itself the chroma is necessarily zero, so the
  // search always ends on something readable even if no tinted shade is.
  const towardWhite = relativeLuminance(bg) < POLE_PIVOT;
  const [L, a, b] = toOklab(color);
  const C = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  let near = L;
  let far = towardWhite ? 1 : 0;
  let best = atLightness(far, C, h);
  for (let i = 0; i < 24; i++) {
    const mid = (near + far) / 2;
    const candidate = atLightness(mid, C, h);
    if (seen(candidate) >= LEVEL_INK_MIN_CONTRAST) {
      far = mid;
      best = candidate;
    } else {
      near = mid;
    }
  }
  return best;
}
