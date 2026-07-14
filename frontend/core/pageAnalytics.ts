import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/core/db';
import { resolveUserIdFromCookie } from '@/core/monitoring';
import {
  buildRouteMatchers,
  dirToRouteTemplate,
  normalizePagePath,
  type RouteMatcher,
} from '@/core/pageAnalyticsPaths';

// Server-side record + aggregation layer for first-party per-page analytics.
// The pure path logic lives in core/pageAnalyticsPaths.ts (unit-tested); this
// module owns the side-effecting parts: discovering the app's real route
// templates off the filesystem, writing visit rows, pruning, and building the
// admin snapshot. Persisted to the same SQLite auth DB via getDb(), so unlike
// the in-memory traffic monitor (core/monitoring.ts) this data survives
// restarts and is queryable with exact COUNT(DISTINCT).

/** Longest window the admin dashboard can request, and the retention horizon. */
export const RETENTION_DAYS = 180;
/** Cap on a single visit's recorded active time (30 min) — a guard against a
 *  pinned foreground tab inflating "time spent"; also enforced at the edge. */
export const MAX_VISIT_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Route-template discovery (cached). Walk app/ once for page files and turn
// each containing directory into its URL template, so concrete permalinks
// collapse to /scorecard/[symbol]/[date] etc. Falls back to an empty matcher
// set (heuristic-only normalization) if the source tree isn't readable.
// ---------------------------------------------------------------------------

let cachedMatchers: RouteMatcher[] | null = null;
const PAGE_FILE_RE = /^page\.(tsx|ts|jsx|js|mdx)$/;

function collectRouteTemplates(appDir: string): string[] {
  const templates: string[] = [];
  const walk = (absDir: string, relDir: string, depth: number) => {
    if (depth > 12) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (entry.isFile() && PAGE_FILE_RE.test(name)) {
        templates.push(dirToRouteTemplate(relDir));
      } else if (entry.isDirectory()) {
        // API routes are not pages; skip private (_) and hidden (.) folders.
        if (relDir === '' && name === 'api') continue;
        if (name.startsWith('_') || name.startsWith('.') || name === 'node_modules') continue;
        walk(path.join(absDir, name), relDir === '' ? name : `${relDir}/${name}`, depth + 1);
      }
    }
  };
  walk(appDir, '', 0);
  return templates;
}

function getMatchers(): RouteMatcher[] {
  if (cachedMatchers) return cachedMatchers;
  let templates: string[] = [];
  try {
    templates = collectRouteTemplates(path.join(process.cwd(), 'app'));
  } catch {
    templates = [];
  }
  cachedMatchers = buildRouteMatchers(templates);
  return cachedMatchers;
}

/** Normalize a concrete client pathname to a stored route template, or null. */
export function normalizeToTemplate(rawPath: unknown): string | null {
  return normalizePagePath(rawPath, getMatchers());
}

// ---------------------------------------------------------------------------
// Visitor attribution. userId comes from the session cookie via the monitor's
// already-cached resolver (never trust a client-sent id — it's spoofable);
// tier is a cheap PK lookup layered with its own short cache.
// ---------------------------------------------------------------------------

const tierCache = new Map<string, { tier: string | null; expiresAt: number }>();
const TIER_CACHE_TTL_MS = 60_000;
const TIER_CACHE_MAX = 10_000;

export function resolveVisitor(sessionCookie: string | null | undefined): {
  userId: string | null;
  tier: string | null;
} {
  const userId = resolveUserIdFromCookie(sessionCookie ?? null);
  if (!userId) return { userId: null, tier: null };
  const now = Date.now();
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > now) return { userId, tier: cached.tier };
  let tier: string | null = null;
  try {
    const row = getDb().prepare('SELECT tier FROM users WHERE id = ?').get(userId) as
      | { tier?: string }
      | undefined;
    tier = row?.tier ?? null;
  } catch {
    tier = null;
  }
  tierCache.set(userId, { tier, expiresAt: now + TIER_CACHE_TTL_MS });
  if (tierCache.size > TIER_CACHE_MAX) {
    const oldest = tierCache.keys().next().value;
    if (oldest !== undefined) tierCache.delete(oldest);
  }
  return { userId, tier };
}

// ---------------------------------------------------------------------------
// Writes. Retention is enforced opportunistically off a write counter so the
// table stays bounded even if the admin dashboard is never opened (the read
// path also prunes). No timers here — route handlers are request-scoped.
// ---------------------------------------------------------------------------

let writesSincePrune = 0;
const PRUNE_EVERY_WRITES = 5000;

function maybePrune(): void {
  writesSincePrune += 1;
  if (writesSincePrune < PRUNE_EVERY_WRITES) return;
  writesSincePrune = 0;
  pruneOldEvents();
}

export function pruneOldEvents(): void {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString();
    getDb().prepare('DELETE FROM page_view_events WHERE created_at < ?').run(cutoff);
  } catch {
    // Pruning is best-effort maintenance; never surface to the request.
  }
}

export type VisitInput = {
  visitId: string;
  path: string;
  userId: string | null;
  tier: string | null;
  durationMs?: number;
};

function clampDuration(ms: number | undefined): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(Math.round(ms), MAX_VISIT_MS);
}

/**
 * Phase 1 — record that a visit started. INSERT OR IGNORE keeps it idempotent
 * against duplicate/retried beacons (visit_id is UNIQUE). Guarantees the
 * access is counted even if the later exit beacon is dropped.
 */
export function recordPageEnter(input: VisitInput): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO page_view_events (visit_id, path, user_id, tier, duration_ms, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
    .run(input.visitId, input.path, input.userId, input.tier, now);
  maybePrune();
}

/**
 * Phase 2 — record the visit's active duration on the way out. Upsert so a
 * single exit beacon fully records a visit whose enter was lost, while
 * MAX(...) means repeated exits (visibilitychange checkpoints, then the final
 * pagehide) only ever ratchet the duration up, never double-count or shrink.
 */
export function recordPageExit(input: VisitInput): void {
  const now = new Date().toISOString();
  const duration = clampDuration(input.durationMs);
  getDb()
    .prepare(
      `INSERT INTO page_view_events (visit_id, path, user_id, tier, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(visit_id) DO UPDATE SET
         duration_ms = MAX(page_view_events.duration_ms, excluded.duration_ms)`,
    )
    .run(input.visitId, input.path, input.userId, input.tier, duration, now);
  maybePrune();
}

// ---------------------------------------------------------------------------
// Read / aggregation for the admin dashboard.
// ---------------------------------------------------------------------------

export type PageAnalyticsRow = {
  path: string;
  /** Total visits (accesses) in the window, anonymous + logged-in. */
  accesses: number;
  /** Distinct authenticated users (COUNT(DISTINCT user_id), NULLs excluded). */
  uniqueUsers: number;
  /** Visits attributed to a logged-in user. */
  loggedInAccesses: number;
  /** Mean active time over visits that recorded a duration (ms). */
  avgDurationMs: number;
  /** Total active time across the window (ms). */
  totalDurationMs: number;
  /** ISO timestamp of the most recent visit. */
  lastAccessAt: string | null;
};

export type PageAnalyticsSnapshot = {
  windowDays: number;
  generatedAt: string;
  retentionDays: number;
  totals: {
    accesses: number;
    uniqueUsers: number;
    loggedInAccesses: number;
    measuredVisits: number;
    totalDurationMs: number;
    avgDurationMs: number;
  };
  pages: PageAnalyticsRow[];
};

const ALLOWED_WINDOWS = [1, 7, 30, 90, RETENTION_DAYS];

export function normalizeWindowDays(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n)) return 7;
  // Snap to the nearest allowed window, clamped to the retention horizon.
  let best = ALLOWED_WINDOWS[0];
  for (const w of ALLOWED_WINDOWS) {
    if (Math.abs(w - n) < Math.abs(best - n)) best = w;
  }
  return Math.min(best, RETENTION_DAYS);
}

/**
 * Build the per-page engagement snapshot over the last `windowDays`. Prunes
 * expired rows first so the table can't grow without bound. Thresholds are
 * JS-computed ISO strings compared directly against the stored ISO `created_at`
 * (both fixed-width `…Z`), so ordering is exact and index-friendly — no
 * datetime() wrapping and its space-vs-`T` format hazard.
 */
export function getPageAnalyticsSnapshot(opts: { windowDays?: number; limit?: number } = {}): PageAnalyticsSnapshot {
  const windowDays = normalizeWindowDays(opts.windowDays ?? 7);
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.min(1000, Number(opts.limit))) : 500;
  const generatedAt = new Date().toISOString();
  const since = new Date(Date.now() - windowDays * DAY_MS).toISOString();

  pruneOldEvents();

  let pages: PageAnalyticsRow[] = [];
  try {
    const rows = getDb()
      .prepare(
        `SELECT path,
                COUNT(*) AS accesses,
                COUNT(DISTINCT user_id) AS unique_users,
                SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) AS logged_in_accesses,
                SUM(duration_ms) AS total_ms,
                AVG(NULLIF(duration_ms, 0)) AS avg_ms,
                MAX(created_at) AS last_at
           FROM page_view_events
          WHERE created_at > ?
          GROUP BY path
          ORDER BY accesses DESC, unique_users DESC
          LIMIT ?`,
      )
      .all(since, limit) as Array<{
      path: string;
      accesses: number;
      unique_users: number;
      logged_in_accesses: number;
      total_ms: number | null;
      avg_ms: number | null;
      last_at: string | null;
    }>;
    pages = rows.map((r) => ({
      path: r.path,
      accesses: Number(r.accesses) || 0,
      uniqueUsers: Number(r.unique_users) || 0,
      loggedInAccesses: Number(r.logged_in_accesses) || 0,
      avgDurationMs: Math.round(Number(r.avg_ms) || 0),
      totalDurationMs: Number(r.total_ms) || 0,
      lastAccessAt: r.last_at ?? null,
    }));
  } catch {
    pages = [];
  }

  let totals: PageAnalyticsSnapshot['totals'] = {
    accesses: 0,
    uniqueUsers: 0,
    loggedInAccesses: 0,
    measuredVisits: 0,
    totalDurationMs: 0,
    avgDurationMs: 0,
  };
  try {
    // Unique users overall is COUNT(DISTINCT) across the whole window — it is
    // NOT the sum of per-page unique users (a user can visit many pages), so
    // it needs its own query.
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS accesses,
                COUNT(DISTINCT user_id) AS unique_users,
                SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) AS logged_in_accesses,
                SUM(CASE WHEN duration_ms > 0 THEN 1 ELSE 0 END) AS measured_visits,
                SUM(duration_ms) AS total_ms,
                AVG(NULLIF(duration_ms, 0)) AS avg_ms
           FROM page_view_events
          WHERE created_at > ?`,
      )
      .get(since) as
      | {
          accesses: number;
          unique_users: number;
          logged_in_accesses: number;
          measured_visits: number;
          total_ms: number | null;
          avg_ms: number | null;
        }
      | undefined;
    if (row) {
      totals = {
        accesses: Number(row.accesses) || 0,
        uniqueUsers: Number(row.unique_users) || 0,
        loggedInAccesses: Number(row.logged_in_accesses) || 0,
        measuredVisits: Number(row.measured_visits) || 0,
        totalDurationMs: Number(row.total_ms) || 0,
        avgDurationMs: Math.round(Number(row.avg_ms) || 0),
      };
    }
  } catch {
    // Keep zeroed totals on failure so the dashboard still renders.
  }

  return { windowDays, generatedAt, retentionDays: RETENTION_DAYS, totals, pages };
}
