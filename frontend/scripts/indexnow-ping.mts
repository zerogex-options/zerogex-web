#!/usr/bin/env node
// Run from the frontend/ directory (or via `make indexnow`):
//   node --experimental-strip-types scripts/indexnow-ping.mts
//
// Tells Bing, and every engine that shares IndexNow submissions, which
// zerogex.io pages changed. Runs after the close on weekdays from
// deploy/systemd/zerogex-web-indexnow.timer; see core/indexNow.ts for why and
// for how the URLs are chosen.
//
// Where the URLs come from:
//   - the static sitemap next-sitemap writes at build: public/sitemap-*.xml on
//     this box (the live https://zerogex.io/sitemap-0.xml when run elsewhere);
//   - the dated-permalink sitemap, from the local Next server first
//     (http://127.0.0.1:3000/sitemap-dated.xml) and the live site second.
//
// What it remembers: $STATE_DIRECTORY/state.json (systemd sets
// STATE_DIRECTORY from the unit's StateDirectory=; by hand it falls back to
// /var/lib/zerogex-web-indexnow, which deploy step 099.indexnow creates). With
// no writable state directory (a laptop), every page counts as new and nothing
// is remembered.
//
// Flags / environment:
//   DRY_RUN=1     print what would be sent, send and remember nothing
//   ALL=1         send every page in both sitemaps, including old permalinks:
//                 run once after setup so the engines see the whole site
//   URLS="..."    send exactly these URLs (space- or comma-separated), e.g.
//                 after publishing an article; the state is left alone
//
// Exit status: 0 when the batch was accepted, when there was nothing to send,
// or when the endpoint was busy or turned the batch away as already seen (the
// next run carries on). 1 only when something on our side needs fixing: the key
// file is not live, or the endpoint says the request or the key is invalid.
// That is the case the unit's OnFailure alert email is for.

import fs from 'node:fs';
import path from 'node:path';
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_URL,
  SITE_URL,
  buildPayload,
  classifyResponse,
  etDate,
  isOwnUrl,
  lastClosedSession,
  parseSitemap,
  parseState,
  selectAll,
  selectChanged,
  type IndexNowState,
  type SitemapEntry,
} from '../core/indexNow.ts';

const DRY_RUN = process.env.DRY_RUN === '1';
const ALL = process.env.ALL === '1';
const URLS = (process.env.URLS ?? '').trim();
const LOCAL_BASE = (process.env.INDEXNOW_LOCAL_BASE || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const STATE_DIR = process.env.STATE_DIRECTORY || process.env.INDEXNOW_STATE_DIR || '/var/lib/zerogex-web-indexnow';
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const FETCH_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 30_000;

function log(line: string): void {
  console.log(`[indexnow] ${line}`);
}

/** The one value this needs from frontend/.env.local, without loading the rest. */
function readHolidays(): string | undefined {
  if (process.env.NEXT_PUBLIC_NYSE_HOLIDAYS) return process.env.NEXT_PUBLIC_NYSE_HOLIDAYS;
  try {
    const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = /^\s*NEXT_PUBLIC_NYSE_HOLIDAYS\s*=\s*["']?([^"'\n]*)["']?\s*$/m.exec(env);
    return m?.[1];
  } catch {
    return undefined;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      log(`${url} -> HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    log(`${url} -> ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** The build's static sitemap files; the sitemap index itself carries no <url>. */
async function loadStaticEntries(): Promise<SitemapEntry[]> {
  const dir = path.join(process.cwd(), 'public');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /^sitemap-\d+\.xml$/.test(f)).sort()
    : [];
  if (files.length > 0) {
    return files.flatMap((f) => parseSitemap(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  log('no public/sitemap-*.xml here (not a built checkout); reading the live sitemap');
  const xml = await fetchText(`${SITE_URL}/sitemap-0.xml`);
  return xml ? parseSitemap(xml) : [];
}

// The dated sitemap's session lists sit in Next's fetch cache for an hour and
// are refreshed stale-while-revalidate: the first request after they expire is
// answered from the old lists and starts the refresh. Read once to start it,
// give the backend a moment, and use the second read, so a 5:43 PM run is not
// handed a list from before the 4:15 PM scorecard existed.
const WARM_DELAY_MS = 15_000;

async function loadDatedEntries(): Promise<SitemapEntry[]> {
  const local = `${LOCAL_BASE}/sitemap-dated.xml`;
  let xml: string | null = null;
  if ((await fetchText(local)) !== null) {
    await new Promise((resolve) => setTimeout(resolve, WARM_DELAY_MS));
    xml = await fetchText(local);
  }
  xml = xml ?? (await fetchText(`${SITE_URL}/sitemap-dated.xml`));
  if (!xml) {
    log('dated sitemap unavailable; sending without the session permalinks');
    return [];
  }
  return parseSitemap(xml);
}

function loadState(): { state: IndexNowState; writable: boolean } {
  let raw: string | null = null;
  try {
    raw = fs.readFileSync(STATE_FILE, 'utf8');
  } catch {
    // First run, or no state directory on this machine.
  }
  let writable = false;
  try {
    fs.accessSync(STATE_DIR, fs.constants.W_OK);
    writable = true;
  } catch {
    log(`no writable ${STATE_DIR}: every page counts as new, and nothing is remembered`);
  }
  return { state: parseState(raw), writable };
}

function saveState(next: IndexNowState): void {
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next)}\n`);
  fs.renameSync(tmp, STATE_FILE);
}

function parseUrlList(raw: string): string[] {
  const urls = raw.split(/[\s,]+/).filter(Boolean);
  for (const u of urls.filter((x) => !isOwnUrl(x))) log(`skipping ${u}: not an https://zerogex.io URL`);
  return [...new Set(urls.filter(isOwnUrl))];
}

async function keyFileIsLive(): Promise<boolean> {
  const body = await fetchText(INDEXNOW_KEY_URL);
  return body?.trim() === INDEXNOW_KEY;
}

async function post(urls: string[]): Promise<number | null> {
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(buildPayload(urls)),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.status;
  } catch (err) {
    log(`POST failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main(): Promise<number> {
  const now = new Date();
  const today = etDate(now);
  const session = lastClosedSession(now, readHolidays());

  let urls: string[];
  let next: IndexNowState | null = null;
  let writable = false;
  if (URLS) {
    urls = parseUrlList(URLS);
    log(`${urls.length} URL${urls.length === 1 ? '' : 's'} given in URLS`);
  } else {
    const loaded = loadState();
    writable = loaded.writable;
    const [staticEntries, datedEntries] = await Promise.all([loadStaticEntries(), loadDatedEntries()]);
    log(`static sitemap: ${staticEntries.length} URLs; dated sitemap: ${datedEntries.length} URLs; today ${today}, last closed session ${session}`);
    const pick = ALL ? selectAll : selectChanged;
    const selection = pick(staticEntries, datedEntries, loaded.state, now, session);
    urls = selection.urls;
    next = selection.next;
    log(`${urls.length} URL${urls.length === 1 ? '' : 's'} to send (${ALL ? 'ALL' : 'changed since the last run'})`);
  }

  if (urls.length === 0) {
    log('nothing to send');
    return 0;
  }
  if (DRY_RUN) {
    for (const u of urls) console.log(`  ${u}`);
    log('DRY_RUN=1: nothing sent, nothing remembered');
    return 0;
  }

  if (!(await keyFileIsLive())) {
    log(`the key file ${INDEXNOW_KEY_URL} is not serving the key; deploy first. Nothing sent.`);
    return 1;
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const status = await post(urls);
    const verdict = status === null ? null : classifyResponse(status);
    if (status !== null && verdict) log(`${INDEXNOW_ENDPOINT} -> HTTP ${status}: ${verdict.meaning}`);
    if (verdict?.kind === 'ok' || verdict?.kind === 'rejected') {
      if (next && writable) saveState(next);
      return 0;
    }
    if (verdict?.kind === 'config') return 1;
    // Transient: a network failure or a 5xx gets one more try in this run; a
    // 429 waits for the next run, as the protocol asks.
    if (attempt === 1 && (verdict === null || verdict.retryNow)) {
      log(`retrying once in ${RETRY_DELAY_MS / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
    break;
  }
  log('not sent this time; the next run tries again (nothing remembered)');
  return 0;
}

process.exit(await main());
