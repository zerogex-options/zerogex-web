import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The gamma chart's level overlays must stay tellable apart in every theme.
//
// GammaTerminalChart draws up to nine reference lines at once — FLIP, the two
// walls, MAX PAIN, GEX KING, PIN, VWAP and the expected-range pair — each as a
// dashed rule plus a colour-filled price tag on the right axis. Colour is the
// only thing identifying which is which, so two levels that land on the same
// colour silently merge into one.
//
// That has gone wrong twice. Wall Street pointed --color-warning at its hot red,
// a shade off the --color-bear the put line already used. And eight palettes had
// --color-hazy (VWAP) and --color-info (expected range) set to the same value,
// so those two overlays rendered identically.
//
// Exact-equality checks would have caught neither: the Wall Street pair differed
// by two hex digits. These tests measure perceptual distance (CIEDE2000) instead.

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

// ── the cascade ──────────────────────────────────────────────────────────────
// :root.dark and :root.palette-* have EQUAL specificity (0,2,0) and the palette
// blocks come later in the file, so a palette's light block also wins in dark
// mode unless its own .dark block redeclares the token. resolve() models that.
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

function resolve(palette: string, dark: boolean): Record<string, string> {
  const applicable = blocks.filter((b) =>
    (b.sel.match(/\.[a-z0-9-]+/g) ?? []).map((s) => s.slice(1))
      .every((c) => (c === 'dark' ? dark : c === palette)));
  applicable.sort((a, b) =>
    (a.sel.match(/\./g) ?? []).length - (b.sel.match(/\./g) ?? []).length || a.idx - b.idx);
  const raw: Record<string, string> = {};
  for (const b of applicable) Object.assign(raw, b.vars);
  const deref = (v: string, depth = 0): string => {
    const m = v?.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
    return m && depth < 12 ? deref(raw[m[1]], depth + 1) : v;
  };
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, deref(v)]));
}

// ── CIEDE2000 ────────────────────────────────────────────────────────────────
const parse = (c: string): [number, number, number] | null => {
  const h = c?.trim().match(/^#([0-9a-f]{6})$/i);
  if (!h) return null;
  const n = parseInt(h[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function lab([r, g, b]: [number, number, number]) {
  const f = (x: number) => (x /= 255, x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [f(r), f(g), f(b)];
  const k = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = k((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const Y = k(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const Z = k((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
function deltaE(c1: [number, number, number], c2: [number, number, number]) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
  const avgL = (L1 + L2) / 2, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2), avgCp = (C1p + C2p) / 2;
  const deg = (r: number) => ((r * 180) / Math.PI + 360) % 360;
  const h1p = deg(Math.atan2(b1, a1p)), h2p = deg(Math.atan2(b2, a2p));
  const avghp = C1p * C2p === 0 ? h1p + h2p
    : Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2
    : (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos(((avghp - 30) * Math.PI) / 180) + 0.24 * Math.cos((2 * avghp * Math.PI) / 180)
    + 0.32 * Math.cos(((3 * avghp + 6) * Math.PI) / 180) - 0.2 * Math.cos(((4 * avghp - 63) * Math.PI) / 180);
  const dhp = C1p * C2p === 0 ? 0
    : Math.abs(h2p - h1p) <= 180 ? h2p - h1p
    : h2p - h1p + (h2p <= h1p ? 360 : -360);
  const dLp = L2 - L1, dCp = C2p - C1p, dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);
  const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const SC = 1 + 0.045 * avgCp, SH = 1 + 0.015 * avgCp * T;
  const RT = -2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7))
    * Math.sin((60 * Math.exp(-(((avghp - 275) / 25) ** 2)) * Math.PI) / 180);
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

// The overlay set from GammaTerminalChart's levelDefs, in the same order.
const LEVELS: [string, string][] = [
  ['FLIP', '--color-flip'], ['CALL WALL', '--color-bear'], ['PUT WALL', '--color-bull'],
  ['MAX PAIN', '--color-maxpain'], ['GEX KING', '--color-king'], ['PIN', '--color-pin'],
  ['VWAP', '--color-hazy'], ['ER HIGH/LOW', '--color-info'],
];
// Under ~12 two thin dashed lines stop reading as different colours. The closest
// live pair is palm-springs dark (PUT WALL vs ER, 12.2) — both palette-identity
// tokens used app-wide, so they are left as they are.
const MIN_DELTA_E = 12;

test('every gamma level overlay is distinguishable from the others, in every theme', () => {
  const clashes: string[] = [];
  for (const p of PALETTES) {
    for (const dark of [false, true]) {
      const pal = resolve(p, dark);
      const rgb = LEVELS.map(([name, tok]) => {
        const c = parse(pal[tok]);
        if (!c) throw new Error(`${p}/${dark ? 'dark' : 'light'}: ${tok} (${name}) `
          + `should resolve to a hex colour, got ${pal[tok]}`);
        return c;
      });
      for (let i = 0; i < LEVELS.length; i++) {
        for (let j = i + 1; j < LEVELS.length; j++) {
          const d = deltaE(rgb[i], rgb[j]);
          if (d < MIN_DELTA_E) {
            clashes.push(`${p}/${dark ? 'dark' : 'light'}: ${LEVELS[i][0]} ${pal[LEVELS[i][1]]} vs `
              + `${LEVELS[j][0]} ${pal[LEVELS[j][1]]} — ΔE ${d.toFixed(1)}`);
          }
        }
      }
    }
  }
  assert.deepEqual(clashes, [], `level overlays collide:\n  ${clashes.join('\n  ')}`);
});

test('VWAP and the expected range never share a colour', () => {
  // The specific regression: eight palettes had these two set to the same value.
  for (const p of PALETTES) {
    for (const dark of [false, true]) {
      const pal = resolve(p, dark);
      assert.notEqual(pal['--color-hazy'], pal['--color-info'],
        `${p}/${dark ? 'dark' : 'light'} draws VWAP and the expected range in one colour`);
    }
  }
});

test('a palette that pins a level marker pins it in both modes', () => {
  // The trap this guards: :root.palette-X outranks :root.dark by source order,
  // so a marker declared only in the light block silently leaks into dark mode.
  const own = (sel: string) => blocks.find((b) => b.sel === sel)?.vars ?? {};
  for (const p of PALETTES) {
    const light = own(`:root.${p}`), dark = own(`:root.${p}.dark`);
    for (const tok of ['--color-flip', '--color-pin', '--color-maxpain']) {
      if (tok in light || tok in dark) {
        assert.ok(tok in light, `${p} sets ${tok} for dark mode but not light`);
        assert.ok(tok in dark, `${p} sets ${tok} for light mode but not dark — `
          + 'it would win in dark mode too');
      }
    }
  }
});
