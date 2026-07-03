#!/usr/bin/env node
// Playwright-based recorder for the day's Replay scrubber.
//
// Invoked by the OA host's ``bulletin_tweet`` cron via a subprocess call:
//   node scripts/render-replay-clip.mjs \
//     --symbol SPX --date 2026-07-03 \
//     --site-url https://zerogex.io --out /tmp/replay.mp4
//
// The tweet job attaches this MP4 to the X post so followers see the day's
// dealer-gamma surface animated across the session, not just the closing
// snapshot. If Playwright / Chromium isn't installed on the host, this
// script exits non-zero and the tweet job silently falls back to
// PNG-plus-text; the video attachment is best-effort by design.
//
// Playwright is imported dynamically so a missing `playwright` package
// yields a graceful failure the caller can differentiate from a real
// render error (see the top-level try/catch).
//
// Duration: ~12 seconds at 4x speed = one full session sweep, which
// stays inside X's video limits (up to 140 s but shorter clips
// autoplay). We use Playwright's built-in ``recordVideo`` context
// option, which produces a WebM. We then transcode to MP4 with the
// bundled ffmpeg if available; if not, the WebM is renamed to .mp4
// as a last-ditch fallback (X historically accepts WebM as MP4 for
// short clips but this path is quality-degraded — the tweet job logs
// that so operators can install ffmpeg to fix).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

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
  process.stderr.write(`render-replay-clip: ${msg}\n`);
  process.exit(code);
}

function log(msg) {
  process.stderr.write(`render-replay-clip: ${msg}\n`);
}

async function findVideoFile(dir) {
  const entries = await readdir(dir).catch(() => []);
  for (const entry of entries) {
    if (entry.endsWith('.webm')) return join(dir, entry);
  }
  return null;
}

async function tryTranscodeToMp4(webmPath, mp4Path) {
  // Playwright's context.recordVideo() produces WebM (VP8). X's uploader
  // is happier with H.264/AAC MP4, so we transcode if ffmpeg is on PATH.
  // Failures fall back to a rename (which X often still accepts for
  // short clips, but produces a warning banner).
  const ffprobe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (ffprobe.status !== 0) {
    log('ffmpeg not found on PATH — renaming .webm to .mp4 as fallback');
    renameSync(webmPath, mp4Path);
    return;
  }
  const ff = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i', webmPath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',   // Twitter requires 4:2:0
      '-crf', '23',
      '-preset', 'veryfast',
      '-movflags', '+faststart', // enable streaming start
      '-an',                     // no audio
      mp4Path,
    ],
    { stdio: 'inherit' },
  );
  if (ff.status !== 0) {
    log('ffmpeg transcode failed — falling back to WebM rename');
    renameSync(webmPath, mp4Path);
    return;
  }
  rmSync(webmPath, { force: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbol = String(args.symbol || '').toUpperCase();
  const date = String(args.date || '');
  const siteUrl = String(args['site-url'] || 'https://zerogex.io').replace(/\/+$/, '');
  const out = String(args.out || '');
  if (!symbol || !date || !out) {
    fail('required flags: --symbol --date --out');
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (err) {
    fail(`playwright not installed on this host (${err?.message || err})`, 2);
  }

  const outDir = dirname(out);
  mkdirSync(outDir, { recursive: true });

  // Playwright writes videos into a caller-chosen directory; we stage in
  // a tmp folder so we can find the .webm and rename it to the caller's
  // requested MP4 filename at the end.
  const stageDir = join(tmpdir(), `zerogex-replay-${symbol}-${date}-${Date.now()}`);
  mkdirSync(stageDir, { recursive: true });

  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    undefined;

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: stageDir,
      size: { width: 1280, height: 800 },
    },
  });
  const page = await context.newPage();
  const url = `${siteUrl}/replay/${symbol}/${date}?autoplay=1`;
  log(`navigating to ${url}`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Wait for the scrubber to mount. It's the only element on the page
    // that renders an SVG.play button + the "Play" label — a text-based
    // selector is stable across cosmetic refactors.
    await page.waitForSelector('text=/replay|play/i', { timeout: 20_000 }).catch(() => {});

    // Kick off autoplay by pressing the play button. Also poke keyboard
    // Space as a fallback because the ReplayScrubber toggles play on
    // the button click and some UIs also on keydown.
    const playBtn = page.locator('button', { hasText: /play/i }).first();
    if (await playBtn.count()) {
      await playBtn.click().catch(() => {});
    }
    await page.keyboard.press('Space').catch(() => {});

    // Cap the recording at ~12 s — one 4x sweep of the session.
    await page.waitForTimeout(12_000);
  } finally {
    await context.close(); // required so the video file is flushed
    await browser.close();
  }

  const webm = await findVideoFile(stageDir);
  if (!webm || !existsSync(webm)) {
    fail('playwright produced no video output', 3);
  }
  const sz = await stat(webm).then((s) => s.size).catch(() => 0);
  if (sz < 1024) {
    fail(`video too small (${sz} bytes) — recording likely failed`, 4);
  }

  await tryTranscodeToMp4(webm, out);
  rmSync(stageDir, { recursive: true, force: true });
  log(`wrote ${out}`);
}

main().catch((err) => {
  fail(err?.stack || String(err));
});
