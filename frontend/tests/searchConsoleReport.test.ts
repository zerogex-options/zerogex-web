import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comparisonWindows,
  compareWindows,
  pageUrlFor,
  rowsByKey,
  totals,
  windowLength,
} from '../core/searchConsoleReport.ts';
import { querySearchAnalyticsBy, type SearchConsoleConfig } from '../core/searchConsole.ts';

// scripts/search-console-report.mts answers "did this page's queries move
// after a change" (the SPX title test is the first use). A wrong window or a
// wrong page URL would print a confident before/after table for the wrong
// days or the wrong page, so the arithmetic is pinned here.

test('a split compares the days before a change with the days from it', () => {
  const { before, after } = comparisonWindows(28, '2026-11-20', '2026-10-11');
  assert.deepEqual(before, { start: '2026-09-13', end: '2026-10-10' });
  assert.deepEqual(after, { start: '2026-10-11', end: '2026-11-07' });
  assert.equal(windowLength(before), 28);
  assert.equal(windowLength(after), 28);
});

test('the after window stops at the newest reported day', () => {
  const { after } = comparisonWindows(28, '2026-10-20', '2026-10-11');
  assert.deepEqual(after, { start: '2026-10-11', end: '2026-10-20' });
  assert.equal(windowLength(after), 10);
});

test('without a split, the latest days are compared with the days before them', () => {
  const { before, after } = comparisonWindows(7, '2026-10-08');
  assert.deepEqual(after, { start: '2026-10-02', end: '2026-10-08' });
  assert.deepEqual(before, { start: '2026-09-25', end: '2026-10-01' });
});

test('a split after the newest reported day, or a malformed date, is refused', () => {
  assert.throws(() => comparisonWindows(28, '2026-10-08', '2026-10-11'), /after the newest reported day/);
  assert.throws(() => comparisonWindows(28, '2026-10-08', '10/11/2026'), /not YYYY-MM-DD/);
  assert.throws(() => comparisonWindows(28, 'today'), /not YYYY-MM-DD/);
});

test('page URLs match what each property type reports', () => {
  assert.equal(pageUrlFor('sc-domain:zerogex.io', '/spx-gamma-levels'), 'https://zerogex.io/spx-gamma-levels');
  assert.equal(pageUrlFor('https://zerogex.io/', '/gex-levels'), 'https://zerogex.io/gex-levels');
  assert.equal(pageUrlFor('https://zerogex.io', 'gex-levels'), 'https://zerogex.io/gex-levels');
});

test('totals weight position by impressions, the way Search Console does', () => {
  const t = totals([
    { clicks: 10, impressions: 100, position: 5 },
    { clicks: 0, impressions: 300, position: 15 },
  ]);
  assert.equal(t.clicks, 10);
  assert.equal(t.impressions, 400);
  assert.equal(t.position, 12.5);
  assert.equal(t.ctr, 0.025);
  assert.deepEqual(totals([]), { clicks: 0, impressions: 0, position: 0, ctr: 0 });
});

test('queries seen in either window are listed, busiest first', () => {
  const before = rowsByKey([
    { keys: ['spx net gex'], clicks: 1, impressions: 90, position: 16 },
    { keys: ['gex for spx'], clicks: 0, impressions: 10, position: 20 },
    { keys: [42], clicks: 5, impressions: 5, position: 1 },
  ]);
  const after = rowsByKey([{ keys: ['spx net gex current value'], clicks: 3, impressions: 200, position: 9 }]);
  const rows = compareWindows(before, after);
  assert.deepEqual(
    rows.map((r) => r.key),
    ['spx net gex current value', 'spx net gex', 'gex for spx'],
  );
  assert.equal(rows[0].before, null);
  assert.equal(rows[1].after, null);
});

test('the query asks for one dimension, filtered to the page and phrase', async () => {
  const config: SearchConsoleConfig = {
    siteUrl: 'sc-domain:zerogex.io',
    serviceAccount: { clientEmail: 'x@example.com', privateKey: 'unused' },
    dataState: 'all',
  };
  let sent: { url: string; body: Record<string, unknown> } | null = null;
  const fakeFetch = async (url: string, init?: RequestInit) => {
    sent = { url, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ rows: [{ keys: ['spx net gex'], clicks: 1, impressions: 2, position: 3 }] }));
  };
  const rows = await querySearchAnalyticsBy(
    config,
    'token',
    {
      startDate: '2026-10-11',
      endDate: '2026-11-07',
      dimension: 'query',
      pageUrl: 'https://zerogex.io/spx-gamma-levels',
      queryContains: 'net gex',
    },
    fakeFetch,
  );
  assert.equal(rows.length, 1);
  assert.ok(sent);
  const { url, body } = sent as { url: string; body: Record<string, unknown> };
  assert.match(url, /sites\/sc-domain%3Azerogex\.io\/searchAnalytics\/query$/);
  assert.deepEqual(body.dimensions, ['query']);
  assert.deepEqual(body.dimensionFilterGroups, [
    {
      groupType: 'and',
      filters: [
        { dimension: 'page', operator: 'equals', expression: 'https://zerogex.io/spx-gamma-levels' },
        { dimension: 'query', operator: 'contains', expression: 'net gex' },
      ],
    },
  ]);
});
