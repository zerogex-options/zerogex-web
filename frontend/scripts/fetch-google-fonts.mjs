// Downloads the self-hosted woff2 files for every font used by app/layout.tsx,
// so the production build never fetches from fonts.gstatic.com at build time
// (Turbopack's next/font/google fetches at build, and a flaky/rate-limited
// gstatic 404 fails the whole build). Run this whenever the font set or weights
// in app/layout.tsx change, then commit the updated app/fonts/** files.
//
//   node scripts/fetch-google-fonts.mjs
//
// Source of truth is Google Fonts' CSS2 API (the same files next/font/google
// would download), latin subset only, normal style only — matching the current
// layout.tsx config. Writes files to app/fonts/<slug>/ and a manifest to
// app/fonts/manifest.json describing the next/font/local `src` wiring per family.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '..', 'app', 'fonts');

// A modern desktop Chrome UA makes the CSS2 API return woff2 (not ttf).
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Mirrors app/layout.tsx exactly: family name, the CSS variable it exposes, the
// requested weights, and whether it's a serif (drives adjustFontFallback in
// layout.tsx — recorded here for reference). Keep in sync with layout.tsx.
const FONTS = [
  { slug: 'inter', family: 'Inter', variable: '--font-inter', weights: [400, 500, 600, 700], serif: false },
  { slug: 'jetbrains-mono', family: 'JetBrains Mono', variable: '--font-jetbrains-mono', weights: [400, 500, 700], serif: false },
  { slug: 'space-grotesk', family: 'Space Grotesk', variable: '--font-space-grotesk', weights: [400, 500, 600, 700], serif: false },
  { slug: 'libre-baskerville', family: 'Libre Baskerville', variable: '--font-libre-baskerville', weights: [400, 700], serif: true },
  { slug: 'playfair', family: 'Playfair Display', variable: '--font-playfair', weights: [400, 500, 600, 700, 800], serif: true },
  { slug: 'cormorant', family: 'Cormorant Garamond', variable: '--font-cormorant', weights: [300, 400, 500, 600, 700], serif: true },
  { slug: 'noto-sans', family: 'Noto Sans', variable: '--font-noto-sans', weights: [400, 500, 600, 700], serif: false },
  { slug: 'newsreader', family: 'Newsreader', variable: '--font-newsreader', weights: [400, 500, 600], serif: true },
  { slug: 'archivo', family: 'Archivo', variable: '--font-archivo', weights: [400, 500, 600, 700], serif: false },
  { slug: 'outfit', family: 'Outfit', variable: '--font-outfit', weights: [400, 500, 600, 700], serif: false },
  { slug: 'fraunces', family: 'Fraunces', variable: '--font-fraunces', weights: [400, 500, 600, 700], serif: true },
  { slug: 'chakra-petch', family: 'Chakra Petch', variable: '--font-chakra-petch', weights: [400, 500, 600, 700], serif: false },
  { slug: 'bagel-fat-one', family: 'Bagel Fat One', variable: '--font-bagel-fat-one', weights: [400], serif: false },
  { slug: 'rubik', family: 'Rubik', variable: '--font-rubik', weights: [400, 500, 700], serif: false },
  { slug: 'jost', family: 'Jost', variable: '--font-jost', weights: [400, 500, 600, 700], serif: false },
  { slug: 'spectral', family: 'Spectral', variable: '--font-spectral', weights: [400, 500, 600], serif: true },
  { slug: 'gloock', family: 'Gloock', variable: '--font-gloock', weights: [400], serif: true },
  { slug: 'hanken-grotesk', family: 'Hanken Grotesk', variable: '--font-hanken-grotesk', weights: [400, 500, 600, 700], serif: false },
];

async function fetchText(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return await res.text();
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error('unreachable');
}

async function fetchBinary(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error('unreachable');
}

// Pull the `/* latin */` @font-face blocks out of a CSS2 response, as
// [{ weight, url }] in requested order. Google emits one comment-labelled
// block per (subset, weight); we keep only latin, normal style.
function parseLatinFaces(css) {
  const faceRe = /\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  const out = [];
  let m;
  while ((m = faceRe.exec(css)) !== null) {
    const body = m[1];
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? '';
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1]?.trim() ?? '';
    if (url) out.push({ weight, url });
  }
  return out;
}

async function run() {
  await mkdir(FONTS_DIR, { recursive: true });
  const manifest = [];

  for (const font of FONTS) {
    const dir = path.join(FONTS_DIR, font.slug);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    const wght = font.weights.join(';');
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      font.family,
    )}:wght@${wght}&display=swap`;
    const css = await fetchText(cssUrl);
    const faces = parseLatinFaces(css);
    if (faces.length === 0) throw new Error(`No latin @font-face found for ${font.family}`);

    const uniqueUrls = [...new Set(faces.map((f) => f.url))];
    const src = [];

    if (uniqueUrls.length === 1) {
      // One file covers every requested weight → a variable font. Declare a
      // single src entry spanning the requested weight range.
      const url = uniqueUrls[0];
      const file = `${font.slug}-variable.woff2`;
      await writeFile(path.join(dir, file), await fetchBinary(url));
      const min = Math.min(...font.weights);
      const max = Math.max(...font.weights);
      src.push({ path: `./fonts/${font.slug}/${file}`, weight: min === max ? `${min}` : `${min} ${max}`, style: 'normal' });
    } else {
      // Distinct file per weight → a static family. One src entry per weight,
      // mapped to that weight's latin file.
      for (const weight of font.weights) {
        const face = faces.find((f) => f.weight === String(weight));
        if (!face) throw new Error(`No latin file for ${font.family} weight ${weight}`);
        const file = `${font.slug}-${weight}.woff2`;
        await writeFile(path.join(dir, file), await fetchBinary(face.url));
        src.push({ path: `./fonts/${font.slug}/${file}`, weight: `${weight}`, style: 'normal' });
      }
    }

    manifest.push({
      slug: font.slug,
      family: font.family,
      variable: font.variable,
      serif: font.serif,
      kind: uniqueUrls.length === 1 ? 'variable' : 'static',
      src,
    });
    console.log(`✓ ${font.family.padEnd(20)} ${uniqueUrls.length === 1 ? 'variable' : 'static '} → ${src.length} file(s)`);
  }

  await writeFile(path.join(FONTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${manifest.length} families to app/fonts/ + manifest.json`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
