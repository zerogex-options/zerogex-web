import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Exercises core/dailyMetrics.ts against a throwaway SQLite file: the derived
// column definitions, the retention guard that keeps pruned page-view history
// alive, the merge semantics of the CSV importer, and the daily_metrics_view
// join. These are the parts that cannot be covered by the pure-function suite
// next door (tests/dailyMetricsMath.test.ts) and are exactly the parts where a
// mistake silently produces plausible-looking wrong numbers.
//
// core/dailyMetrics.ts is loadable here — rather than only inside Next — because
// it deliberately avoids `server-only` and the "@/" alias, the same property
// scripts/backfill-daily-metrics.mts depends on.

const dbPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-daily-metrics-')),
  'auth.db',
);
process.env.AUTH_DB_PATH = dbPath;

// Dynamic import: core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment above has to land first. A static import would be hoisted past it.
const { getDb } = await import('../core/db.ts');
const {
  PAGE_VIEW_RETENTION_DAYS,
  buildDailySignalsSnapshot,
  getDailyMetricRows,
  importExternalMetrics,
  rebuildDailyMetrics,
} = await import('../core/dailyMetrics.ts');

const db = getDb();

// ---------------------------------------------------------------------------
// Fixture. Everything is anchored to "today" so the rows land inside the
// rebuild window no matter when the suite runs.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const now = Date.now();

const ET_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The ET day `daysAgo` days back — derived from the real instant, exactly as the
 * code under test derives it. Re-anchoring to a fixed UTC hour first (the
 * obvious way to write this) makes the suite fail between 00:00 and 04:00 UTC,
 * when "today" in UTC is already tomorrow relative to ET.
 */
const dayOf = (daysAgo: number) => ET_DAY.format(new Date(now - daysAgo * DAY_MS));

/**
 * An instant inside that ET day. Hours 12–20 UTC are 08:00–16:00 ET in either
 * DST offset, so the calendar day never slips regardless of when the suite runs.
 */
function isoDaysAgo(daysAgo: number, hourUtc = 16): string {
  return `${dayOf(daysAgo)}T${String(hourUtc).padStart(2, '0')}:30:00.000Z`;
}

let auditSeq = 0;
function audit(type: string, iso: string, message: string, userId: string | null = null): void {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(`audit_${auditSeq++}`, type, userId, message, iso);
}

function seedUser(id: string, iso: string): void {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at)
     VALUES (?, ?, 'x', 'public', ?, ?)`,
  ).run(id, `${id}@example.test`, iso, iso);
}

function seedVisit(visitId: string, iso: string, userId: string | null): void {
  db.prepare(
    `INSERT INTO page_view_events (visit_id, path, user_id, tier, duration_ms, created_at)
     VALUES (?, '/dashboard', ?, 'public', 0, ?)`,
  ).run(visitId, userId, iso);
}

// sub_A trials at D-10, then converts to `active` at D-3. The conversion is not
// a second start.
audit('stripe_subscription_sync', isoDaysAgo(10), 'Subscription sub_A status=trialing tier=pro cancelAtPeriodEnd=false');
audit('stripe_subscription_sync', isoDaysAgo(3), 'Subscription sub_A status=active tier=pro cancelAtPeriodEnd=false');
// sub_B emits an `incomplete`/public sync before its real trial start.
audit('stripe_subscription_sync', isoDaysAgo(9, 16), 'Subscription sub_B status=incomplete tier=public cancelAtPeriodEnd=false');
audit('stripe_subscription_sync', isoDaysAgo(9, 17), 'Subscription sub_B status=trialing tier=basic cancelAtPeriodEnd=false');
// sub_C skips the trial entirely.
audit('stripe_subscription_sync', isoDaysAgo(8), 'Subscription sub_C status=active tier=pro cancelAtPeriodEnd=false');

// One cancel click emits BOTH a request row and an ack row; a second member
// cancels the same day.
audit('stripe_cancellation_requested', isoDaysAgo(5), 'Cancellation requested for sub_A', 'u1');
audit('cancellation_ack_email_sent', isoDaysAgo(5, 16), 'Cancellation ack for sub_A', 'u1');
audit('stripe_cancellation_requested', isoDaysAgo(5, 18), 'Cancellation requested for sub_C', 'u2');

// One invoice, three Smart Retries.
audit('stripe_payment_failed', isoDaysAgo(2), 'Invoice in_123 payment failed for sub A (attempt 1)', 'u1');
audit('stripe_payment_failed', isoDaysAgo(2, 18), 'Invoice in_123 payment failed for sub A (attempt 2)', 'u1');
audit('stripe_payment_failed', isoDaysAgo(1), 'Invoice in_123 payment failed for sub A (attempt 3)', 'u1');

seedUser('u1', isoDaysAgo(10));
seedUser('u2', isoDaysAgo(10, 18));
seedUser('u3', isoDaysAgo(4));

seedVisit('v1', isoDaysAgo(4), 'u1');
seedVisit('v2', isoDaysAgo(4, 16), 'u1'); // same user twice → 2 views, 1 unique
seedVisit('v3', isoDaysAgo(4, 17), 'u2');
seedVisit('v4', isoDaysAgo(4, 18), null); // anonymous → view only
seedVisit('v5', isoDaysAgo(1), 'u3');

const firstRebuild = rebuildDailyMetrics();

function rowsByDay(): Map<string, ReturnType<typeof getDailyMetricRows>[number]> {
  return new Map(getDailyMetricRows({ days: 30 }).map((r) => [r.day, r]));
}

// ---------------------------------------------------------------------------

test('the axis starts at the first day of real activity, not the window edge', () => {
  // Otherwise a young product gets 900 rows of fabricated zeros, and a zero
  // meaning "we did not exist yet" is exactly what turns a correlation into an
  // artifact.
  assert.equal(firstRebuild.firstDay, dayOf(10));
  assert.equal(firstRebuild.lastDay, dayOf(0));
  assert.equal(rowsByDay().has(dayOf(20)), false);
});

test('a trial start is a subscription’s first paid sync, and only its first', () => {
  const rows = rowsByDay();
  assert.equal(rows.get(dayOf(10))!.trialStarts, 1);
  // The later active sync is a conversion, not a new signup.
  assert.equal(rows.get(dayOf(3))!.trialStarts, 0);
  assert.equal(rows.get(dayOf(3))!.paidStarts, 0);
});

test('an incomplete sync before the trial does not claim the start', () => {
  assert.equal(rowsByDay().get(dayOf(9))!.trialStarts, 1);
});

test('a checkout with no trial books as a paid start', () => {
  const day = rowsByDay().get(dayOf(8))!;
  assert.equal(day.paidStarts, 1);
  assert.equal(day.trialStarts, 0);
});

test('one cancel click counts once even though it emits two audit rows', () => {
  // Two members cancelled that day; the request+ack pair from the first is one.
  assert.equal(rowsByDay().get(dayOf(5))!.cancels, 2);
});

test('Smart Retries of one invoice count as a single payment failure', () => {
  const rows = rowsByDay();
  assert.equal(rows.get(dayOf(2))!.paymentFailures, 1);
  assert.equal(rows.get(dayOf(1))!.paymentFailures, 0);
});

test('registrations come from the users table, one per account', () => {
  const rows = rowsByDay();
  assert.equal(rows.get(dayOf(10))!.registrations, 2);
  assert.equal(rows.get(dayOf(4))!.registrations, 1);
});

test('pageviews count anonymous visits; unique users count logged-in ones', () => {
  const rows = rowsByDay();
  assert.equal(rows.get(dayOf(4))!.pageviews, 4);
  assert.equal(rows.get(dayOf(4))!.uniqueUsers, 2);
  assert.equal(rows.get(dayOf(1))!.pageviews, 1);
});

test('a day before the beacon started is NULL traffic, not zero traffic', () => {
  const day = rowsByDay().get(dayOf(8))!;
  assert.equal(day.pageviews, null);
  assert.equal(day.uniqueUsers, null);
  // …while the audit-derived columns on the same day are real zeros.
  assert.equal(day.registrations, 0);
});

test('a short-window rebuild cannot re-book an older subscription as new', () => {
  // sub_A's first trialing sync is at D-10, outside a 5-day window, but it syncs
  // again as `active` at D-3, inside it. A rebuild that scanned only its own
  // write window would call that later sync the subscription's first paid
  // observation and invent a signup out of a routine webhook.
  rebuildDailyMetrics({ windowDays: 5 });
  const rows = rowsByDay();
  assert.equal(rows.get(dayOf(3))!.paidStarts, 0);
  assert.equal(rows.get(dayOf(3))!.trialStarts, 0);
  // Days outside the write window are left exactly as they were.
  assert.equal(rows.get(dayOf(10))!.trialStarts, 1);
});

test('imported history older than the first user still materializes', () => {
  // A Search Console backfill reaches ~16 months, usually past the first
  // account. Without those days in daily_metrics the panel's LEFT JOIN would
  // drop them and the earliest imported history would be invisible.
  importExternalMetrics([{ day: '2025-01-15', googleClicks: 5, googleImpressions: 90 }]);
  rebuildDailyMetrics();
  const row = db
    .prepare('SELECT day, registrations FROM daily_metrics WHERE day = ?')
    .get('2025-01-15') as { day: string; registrations: number } | undefined;
  assert.ok(row, 'the imported day is materialized');
  assert.equal(row!.registrations, 0);
  // …and it comes back through the joined read.
  const joined = getDailyMetricRows({ days: 730 }).find((r) => r.day === '2025-01-15');
  assert.equal(joined?.googleClicks, 5);
});

test('rebuilding twice changes nothing', () => {
  const before = getDailyMetricRows({ days: 30 });
  rebuildDailyMetrics();
  assert.deepEqual(getDailyMetricRows({ days: 30 }), before);
});

test('a day past page-view retention keeps the totals it captured', () => {
  // The raw rows are gone by then, so a recompute would legitimately read 0 —
  // and writing that would erase the only surviving record of that traffic.
  const prunedDay = dayOf(PAGE_VIEW_RETENTION_DAYS + 120);
  db.prepare(
    `INSERT INTO daily_metrics (day, trial_starts, paid_starts, cancels, payment_failures,
       registrations, unique_users, pageviews, pageviews_authoritative, computed_at)
     VALUES (?, 0, 0, 0, 0, 0, 7, 99, 1, ?)
     ON CONFLICT(day) DO UPDATE SET unique_users = 7, pageviews = 99, pageviews_authoritative = 1`,
  ).run(prunedDay, new Date().toISOString());

  rebuildDailyMetrics();

  const preserved = db
    .prepare('SELECT pageviews, unique_users FROM daily_metrics WHERE day = ?')
    .get(prunedDay) as { pageviews: number; unique_users: number };
  assert.equal(preserved.pageviews, 99);
  assert.equal(preserved.unique_users, 7);
});

test('importing one source never blanks another source’s columns', () => {
  importExternalMetrics([
    { day: dayOf(10), xImpressions: 5000, xProfileVisits: 120 },
    { day: dayOf(9), xImpressions: 1200 },
  ]);
  importExternalMetrics([{ day: dayOf(10), googleClicks: 14, googleImpressions: 300 }]);

  const rows = rowsByDay();
  const merged = rows.get(dayOf(10))!;
  assert.equal(merged.xImpressions, 5000, 'the Google import must not clear the X columns');
  assert.equal(merged.googleClicks, 14);
  // A field that has never been imported stays NULL rather than becoming 0.
  assert.equal(rows.get(dayOf(9))!.xProfileVisits, null);
});

test('re-importing a corrected export overwrites only what it carries', () => {
  importExternalMetrics([{ day: dayOf(10), xImpressions: 5100 }]);
  const merged = rowsByDay().get(dayOf(10))!;
  assert.equal(merged.xImpressions, 5100);
  assert.equal(merged.xProfileVisits, 120);
  assert.equal(merged.googleClicks, 14);
});

test('daily_metrics_view yields exactly one row per day, joined both ways', () => {
  const joined = db
    .prepare('SELECT * FROM daily_metrics_view WHERE day = ?')
    .all(dayOf(10)) as Array<Record<string, unknown>>;
  assert.equal(joined.length, 1);
  assert.equal(Number(joined[0].trial_starts), 1);
  assert.equal(Number(joined[0].x_impressions), 5100);

  // A day that exists ONLY in the external table still appears, exactly once.
  importExternalMetrics([{ day: '2019-01-02', googleClicks: 3 }]);
  const external = db
    .prepare('SELECT * FROM daily_metrics_view WHERE day = ?')
    .all('2019-01-02') as Array<Record<string, unknown>>;
  assert.equal(external.length, 1);
  assert.equal(Number(external[0].google_clicks), 3);
});

test('the snapshot carries the four relationships and their full lag profiles', () => {
  const snapshot = buildDailySignalsSnapshot({ days: 30 });
  assert.deepEqual(snapshot.relationships.map((r) => r.id), [
    'x-impressions-to-trials',
    'x-profile-visits-to-trials',
    'google-clicks-to-trials',
    'trials-to-payment-failures',
  ]);
  assert.ok(snapshot.relationships.every((r) => r.lags.length === 15), 'lags 0…14 inclusive');
  assert.equal(
    snapshot.relationships.find((r) => r.id === 'trials-to-payment-failures')!.highlightLags[0],
    7,
  );
  assert.equal(snapshot.externalMetricsEmpty, false);
});

test('coverage counts only the days a column actually has a value for', () => {
  const snapshot = buildDailySignalsSnapshot({ days: 30 });
  const coverage = (key: string) => snapshot.coverage.find((c) => c.key === key)!;
  assert.equal(coverage('xImpressions').days, 2);
  assert.equal(coverage('xImpressions').total, 5100 + 1200);
  assert.equal(coverage('xProfileVisits').days, 1);
  assert.equal(coverage('trialStarts').total, 2);
  assert.equal(coverage('registrations').total, 3);
});

// core/dailyMetrics.ts restates page_view_events' retention horizon rather than
// importing it (core/pageAnalytics.ts is `server-only` and uses "@/" specifiers,
// neither of which loads in the backfill script's bare-Node loader). The drift
// that would actually hurt is a copy LARGER than the real retention: the rollup
// would then treat a pruned-out day as recomputable and overwrite the only
// surviving record of that day's traffic with zero.
test('the page-view retention horizon matches core/pageAnalytics.ts', () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, '..', 'core', 'pageAnalytics.ts'),
    'utf8',
  );
  const declared = /export const RETENTION_DAYS = (\d+);/.exec(source);
  assert.ok(declared, 'could not find RETENTION_DAYS in core/pageAnalytics.ts');
  assert.equal(
    PAGE_VIEW_RETENTION_DAYS,
    Number(declared[1]),
    'core/dailyMetrics.ts PAGE_VIEW_RETENTION_DAYS has drifted from core/pageAnalytics.ts RETENTION_DAYS',
  );
});

test.after(() => {
  fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
});
