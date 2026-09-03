#!/usr/bin/env node
/**
 * og-image-manifest.js — give the social card a content-addressed URL.
 *
 * `/og-image.png` used to be the only URL the OG/Twitter tags ever pointed at,
 * and that URL never changed when the artwork did. Two caches sit in front of
 * it and neither is purged by `make deploy`:
 *
 *   1. Cloudflare. zerogex.io is proxied (see deploy/CLOUDFLARE_MTLS.md) and
 *      .png is on CF's default-cacheable extension list, so every edge PoP
 *      holds its own copy of whatever bytes it fetched first.
 *   2. X/LinkedIn/Facebook card caches, which re-scrape the page every few
 *      days and re-pin whatever the origin hands back at that moment.
 *
 * A scrape that lands on a warm PoP therefore re-pins the *old* artwork, which
 * is why a refreshed card can revert days after the new PNG shipped. Hashing
 * the bytes into the filename removes the ambiguity entirely: new artwork is a
 * new URL, so no cache anywhere can answer for it with something stale.
 *
 * This is the same trick Next already applies to app/favicon.ico (see the note
 * in frontend/app/layout.tsx) — the social card just never got it.
 *
 * The script also records the PNG's real pixel dimensions. The metadata used
 * to hard-code 1200x630 while the shipped asset was 1731x909; scrapers that
 * trust the declared size (LinkedIn in particular) lay the card out wrong when
 * those disagree.
 *
 * Writes:
 *   frontend/core/ogImageManifest.ts        (committed — derived from the
 *                                            tracked asset, so a plain
 *                                            `npm run build` needs no
 *                                            pre-step)
 *   frontend/public/og-image.<hash>.png     (gitignored, what the tags point at)
 *   frontend/public/og-image.png            (gitignored; kept so cards scraped
 *                                            before this change keep resolving)
 *
 * Dependency-free on purpose: `make logo` runs it on the deploy box, which is
 * the same constraint scripts/trim-png.js works under.
 *
 * Usage: node scripts/og-image-manifest.js [--check | --live]
 *
 *   --check  don't write anything; exit non-zero if the committed manifest is
 *            out of date with respect to assets/branding/og-image.png
 *
 *   --live   don't write anything; check that the *deployed* site serves the
 *            card this repo expects, and name the failure mode when it does
 *            not. Implies --check. ORIGIN=<url> overrides https://zerogex.io;
 *            PAGE=<path> checks the URL actually being posted (e.g. /?v=2).
 *
 * The --live mode exists because "the old og-image is showing on X" has four
 * distinct causes and only the first three are ours to fix:
 *
 *   1. the committed manifest is stale (someone replaced the artwork without
 *      re-running `make logo`);
 *   2. the box has not deployed since the artwork changed, so the tags still
 *      name the previous hash;
 *   3. it deployed but `make logo` did not run, so the hashed PNG 404s;
 *   4. everything is correct but the image is too heavy, so X scrapes the
 *      page, keeps the title and description, and silently drops the picture;
 *   5. everything is correct and X is simply serving its own cached card,
 *      which it keys on the *page* URL and holds for about a week.
 *
 * 4 and 5 are both invisible from the repo and look identical from the outside
 * -- a stale-looking card with nothing wrong on our side. They are told apart
 * by whether a *fresh* scrape (a URL X has not seen) renders the image: if it
 * comes back as a small card carrying the current title and description, the
 * page scrape worked and the image was refused, which is 4.
 *
 * 4 is not hypothetical. The 1731x909 1.7 MB export of this card was dropped
 * by X while every check here passed; the same artwork at 1200x630 / 379 KB
 * rendered. X's documented 5 MB cap is not the limit that actually binds.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(REPO_ROOT, 'assets/branding/og-image.png');
const MANIFEST = path.join(REPO_ROOT, 'frontend/core/ogImageManifest.ts');
const PUBLIC_DIR = path.join(REPO_ROOT, 'frontend/public');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Read width/height straight out of the IHDR chunk. It is required by the spec
 * to be the first chunk, so the offsets are fixed: 8-byte signature, 4-byte
 * length, 4-byte "IHDR" type, then the two big-endian uint32 dimensions.
 */
function readPngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${SOURCE} is not a PNG`);
  }
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`${SOURCE} does not start with an IHDR chunk`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function render({ hash, width, height }) {
  return `// GENERATED by scripts/og-image-manifest.js — do not edit by hand.
//
// Re-run \`make logo\` (or \`node scripts/og-image-manifest.js\`) after replacing
// assets/branding/og-image.png, and commit the result. The hash is what makes a
// new social card actually reach X/LinkedIn/Facebook instead of being answered
// from a Cloudflare edge or a scraper's card cache that still holds the old
// bytes — see the header comment in that script for the full story.

/** Content hash of assets/branding/og-image.png (first 8 hex of its sha256). */
export const OG_IMAGE_HASH = '${hash}';

/** Cache-busting path for the site-wide social card, relative to the site root. */
export const OG_IMAGE_PATH = '/og-image.${hash}.png';

/** The card's real pixel dimensions, read from the PNG's IHDR chunk. */
export const OG_IMAGE_WIDTH = ${width};
export const OG_IMAGE_HEIGHT = ${height};
`;
}

const DEFAULT_ORIGIN = 'https://zerogex.io';

// What X's card fetcher actually sends. Kept distinct from a browser UA below
// because telling the two apart is the whole point of the probe matrix.
const SCRAPER_UA = 'Twitterbot/1.0';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 15000;

async function get(url, accept, headers = {}) {
  return fetch(url, {
    headers: { 'user-agent': SCRAPER_UA, accept, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The natural way to use this is `make rebuild && make og-check`, and that
 * races: pm2 returns as soon as it has restarted the process, while Next is
 * still booting, so nginx has nothing to proxy to and answers 502 for a few
 * seconds. That is a cold start, not a broken deploy, so ride it out briefly
 * rather than reporting the site as down. A gateway error that outlasts this
 * is reported normally.
 */
async function getPage(url, attempts = 4) {
  for (let i = 1; ; i++) {
    const res = await get(url, 'text/html');
    if (res.ok || ![502, 503, 504].includes(res.status) || i === attempts) return res;
    console.log(`  · ${res.status} from the origin — the app is probably still booting, retrying (${i}/${attempts - 1})`);
    await sleep(3000);
  }
}

/**
 * Pull one meta tag's content out of raw HTML. Matches on `property=` or
 * `name=` because OG tags use the former and Twitter's use the latter, and
 * anchors the key so og:image does not also match og:image:width.
 */
function metaContent(html, key) {
  for (const [tag] of html.matchAll(/<meta[^>]*>/gi)) {
    if (!new RegExp(`\\b(?:property|name)\\s*=\\s*["']${key}["']`, 'i').test(tag)) continue;
    const m = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Summarize who answered. `cf-mitigated` appears when Cloudflare challenged or
 * blocked the request, and the absence of any CF header means the request
 * never reached the edge -- in which case this check says nothing about what a
 * scraper out on the internet gets.
 */
function edge(res) {
  const bits = [];
  for (const h of ['server', 'cf-ray', 'cf-cache-status', 'cf-mitigated']) {
    const v = res.headers.get(h);
    if (v) bits.push(`${h}=${v}`);
  }
  return bits.length ? bits.join('  ') : '(no CDN headers — did not traverse Cloudflare)';
}

function fail(lines) {
  console.error(`og-image-manifest: ${lines.join('\n')}`);
  process.exit(1);
}

/**
 * X fetches the card image as an anonymous bot: no Referer, its own UA, from
 * its own IPs. Cloudflare can treat that very differently from a curl run on
 * the deploy box, and when it does, the page still scrapes (so the title and
 * description look right) while the image silently drops -- which renders as a
 * small summary card with no picture. This matrix pins which of those it is.
 */
async function probe(url, origin) {
  const cases = [
    ['Twitterbot UA, no Referer  (what X sends)', { 'user-agent': SCRAPER_UA }],
    ['browser UA,   no Referer', { 'user-agent': BROWSER_UA }],
    ['Twitterbot UA, same-site Referer', { 'user-agent': SCRAPER_UA, referer: `${origin}/` }],
  ];
  const results = [];
  for (const [label, headers] of cases) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'image/png,image/*', ...headers },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      await res.arrayBuffer();
      results.push({ label, status: res.status, edge: edge(res) });
    } catch (err) {
      results.push({ label, status: `error (${err.message})`, edge: '' });
    }
  }
  return results;
}

async function printProbe(url, origin) {
  console.log('');
  console.log('Probing the image the way X does (page scrape and image fetch are');
  console.log('separate requests -- the page can succeed while the image is blocked):');
  for (const r of await probe(url, origin)) {
    console.log(`  ${String(r.status).padEnd(6)} ${r.label}`);
    if (r.edge) console.log(`         ${r.edge}`);
  }
  console.log('');
  console.log('  All three the same and 200: nothing is blocking the fetch.');
  console.log('  Only the browser UA works: Cloudflare is blocking X\'s bot.');
  console.log('  Only the same-site Referer works: Cloudflare hotlink protection.');
}

async function live({ hash, width, height }) {
  const origin = (process.env.ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, '');
  // Check the URL actually being posted. A card that misbehaves only with a
  // query string would otherwise pass a check that only ever looked at "/".
  const page = process.env.PAGE || '/';
  const pageUrl = `${origin}${page.startsWith('/') ? '' : '/'}${page}`;
  const expectedPath = `/og-image.${hash}.png`;
  const expectedUrl = `${origin}${expectedPath}`;

  console.log(`og-image-manifest: checking ${pageUrl} against og-image.${hash}.png`);

  let html, pageRes;
  try {
    pageRes = await getPage(pageUrl);
    if (!pageRes.ok) {
      fail([
        `${pageUrl} returned HTTP ${pageRes.status}.`,
        `    ${edge(pageRes)}`,
        ...([502, 503, 504].includes(pageRes.status)
          ? ['', '  A gateway error this persistent is the app failing to come up,',
                '  not a slow restart. Check it: pm2 logs zerogex-web --lines 50']
          : []),
      ]);
    }
    html = await pageRes.text();
  } catch (err) {
    fail([`could not reach ${pageUrl} (${err.message}).`]);
  }
  console.log(`  · page: ${edge(pageRes)}`);

  // Without summary_large_image X renders the small no-image card even when
  // every image tag below is perfect, so this has to come first.
  const cardType = metaContent(html, 'twitter:card');
  if (cardType !== 'summary_large_image') {
    fail([
      `twitter:card is ${cardType === null ? 'absent' : `"${cardType}"`}, not "summary_large_image".`,
      '',
      '  X renders a small card with no image at all unless this is set. It',
      '  comes from `twitter.card` in frontend/app/layout.tsx.',
    ]);
  }

  // X prefers twitter:image when it is present and falls back to og:image, so
  // both have to be right -- a correct og:image alone would still card wrong.
  for (const key of ['og:image', 'twitter:image']) {
    const got = metaContent(html, key);
    if (!got) fail([`${pageUrl} serves no <meta ${key}> tag at all.`]);
    // Next resolves these against metadataBase, so compare absolute-or-relative.
    if (got !== expectedUrl && got !== expectedPath) {
      fail([
        `${key} points at the wrong card.`,
        `    serving:  ${got}`,
        `    expected: ${expectedUrl}`,
        '',
        '  The deploy box is behind this checkout. Pull and redeploy there:',
        '      cd ~/zerogex-web && make deploy',
      ]);
    }
  }

  let bytes, contentType, imgRes, ms;
  try {
    const t0 = process.hrtime.bigint();
    imgRes = await get(expectedUrl, 'image/png');
    if (!imgRes.ok) {
      console.log(`  · image: ${edge(imgRes)}`);
      await printProbe(expectedUrl, origin);
      console.log('');
      fail([
        `the tags name ${expectedPath} but it returns HTTP ${imgRes.status}.`,
        `    ${edge(imgRes)}`,
        '',
        '  If that status is 403/503, Cloudflare is blocking the fetch rather',
        '  than the file being absent. Otherwise the manifest deployed without',
        '  the PNG beside it, meaning step 3 of the deploy (`make logo`) did',
        '  not run: cd ~/zerogex-web && make logo && make rebuild',
      ]);
    }
    contentType = imgRes.headers.get('content-type') || '(none)';
    bytes = Buffer.from(await imgRes.arrayBuffer());
    ms = Number(process.hrtime.bigint() - t0) / 1e6;
  } catch (err) {
    fail([`could not fetch ${expectedUrl} (${err.message}).`]);
  }
  console.log(`  · image: ${edge(imgRes)}`);

  // The filename *is* the digest, so this is self-verifying: anything but a
  // match means something between us and the client rewrote the bytes.
  const served = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  if (served !== hash) {
    fail([
      `${expectedPath} does not contain the bytes it is named for.`,
      `    served sha256: ${served}`,
      `    expected:      ${hash}`,
      '',
      '  A content-addressed URL cannot go stale on its own, so something in',
      '  front of the origin is rewriting or mis-serving it. Check Cloudflare.',
    ]);
  }

  const mb = bytes.length / (1024 * 1024);
  if (mb > 5) {
    fail([
      `${expectedPath} is ${mb.toFixed(1)} MB, over X's 5 MB limit for a card image.`,
      '',
      '  X drops an oversized image and renders a bare link instead. Re-export',
      '  assets/branding/og-image.png smaller, then `make logo` and commit.',
    ]);
  }

  const ratio = width / height;
  console.log(`  ✓ twitter:card is summary_large_image`);
  console.log(`  ✓ og:image and twitter:image both name ${expectedPath}`);
  console.log(`  ✓ it serves ${(bytes.length / 1024).toFixed(0)} KB of ${contentType} in ${ms.toFixed(0)} ms, sha256 ${served}`);
  if (ratio < 1.7 || ratio > 2.1) {
    console.log(`  ⚠ ${width}x${height} is ${ratio.toFixed(2)}:1; X crops cards to 1.91:1, so`);
    console.log('    expect the edges of this artwork to be cut off in the timeline.');
  } else {
    console.log(`  ✓ ${width}x${height} (${ratio.toFixed(2)}:1, inside X's 1.91:1 crop)`);
  }

  // Under X's 5 MB cap but still heavy enough to be worth flagging: the
  // fetcher gives up quickly, and a content-addressed URL is cold at every
  // edge the first time each one is asked for it.
  if (mb > 1) {
    console.log(`  ⚠ ${mb.toFixed(1)} MB is heavy for a card. X's documented cap is 5 MB, but`);
    console.log('    that cap is not the real limit: a 1.7 MB 1731x909 card was dropped');
    console.log('    silently here -- scraped fine, no image -- while a 379 KB 1200x630');
    console.log('    one rendered. Keep it well under 1 MB at 1200x630.');
  }

  await printProbe(expectedUrl, origin);
  console.log('');
  console.log('If every check above passed, an old card on X is X\'s own cache: it');
  console.log('keys the card on the page URL, holds it about a week, and the Card');
  console.log('Validator that used to force a refresh was retired.');
  console.log('');
  console.log('  To get a fresh scrape, post a URL X has not seen yet:');
  console.log(`      ${origin}/?v=2        (bump the number each time)`);
  console.log('');
  console.log('  To preview without posting, paste that URL into the X compose box');
  console.log('  and wait a beat. Do not preview the bare URL you intend to post.');
}

async function main() {
  const wantsLive = process.argv.includes('--live');
  const check = wantsLive || process.argv.includes('--check');

  if (!fs.existsSync(SOURCE)) {
    console.error(`og-image-manifest: ${path.relative(REPO_ROOT, SOURCE)} is missing`);
    process.exit(1);
  }

  const bytes = fs.readFileSync(SOURCE);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const { width, height } = readPngSize(bytes);
  const contents = render({ hash, width, height });

  if (check) {
    const current = fs.existsSync(MANIFEST) ? fs.readFileSync(MANIFEST, 'utf8') : '';
    if (current !== contents) {
      console.error(
        'og-image-manifest: frontend/core/ogImageManifest.ts is stale.\n' +
          '  Run `node scripts/og-image-manifest.js` and commit the result.'
      );
      process.exit(1);
    }
    console.log(`og-image-manifest: up to date (og-image.${hash}.png, ${width}x${height})`);
    if (wantsLive) await live({ hash, width, height });
    return;
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, contents);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // Drop hashed copies from earlier builds. Without this the public dir grows a
  // new PNG every time the artwork changes, and stale ones would keep being
  // served to anything that scraped them.
  for (const entry of fs.readdirSync(PUBLIC_DIR)) {
    if (/^og-image\.[0-9a-f]{8}\.png$/.test(entry) && entry !== `og-image.${hash}.png`) {
      fs.rmSync(path.join(PUBLIC_DIR, entry));
    }
  }

  fs.writeFileSync(path.join(PUBLIC_DIR, `og-image.${hash}.png`), bytes);
  // Legacy un-hashed path. Nothing in the app points at it any more, but cards
  // scraped before the hashed URL shipped still reference it, so keep it live.
  fs.writeFileSync(path.join(PUBLIC_DIR, 'og-image.png'), bytes);

  console.log(`  ✓ og-image.${hash}.png (${width}x${height})`);
}

main().catch((err) => {
  console.error(`og-image-manifest: ${err.message}`);
  process.exit(1);
});
