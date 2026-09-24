#!/usr/bin/env node
// Playwright-based screenshot of the Live Bulletin card.
//
// Invoked by the OA host's ``bulletin_tweet`` job via a subprocess call:
//   node scripts/render-bulletin-png.mjs \
//     --symbol SPY --mode close \
//     --site-url http://127.0.0.1:3000 \
//     --token $BULLETIN_SNAPSHOT_TOKEN \
//     --out /tmp/bulletin-spy.png \
//     --meta-out /tmp/bulletin-spy.json
//
// ``--site-url`` is where the page is loaded from. The job points it at the
// Next server on the same box, not the public domain: that skips Cloudflare,
// which can challenge a headless browser, and the round trip out and back.
//
// Screenshots the SAME ``<GammaReportCard>`` component the paid /live-
// bulletin page renders — no parallel implementation, no drift.  The page
// at /live-bulletin/snapshot/[symbol] stamps ``data-bulletin-ready="true"``
// on its wrapper once the underlying data has resolved; we wait for that
// signal then capture the ``[data-bulletin-card]`` element as a PNG.
//
// We deliberately do NOT wait for the network to go quiet ("networkidle").
// Any page that holds a connection open or polls never goes quiet, and on the
// live site that wait timed out on every run. The page says itself when the
// card is complete, which is the only signal that matters.
//
// ``--meta-out`` receives the numbers the card drew (the wrapper's
// ``data-bulletin-levels``).  The X-post attaches this picture and quotes
// those numbers, so the two always agree.
//
// The card is attached to a public post, so a half-rendered one is a
// failure, not a fallback: if the ready signal never fires we exit non-zero
// and the job holds the post.  When the page loaded but the card didn't, a
// full-page picture of what the browser saw is saved next to ``--out`` as
// ``<name>.debug.png``.
//
// The snapshot token is a secret: it is scrubbed from everything this script
// prints, including Playwright's own error text.
//
// Exit codes (the Python caller turns each into a plain-English reason):
//   1 — anything unexpected (bad flags, ...)
//   2 — Playwright isn't installed next to this script
//   3 — the page loaded but had no bulletin card (wrong token or symbol)
//   4 — the screenshot produced no file
//   5 — the card never signaled ready (its data or logo didn't load)
//   6 — no Chromium could be launched
//   7 — the page couldn't be loaded (site down, an HTTP error, or blocked)

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const NAV_TIMEOUT_MS = 45_000;
const READY_TIMEOUT_MS = 30_000;
const FONTS_TIMEOUT_MS = 10_000;

// Every spelling of the token that could show up in a message: raw, and as it
// appears inside a URL.
let secrets = [];

function redact(text) {
  let out = String(text);
  for (const secret of secrets) {
    out = out.split(secret).join('***');
  }
  return out;
}

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
  process.stderr.write(`render-bulletin-png: ${redact(msg)}\n`);
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
  process.stderr.write(`render-bulletin-png: ${redact(msg)}\n`);
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

function isCloudflareChallenge(response, title) {
  const mitigated = response?.headers()['cf-mitigated'] === 'challenge';
  return mitigated || /just a moment|attention required/i.test(title || '');
}

// Why the card never signaled ready, in words the job can put in an email.
// The snapshot page publishes what it is still waiting on.
async function explainNotReady(page, response) {
  const title = await page.title().catch(() => '');
  const wrapper = page.locator('[data-bulletin-ready]').first();
  if (!(await wrapper.count().catch(() => 0))) {
    if (isCloudflareChallenge(response, title)) {
      return new RenderError(
        'Cloudflare showed its bot check instead of the page; load it from the local site (BULLETIN_TWEET_RENDER_URL)',
        7,
      );
    }
    const shown = title ? ` (page title: "${title.slice(0, 80)}")` : '';
    return new RenderError(`the page has no bulletin card${shown}; check the token and symbol`, 3);
  }
  const data = await wrapper.getAttribute('data-bulletin-data').catch(() => null);
  const logo = await wrapper.getAttribute('data-bulletin-logo').catch(() => null);
  const waiting = [];
  if (data === 'missing') waiting.push('the website could not get the GEX summary from the API');
  if (logo === 'failed') waiting.push('the logo image (/title-dark.png) failed to load; run `make logo` in zerogex-web');
  if (logo === 'loading') waiting.push('the logo image was still loading');
  const why = waiting.length ? waiting.join('; ') : 'its data or logo did not load';
  return new RenderError(`the card was not ready after ${READY_TIMEOUT_MS / 1000}s: ${why}`, 5);
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

  if (token) {
    const inUrl = new URLSearchParams({ token }).toString().slice('token='.length);
    secrets = [...new Set([token, encodeURIComponent(token), inUrl])].sort((a, b) => b.length - a.length);
  }

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

  let url;
  try {
    url = new URL(`${siteUrl}/live-bulletin/snapshot/${symbol}`);
  } catch {
    fail(`invalid --site-url '${siteUrl}'`);
  }
  // ``mode`` is cosmetic on the card itself — the GammaReportCard doesn't
  // care about premarket/midday/close — but we still pass it through so the
  // URL is inspectable in logs and so a future card variant can key off it.
  url.searchParams.set('horizon', 'daily');
  if (dateStr) url.searchParams.set('date', dateStr);
  if (token) url.searchParams.set('token', token);
  const shownUrl = redact(url.href);
  const debugOut = out.replace(/(\.png)?$/i, '.debug.png');

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
  // Only the site's own files. Third-party scripts (the X pixel, product
  // analytics) aren't part of the card, can stall a headless browser, and
  // would count this robot as a visitor in someone else's dashboard.
  await context.route('**/*', (route) => {
    const target = route.request().url();
    if (target.startsWith('data:') || target.startsWith('blob:')) return route.continue();
    let origin = null;
    try {
      origin = new URL(target).origin;
    } catch {
      /* unparseable: treat as foreign */
    }
    return origin === url.origin ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  log(`navigating to ${shownUrl}`);
  let levels = null;
  let loaded = false;
  try {
    let response;
    try {
      response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    } catch (err) {
      // "page.goto: net::ERR_CONNECTION_REFUSED at <url>" -> the error name.
      const reason = firstLine(err).replace(/^page\.goto:\s*/, '').replace(/ at https?:\/\/\S+$/, '');
      throw new RenderError(
        `could not open ${shownUrl} (${reason}); is the website running on this box? (pm2 status)`,
        7,
      );
    }
    loaded = true;
    const status = response?.status() ?? 0;
    if (status === 404) {
      throw new RenderError(
        'the page said "not found": the BULLETIN_SNAPSHOT_TOKEN here does not match the website\'s, or the symbol is unknown',
        3,
      );
    }
    if (status >= 400) {
      const title = await page.title().catch(() => '');
      if (isCloudflareChallenge(response, title)) {
        throw new RenderError(
          `Cloudflare blocked the headless browser (HTTP ${status}); load the page from the local site (BULLETIN_TWEET_RENDER_URL)`,
          7,
        );
      }
      throw new RenderError(`the page returned HTTP ${status}`, 7);
    }

    // The snapshot sets ``data-bulletin-ready="true"`` once its data and the
    // logo raster have both landed.  No ready signal means an incomplete card.
    try {
      await page.waitForSelector('[data-bulletin-ready="true"]', { timeout: READY_TIMEOUT_MS });
    } catch {
      throw await explainNotReady(page, response);
    }

    const rawLevels = await page.getAttribute('[data-bulletin-ready="true"]', 'data-bulletin-levels');
    try {
      levels = rawLevels ? JSON.parse(rawLevels) : null;
    } catch {
      levels = null;
    }

    // Web fonts arrive after the DOM; without this the card can be captured
    // in a fallback face. Bounded, so a font that never loads can't hang us.
    await page.evaluate(
      (ms) =>
        Promise.race([
          document.fonts.ready.then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), ms)),
        ]),
      FONTS_TIMEOUT_MS,
    );

    // Small paint settle so any late layout shift (last hook re-render, font
    // metric adjustment) lands before we screenshot.
    await page.waitForTimeout(400);

    const card = page.locator('[data-bulletin-card="true"]').first();
    if (!(await card.count())) {
      throw new RenderError('bulletin card element not found in snapshot page', 3);
    }
    await card.screenshot({ path: out, type: 'png', omitBackground: false });
  } catch (err) {
    if (loaded) {
      try {
        await page.screenshot({ path: debugOut, fullPage: true });
        log(`saved what the browser saw to ${debugOut}`);
      } catch {
        /* the error below is what matters */
      }
    }
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }

  if (!existsSync(out) || statSync(out).size === 0) {
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
