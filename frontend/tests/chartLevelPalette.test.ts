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
const blend = (fg: string, bg: string): [number, number, number] | null => {
  const m = fg?.trim().match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*[,/]\s*([\d.]+)\s*\)$/i);
  const under = m ? parse(bg) : null;
  if (!m || !under) return null;
  const a = Number(m[4]);
  return [1, 2, 3].map((i) => Number(m[i]) * a + under[i - 1] * (1 - a)) as [number, number, number];
};

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

// ── price-tag ink ────────────────────────────────────────────────────────────
// The tag's price is drawn on the level's own colour, so its contrast is against
// that chip, not the page. useChipInk picks black or white by the chip's
// luminance; that pair is optimal, guaranteeing at least 4.58:1 for any colour.
// Softening either ink breaks the guarantee (#0B0E12/#FFFFFF already drops two
// of this app's chips below 4.5:1), which is what this pins down.
const hook = readFileSync(new URL('../hooks/useChartTheme.ts', import.meta.url), 'utf8');
const inkConst = (name: string) => {
  const m = hook.match(new RegExp(`const ${name} = '(#[0-9A-Fa-f]{3,6})'`));
  assert.ok(m, `${name} should be a hex literal in useChartTheme.ts`);
  return m[1];
};

function contrast(a: [number, number, number], b: [number, number, number]) {
  const lum = ([r, g, bl]: [number, number, number]) => {
    const f = (v: number) => ((v /= 255), v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Every colour GammaTerminalChart passes to PriceTag as `bg`.
const CHIPS = [...LEVELS.map(([, tok]) => tok), '--color-accent-hot', '--text-secondary'];

test('the price on a tag is readable against every chip, in every theme', () => {
  const dark = parse(inkConst('INK_DARK'));
  const light = parse(inkConst('INK_LIGHT'));
  assert.ok(dark && light, 'both inks should parse');
  const unreadable: string[] = [];
  for (const p of PALETTES) {
    for (const isDark of [false, true]) {
      const pal = resolve(p, isDark);
      for (const tok of CHIPS) {
        // --text-secondary is translucent, so judge the blend over the card.
        const chip = parse(pal[tok]) ?? blend(pal[tok], pal['--bg-card']);
        assert.ok(chip, `${p}/${isDark ? 'dark' : 'light'} ${tok} should resolve to a colour`);
        const best = Math.max(contrast(dark, chip), contrast(light, chip));
        if (best < 4.5) {
          unreadable.push(`${p}/${isDark ? 'dark' : 'light'} ${tok} ${pal[tok]} — best ${best.toFixed(2)}:1`);
        }
      }
    }
  }
  assert.deepEqual(unreadable, [], `tag text falls below 4.5:1:\n  ${unreadable.join('\n  ')}`);
});

test('the ink pivot matches the luminance where black and white are equally readable', () => {
  // (Y + 0.05)^2 = 1.05 * 0.05  →  Y = sqrt(0.0525) - 0.05
  const m = hook.match(/const INK_PIVOT = ([\d.]+)/);
  assert.ok(m, 'INK_PIVOT should be a numeric literal in useChartTheme.ts');
  assert.ok(Math.abs(Number(m[1]) - (Math.sqrt(0.0525) - 0.05)) < 0.0005,
    `INK_PIVOT ${m[1]} should be ${(Math.sqrt(0.0525) - 0.05).toFixed(4)}`);
});

// ── the live-price tag ───────────────────────────────────────────────────────
// The last-traded price gets a tag in the same axis column as the levels, filled
// with --color-accent-hot, and its line and dot use that token too. So the hot
// accent is a tenth member of this set, not something separate -- Wall Street had
// it at #C7213D against a #E7213D call wall, two reds in one column, and eleven
// other palettes had the same shape because they tune the accent warm and their
// call wall is red.
//
// This one is worth guarding hard: darkening MAX PAIN for the light cards once
// pushed it onto the muted-gold hot accent of london, california and zurich, and
// nothing caught it, because the hot accent was not part of the set being checked.
test('the live-price tag is distinguishable from the levels beside it', () => {
  const clashes: string[] = [];
  for (const p of PALETTES) {
    for (const isDark of [false, true]) {
      const pal = resolve(p, isDark);
      const hot = parse(pal['--color-accent-hot']);
      assert.ok(hot, `${p} --color-accent-hot should resolve to a hex colour`);
      for (const [name, tok] of LEVELS) {
        const other = parse(pal[tok]);
        assert.ok(other, `${p} ${tok} should resolve to a hex colour`);
        const d = deltaE(hot, other);
        if (d < MIN_DELTA_E) {
          clashes.push(`${p.replace('palette-', '')}/${isDark ? 'dark' : 'light'}: `
            + `LAST ${pal['--color-accent-hot']} vs ${name} ${pal[tok]} — ΔE ${d.toFixed(1)}`);
        }
      }
    }
  }
  assert.deepEqual(clashes, [], `live-price collisions:\n  ${clashes.join('\n  ')}`);
});

test('Wall Street keeps the live price off its call wall', () => {
  // The reported bug: two near-identical reds stacked in the axis column.
  for (const isDark of [false, true]) {
    const pal = resolve('palette-wallstreet', isDark);
    const hot = parse(pal['--color-accent-hot']);
    const bear = parse(pal['--color-bear']);
    assert.ok(hot && bear);
    const d = deltaE(hot, bear);
    assert.ok(d >= MIN_DELTA_E,
      `wallstreet/${isDark ? 'dark' : 'light'}: live price ${pal['--color-accent-hot']} `
      + `vs call wall ${pal['--color-bear']} is only ΔE ${d.toFixed(1)}`);
  }
});

// ── the pair view's two charts ───────────────────────────────────────────────
// PairCandleChart and PairGammaHeatmap sit side by side and label the same five
// levels with the same two-letter codes, so SP/GF/CW/PW/MP has to mean the same
// colour in both. They had drifted: the candle chart still drew the flip from
// --color-warning and max pain from --color-accent-hot, which predate the
// dedicated --color-flip and --color-maxpain tokens. In the three palettes whose
// hot accent IS their old gold that put GF and MP on the same hex.
const readLevels = (rel: string, re: RegExp) => {
  const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
  const out: Record<string, string> = {};
  for (const m of src.matchAll(re)) out[m[1]] = m[2];
  return out;
};
const candleLevels = readLevels('../components/PairCandleChart.tsx',
  /\{\s*key:\s*"(\w+)",\s*code:\s*"\w+",\s*color:\s*"var\((--[a-z0-9-]+)\)"\s*\}/g);
const heatmapLevels = readLevels('../components/PairGammaHeatmap.tsx',
  /^\s{2}(\w+):\s*\{[^}]*?color:\s*"var\((--[a-z0-9-]+)\)"[^}]*?\}/gm);

test('the two pair charts give a level the same colour', () => {
  assert.equal(Object.keys(candleLevels).length, 5, 'PairCandleChart should define five levels');
  assert.deepEqual(candleLevels, heatmapLevels,
    'PairCandleChart and PairGammaHeatmap must map each level to the same token');
});

test('the pair-view levels are distinguishable from each other, in every theme', () => {
  const clashes: string[] = [];
  for (const p of PALETTES) {
    for (const isDark of [false, true]) {
      const pal = resolve(p, isDark);
      const entries = Object.entries(candleLevels);
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = parse(pal[entries[i][1]]);
          const b = parse(pal[entries[j][1]]);
          assert.ok(a && b, `${p}: ${entries[i][1]} / ${entries[j][1]} should resolve`);
          const d = deltaE(a, b);
          if (d < MIN_DELTA_E) {
            clashes.push(`${p.replace('palette-', '')}/${isDark ? 'dark' : 'light'}: `
              + `${entries[i][0]} ${pal[entries[i][1]]} vs ${entries[j][0]} ${pal[entries[j][1]]} — ΔE ${d.toFixed(1)}`);
          }
        }
      }
    }
  }
  assert.deepEqual(clashes, [], `pair-view level collisions:\n  ${clashes.join('\n  ')}`);
});

// ── pair-view level tags ─────────────────────────────────────────────────────
// Both pair charts label a level with a small glyph on a faint wash of that
// level's colour. Painting that glyph IN the level colour is what fails: at 9px
// and 8px it cleared 4.5:1 in well under half the palette/level combinations and
// bottomed out near 1.9:1, so the price on the candle chart's tag and the code
// on the heatmap's rail tag were the parts you could not read. The glyph is
// --text-primary in both now; the wash and the border still carry the colour.
const candleSrc = readFileSync(new URL('../components/PairCandleChart.tsx', import.meta.url), 'utf8');
const heatmapSrc = readFileSync(new URL('../components/PairGammaHeatmap.tsx', import.meta.url), 'utf8');

test('pair-view level tags do not paint their text in the level colour', () => {
  const candleTag = candleSrc.slice(candleSrc.indexOf('{LEVEL_LINES.map('));
  const tagText = candleTag.slice(0, candleTag.indexOf('</text>'));
  assert.match(tagText, /fill="var\(--text-primary\)"/,
    "PairCandleChart's level tag should paint its value in --text-primary");
  assert.doesNotMatch(tagText, /fill=\{color\}/,
    "PairCandleChart's level tag text should not use the level colour");

  const railTag = heatmapSrc.slice(heatmapSrc.indexOf('function RailTag('));
  assert.match(railTag.slice(0, railTag.indexOf('</span>')), /color:\s*"var\(--text-primary\)"/,
    "PairGammaHeatmap's RailTag should paint its code in --text-primary");
});

test('pair-view level tag text clears AA on its tinted chip, in every theme', () => {
  // The chip is color-mix(in srgb, <level> N%, <card>); the candle tag uses 16%
  // and the heatmap's rail tag 18%, so 18% is the stronger wash to check.
  const unreadable: string[] = [];
  for (const p of PALETTES) {
    for (const isDark of [false, true]) {
      const pal = resolve(p, isDark);
      const card = parse(pal['--bg-card']);
      const ink = parse(pal['--text-primary']);
      assert.ok(card && ink, `${p} should define --bg-card and --text-primary`);
      for (const [, tok] of Object.entries(candleLevels)) {
        const lvl = parse(pal[tok]);
        assert.ok(lvl, `${p} ${tok} should resolve`);
        for (const mix of [0.16, 0.18]) {
          const chip = [0, 1, 2].map((i) => lvl[i] * mix + card[i] * (1 - mix)) as [number, number, number];
          const lum = ([r, g, b]: [number, number, number]) => {
            const f = (v: number) => ((v /= 255), v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const [x, y] = [lum(ink), lum(chip)];
          const cr = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
          if (cr < 4.5) {
            unreadable.push(`${p.replace('palette-', '')}/${isDark ? 'dark' : 'light'} ${tok} `
              + `at ${Math.round(mix * 100)}% — ${cr.toFixed(2)}:1`);
          }
        }
      }
    }
  }
  assert.deepEqual(unreadable, [], `tag text below 4.5:1:\n  ${unreadable.join('\n  ')}`);
});

// ── gamma-chart on-plot labels ───────────────────────────────────────────────
// The level name chips, the flip status chip and the rail bar labels all used
// to paint their text in the level's (or the bar's) own colour, at 9.5px and
// 8.5px, against --bg-card. That cleared 4.5:1 in 105 of 192 combinations for
// the level chips, 12 of 24 for the flip chip and 24 of 48 for the rail labels,
// worst 2.36:1. All three are --text-primary now; the chip borders and, for the
// rail, the bar the label is drawn against still carry the colour.
const terminalSrc = readFileSync(new URL('../components/GammaTerminalChart.tsx', import.meta.url), 'utf8');

const between = (src: string, from: string, to: string) => {
  const i = src.indexOf(from);
  assert.notEqual(i, -1, `expected to find ${from}`);
  const j = src.indexOf(to, i);
  assert.notEqual(j, -1, `expected ${to} after ${from}`);
  return src.slice(i, j);
};

test('the gamma chart does not paint on-plot label text in the mark colour', () => {
  const nameChip = between(terminalSrc, '{chipPlacements.map(', '</text>');
  assert.match(nameChip, /fill="var\(--text-primary\)"/, 'level name chips should use --text-primary');
  assert.doesNotMatch(nameChip, /fill=\{c\.color\}/, 'level name chips should not paint text in the level colour');

  const flip = between(terminalSrc, '{flipChip && (', '</text>');
  assert.doesNotMatch(flip, /fill=\{flipChip\.color\}/, 'the flip chip should not paint text in the level colour');
  assert.match(flip, /fill=\{flipChip\.drawn \? "var\(--text-primary\)" : "var\(--text-muted\)"\}/,
    'the flip chip should be readable when drawn and stay muted when unresolved');

  const rail = between(terminalSrc, 'function RailBarLabel(', '</text>');
  assert.match(rail, /fill="var\(--text-primary\)"/, 'rail bar labels should use --text-primary');
  assert.doesNotMatch(rail, /\bcolor\b\s*:\s*string/, 'RailBarLabel should no longer take a colour prop');
});

test('--text-primary is readable on the chip and plot background, in every theme', () => {
  const weak: string[] = [];
  for (const p of PALETTES) {
    for (const isDark of [false, true]) {
      const pal = resolve(p, isDark);
      const ink = parse(pal['--text-primary']);
      for (const surface of ['--bg-card', '--bg-main']) {
        const bg = parse(pal[surface]);
        assert.ok(ink && bg, `${p} should define --text-primary and ${surface}`);
        const lum = ([r, g, b]: [number, number, number]) => {
          const f = (v: number) => ((v /= 255), v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const [x, y] = [lum(ink), lum(bg)];
        const cr = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        if (cr < 4.5) {
          weak.push(`${p.replace('palette-', '')}/${isDark ? 'dark' : 'light'} on ${surface} — ${cr.toFixed(2)}:1`);
        }
      }
    }
  }
  assert.deepEqual(weak, [], `on-plot label text below 4.5:1:\n  ${weak.join('\n  ')}`);
});
