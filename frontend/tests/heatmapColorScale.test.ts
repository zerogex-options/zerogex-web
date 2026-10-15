// Unit tests for the GEX heatmap's color scale (core/heatmapColorScale.ts).
//
// Light themes keep the scale the heatmap has always had. Dark themes get one
// where zero sits a shade below the card and each side brightens with |GEX|,
// checked here against every palette's dark card in app/globals.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DARK_NEGATIVE,
  DARK_POSITIVE,
  DARK_ZERO_SHADE,
  darkZeroColor,
  heatmapColorScale,
  heatmapLegendGradientCss,
  parseHexColor,
  type RGB,
} from '../core/heatmapColorScale.ts';

// ── color math ───────────────────────────────────────────────────────────────
const toLinear = (v: number) => ((v /= 255), v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function oklab({ r, g, b }: RGB): [number, number, number] {
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787745 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const lightness = (c: RGB) => oklab(c)[0];
const oklabDistance = (a: RGB, b: RGB) => {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const luminance = ({ r, g, b }: RGB) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// ── every palette's dark card, resolved through the cascade ──────────────────
// :root.dark and :root.palette-* have equal specificity and the palette blocks
// come later, so a palette's light block wins in dark mode unless its own .dark
// block redeclares the token (same model as chartLevelPalette.test.ts).
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
type Block = { sel: string; vars: Record<string, string>; idx: number };
const blocks: Block[] = [];
for (const m of css.matchAll(/^(:root[^\s{]*)\s*\{([^}]*)\}/gm)) {
  if (!/^:root(\.[a-z0-9-]+)*$/.test(m[1])) continue;
  const vars: Record<string, string> = {};
  for (const line of m[2].split(/[\n;]/)) {
    const d = line.match(/\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*$/i);
    if (d) vars[d[1]] = d[2].trim();
  }
  blocks.push({ sel: m[1], vars, idx: m.index! });
}
const PALETTES = [...new Set(blocks.map((b) => b.sel.match(/palette-[a-z-]+/)?.[0]).filter(Boolean))] as string[];
function darkCard(palette: string): string {
  const applicable = blocks.filter((b) =>
    (b.sel.match(/\.[a-z0-9-]+/g) ?? []).map((s) => s.slice(1)).every((c) => c === 'dark' || c === palette));
  applicable.sort((a, b) =>
    (a.sel.match(/\./g) ?? []).length - (b.sel.match(/\./g) ?? []).length || a.idx - b.idx);
  const raw: Record<string, string> = {};
  for (const b of applicable) Object.assign(raw, b.vars);
  return raw['--bg-card'];
}

// ── light ────────────────────────────────────────────────────────────────────
test('light themes keep the scale the heatmap has always had', () => {
  // The pre-dark-scale colorForRatio, verbatim.
  const NEG = { r: 44, g: 72, b: 117 }, ZERO = { r: 255, g: 246, b: 237 }, POS = { r: 255, g: 133, b: 49 };
  const mix = (a: RGB, b: RGB, t: number) => ({
    r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t),
  });
  const original = (ratio: number) => (ratio >= 0 ? mix(ZERO, POS, Math.min(1, ratio)) : mix(NEG, ZERO, Math.min(1, 1 + ratio)));
  const scale = heatmapColorScale(false, '#FFFFFF');
  for (let i = -20; i <= 20; i++) assert.deepEqual(scale(i / 20), original(i / 20), `ratio ${i / 20}`);
});

// ── dark ─────────────────────────────────────────────────────────────────────
test('dark zero is a shade below the card it sits on', () => {
  const card = parseHexColor('#12283C')!;
  assert.deepEqual(heatmapColorScale(true, '#12283C')(0), darkZeroColor(card));
  assert.deepEqual(darkZeroColor(card), { r: 14, g: 31, b: 47 });
  assert.ok(lightness(darkZeroColor(card)) < lightness(card));
});

test('an unreadable card color falls back to the default dark card', () => {
  const fallback = heatmapColorScale(true, '#12283C')(0);
  for (const bad of ['', null, undefined, 'rgb(1, 2, 3)', 'var(--bg-card)', '#12']) {
    assert.deepEqual(heatmapColorScale(true, bad)(0), fallback, String(bad));
  }
  assert.deepEqual(parseHexColor('#abc'), { r: 0xaa, g: 0xbb, b: 0xcc });
});

test('each dark arm brightens steadily with |GEX| and stops at its last color', () => {
  const scale = heatmapColorScale(true, '#12283C');
  for (const sign of [1, -1]) {
    let prev = lightness(scale(0));
    for (let i = 1; i <= 50; i++) {
      const L = lightness(scale((sign * i) / 50));
      assert.ok(L > prev, `${sign > 0 ? '+' : '-'}${i / 50}: ${L.toFixed(3)} after ${prev.toFixed(3)}`);
      prev = L;
    }
  }
  assert.deepEqual(scale(1), DARK_POSITIVE[DARK_POSITIVE.length - 1]);
  assert.deepEqual(scale(-1), DARK_NEGATIVE[DARK_NEGATIVE.length - 1]);
  assert.deepEqual(scale(1.5), scale(1), 'clamped past the clip');
  assert.deepEqual(scale(-1.5), scale(-1), 'clamped past the clip');
});

test('a +X wall and a -X wall carry the same weight, in different hues', () => {
  const scale = heatmapColorScale(true, '#12283C');
  for (const r of [0.35, 0.5, 0.7, 0.85, 1]) {
    const [pos, neg] = [scale(r), scale(-r)];
    assert.ok(Math.abs(lightness(pos) - lightness(neg)) < 0.015, `lightness at ±${r}`);
    assert.ok(oklabDistance(pos, neg) > 0.1, `hue at ±${r}`);
  }
});

test('on every palette’s dark card, zero recedes and strong walls stand out', () => {
  assert.ok(PALETTES.includes('palette-zerogex-og'), 'the palette blocks in globals.css were not found');
  for (const palette of PALETTES) {
    const raw = darkCard(palette);
    const card = parseHexColor(raw);
    assert.ok(card, `${palette}: dark --bg-card ${raw} is not a hex color the canvas can build on`);
    const scale = heatmapColorScale(true, raw);
    assert.ok(lightness(scale(0)) < lightness(card!), `${palette}: zero is not below the card`);
    for (const r of [0.7, -0.7, 1, -1]) {
      const ratio = contrast(scale(r), card!);
      assert.ok(ratio >= 3, `${palette}: ${r} wall at ${ratio.toFixed(2)}:1 against the card`);
    }
  }
});

test('the narrow legend bar matches the canvas scale', () => {
  const dark = heatmapLegendGradientCss(true);
  assert.match(dark, new RegExp(`color-mix\\(in srgb, var\\(--bg-card\\) ${DARK_ZERO_SHADE * 100}%, black\\) 50%`));
  assert.ok(dark.startsWith(`linear-gradient(90deg, rgb(${DARK_NEGATIVE[2].r},${DARK_NEGATIVE[2].g},${DARK_NEGATIVE[2].b}) 0%`));
  assert.ok(dark.endsWith(`rgb(${DARK_POSITIVE[2].r},${DARK_POSITIVE[2].g},${DARK_POSITIVE[2].b}) 100%)`));
  const light = heatmapLegendGradientCss(false);
  assert.ok(light.startsWith('linear-gradient(90deg, rgb(44,72,117) 0%'));
  assert.ok(light.includes('rgb(255,246,237) 50%'));
  assert.ok(light.endsWith('rgb(255,133,49) 100%)'));
});
