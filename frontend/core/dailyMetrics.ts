// Deliberately NOT marked `server-only`, unlike its neighbours: this module is
// also loaded directly by scripts/backfill-daily-metrics.mts under bare Node,
// where that guard throws. Its imports are relative for the same reason — the
// "@/" alias is a bundler feature the script's loader doesn't have. It is still
// server code (it opens the SQLite DB through ./db.ts); a client component that
// imported it would fail the build on node:sqlite.
import { getDb } from './db.ts';
import {
  MIN_CORRELATION_N,
  classifyCorrelation,
  coefficientOfVariation,
  etDayKey,
  lagProfile,
  rollingMean,
  weekdayAnalysis,
  type CorrelationStrength,
  type LagPoint,
  type WeekdayAnalysis,
} from './dailyMetricsMath.ts';
import type { ExternalMetricRow } from './dailyMetricsCsv.ts';
import { isSearchConsoleConfigured } from './searchConsole.ts';

// One row per ET calendar day, joining what the product does (trial starts,
// cancels, payment failures, registrations, traffic) to what brought people to
// it (X impressions and profile visits, Google Search clicks) — the fact table
// the admin "Daily Signals" panel reads.
//
// Everything except the two off-platform feeds is DERIVED, so the table is a
// cache that `rebuildDailyMetrics()` can reconstruct from the append-only
// sources at any time; that is what makes a same-day backfill of the entire
// history possible rather than starting a fresh collection from zero.
//
// Column definitions are deliberately the SAME ones the rest of the admin
// dashboard already uses, so a number here reconciles with the chart next door:
//
//   trial_starts     A subscription's FIRST observed paid-tier sync whose
//                    Stripe status is `trialing` — the day the free trial
//                    began. Keyed by subscription id, so a member who trials
//                    twice (cancel, then re-subscribe) counts twice, and a
//                    webhook redelivery counts once.
//   paid_starts      The same first-paid-tier-sync moment when the status is
//                    anything BUT trialing: a checkout that skipped the trial
//                    (the hasPriorPaid path). Together with trial_starts this
//                    is the "signups" line core/monitoring.ts's growth rates
//                    already count, split by whether money moved on day one.
//   cancels          `stripe_cancellation_requested` / `cancellation_ack_
//                    email_sent`, deduped per member per day — the day the
//                    member CLICKED cancel, not the later access drop. That is
//                    the decision moment, which is what a day-of-week effect
//                    would live in.
//   payment_failures `stripe_payment_failed (attempt 1)`, deduped per invoice —
//                    the first decline of an invoice, not each Smart Retry.
//   registrations    New rows in `users`, by created_at. One row per account,
//                    so it cannot double-count the way an audit stream can.
//   pageviews /      From page_view_events. NULL before the beacon shipped.
//   unique_users     unique_users is COUNT(DISTINCT user_id) — logged-in only,
//                    since anonymous visits have no stable id.
//
// All bucketing is on the America/New_York day, matching every other chart on
// the admin page (see etDayKey), so a "day" here is the same day there.

const DAY_MS = 86_400_000;

/** How far back a rebuild reaches. ~2.5y, comfortably older than the product. */
export const REBUILD_WINDOW_DAYS = 900;

/** Longest window the admin panel will serve in one response. */
export const MAX_SERIES_DAYS = 730;

/**
 * Mirrors core/pageAnalytics.ts's RETENTION_DAYS — how long raw page_view_events
 * rows survive before the pruner deletes them. Restated here rather than
 * imported because core/pageAnalytics.ts is `server-only` and uses "@/" imports,
 * neither of which resolves in the backfill script's bare-Node loader.
 * tests/dailyMetrics.test.ts reads that file and fails if the two ever drift,
 * which is the case that matters: a value LARGER than the real retention would
 * let a post-prune recompute overwrite captured history with zeros.
 */
export const PAGE_VIEW_RETENTION_DAYS = 180;

/**
 * A day is only a fair page-view sample once it sits fully inside the
 * page_view_events retention horizon; one day of headroom keeps the boundary
 * day (which the pruner is actively eating) from being written as a real count.
 */
const PAGE_VIEW_SAFE_DAYS = PAGE_VIEW_RETENTION_DAYS - 1;

/**
 * Rebuilds are idempotent and cheap-ish, but the admin page polls every 60s and
 * several panels can mount at once; recompute at most this often per process.
 */
const REBUILD_THROTTLE_MS = 5 * 60_000;

let lastRebuildAtMs = 0;

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export type DailyMetricRow = {
  day: string;
  trialStarts: number;
  paidStarts: number;
  cancels: number;
  paymentFailures: number;
  registrations: number;
  uniqueUsers: number | null;
  pageviews: number | null;
  xImpressions: number | null;
  xProfileVisits: number | null;
  googleClicks: number | null;
  googleImpressions: number | null;
};

/** Keys of DailyMetricRow that carry a numeric series. */
export type MetricKey = Exclude<keyof DailyMetricRow, 'day'>;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * audit_events / users timestamps are written by nowIso() as real ISO instants,
 * but older rows (and anything written through SQLite's datetime()) can be
 * "YYYY-MM-DD HH:MM:SS" with no zone marker — which IS UTC but which Date()
 * reads as local. Normalize before bucketing so a deploy in a non-UTC container
 * can't shift a day's counts.
 */
function toIsoInstant(createdAt: string): string {
  const trimmed = createdAt.trim();
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed.replace(' ', 'T')}Z`;
}

function etDayOf(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(toIsoInstant(createdAt));
  if (Number.isNaN(d.getTime())) return null;
  return etDayKey(d);
}

/** ET day key for a UTC hour bucket string ("YYYY-MM-DDTHH" or "… HH"). */
function etDayOfHourBucket(hourBucket: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2})$/.exec(hourBucket.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:30:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return etDayKey(d);
}

function parseSubId(message: string): string | null {
  const m = message.match(/sub_[A-Za-z0-9]+/);
  return m ? m[0] : null;
}

function parseSyncStatus(message: string): string | null {
  const m = message.match(/\bstatus=([A-Za-z_]+)/);
  return m ? m[1] : null;
}

/** 'pro' | 'basic' are paid; anything else (incl. 'public') is not. */
function parsePaidTier(message: string): string | null {
  const m = message.match(/\btier=(\w+)/);
  if (!m) return null;
  const tier = m[1];
  return tier === 'pro' || tier === 'basic' ? tier : null;
}

function dayKeysBack(now: Date, count: number): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const day = etDayKey(new Date(now.getTime() - i * DAY_MS));
    if (!seen.has(day)) {
      seen.add(day);
      keys.push(day);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Rebuild
// ---------------------------------------------------------------------------

type DerivedCounts = {
  trialStarts: number;
  paidStarts: number;
  cancels: number;
  paymentFailures: number;
  registrations: number;
};

function emptyCounts(): DerivedCounts {
  return { trialStarts: 0, paidStarts: 0, cancels: 0, paymentFailures: 0, registrations: 0 };
}

/**
 * The earliest day the rollup has anything to say about — the first account, the
 * first audit row, the first recorded visit, or the earliest imported X/Google
 * day, whichever came first. Returns null only for a genuinely empty database,
 * where the right number of rows to materialize is zero rather than a window of
 * fabricated ones.
 *
 * The imported day matters as much as the other three: a Search Console backfill
 * reaches sixteen months back, usually further than the product's first user,
 * and without those days in `daily_metrics` the LEFT JOIN the panel reads would
 * silently drop the earliest imported history.
 */
function earliestSourceDay(db: ReturnType<typeof getDb>): string | null {
  const candidates: Array<string | null> = [];
  for (const sql of [
    'SELECT MIN(created_at) AS first_at FROM users',
    'SELECT MIN(created_at) AS first_at FROM audit_events',
    'SELECT MIN(created_at) AS first_at FROM page_view_events',
  ]) {
    const row = db.prepare(sql).get() as { first_at: string | null } | undefined;
    candidates.push(etDayOf(row?.first_at ?? null));
  }
  // Already a day key rather than an instant, so it needs no bucketing.
  const importedRow = db
    .prepare('SELECT MIN(day) AS first_day FROM daily_external_metrics')
    .get() as { first_day: string | null } | undefined;
  const imported = importedRow?.first_day ?? null;
  if (imported && /^\d{4}-\d{2}-\d{2}$/.test(imported)) candidates.push(imported);

  const present = candidates.filter((d): d is string => d !== null);
  if (present.length === 0) return null;
  return present.reduce((min, d) => (d < min ? d : min));
}

export type RebuildResult = {
  daysWritten: number;
  firstDay: string | null;
  lastDay: string | null;
  /** Earliest day page_view_events still holds, or null when it is empty. */
  pageViewsFrom: string | null;
  durationMs: number;
};

/**
 * Recompute the derived columns for the trailing `windowDays` and upsert them.
 *
 * The subscription scan deliberately reaches back over ALL retained history,
 * not just `windowDays`, and walks it oldest-first: "the FIRST paid sync for
 * this subscription" is only first if nothing earlier was missed. Scanning only
 * the write window would re-book a long-standing subscriber as a brand-new
 * trial start on its next routine sync, so a `DAYS=30` rebuild would invent
 * signups that never happened. Bookings still land only inside the window.
 *
 * Page-view columns are written only for days inside the retention horizon.
 * Outside it the recompute would legitimately read 0 (the rows are pruned), and
 * writing that would erase the only surviving record of that day's traffic, so
 * the upsert leaves the stored value alone instead.
 */
export function rebuildDailyMetrics(opts: { windowDays?: number } = {}): RebuildResult {
  const startedAt = Date.now();
  const now = new Date();
  const windowDays = Math.max(1, Math.min(REBUILD_WINDOW_DAYS, opts.windowDays ?? REBUILD_WINDOW_DAYS));
  const db = getDb();

  // Start the axis at the product's first day of life, not at the window's far
  // edge. Materializing the 800-odd days before anything existed would fill the
  // table with fabricated zeros, and a zero that means "we did not exist yet" is
  // exactly the kind of value that turns a correlation into an artifact.
  const originDay = earliestSourceDay(db);
  // An empty database gets an empty table, not a window of zeros that would
  // read as "we existed and nothing happened".
  const days = originDay === null ? [] : dayKeysBack(now, windowDays).filter((day) => day >= originDay);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const acc = new Map<string, DerivedCounts>();
  for (const day of days) acc.set(day, emptyCounts());

  // ── Subscription starts ───────────────────────────────────────────────────
  // Full history, oldest-first, so the first paid-tier observation of each
  // subscription is genuinely its first even when only a short window is being
  // written. Status at that moment decides trial vs. direct paid; a first
  // observation older than the write window is simply not booked anywhere.
  const syncRows = db
    .prepare(
      `SELECT created_at, message FROM audit_events
        WHERE type = 'stripe_subscription_sync'
          AND created_at > datetime('now', '-${REBUILD_WINDOW_DAYS} days')
        ORDER BY created_at ASC`,
    )
    .all() as Array<{ created_at: string; message: string }>;

  const seenSubscriptions = new Set<string>();
  for (const row of syncRows) {
    const subId = parseSubId(row.message);
    if (!subId || seenSubscriptions.has(subId)) continue;
    if (!parsePaidTier(row.message)) continue; // not yet a paid state — keep looking
    seenSubscriptions.add(subId);
    const day = etDayOf(row.created_at);
    const bucket = day ? acc.get(day) : undefined;
    if (!bucket) continue;
    if (parseSyncStatus(row.message) === 'trialing') bucket.trialStarts += 1;
    else bucket.paidStarts += 1;
  }

  // ── Cancels + payment failures ────────────────────────────────────────────
  // Both streams are deduped the way core/monitoring.ts's growth rates dedupe
  // them: a cancel click emits both a request row and an ack-email row, and one
  // declined invoice emits a row per Smart Retry.
  const churnRows = db
    .prepare(
      `SELECT type, user_id, created_at, message FROM audit_events
        WHERE type IN ('stripe_cancellation_requested', 'cancellation_ack_email_sent', 'stripe_payment_failed')
          AND created_at > datetime('now', '-${windowDays} days')`,
    )
    .all() as Array<{ type: string; user_id: string | null; created_at: string; message: string }>;

  const cancelKeys = new Set<string>();
  const failureKeys = new Set<string>();
  for (const row of churnRows) {
    const day = etDayOf(row.created_at);
    if (!day || !acc.has(day)) continue;
    if (row.type === 'stripe_payment_failed') {
      if (!/\(attempt 1\)/.test(row.message)) continue;
      const invoice = row.message.match(/Invoice (in_[A-Za-z0-9]+)/)?.[1] ?? row.message;
      failureKeys.add(`${day}:${invoice}`);
    } else {
      cancelKeys.add(`${day}:${row.user_id ?? parseSubId(row.message) ?? row.message}`);
    }
  }
  for (const key of cancelKeys) {
    const day = key.slice(0, 10);
    const bucket = acc.get(day);
    if (bucket) bucket.cancels += 1;
  }
  for (const key of failureKeys) {
    const day = key.slice(0, 10);
    const bucket = acc.get(day);
    if (bucket) bucket.paymentFailures += 1;
  }

  // ── Registrations ─────────────────────────────────────────────────────────
  const userRows = db
    .prepare(
      `SELECT created_at FROM users WHERE created_at > datetime('now', '-${windowDays} days')`,
    )
    .all() as Array<{ created_at: string }>;
  for (const row of userRows) {
    const day = etDayOf(row.created_at);
    const bucket = day ? acc.get(day) : undefined;
    if (bucket) bucket.registrations += 1;
  }

  // ── Traffic ───────────────────────────────────────────────────────────────
  // Aggregated by UTC hour in SQL, then folded onto ET days in JS. Grouping
  // straight to a day in SQL would need a fixed UTC offset, which is wrong for
  // half the year; grouping by hour is DST-safe and still collapses the table
  // to a few thousand rows. Unique users can't be summed across hours, so that
  // query returns distinct (hour, user) pairs and the fold does the counting.
  const pageviewsByDay = new Map<string, number>();
  const usersByDay = new Map<string, Set<string>>();
  let pageViewsFrom: string | null = null;

  const firstVisitRow = db
    .prepare('SELECT MIN(created_at) AS first_at FROM page_view_events')
    .get() as { first_at: string | null } | undefined;
  pageViewsFrom = etDayOf(firstVisitRow?.first_at ?? null);

  if (pageViewsFrom) {
    const hourRows = db
      .prepare(
        `SELECT substr(created_at, 1, 13) AS h, COUNT(*) AS c
           FROM page_view_events
          GROUP BY h`,
      )
      .all() as Array<{ h: string; c: number }>;
    for (const row of hourRows) {
      const day = etDayOfHourBucket(row.h);
      if (!day) continue;
      pageviewsByDay.set(day, (pageviewsByDay.get(day) ?? 0) + (Number(row.c) || 0));
    }

    const userHourRows = db
      .prepare(
        `SELECT substr(created_at, 1, 13) AS h, user_id
           FROM page_view_events
          WHERE user_id IS NOT NULL
          GROUP BY h, user_id`,
      )
      .all() as Array<{ h: string; user_id: string }>;
    for (const row of userHourRows) {
      const day = etDayOfHourBucket(row.h);
      if (!day) continue;
      let set = usersByDay.get(day);
      if (!set) {
        set = new Set<string>();
        usersByDay.set(day, set);
      }
      set.add(row.user_id);
    }
  }

  const safeFrom = etDayKey(new Date(now.getTime() - PAGE_VIEW_SAFE_DAYS * DAY_MS));

  // ── Upsert ────────────────────────────────────────────────────────────────
  const upsert = db.prepare(
    `INSERT INTO daily_metrics
       (day, trial_starts, paid_starts, cancels, payment_failures, registrations,
        unique_users, pageviews, pageviews_authoritative, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       trial_starts = excluded.trial_starts,
       paid_starts = excluded.paid_starts,
       cancels = excluded.cancels,
       payment_failures = excluded.payment_failures,
       registrations = excluded.registrations,
       unique_users = CASE WHEN excluded.pageviews_authoritative = 1
                           THEN excluded.unique_users ELSE daily_metrics.unique_users END,
       pageviews = CASE WHEN excluded.pageviews_authoritative = 1
                        THEN excluded.pageviews ELSE daily_metrics.pageviews END,
       pageviews_authoritative = CASE WHEN excluded.pageviews_authoritative = 1
                                      THEN 1 ELSE daily_metrics.pageviews_authoritative END,
       computed_at = excluded.computed_at`,
  );

  const computedAt = now.toISOString();
  db.exec('BEGIN');
  try {
    for (const day of days) {
      const counts = acc.get(day) ?? emptyCounts();
      // Authoritative = page_view_events can still answer for this day: it is
      // at/after the first visit ever recorded, and not yet eaten by the pruner.
      const authoritative = pageViewsFrom !== null && day >= pageViewsFrom && day >= safeFrom;
      upsert.run(
        day,
        counts.trialStarts,
        counts.paidStarts,
        counts.cancels,
        counts.paymentFailures,
        counts.registrations,
        authoritative ? (usersByDay.get(day)?.size ?? 0) : null,
        authoritative ? (pageviewsByDay.get(day) ?? 0) : null,
        authoritative ? 1 : 0,
        computedAt,
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  lastRebuildAtMs = Date.now();
  return {
    daysWritten: days.length,
    firstDay: firstDay ?? null,
    lastDay: lastDay ?? null,
    pageViewsFrom,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Refresh the rollup unless a recent rebuild already did. Swallows failures on
 * purpose: a stale panel is better than a 500 on the admin dashboard, and the
 * next poll retries.
 */
export function refreshDailyMetrics(opts: { force?: boolean; windowDays?: number } = {}): void {
  if (!opts.force && Date.now() - lastRebuildAtMs < REBUILD_THROTTLE_MS) return;
  try {
    rebuildDailyMetrics({ windowDays: opts.windowDays });
  } catch {
    // Leave lastRebuildAtMs untouched so the next request retries rather than
    // waiting out the throttle on a failed rebuild.
  }
}

// ---------------------------------------------------------------------------
// External metric import
// ---------------------------------------------------------------------------

export type ImportResult = {
  daysWritten: number;
  firstDay: string | null;
  lastDay: string | null;
};

/**
 * Upsert imported X / Google numbers. A field absent from the import is left
 * untouched (COALESCE against the incoming NULL), so importing a Search Console
 * export can never blank the X columns for the same days, and re-importing a
 * corrected export overwrites only what it actually carries.
 */
export function importExternalMetrics(rows: ReadonlyArray<ExternalMetricRow>): ImportResult {
  if (rows.length === 0) return { daysWritten: 0, firstDay: null, lastDay: null };
  const db = getDb();
  const updatedAt = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO daily_external_metrics
       (day, x_impressions, x_profile_visits, google_clicks, google_impressions, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       x_impressions = COALESCE(excluded.x_impressions, daily_external_metrics.x_impressions),
       x_profile_visits = COALESCE(excluded.x_profile_visits, daily_external_metrics.x_profile_visits),
       google_clicks = COALESCE(excluded.google_clicks, daily_external_metrics.google_clicks),
       google_impressions = COALESCE(excluded.google_impressions, daily_external_metrics.google_impressions),
       updated_at = excluded.updated_at`,
  );

  const sorted = [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  db.exec('BEGIN');
  try {
    for (const row of sorted) {
      upsert.run(
        row.day,
        row.xImpressions ?? null,
        row.xProfileVisits ?? null,
        row.googleClicks ?? null,
        row.googleImpressions ?? null,
        updatedAt,
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return {
    daysWritten: sorted.length,
    firstDay: sorted[0]?.day ?? null,
    lastDay: sorted[sorted.length - 1]?.day ?? null,
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The materialized series, oldest first, trimmed to the last `days` calendar
 * days. Reads the same LEFT JOIN the `daily_metrics_view` SQL view exposes for
 * ad-hoc querying — kept as an explicit query here so the column list and the
 * TypeScript row type are visibly the same thing.
 */
export function getDailyMetricRows(opts: { days?: number } = {}): DailyMetricRow[] {
  const days = Math.max(1, Math.min(MAX_SERIES_DAYS, opts.days ?? 90));
  const since = etDayKey(new Date(Date.now() - (days - 1) * DAY_MS));
  const rows = getDb()
    .prepare(
      `SELECT d.day AS day,
              d.trial_starts AS trialStarts,
              d.paid_starts AS paidStarts,
              d.cancels AS cancels,
              d.payment_failures AS paymentFailures,
              d.registrations AS registrations,
              d.unique_users AS uniqueUsers,
              d.pageviews AS pageviews,
              x.x_impressions AS xImpressions,
              x.x_profile_visits AS xProfileVisits,
              x.google_clicks AS googleClicks,
              x.google_impressions AS googleImpressions
         FROM daily_metrics d
         LEFT JOIN daily_external_metrics x ON x.day = d.day
        WHERE d.day >= ?
        ORDER BY d.day ASC`,
    )
    .all(since) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    day: String(r.day),
    trialStarts: toNumber(r.trialStarts),
    paidStarts: toNumber(r.paidStarts),
    cancels: toNumber(r.cancels),
    paymentFailures: toNumber(r.paymentFailures),
    registrations: toNumber(r.registrations),
    uniqueUsers: toNullableNumber(r.uniqueUsers),
    pageviews: toNullableNumber(r.pageviews),
    xImpressions: toNullableNumber(r.xImpressions),
    xProfileVisits: toNullableNumber(r.xProfileVisits),
    googleClicks: toNullableNumber(r.googleClicks),
    googleImpressions: toNullableNumber(r.googleImpressions),
  }));
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export type RelationshipId =
  | 'x-impressions-to-trials'
  | 'x-profile-visits-to-trials'
  | 'google-clicks-to-trials'
  | 'trials-to-payment-failures';

export type RelationshipTest = {
  id: RelationshipId;
  title: string;
  /** What is being tested, in one sentence, for the card header. */
  hypothesis: string;
  driverLabel: string;
  outcomeLabel: string;
  /** The same two labels, phrased for use inside a sentence. */
  driverPhrase: string;
  outcomePhrase: string;
  /**
   * The lags stated up front — the pre-registered hypothesis. Reported
   * separately from `best` because picking the strongest of fifteen lags after
   * the fact is a different (and much weaker) claim than testing the one you
   * named in advance.
   */
  highlightLags: number[];
  lags: LagPoint[];
  highlights: Array<LagPoint & { strength: CorrelationStrength }>;
  /**
   * Strongest |r| among the lags that still have MIN_CORRELATION_N paired days.
   * Exploratory — it is the maximum of fifteen tries, so label it as such
   * wherever it is shown.
   */
  best: (LagPoint & { strength: CorrelationStrength }) | null;
  /** Days on which the driver has any value at all; 0 means "never imported". */
  driverDays: number;
};

export type WeekdayMetric = {
  key: MetricKey;
  label: string;
  analysis: WeekdayAnalysis;
};

export type VolatilityRow = {
  key: MetricKey;
  label: string;
  /** Coefficient of variation of the raw daily series. */
  raw: number | null;
  /** …and of its 7-day trailing mean. The gap is the "it's just noise" answer. */
  smoothed: number | null;
  mean: number | null;
};

export type CoverageRow = {
  key: MetricKey;
  label: string;
  days: number;
  firstDay: string | null;
  lastDay: string | null;
  total: number | null;
};

export type DailySignalsSnapshot = {
  generatedAt: string;
  windowDays: number;
  rows: DailyMetricRow[];
  coverage: CoverageRow[];
  relationships: RelationshipTest[];
  weekday: WeekdayMetric[];
  volatility: VolatilityRow[];
  /** Earliest day the page-view columns can still be recomputed for. */
  pageViewRetentionDays: number;
  /** True when neither X nor Google has ever been imported. */
  externalMetricsEmpty: boolean;
  /** True when Search Console credentials are configured, so a sync can run. */
  googleSyncConfigured: boolean;
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  trialStarts: 'Trial starts',
  paidStarts: 'Paid starts',
  cancels: 'Cancels',
  paymentFailures: 'Payment failures',
  registrations: 'Registrations',
  uniqueUsers: 'Unique users',
  pageviews: 'Pageviews',
  xImpressions: 'X impressions',
  xProfileVisits: 'X profile visits',
  googleClicks: 'Google clicks',
  googleImpressions: 'Google impressions',
};

/**
 * The same labels as they should read INSIDE a sentence. Distinct from
 * METRIC_LABELS, which are headings: lowercasing a heading is right for "trial
 * starts" and wrong for "X impressions" or "Google clicks", where the capital
 * is a product's name rather than sentence case.
 */
const SENTENCE_LABELS: Record<MetricKey, string> = {
  trialStarts: 'trial starts',
  paidStarts: 'paid starts',
  cancels: 'cancels',
  paymentFailures: 'payment failures',
  registrations: 'registrations',
  uniqueUsers: 'unique users',
  pageviews: 'pageviews',
  xImpressions: 'X impressions',
  xProfileVisits: 'X profile visits',
  googleClicks: 'Google clicks',
  googleImpressions: 'Google impressions',
};

/** How far a driver→outcome profile is scanned. Two weeks covers the 7-day trial. */
const MAX_LAG_DAYS = 14;

function series(rows: ReadonlyArray<DailyMetricRow>, key: MetricKey): Array<number | null> {
  return rows.map((r) => r[key]);
}

function countPresent(values: ReadonlyArray<number | null>): number {
  return values.reduce<number>((n, v) => (typeof v === 'number' ? n + 1 : n), 0);
}

function buildRelationship(
  rows: ReadonlyArray<DailyMetricRow>,
  spec: {
    id: RelationshipId;
    title: string;
    hypothesis: string;
    driver: MetricKey;
    outcome: MetricKey;
    highlightLags: number[];
    maxLag?: number;
  },
): RelationshipTest {
  const driver = series(rows, spec.driver);
  const outcome = series(rows, spec.outcome);
  const lags = lagProfile(driver, outcome, spec.maxLag ?? MAX_LAG_DAYS);
  const withStrength = (point: LagPoint) => ({ ...point, strength: classifyCorrelation(point) });
  // Only lags with a usable sample compete for "strongest". Without the floor
  // the winner is reliably the longest lag, where the shift has eaten the series
  // down to three or four pairs and |r| approaches 1 for free.
  let best: LagPoint | null = null;
  for (const point of lags) {
    if (point.r === null || point.n < MIN_CORRELATION_N) continue;
    if (!best || best.r === null || Math.abs(point.r) > Math.abs(best.r)) best = point;
  }
  return {
    id: spec.id,
    title: spec.title,
    hypothesis: spec.hypothesis,
    driverLabel: METRIC_LABELS[spec.driver],
    outcomeLabel: METRIC_LABELS[spec.outcome],
    driverPhrase: SENTENCE_LABELS[spec.driver],
    outcomePhrase: SENTENCE_LABELS[spec.outcome],
    highlightLags: spec.highlightLags,
    lags,
    highlights: spec.highlightLags
      .map((lag) => lags.find((l) => l.lag === lag))
      .filter((l): l is LagPoint => Boolean(l))
      .map(withStrength),
    best: best ? withStrength(best) : null,
    driverDays: countPresent(driver),
  };
}

const WEEKDAY_METRIC_KEYS: MetricKey[] = ['registrations', 'trialStarts', 'cancels', 'paymentFailures'];
const VOLATILITY_METRIC_KEYS: MetricKey[] = ['registrations', 'trialStarts', 'pageviews', 'xImpressions'];
const COVERAGE_KEYS: MetricKey[] = [
  'trialStarts',
  'paidStarts',
  'cancels',
  'paymentFailures',
  'registrations',
  'uniqueUsers',
  'pageviews',
  'xImpressions',
  'xProfileVisits',
  'googleClicks',
  'googleImpressions',
];

/**
 * The whole panel payload: the daily rows, what each column actually covers,
 * the four pre-registered relationships, the weekday breakdowns, and a
 * volatility readout that contrasts each raw series with its 7-day mean.
 */
export function buildDailySignalsSnapshot(opts: { days?: number } = {}): DailySignalsSnapshot {
  const windowDays = Math.max(7, Math.min(MAX_SERIES_DAYS, opts.days ?? 90));
  const rows = getDailyMetricRows({ days: windowDays });

  const coverage: CoverageRow[] = COVERAGE_KEYS.map((key) => {
    const values = series(rows, key);
    let firstDay: string | null = null;
    let lastDay: string | null = null;
    let total = 0;
    let days = 0;
    values.forEach((v, i) => {
      if (typeof v !== 'number') return;
      days += 1;
      total += v;
      if (firstDay === null) firstDay = rows[i].day;
      lastDay = rows[i].day;
    });
    return { key, label: METRIC_LABELS[key], days, firstDay, lastDay, total: days > 0 ? total : null };
  });

  const relationships: RelationshipTest[] = [
    buildRelationship(rows, {
      id: 'x-impressions-to-trials',
      title: 'X impressions → trial starts',
      hypothesis: 'A day with more X impressions produces more trial starts that day or the next.',
      driver: 'xImpressions',
      outcome: 'trialStarts',
      highlightLags: [0, 1],
    }),
    buildRelationship(rows, {
      id: 'x-profile-visits-to-trials',
      title: 'X profile visits → trial starts',
      hypothesis: 'Profile visits are closer to intent than impressions, so they should track trial starts at least as well.',
      driver: 'xProfileVisits',
      outcome: 'trialStarts',
      highlightLags: [0, 1],
    }),
    buildRelationship(rows, {
      id: 'google-clicks-to-trials',
      title: 'Google clicks → trial starts',
      hypothesis: 'Search clicks convert to trials on the same day or the next.',
      driver: 'googleClicks',
      outcome: 'trialStarts',
      highlightLags: [0, 1],
    }),
    buildRelationship(rows, {
      id: 'trials-to-payment-failures',
      title: 'Trial starts → payment failures 7 days later',
      hypothesis: 'A 7-day trial cohort converts (or declines) exactly 7 days after it started, so payment failures should echo trial starts at lag 7.',
      driver: 'trialStarts',
      outcome: 'paymentFailures',
      highlightLags: [7],
    }),
  ];

  const weekday: WeekdayMetric[] = WEEKDAY_METRIC_KEYS.map((key) => ({
    key,
    label: METRIC_LABELS[key],
    analysis: weekdayAnalysis(rows.map((r) => ({ day: r.day, value: r[key] }))),
  }));

  const volatility: VolatilityRow[] = VOLATILITY_METRIC_KEYS.map((key) => {
    const values = series(rows, key);
    const present = values.filter((v): v is number => typeof v === 'number');
    return {
      key,
      label: METRIC_LABELS[key],
      raw: coefficientOfVariation(values),
      smoothed: coefficientOfVariation(rollingMean(values, 7)),
      mean: present.length > 0 ? present.reduce((s, v) => s + v, 0) / present.length : null,
    };
  });

  const externalMetricsEmpty = !rows.some(
    (r) => r.xImpressions !== null || r.xProfileVisits !== null || r.googleClicks !== null,
  );

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    rows,
    coverage,
    relationships,
    weekday,
    volatility,
    pageViewRetentionDays: PAGE_VIEW_RETENTION_DAYS,
    externalMetricsEmpty,
    googleSyncConfigured: isSearchConsoleConfigured(),
  };
}
