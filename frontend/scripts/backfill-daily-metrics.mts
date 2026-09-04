#!/usr/bin/env node
// Run from the frontend/ directory (or via `make backfill-daily-metrics`):
//   node --experimental-strip-types scripts/backfill-daily-metrics.mts
//
// Materializes the per-day rollup behind Admin → Monitoring → Daily Signals,
// and optionally imports the two off-platform feeds that cannot be derived.
//
// The rollup is a CACHE of the append-only sources this DB already holds
// (audit_events for subscription starts / cancels / payment failures, users for
// registrations, page_view_events for traffic), so this is a true BACKFILL, not
// the start of a fresh collection: the first run reconstructs the product's
// entire history, and re-running is idempotent.
//
// The one thing it cannot reconstruct is a page-view day that has already aged
// past the page_view_events retention horizon (180 days) — those rows are gone,
// which is precisely why this table exists to keep their daily totals. Days
// outside the horizon keep whatever was captured earlier and are never
// overwritten with the 0 a post-prune recompute would produce.
//
// Environment / flags:
//   DAYS=<n>          how far back to rebuild (default: everything, capped at
//                     the module's REBUILD_WINDOW_DAYS)
//   X_CSV=<path>      X analytics export to import (Impressions, Profile visits)
//   GOOGLE_CSV=<path> Search Console "Dates" export to import (Clicks, Impressions)
//   COMBINED_CSV=<path>  this page's own CSV download, round-tripping both
//   REPORT=0          skip the correlation readout at the end
//
// IMPORTANT: core/db.ts reads AUTH_DB_PATH from process.env only — it does NOT
// load .env.local the way Next.js does at app boot. We hoist it out of
// .env.local before the dynamic import below so this writes the same file the
// live PM2 process reads. Dynamic import is required: a static import would be
// hoisted above the env mutation.

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
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
if (envLocal.AUTH_DB_PATH && !process.env.AUTH_DB_PATH) {
  process.env.AUTH_DB_PATH = envLocal.AUTH_DB_PATH;
}

const resolvedDbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');
console.log(`Daily metrics backfill against: ${resolvedDbPath}`);
if (!process.env.AUTH_DB_PATH) {
  console.log('(AUTH_DB_PATH unset — using the dev default)');
}

const { parseExternalMetricsCsv } = await import('../core/dailyMetricsCsv.ts');
const {
  buildDailySignalsSnapshot,
  importExternalMetrics,
  rebuildDailyMetrics,
} = await import('../core/dailyMetrics.ts');
const { classifyCorrelation } = await import('../core/dailyMetricsMath.ts');

// ── Imports first, so the rebuild's report includes what was just loaded ─────

const IMPORTS = [
  { env: 'X_CSV', source: 'x' as const, label: 'X analytics' },
  { env: 'GOOGLE_CSV', source: 'google' as const, label: 'Google Search Console' },
  { env: 'COMBINED_CSV', source: 'combined' as const, label: 'Combined export' },
];

for (const spec of IMPORTS) {
  const file = process.env[spec.env];
  if (!file) continue;
  if (!fs.existsSync(file)) {
    console.error(`\n${spec.env}: no such file: ${file}`);
    process.exit(2);
  }
  const parsed = parseExternalMetricsCsv(fs.readFileSync(file, 'utf8'), spec.source);
  if (parsed.rows.length === 0) {
    console.error(`\n${spec.label}: nothing imported. ${parsed.errors[0] ?? ''}`);
    process.exit(2);
  }
  const written = importExternalMetrics(parsed.rows);
  console.log(
    `\n${spec.label}: imported ${written.daysWritten} day(s), ${written.firstDay} → ${written.lastDay}` +
      `\n  columns read: ${Object.entries(parsed.mapping).map(([k, v]) => `${k}←"${v}"`).join(', ')}`,
  );
  if (parsed.ignoredColumns.length > 0) {
    console.log(`  columns ignored: ${parsed.ignoredColumns.join(', ')}`);
  }
  for (const problem of parsed.errors.slice(0, 5)) console.log(`  ! ${problem}`);
}

// ── Rebuild ─────────────────────────────────────────────────────────────────

const requestedDays = Number.parseInt(process.env.DAYS ?? '', 10);
const result = rebuildDailyMetrics(
  Number.isFinite(requestedDays) ? { windowDays: requestedDays } : {},
);
console.log(
  `\nRebuilt ${result.daysWritten} day(s): ${result.firstDay} → ${result.lastDay} in ${result.durationMs}ms.`,
);
console.log(
  result.pageViewsFrom
    ? `Page-view history available from ${result.pageViewsFrom}.`
    : 'No page-view data recorded yet (the analytics beacon has never fired).',
);

if (process.env.REPORT === '0') process.exit(0);

// ── Report ──────────────────────────────────────────────────────────────────
// The same numbers the admin panel shows, printed here so a backfill answers
// the question immediately instead of requiring someone to open a browser.

const snapshot = buildDailySignalsSnapshot({ days: 365 });

console.log(`\nCoverage across ${snapshot.rows.length} materialized day(s):`);
for (const row of snapshot.coverage) {
  console.log(
    row.days === 0
      ? `  ${row.label.padEnd(20)} no data`
      : `  ${row.label.padEnd(20)} ${String(row.total).padStart(9)} across ${String(row.days).padStart(4)}d  (${row.firstDay} → ${row.lastDay})`,
  );
}

const fmt = (v: number | null, digits = 2) => (v === null || !Number.isFinite(v) ? '   —' : v.toFixed(digits));

console.log('\nRelationships (pre-registered lags):');
for (const test of snapshot.relationships) {
  console.log(`  ${test.title}`);
  if (test.driverDays === 0) {
    console.log(`    no ${test.driverLabel.toLowerCase()} imported yet`);
    continue;
  }
  for (const point of test.highlights) {
    const verdict = classifyCorrelation(point);
    console.log(
      `    lag ${String(point.lag).padStart(2)}d  r=${fmt(point.r)}  rank=${fmt(point.rho)}  n=${String(point.n).padStart(4)}  p=${fmt(point.p, 4)}  → ${verdict}`,
    );
  }
  if (test.best) {
    console.log(`    strongest across 0–14d: lag ${test.best.lag}d (r=${fmt(test.best.r)}) — exploratory`);
  }
}

console.log('\nDay of week:');
for (const metric of snapshot.weekday) {
  const { peak, trough, anova } = metric.analysis;
  if (!peak || peak.days === 0) {
    console.log(`  ${metric.label.padEnd(20)} no data`);
    continue;
  }
  const verdict =
    anova.p === null
      ? 'not enough variation to test yet'
      : anova.p < 0.05
        ? 'real weekday effect'
        : 'not distinguishable from noise';
  console.log(
    `  ${metric.label.padEnd(20)} peak ${peak.label} ${fmt(peak.mean)}/day, trough ${trough?.label} ${fmt(trough?.mean ?? null)}/day` +
      `  F=${fmt(anova.f)} p=${fmt(anova.p, 4)} → ${verdict}`,
  );
  console.log(`    ${metric.analysis.buckets.map((b) => `${b.label} ${fmt(b.mean)}`).join('  ')}`);
}

console.log('\nVolatility (coefficient of variation, raw vs 7-day mean):');
for (const row of snapshot.volatility) {
  console.log(
    `  ${row.label.padEnd(20)} mean/day ${fmt(row.mean)}   raw ${fmt(row.raw)}   smoothed ${fmt(row.smoothed)}`,
  );
}
