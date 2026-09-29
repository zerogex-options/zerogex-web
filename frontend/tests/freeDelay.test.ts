// The free surfaces' "delayed ~15 minutes" label has to be true.
//
// Every free, no-login surface (the six gamma-levels pages, the embed widget and
// card, llms.txt, /mcp, the education page's reading, the thinkorswim pre-fill
// and the public /chart) said its data was delayed about 15 minutes. The delay
// was a 900-second cache and nothing more, so the data was anywhere from seconds
// to fifteen minutes old: on 2026-09-29 at 4:03 PM ET, llms.txt served SPY "as
// of 3:57 PM". Those surfaces now read through serverApiGetDelayed, which asks
// the backend for data at least 15 minutes old (zerogex-oa
// src/api/delayed_read.py), and cache for a minute.
//
// The source scan below is the guard that matters: a free surface that reads
// market data through plain serverApiGet serves near-live numbers under a
// "delayed" label, and nothing else would notice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  FREE_DELAY_MINUTES,
  FREE_DELAY_SECONDS,
  FREE_REVALIDATE_SECONDS,
  delayedNow,
  delayedPath,
} from '../core/freeDelay.ts';
import { getMarketSession } from '../core/utils.ts';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

test('the free tier is 15 minutes behind and caches for a minute', () => {
  assert.equal(FREE_DELAY_MINUTES, 15);
  assert.equal(FREE_DELAY_SECONDS, 900);
  // Short enough that "~15 minutes" stays true: the backend's ceiling is one
  // minute bucket behind the delay, so data reaches a visitor 15-17 min old.
  assert.equal(FREE_REVALIDATE_SECONDS, 60);
});

test('delayedPath adds the delay whether or not the path has a query', () => {
  assert.equal(delayedPath('/api/gex/summary'), '/api/gex/summary?delay_minutes=15');
  assert.equal(
    delayedPath('/api/gex/summary?symbol=SPX&underlying=SPX'),
    '/api/gex/summary?symbol=SPX&underlying=SPX&delay_minutes=15',
  );
});

test('delayedNow is the backend ceiling: the delay plus one minute bucket', () => {
  const now = new Date('2026-09-29T20:03:51Z');
  assert.equal(delayedNow(now).toISOString(), '2026-09-29T19:47:51.000Z');
});

test('the session a delayed read describes is the one at its ceiling, not now', () => {
  // 09:40 ET: the market is open, but delayed data is still from 09:24.
  const opening = new Date('2026-09-29T13:40:00Z');
  assert.equal(getMarketSession(opening), 'open');
  assert.equal(getMarketSession(delayedNow(opening)), 'pre-market');
  // 16:10 ET: the market has closed, but delayed data is still from 15:54.
  const closing = new Date('2026-09-29T20:10:00Z');
  assert.equal(getMarketSession(closing), 'after-hours');
  assert.equal(getMarketSession(delayedNow(closing)), 'open');
});

// Every free surface, and the only plain serverApiGet each may still make: a
// read that is not market data (the forecast archive changes twice a day).
const FREE_SURFACES: Record<string, RegExp[]> = {
  'app/spx-gamma-levels/gammaLevels.tsx': [/\/api\/forecast\/available-dates/],
  'app/chart/snapshot.ts': [],
  'app/embed/[symbol]/route.ts': [],
  'app/embed/image/[symbol]/route.tsx': [],
  'core/llmsTxt.ts': [],
  'app/mcp/route.ts': [],
  'app/education/spx-net-gamma-exposure-today/page.tsx': [],
  'app/thinkorswim-indicator/page.tsx': [],
};

test('every free surface reads market data only through the delayed read', () => {
  for (const [file, allowed] of Object.entries(FREE_SURFACES)) {
    const source = read(file);
    assert.match(source, /serverApiGetDelayed</, `${file} makes no delayed read`);
    // Each plain read, from its call to the path it asks for.
    const plainReads = source.match(/serverApiGet(?:Result)?<[^>]*>\(\s*[`'"][^`'"]*/g) ?? [];
    for (const call of plainReads) {
      assert.ok(
        allowed.some((pattern) => pattern.test(call)),
        `${file} reads without the delay: ${call.replace(/\s+/g, ' ')}`,
      );
    }
  }
});

test('the free daily email reads the same delayed summary', () => {
  // It goes out between 08:30 and 09:25 ET, while SPY and QQQ trade pre-market,
  // and every row says "delayed ~15 minutes". A plain fetch, not serverApiGet,
  // so the scan above cannot see it.
  const script = read('scripts/send-daily-levels.mts');
  assert.match(script, /delayedPath\(`\/api\/gex\/summary\?/);
  assert.doesNotMatch(script, /fetch\(\s*`\$\{API_BASE\}\/api\/gex\/summary/);
});

test('the six gamma-levels pages revalidate every minute, not every 15', () => {
  for (const symbol of ['spx', 'spy', 'qqq', 'ndx', 'es', 'nq']) {
    const page = read(`app/${symbol}-gamma-levels/page.tsx`);
    assert.match(page, /^export const revalidate = 60;/m, `${symbol} page`);
  }
});

test('no free surface tells a shared cache to hold it for an hour', () => {
  for (const file of ['app/embed/[symbol]/route.ts', 'app/embed/image/[symbol]/route.tsx', 'core/llmsTxt.ts']) {
    const source = read(file);
    assert.match(
      source,
      /s-maxage=\$\{FREE_REVALIDATE_SECONDS\}, stale-while-revalidate=\$\{FREE_REVALIDATE_SECONDS\}/,
      file,
    );
    assert.doesNotMatch(source, /stale-while-revalidate=3600/, file);
  }
});
