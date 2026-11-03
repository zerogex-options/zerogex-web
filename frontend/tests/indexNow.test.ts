import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  DATED_LOOKBACK_DAYS,
  DATED_MEMORY_DAYS,
  EMPTY_STATE,
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  INDEXNOW_KEY_URL,
  buildPayload,
  classifyResponse,
  etDate,
  isOwnUrl,
  isPageUrl,
  isTradingDay,
  lastClosedSession,
  parseSitemap,
  parseState,
  selectAll,
  selectChanged,
  type SitemapEntry,
} from '../core/indexNow.ts';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const REPO = path.join(ROOT, '..');

// The shape next-sitemap writes to public/sitemap-0.xml.
const STATIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://zerogex.io/spx-gamma-levels</loc><lastmod>2026-10-30T21:00:00.000Z</lastmod><changefreq>daily</changefreq><priority>0.95</priority></url>
<url><loc>https://zerogex.io/gex-levels</loc><lastmod>2026-10-30T21:00:00.000Z</lastmod><changefreq>daily</changefreq><priority>0.95</priority></url>
<url><loc>https://zerogex.io/icon.png</loc><lastmod>2026-11-01T12:00:00.000Z</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
<url><loc>https://zerogex.io/education/what-is-a-put-wall</loc><lastmod>2026-11-02T16:00:00.000Z</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
<url><loc>https://zerogex.io/pricing</loc><lastmod>2026-10-01T12:00:00-04:00</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
</urlset>`;

// The shape app/sitemap-dated.xml/route.ts serves.
const DATED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://zerogex.io/replay/SPX/2026-11-03</loc><lastmod>2026-11-03</lastmod></url>
  <url><loc>https://zerogex.io/scorecard/SPY/2026-11-03</loc><lastmod>2026-11-03</lastmod></url>
  <url><loc>https://zerogex.io/replay/SPX/2026-11-02</loc><lastmod>2026-11-02</lastmod></url>
  <url><loc>https://zerogex.io/forecast/QQQ/2026-10-20</loc><lastmod>2026-10-20</lastmod></url>
</urlset>`;

const STATIC = parseSitemap(STATIC_XML);
const DATED = parseSitemap(DATED_XML);
// Tuesday Nov 3 2026, 5:45 PM ET (EST): the weekday run, after the close.
const TUE_EVENING = new Date('2026-11-03T22:45:00.000Z');
const SESSION_TUE = '2026-11-03';

test('the key is a valid IndexNow key and the public key file serves exactly it', () => {
  assert.match(INDEXNOW_KEY, /^[a-zA-Z0-9-]{8,128}$/);
  const file = path.join(ROOT, 'public', `${INDEXNOW_KEY}.txt`);
  assert.ok(existsSync(file), `public/${INDEXNOW_KEY}.txt is missing, so ${INDEXNOW_KEY_URL} would 404`);
  assert.equal(readFileSync(file, 'utf8').trim(), INDEXNOW_KEY);
  // At the site root: a key file's directory bounds which URLs it may submit.
  assert.equal(new URL(INDEXNOW_KEY_URL).pathname, `/${INDEXNOW_KEY}.txt`);
});

test('the key file path is not intercepted by the auth middleware or blocked by robots.txt', () => {
  // proxy.ts lets any path containing a dot through untouched.
  const proxy = readFileSync(path.join(ROOT, 'proxy.ts'), 'utf8');
  assert.match(proxy, /pathname\.includes\('\.'\)/);
  // No robots.ts disallow rule for every crawler is a prefix of the key file's path.
  const robots = readFileSync(path.join(ROOT, 'app/robots.ts'), 'utf8');
  const at = robots.indexOf("userAgent: '*'");
  assert.ok(at > 0, 'the all-crawler group was not found in robots.ts');
  const open = robots.indexOf('disallow: [', at);
  const list = robots.slice(open, robots.indexOf(']', open)).replace(/\/\/.*$/gm, '');
  const rules = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(rules, ['/api', '/_next/data', '/checkout']);
  const keyPath = new URL(INDEXNOW_KEY_URL).pathname;
  for (const rule of rules) assert.ok(!keyPath.startsWith(rule), `robots.ts disallows ${rule}, which covers ${keyPath}`);
});

test('parseSitemap reads both sitemap shapes and ignores a sitemap index', () => {
  assert.equal(STATIC.length, 5);
  assert.deepEqual(STATIC[0], {
    loc: 'https://zerogex.io/spx-gamma-levels',
    lastmod: '2026-10-30T21:00:00.000Z',
    changefreq: 'daily',
  });
  assert.equal(DATED.length, 4);
  assert.equal(DATED[0].lastmod, '2026-11-03');
  assert.equal(DATED[0].changefreq, undefined);
  assert.deepEqual(
    parseSitemap('<sitemapindex><sitemap><loc>https://zerogex.io/sitemap-0.xml</loc></sitemap></sitemapindex>'),
    [],
  );
  assert.equal(parseSitemap('<url><loc>https://zerogex.io/a?x=1&amp;y=2</loc></url>')[0].loc, 'https://zerogex.io/a?x=1&y=2');
});

test('the last closed session: today after 4:15 PM ET on a trading day, otherwise the trading day before', () => {
  const holidays = '2026-11-26,2026-12-25';
  // EST in November (UTC-5).
  assert.equal(lastClosedSession(new Date('2026-11-03T22:45:00Z'), holidays), '2026-11-03'); // Tue 5:45 PM
  assert.equal(lastClosedSession(new Date('2026-11-03T21:00:00Z'), holidays), '2026-11-02'); // Tue 4:00 PM, not done yet
  assert.equal(lastClosedSession(new Date('2026-11-03T21:15:00Z'), holidays), '2026-11-03'); // Tue 4:15 PM
  assert.equal(lastClosedSession(new Date('2026-11-04T08:00:00Z'), holidays), '2026-11-03'); // Wed 3:00 AM catch-up
  assert.equal(lastClosedSession(new Date('2026-11-08T15:00:00Z'), holidays), '2026-11-06'); // Sunday -> Friday
  assert.equal(lastClosedSession(new Date('2026-11-09T14:00:00Z'), holidays), '2026-11-06'); // Monday morning -> Friday
  assert.equal(lastClosedSession(new Date('2026-11-26T22:45:00Z'), holidays), '2026-11-25'); // Thanksgiving -> Wednesday
  // EDT in June (UTC-4): 5:43 PM ET is 21:43 UTC.
  assert.equal(lastClosedSession(new Date('2026-06-10T21:43:00Z'), undefined), '2026-06-10');
  assert.equal(isTradingDay('2026-11-26', holidays), false);
  assert.equal(isTradingDay('2026-11-26', undefined), true);
  assert.equal(etDate(new Date('2026-11-04T03:00:00Z')), '2026-11-03'); // 10 PM ET is still Nov 3
});

test('first run: the daily pages, the last week of permalinks, and every other page as new', () => {
  const { urls, next } = selectChanged(STATIC, DATED, EMPTY_STATE, TUE_EVENING, SESSION_TUE);
  assert.deepEqual(urls, [
    'https://zerogex.io/spx-gamma-levels',
    'https://zerogex.io/gex-levels',
    'https://zerogex.io/replay/SPX/2026-11-03',
    'https://zerogex.io/scorecard/SPY/2026-11-03',
    'https://zerogex.io/replay/SPX/2026-11-02',
    'https://zerogex.io/education/what-is-a-put-wall',
    'https://zerogex.io/pricing',
  ]);
  // Not the icon (a file), not the permalink from two weeks ago.
  assert.ok(!urls.includes('https://zerogex.io/icon.png'));
  assert.ok(!urls.includes('https://zerogex.io/forecast/QQQ/2026-10-20'));
  assert.equal(next.dailyOn, SESSION_TUE);
  assert.equal(next.static['https://zerogex.io/pricing'], '2026-10-01T12:00:00-04:00');
  assert.equal(next.dated['https://zerogex.io/replay/SPX/2026-11-03'], '2026-11-03');
  assert.equal(next.static['https://zerogex.io/spx-gamma-levels'], undefined, 'daily pages are keyed on the session, not their lastmod');
});

test('a second run for the same session sends nothing: unchanged URLs are not resubmitted', () => {
  const first = selectChanged(STATIC, DATED, EMPTY_STATE, TUE_EVENING, SESSION_TUE);
  const again = selectChanged(STATIC, DATED, first.next, new Date('2026-11-03T23:30:00Z'), SESSION_TUE);
  assert.deepEqual(again.urls, []);
  // A catch-up run the next morning is still the same session.
  const morning = new Date('2026-11-04T08:00:00Z');
  assert.deepEqual(selectChanged(STATIC, DATED, first.next, morning, lastClosedSession(morning, undefined)).urls, []);
});

test('the next session: the daily pages again, its new permalinks, nothing already sent', () => {
  const first = selectChanged(STATIC, DATED, EMPTY_STATE, TUE_EVENING, SESSION_TUE);
  const wed: SitemapEntry[] = [
    { loc: 'https://zerogex.io/replay/SPX/2026-11-04', lastmod: '2026-11-04' },
    // The hedging-flow list lagged on Tuesday evening; Tuesday's page shows up now.
    { loc: 'https://zerogex.io/hedging-flow/SPX/2026-11-03', lastmod: '2026-11-03' },
    ...DATED,
  ];
  const { urls } = selectChanged(STATIC, wed, first.next, new Date('2026-11-04T22:45:00Z'), '2026-11-04');
  assert.deepEqual(urls, [
    'https://zerogex.io/spx-gamma-levels',
    'https://zerogex.io/gex-levels',
    'https://zerogex.io/replay/SPX/2026-11-04',
    'https://zerogex.io/hedging-flow/SPX/2026-11-03',
  ]);
});

test('a holiday sends no daily pages; a changed page still goes out', () => {
  const first = selectChanged(STATIC, DATED, EMPTY_STATE, TUE_EVENING, SESSION_TUE);
  const holiday = new Date('2026-11-26T22:45:00Z');
  // Pretend Tuesday's run was Wednesday's, so the last closed session is already sent.
  const state = { ...first.next, dailyOn: '2026-11-25' };
  const changed = STATIC.map((e) =>
    e.loc.endsWith('/what-is-a-put-wall') ? { ...e, lastmod: '2026-11-26T16:00:00.000Z' } : e,
  );
  const { urls } = selectChanged(changed, [], state, holiday, lastClosedSession(holiday, '2026-11-26'));
  assert.deepEqual(urls, ['https://zerogex.io/education/what-is-a-put-wall']);
});

test('remembered permalinks are forgotten after DATED_MEMORY_DAYS, never inside the lookback', () => {
  assert.ok(DATED_MEMORY_DAYS > DATED_LOOKBACK_DAYS);
  const state = parseState(JSON.stringify({
    static: {},
    dated: { 'https://zerogex.io/replay/SPX/2026-10-01': '2026-10-01', 'https://zerogex.io/replay/SPX/2026-11-02': '2026-11-02' },
    dailyOn: SESSION_TUE,
  }));
  const { next } = selectChanged([], [], state, TUE_EVENING, SESSION_TUE);
  assert.deepEqual(Object.keys(next.dated), ['https://zerogex.io/replay/SPX/2026-11-02']);
});

test('ALL sends every page in both sitemaps and remembers it', () => {
  const all = selectAll(STATIC, DATED, EMPTY_STATE, TUE_EVENING, SESSION_TUE);
  assert.equal(all.urls.length, 8); // five static minus the icon, plus four dated
  assert.ok(all.urls.includes('https://zerogex.io/forecast/QQQ/2026-10-20'));
  assert.deepEqual(selectChanged(STATIC, DATED, all.next, TUE_EVENING, SESSION_TUE).urls, []);
});

test('only this host and only pages are ever sent', () => {
  const entries: SitemapEntry[] = [
    { loc: 'https://zerogex.io/chart', changefreq: 'daily' },
    { loc: 'https://zerogex.io/chart', changefreq: 'daily' },
    { loc: 'http://zerogex.io/forecast', changefreq: 'daily' },
    { loc: 'https://api.zerogex.io/docs', changefreq: 'daily' },
    { loc: 'https://www.zerogex.io/replay', changefreq: 'daily' },
    { loc: 'https://zerogex.io/apple-icon.png', changefreq: 'daily' },
  ];
  assert.deepEqual(selectChanged(entries, [], EMPTY_STATE, TUE_EVENING, SESSION_TUE).urls, ['https://zerogex.io/chart']);
  assert.equal(isOwnUrl('not a url'), false);
  assert.equal(isPageUrl('https://zerogex.io'), true);
  assert.equal(isPageUrl('https://zerogex.io/icon.png'), false);
});

test('a missing or broken state file is a first run, not an error', () => {
  assert.deepEqual(parseState(null), { static: {}, dated: {} });
  assert.deepEqual(parseState('not json'), { static: {}, dated: {} });
  assert.deepEqual(parseState('{"static":5}'), { static: {}, dated: {}, dailyOn: undefined });
});

test('the payload is the protocol shape, with the key file at the root', () => {
  assert.deepEqual(buildPayload(['https://zerogex.io/chart']), {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://zerogex.io/${INDEXNOW_KEY}.txt`,
    urlList: ['https://zerogex.io/chart'],
  });
});

test('response codes: accepted, our mistake (email), already seen (no email), or later', () => {
  assert.equal(classifyResponse(200).kind, 'ok');
  assert.equal(classifyResponse(202).kind, 'ok');
  assert.equal(classifyResponse(400).kind, 'config');
  assert.equal(classifyResponse(403).kind, 'config');
  // The key file was read before sending, so a 403 points at the engines'
  // fetch of it (Cloudflare), not at a missing file.
  assert.match(classifyResponse(403).meaning, /This server can read https:\/\/zerogex\.io\/[a-z0-9]+\.txt/);
  assert.match(classifyResponse(403).meaning, /Cloudflare \(Security > Events/);
  assert.equal(classifyResponse(422).kind, 'rejected');
  assert.deepEqual([classifyResponse(429).kind, classifyResponse(429).retryNow], ['transient', false]);
  assert.deepEqual([classifyResponse(503).kind, classifyResponse(503).retryNow], ['transient', true]);
});

test('the weekday timer, its service, the deploy step and the make target exist and agree', () => {
  const timer = readFileSync(path.join(REPO, 'deploy/systemd/zerogex-web-indexnow.timer'), 'utf8');
  // After the close and the 4:15 PM receipts, in New York time so it does not
  // drift an hour with daylight saving.
  assert.match(timer, /^OnCalendar=Mon\.\.Fri 17:43:00 America\/New_York$/m);
  assert.match(timer, /^RandomizedDelaySec=1m$/m);
  const service = readFileSync(path.join(REPO, 'deploy/systemd/zerogex-web-indexnow.service'), 'utf8');
  assert.match(service, /^ExecStart=\/usr\/bin\/make -C \/home\/ubuntu\/zerogex-web indexnow$/m);
  assert.match(service, /^OnFailure=zerogex-web-alert@%n\.service$/m);
  assert.match(service, /^StateDirectory=zerogex-web-indexnow$/m);
  assert.match(service, /^ProtectSystem=strict$/m);
  const step = path.join(REPO, 'deploy/steps/099.indexnow');
  assert.ok(existsSync(step), 'deploy/steps/099.indexnow is missing');
  assert.ok((statSync(step).mode & 0o111) !== 0, 'deploy/steps/099.indexnow must be executable or deploy.sh skips it');
  assert.match(readFileSync(step, 'utf8'), /install -d -m 0755 -o "\$OWNER" -g "\$OWNER" "\$STATE_DIR"/);
  const makefile = readFileSync(path.join(REPO, 'Makefile'), 'utf8');
  assert.match(makefile, /^indexnow:\n\t.*scripts\/indexnow-ping\.mts/m);
  const script = readFileSync(path.join(ROOT, 'scripts/indexnow-ping.mts'), 'utf8');
  assert.match(script, /process\.env\.STATE_DIRECTORY \|\| process\.env\.INDEXNOW_STATE_DIR \|\| '\/var\/lib\/zerogex-web-indexnow'/);
});
