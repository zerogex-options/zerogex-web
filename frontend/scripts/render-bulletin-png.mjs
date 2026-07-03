#!/usr/bin/env node
// Playwright-based screenshot of the Live Bulletin card.
//
// Invoked by the OA host's ``bulletin_tweet`` cron via a subprocess call:
//   node scripts/render-bulletin-png.mjs \
//     --symbol SPX --mode close --date 2026-07-03 \
//     --site-url https://zerogex.io \
//     --token $BULLETIN_SNAPSHOT_TOKEN \
//     --out /tmp/bulletin-spx.png
//
// Screenshots the SAME ``<GammaReportCard>`` component the paid /live-
// bulletin page renders — no parallel implementation, no drift.  The page
// at /live-bulletin/snapshot/[symbol] stamps ``data-bulletin-ready="true"``
// on its wrapper once the underlying data has resolved; we wait for that
// signal then capture the ``[data-bulletin-card]`` element as a PNG.
//
// Fails fast + non-zero when Playwright isn't installed (exit code 2) so
// the Python caller can differentiate a real render failure from a missing-
// helper situation and degrade to text-only.

import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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

function log(msg) {
  process.stderr.write(`render-bulletin-png: ${msg}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbol = String(args.symbol || '').toUpperCase();
  const mode = String(args.mode || 'midday');
  const dateStr = args.date ? String(args.date) : null;
  const siteUrl = String(args['site-url'] || 'https://zerogex.io').replace(/\/+$/, '');
  const token = args.token ? String(args.token) : null;
  const out = String(args.out || '');

  if (!symbol || !out) {
    fail('required flags: --symbol --out');
  }
  if (!['premarket', 'midday', 'close'].includes(mode)) {
    fail(`invalid --mode '${mode}' (want premarket|midday|close)`);
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (err) {
    fail(`playwright not installed on this host (${err?.message || err})`, 2);
  }

  mkdirSync(dirname(out), { recursive: true });

  const url = new URL(`${siteUrl}/live-bulletin/snapshot/${symbol}`);
  // ``mode`` is cosmetic on the card itself — the GammaReportCard doesn't
  // care about premarket/midday/close — but we still pass it through so the
  // URL is inspectable in logs and so a future card variant can key off it.
  url.searchParams.set('horizon', 'daily');
  if (dateStr) url.searchParams.set('date', dateStr);
  if (token) url.searchParams.set('token', token);

  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    undefined;

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  // The card is ~640 wide by design; wrap it in a viewport that gives the
  // watermark's tiled -30% inset room to breathe without adding to the
  // final PNG (we clip to the card element, not the viewport).
  const context = await browser.newContext({
    viewport: { width: 900, height: 1400 },
    deviceScaleFactor: 2,
    // The paid page defaults to the operator's saved theme; the snapshot
    // page inherits from the same CSS var pipeline, so no override needed.
  });
  const page = await context.newPage();
  log(`navigating to ${url.href}`);
  try {
    await page.goto(url.href, { waitUntil: 'networkidle', timeout: 45_000 });

    // Wait for the snapshot's ready signal — the SnapshotClient sets this
    // once GEX summary, spot, session close and the logo raster have all
    // resolved. Prefer the DOM attribute (survives race with hooks) but
    // fall back to the window flag if the attribute selector times out.
    try {
      await page.waitForSelector('[data-bulletin-ready="true"]', { timeout: 30_000 });
    } catch {
      await page.waitForFunction(() => window.__zerogexBulletinReady === true, {
        timeout: 15_000,
      });
    }

    // Small paint settle so any late layout shift (last hook re-render, font
    // metric adjustment) lands before we screenshot.
    await page.waitForTimeout(400);

    const card = page.locator('[data-bulletin-card="true"]').first();
    if (!(await card.count())) {
      fail('bulletin card element not found in snapshot page', 3);
    }
    await card.screenshot({ path: out, type: 'png', omitBackground: false });
  } finally {
    await context.close();
    await browser.close();
  }

  if (!existsSync(out)) {
    fail('screenshot did not produce a file', 4);
  }
  log(`wrote ${out}`);
}

main().catch((err) => {
  fail(err?.stack || String(err));
});
