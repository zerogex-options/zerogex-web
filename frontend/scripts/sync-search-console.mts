#!/usr/bin/env node
// Run from the frontend/ directory (or via `make sync-search-console`):
//   node --experimental-strip-types scripts/sync-search-console.mts
//
// Pulls daily clicks + impressions from Google Search Console into the
// `google_clicks` / `google_impressions` columns of the daily metrics rollup
// behind Admin → Monitoring → Daily Signals. Designed to run on a timer (see
// deploy/systemd/zerogex-web-search-console.timer) so that column keeps itself
// current, and to run by hand for the initial backfill.
//
// Setup, once:
//   1. Google Cloud console → create a service account → create a JSON key.
//      No roles are needed; the account is authorized on the property, not the
//      project.
//   2. Enable the "Google Search Console API" on that project.
//   3. Search Console → Settings → Users and permissions → Add user →
//      the service account's `client_email` → Full or Restricted.
//   4. Put the key somewhere the app user can read (0600) and set in
//      frontend/.env.local:
//        GSC_SITE_URL=sc-domain:zerogex.io      # exactly as Search Console names it
//        GSC_SERVICE_ACCOUNT_KEY_FILE=/var/lib/zerogex/gsc-service-account.json
//
// Flags / environment:
//   DAYS=<n>            trailing window to fetch (default 14; max ~16 months,
//                       which is all Search Console retains)
//   END=<YYYY-MM-DD>    end the window somewhere other than today
//   DRY_RUN=1           fetch and print, write nothing
//
// Re-running is safe and is the point: Search Console revises the last few days
// after first reporting them, so a trailing window overwrites its own earlier
// numbers with the settled ones, and a missed run heals on the next tick.
//
// IMPORTANT: core/db.ts reads AUTH_DB_PATH from process.env only — it does NOT
// load .env.local the way Next.js does at app boot. We hoist the whole file into
// process.env before the dynamic imports below so this writes the same DB the
// live PM2 process reads. Dynamic import is required: a static one would be
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
for (const key of [
  'AUTH_DB_PATH',
  'GSC_SITE_URL',
  'GSC_SERVICE_ACCOUNT_JSON',
  'GSC_SERVICE_ACCOUNT_KEY_FILE',
  'GSC_DATA_STATE',
  'GSC_SYNC_DAYS',
]) {
  if (envLocal[key] && !process.env[key]) process.env[key] = envLocal[key];
}

const dryRun = process.env.DRY_RUN === '1';
const resolvedDbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');

const { SearchConsoleError, DEFAULT_SYNC_DAYS, syncSearchConsole } = await import(
  '../core/searchConsole.ts'
);

const requestedDays = Number.parseInt(process.env.DAYS ?? process.env.GSC_SYNC_DAYS ?? '', 10);
const days = Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : DEFAULT_SYNC_DAYS;
const endDay = process.env.END?.trim() || undefined;

let result;
try {
  result = await syncSearchConsole({ days, endDay, readFile: (p) => fs.readFileSync(p, 'utf8') });
} catch (err) {
  if (err instanceof SearchConsoleError) {
    // An unconfigured install is not a failure — the timer is installed before
    // the operator has necessarily pasted the key, and a red unit every hour
    // trains people to ignore the unit. Say what is missing and exit clean.
    console.error(`Search Console sync skipped: ${err.message}`);
    process.exit(err.unconfigured ? 0 : 2);
  }
  throw err;
}

console.log(
  `Search Console: ${result.siteUrl} (dataState=${result.dataState}) ${result.startDate} → ${result.endDate}`,
);
console.log(
  result.reportedThrough
    ? `  Google has reported through ${result.reportedThrough}; ${result.rows.length} day(s) to write` +
        (result.zeroFilled > 0 ? `, ${result.zeroFilled} of them genuine zeros` : '')
    : '  Google reported no days in this window — nothing to write.',
);
if (result.truncated) {
  console.log('  ! The response filled the API page; narrow DAYS and re-run.');
}

if (result.rows.length === 0) process.exit(0);

if (dryRun) {
  for (const row of result.rows.slice(-14)) {
    console.log(`  ${row.day}  clicks=${row.googleClicks}  impressions=${row.googleImpressions}`);
  }
  console.log('DRY_RUN=1 — nothing written.');
  process.exit(0);
}

const { importExternalMetrics, rebuildDailyMetrics } = await import('../core/dailyMetrics.ts');
const written = importExternalMetrics(result.rows);
console.log(`Wrote ${written.daysWritten} day(s) to ${resolvedDbPath} (${written.firstDay} → ${written.lastDay}).`);

// Keep the derived half of the rollup in step, so a scheduled sync leaves the
// whole table current rather than only its Google columns.
const rebuilt = rebuildDailyMetrics();
console.log(`Rollup rebuilt: ${rebuilt.daysWritten} day(s) through ${rebuilt.lastDay}.`);
