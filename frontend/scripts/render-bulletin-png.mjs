#!/usr/bin/env node
// Playwright-based screenshot of the Live Bulletin card.
//
// Invoked by the OA host's ``bulletin_tweet`` job via a subprocess call:
//   node scripts/render-bulletin-png.mjs \
//     --symbol SPY --mode close \
//     --site-url https://zerogex.io \
//     --token $BULLETIN_SNAPSHOT_TOKEN \
//     --out /tmp/bulletin-spy.png \
//     --meta-out /tmp/bulletin-spy.json
//
// Screenshots the SAME ``<GammaReportCard>`` component the paid /live-
// bulletin page renders — no parallel implementation, no drift.  The page
// at /live-bulletin/snapshot/[symbol] stamps ``data-bulletin-ready="true"``
// on its wrapper once the underlying data has resolved; we wait for that
// signal then capture the ``[data-bulletin-card]`` element as a PNG.
//
// ``--meta-out`` receives the numbers the card drew (the wrapper's
// ``data-bulletin-levels``).  The X-post attaches this picture and quotes
// those numbers, so the two always agree.
//
// The card is attached to a public post, so a half-rendered one is a
// failure, not a fallback: if the ready signal never fires we exit non-zero
// and the job holds the post.
//
// Exit codes (the Python caller turns each into a plain-English reason):
//   1 — anything unexpected (bad flags, navigation error, ...)
//   2 — Playwright isn't installed next to this script
//   3 — the page loaded but had no bulletin card (wrong token or symbol)
//   4 — the screenshot produced no file
//   5 — the card never signaled ready (its data or logo didn't load)
//   6 — no Chromium could be launched

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const READY_TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const val = argv[i + 1];
    if (val == null || val.startsWith('--')) {
      out[name] = true;
    } else {
      out[name] = val;
      i += 1;
    }
  }
  return out;
}

function fail(msg, code = 1) {
  process.stderr.write(`render-bulletin-png: ${msg}\n`);
  process.exit(code);
}

// Thrown inside the browser session so the ``finally`` still closes Chromium
// before we exit with the code.
class RenderError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function log(msg) {
  process.stderr.write(`render-bulletin-png: ${msg}\n`);
}

function firstLine(err) {
  return String(err?.message || err).split('\n')[0];
}

// playwright-core is a declared dependency, so every `npm ci` installs it.
// The full `playwright` package is accepted too, for boxes that still carry
// the old hand-installed copy.
async function loadPlaywright() {
  for (const name of ['playwright-core', 'playwright']) {
    try {
      return await import(name);
    } catch {
      /* try the next one */
    }
  }
  return null;
}

// The newest Chromium already downloaded under the browsers directory. Used
// only when the build this playwright-core version expects is missing, so a
// version bump doesn't hold the post until someone re-runs the browser install.
function findInstalledChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache', 'ms-playwright')];
  const found = [];
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    let names = [];
    try {
      names = readdirSync(root);
    } catch {
      continue;
    }
    for (const name of names) {
      const m = /^chromium-(\d+)$/.exec(name);
      if (!m) continue;
      for (const sub of ['chrome-linux64', 'chrome-linux']) {
        const bin = join(root, name, sub, 'chrome');
        if (existsSync(bin)) found.push({ rev: Number(m[1]), bin });
      }
    }
  }
  found.sort((a, b) => b.rev - a.rev);
  return found.length ? found[0].bin : null;
}

async function launchChromium(chromium) {
  const options = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const explicit =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROMIUM_EXECUTABLE_PATH || '';
  if (explicit) {
    return chromium.launch({ ...options, executablePath: explicit });
  }
  try {
    return await chromium.launch(options);
  } catch (err) {
    const fallback = findInstalledChromium();
    if (!fallback) throw err;
    log(`expected Chromium build unavailable (${firstLine(err)}); using ${fallback}`);
    return chromium.launch({ ...options, executablePath: fallback });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbol = String(args.symbol || '').toUpperCase();
  const mode = String(args.mode || 'midday');
  const dateStr = args.date ? String(args.date) : null;
  const siteUrl = String(args['site-url'] || 'https://zerogex.io').replace(/\/+$/, '');
  const token = args.token ? String(args.token) : null;
  const out = String(args.out || '');
  const metaOut = args['meta-out'] ? String(args['meta-out']) : null;

  if (!symbol || !out) {
    fail('required flags: --symbol --out');
  }
  if (!['premarket', 'midday', 'close'].includes(mode)) {
    fail(`invalid --mode '${mode}' (want premarket|midday|close)`);
  }

  const playwright = await loadPlaywright();
  if (!playwright) {
    fail('playwright-core is not installed next to this script (run npm ci in zerogex-web/frontend)', 2);
  }

  mkdirSync(dirname(out), { recursive: true });
  if (metaOut) mkdirSync(dirname(metaOut), { recursive: true });

  const url = new URL(`${siteUrl}/live-bulletin/snapshot/${symbol}`);
  // ``mode`` is cosmetic on the card itself — the GammaReportCard doesn't
  // care about premarket/midday/close — but we still pass it through so the
  // URL is inspectable in logs and so a future card variant can key off it.
  url.searchParams.set('horizon', 'daily');
  if (dateStr) url.searchParams.set('date', dateStr);
  if (token) url.searchParams.set('token', token);
  // Never write the snapshot token to the logs.
  const shownUrl = token ? url.href.replace(encodeURIComponent(token), '***') : url.href;

  let browser;
  try {
    browser = await launchChromium(playwright.chromium);
  } catch (err) {
    fail(`could not launch Chromium (${firstLine(err)})`, 6);
  }
  // The card is ~640 wide by design; wrap it in a viewport that gives the
  // watermark's tiled -30% inset room to breathe without adding to the
  // final PNG (we clip to the card element, not the viewport).
  const context = await browser.newContext({
    viewport: { width: 900, height: 1400 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  log(`navigating to ${shownUrl}`);
  let levels = null;
  try {
    await page.goto(url.href, { waitUntil: 'networkidle', timeout: 45_000 });

    // The snapshot sets ``data-bulletin-ready="true"`` once its data and the
    // logo raster have both landed.  No ready signal means an incomplete card.
    try {
      await page.waitForSelector('[data-bulletin-ready="true"]', { timeout: READY_TIMEOUT_MS });
    } catch {
      const hasCard = (await page.locator('[data-bulletin-card="true"]').count()) > 0;
      if (!hasCard) {
        throw new RenderError('bulletin card element not found in snapshot page (check the token and symbol)', 3);
      }
      throw new RenderError(
        `the card never signaled ready within ${READY_TIMEOUT_MS / 1000}s (its data or logo did not load)`,
        5,
      );
    }

    const rawLevels = await page.getAttribute('[data-bulletin-ready="true"]', 'data-bulletin-levels');
    try {
      levels = rawLevels ? JSON.parse(rawLevels) : null;
    } catch {
      levels = null;
    }

    // Small paint settle so any late layout shift (last hook re-render, font
    // metric adjustment) lands before we screenshot.
    await page.waitForTimeout(400);

    const card = page.locator('[data-bulletin-card="true"]').first();
    if (!(await card.count())) {
      throw new RenderError('bulletin card element not found in snapshot page', 3);
    }
    await card.screenshot({ path: out, type: 'png', omitBackground: false });
  } finally {
    await context.close();
    await browser.close();
  }

  if (!existsSync(out)) {
    fail('screenshot did not produce a file', 4);
  }
  if (metaOut) {
    writeFileSync(
      metaOut,
      `${JSON.stringify(
        { ready: true, symbol, levels, page: shownUrl, rendered_at: new Date().toISOString() },
        null,
        2,
      )}\n`,
    );
  }
  log(`wrote ${out}`);
}

main().catch((err) => {
  if (err instanceof RenderError) fail(err.message, err.code);
  fail(err?.stack || String(err));
});
