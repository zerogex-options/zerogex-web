#!/usr/bin/env node
// Run from the frontend/ directory (or via `make search-console-report`):
//   node --experimental-strip-types scripts/search-console-report.mts
//
// Read-only. Prints how one page's search queries moved between two windows:
// clicks, impressions, CTR and average position, before and after, from Google
// Search Console. It writes nothing, anywhere. Uses the same service account
// and .env.local settings as `make sync-search-console`.
//
// Flags / environment:
//   PAGE=<path>         the page to report on (default /spx-gamma-levels).
//                       PAGE= (empty) reports across the whole site.
//   QUERY=<text>        only queries containing this text, e.g. "net gex"
//   BY=query|page       break down by query (default) or by page. BY=page with
//                       QUERY="gamma wall" shows which URL takes those clicks.
//   DAYS=<n>            length of each window (default 28)
//   SPLIT=<YYYY-MM-DD>  the day a change shipped: compares the DAYS before it
//                       with the DAYS from it. Without SPLIT, compares the
//                       latest DAYS with the DAYS before them.
//   END=<YYYY-MM-DD>    newest day to include (default three days ago, since
//                       Search Console reports with a lag of about two days)
//   LIMIT=<n>           rows to print (default 25)
//
// Example, the SPX title decision:
//   make search-console-report PAGE=/spx-gamma-levels QUERY="net gex" SPLIT=2026-10-11

import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
for (const key of ['GSC_SITE_URL', 'GSC_SERVICE_ACCOUNT_JSON', 'GSC_SERVICE_ACCOUNT_KEY_FILE', 'GSC_DATA_STATE']) {
  if (envLocal[key] && !process.env[key]) process.env[key] = envLocal[key];
}

const { SearchConsoleError, resolveConfig, fetchAccessToken, querySearchAnalyticsBy, todayKey } = await import(
  '../core/searchConsole.ts'
);
const { comparisonWindows, windowLength, pageUrlFor, rowsByKey, totals, compareWindows } = await import(
  '../core/searchConsoleReport.ts'
);

const pagePath = process.env.PAGE ?? '/spx-gamma-levels';
const queryContains = (process.env.QUERY ?? '').trim() || undefined;
const by = process.env.BY === 'page' ? 'page' : 'query';
const days = Number(process.env.DAYS ?? 28);
const split = (process.env.SPLIT ?? '').trim() || undefined;
const limit = Math.max(1, Number(process.env.LIMIT ?? 25));
const defaultEnd = new Date(Date.parse(`${todayKey()}T00:00:00Z`) - 3 * 86_400_000).toISOString().slice(0, 10);
const end = (process.env.END ?? '').trim() || defaultEnd;

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pos = (x: number) => (x > 0 ? x.toFixed(1) : '-');

try {
  const config = resolveConfig(process.env, (p) => fs.readFileSync(p, 'utf8'));
  const { before, after } = comparisonWindows(days, end, split);
  const pageUrl = pagePath ? pageUrlFor(config.siteUrl, pagePath) : undefined;
  const token = await fetchAccessToken(config.serviceAccount);
  const fetchWindow = async (w: { start: string; end: string }) =>
    rowsByKey(
      await querySearchAnalyticsBy(config, token, {
        startDate: w.start,
        endDate: w.end,
        dimension: by,
        pageUrl,
        queryContains,
      }),
    );
  const [b, a] = await Promise.all([fetchWindow(before), fetchWindow(after)]);

  console.log(`Search Console, ${config.siteUrl}`);
  console.log(`Page:   ${pageUrl ?? 'whole site'}`);
  if (queryContains) console.log(`Query:  contains "${queryContains}"`);
  console.log(`Before: ${before.start} to ${before.end} (${windowLength(before)} days)`);
  console.log(`After:  ${after.start} to ${after.end} (${windowLength(after)} days)`);
  if (windowLength(after) < windowLength(before)) {
    console.log('Note:   the after window is shorter than the before window, so compare CTR and position, not raw totals.');
  }
  console.log('');

  const tb = totals(b.values());
  const ta = totals(a.values());
  console.log('Totals          clicks  impressions     CTR  position');
  console.log(`  before  ${String(tb.clicks).padStart(12)} ${String(tb.impressions).padStart(12)} ${pct(tb.ctr).padStart(7)} ${pos(tb.position).padStart(9)}`);
  console.log(`  after   ${String(ta.clicks).padStart(12)} ${String(ta.impressions).padStart(12)} ${pct(ta.ctr).padStart(7)} ${pos(ta.position).padStart(9)}`);
  console.log('');

  const rows = compareWindows(b, a).slice(0, limit);
  if (rows.length === 0) {
    console.log('No rows. Search Console reported nothing for this page and filter in either window.');
  } else {
    console.log(`Top ${rows.length} by ${by} (impressions across both windows):`);
    console.log(`  ${by.padEnd(48)}  clicks b/a   impr b/a     pos b/a`);
    for (const r of rows) {
      const cb = r.before?.clicks ?? 0;
      const ca = r.after?.clicks ?? 0;
      const ib = r.before?.impressions ?? 0;
      const ia = r.after?.impressions ?? 0;
      const label = r.key.length > 48 ? `${r.key.slice(0, 45)}...` : r.key;
      console.log(
        `  ${label.padEnd(48)}  ${`${cb}/${ca}`.padStart(10)} ${`${ib}/${ia}`.padStart(10)} ${`${pos(r.before?.position ?? 0)}/${pos(r.after?.position ?? 0)}`.padStart(11)}`,
      );
    }
  }
} catch (err) {
  if (err instanceof SearchConsoleError && err.unconfigured) {
    console.log(`Search Console report skipped: not configured. ${err.message}`);
    process.exit(0);
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
