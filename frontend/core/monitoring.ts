import 'server-only';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/core/db';
import { DISCLAIMER_VERSION } from '@/core/disclaimer';
import {
  MAX_DAILY,
  MAX_HOURLY,
  etBucketKeys,
  generateDailyKeys,
  generateHourlyKeys,
} from '@/core/monitoringBuckets';

const STORE_PATH = process.env.MONITORING_STORE_PATH ?? path.join(process.cwd(), 'data', 'monitoring.json');
const SIGNUP_STORE_PATH = process.env.SIGNUP_STORE_PATH ?? path.join(process.cwd(), 'data', 'signups.json');
const FLUSH_INTERVAL_MS = 60_000;
const PRUNE_INTERVAL_MS = 60 * 60_000;
const TOKEN_CACHE_TTL_MS = 60_000;
const TOKEN_CACHE_MAX = 10_000;

export type MonitoringBucket = {
  apiCalls: number;
  pageAccesses: number;
  users: string[];
  userCounts: Record<string, number>;
  ipCounts: Record<string, number>;
};

export type MonitoringSnapshotPoint = {
  bucket: string;
  apiCalls: number;
  pageAccesses: number;
  uniqueUsers: number;
  uniqueIps: number;
};

export type SignupPoint = {
  day: string;
  basic: number;
  pro: number;
  public: number;
  paying: number;
  disclaimer: number;
};

export type WebhookHealth = {
  // Counters of audit_events rows in two trailing windows. Errors are real
  // handler failures (5xx-returning); orphans are events for unknown
  // customer ids; stale_skipped means the ordering guard threw out an
  // out-of-order delivery; payment_failed mirrors Stripe dunning events.
  errors24h: number;
  errors7d: number;
  orphans24h: number;
  orphans7d: number;
  staleSkipped24h: number;
  staleSkipped7d: number;
  paymentFailed24h: number;
  paymentFailed7d: number;
  // Founding-cohort all-time counters: redemptions vs lifetime-coupon
  // applications. Lifetime stays at 0 for ~12 months after the first
  // redemption; a meaningful lag between these counters past month 13
  // would signal the apply-on-month-13 branch isn't firing.
  foundingRedeemed: number;
  foundingLifetimeApplied: number;
  // Recent (last-7-day) error rows for inline display when errors24h > 0.
  // Capped at 10 to keep the payload bounded.
  recentErrors: Array<{ createdAt: string; message: string }>;
  // Recent (last-7-day) stale-skipped rows with the per-row Δ between the
  // skipped event's `created` and the newer one that beat it, plus any
  // payment-failed audit on the same subscription within ±10 minutes.
  // Tight-Δ rows with no link are almost always Stripe's normal multi-event
  // checkout / dunning bursts; the link surfaces the kenji-style pairing
  // where the skip is collateral to a real payment failure.
  recentStaleSkipped: Array<{
    createdAt: string;
    message: string;
    subscriptionId: string | null;
    eventType: string | null;
    deltaSeconds: number | null;
    linkedPaymentFailed: {
      createdAt: string;
      email: string | null;
      message: string;
    } | null;
  }>;
};

export type MonitoringSnapshot = {
  signups: SignupPoint[];
  hourly: MonitoringSnapshotPoint[];
  daily: MonitoringSnapshotPoint[];
  topIps: Array<{ ip: string; count: number }>;
  topUsers: Array<{ userId: string; email: string | null; count: number }>;
  webhookHealth: WebhookHealth;
  lastFlushAt: string | null;
  generatedAt: string;
};

type StoreShape = {
  version: 1;
  hourly: Record<string, MonitoringBucket>;
  daily: Record<string, MonitoringBucket>;
  lastFlushAt: string | null;
};

let store: StoreShape = createEmptyStore();
let dirty = false;
let initialized = false;
let flushTimer: NodeJS.Timeout | null = null;
let pruneTimer: NodeJS.Timeout | null = null;

const tokenCache = new Map<string, { userId: string | null; expiresAt: number }>();

function createEmptyStore(): StoreShape {
  return { version: 1, hourly: {}, daily: {}, lastFlushAt: null };
}

function emptyBucket(): MonitoringBucket {
  return { apiCalls: 0, pageAccesses: 0, users: [], userCounts: {}, ipCounts: {} };
}

function normalizeBucket(raw: Partial<MonitoringBucket> | undefined): MonitoringBucket {
  const bucket = emptyBucket();
  if (!raw) return bucket;
  bucket.apiCalls = raw.apiCalls ?? 0;
  bucket.pageAccesses = raw.pageAccesses ?? 0;
  bucket.users = Array.isArray(raw.users) ? raw.users : [];
  bucket.ipCounts = raw.ipCounts && typeof raw.ipCounts === 'object' ? raw.ipCounts : {};
  if (raw.userCounts && typeof raw.userCounts === 'object') {
    bucket.userCounts = raw.userCounts;
  } else {
    // Migrate legacy buckets (pre-userCounts): seed counts at 1 per known user.
    for (const u of bucket.users) bucket.userCounts[u] = 1;
  }
  return bucket;
}

function readStoreFromDisk(): StoreShape {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    if (parsed && parsed.version === 1 && parsed.hourly && parsed.daily) {
      const hourly: Record<string, MonitoringBucket> = {};
      for (const [k, v] of Object.entries(parsed.hourly)) hourly[k] = normalizeBucket(v);
      const daily: Record<string, MonitoringBucket> = {};
      for (const [k, v] of Object.entries(parsed.daily)) daily[k] = normalizeBucket(v);
      return {
        version: 1,
        hourly,
        daily,
        lastFlushAt: parsed.lastFlushAt ?? null,
      };
    }
  } catch {
    // No file or parse failed: start fresh.
  }
  return createEmptyStore();
}

function loadStore() {
  store = readStoreFromDisk();
}

function ensureBucket(map: Record<string, MonitoringBucket>, key: string): MonitoringBucket {
  let bucket = map[key];
  if (!bucket) {
    bucket = emptyBucket();
    map[key] = bucket;
  }
  return bucket;
}

export function recordRequest(input: {
  isApi: boolean;
  userId: string | null;
  ip: string | null;
  at?: Date;
}) {
  if (!initialized) initMonitoring();
  const at = input.at ?? new Date();
  const { hour, day } = etBucketKeys(at);
  const hb = ensureBucket(store.hourly, hour);
  const db = ensureBucket(store.daily, day);
  if (input.isApi) {
    hb.apiCalls += 1;
    db.apiCalls += 1;
  } else {
    hb.pageAccesses += 1;
    db.pageAccesses += 1;
  }
  if (input.userId) {
    if (!hb.users.includes(input.userId)) hb.users.push(input.userId);
    if (!db.users.includes(input.userId)) db.users.push(input.userId);
    hb.userCounts[input.userId] = (hb.userCounts[input.userId] ?? 0) + 1;
    db.userCounts[input.userId] = (db.userCounts[input.userId] ?? 0) + 1;
  }
  if (input.ip) {
    hb.ipCounts[input.ip] = (hb.ipCounts[input.ip] ?? 0) + 1;
    db.ipCounts[input.ip] = (db.ipCounts[input.ip] ?? 0) + 1;
  }
  dirty = true;
}

function persist() {
  if (!dirty) return;
  try {
    const dir = path.dirname(STORE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    store.lastFlushAt = new Date().toISOString();
    fs.writeFileSync(tmp, JSON.stringify(store), 'utf8');
    fs.renameSync(tmp, STORE_PATH);
    dirty = false;
  } catch {
    // Persist failures should not crash the server; the next tick will retry.
  }
}

function prune() {
  const hourlyKeys = Object.keys(store.hourly).sort();
  while (hourlyKeys.length > MAX_HOURLY) {
    const oldest = hourlyKeys.shift();
    if (oldest === undefined) break;
    delete store.hourly[oldest];
    dirty = true;
  }
  const dailyKeys = Object.keys(store.daily).sort();
  while (dailyKeys.length > MAX_DAILY) {
    const oldest = dailyKeys.shift();
    if (oldest === undefined) break;
    delete store.daily[oldest];
    dirty = true;
  }
}

export function initMonitoring() {
  if (initialized) return;
  initialized = true;
  loadStore();
  if (flushTimer === null) {
    flushTimer = setInterval(persist, FLUSH_INTERVAL_MS);
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
  }
  if (pruneTimer === null) {
    pruneTimer = setInterval(() => {
      prune();
      persist();
    }, PRUNE_INTERVAL_MS);
    if (typeof pruneTimer.unref === 'function') pruneTimer.unref();
  }
  const flushOnExit = () => {
    try { persist(); } catch { /* ignore */ }
  };
  process.once('SIGTERM', flushOnExit);
  process.once('SIGINT', flushOnExit);
  process.once('beforeExit', flushOnExit);
}

function bucketToPoint(key: string, bucket: MonitoringBucket | undefined): MonitoringSnapshotPoint {
  if (!bucket) {
    return { bucket: key, apiCalls: 0, pageAccesses: 0, uniqueUsers: 0, uniqueIps: 0 };
  }
  return {
    bucket: key,
    apiCalls: bucket.apiCalls,
    pageAccesses: bucket.pageAccesses,
    uniqueUsers: bucket.users.length,
    uniqueIps: Object.keys(bucket.ipCounts).length,
  };
}

function aggregateTopIps(buckets: Record<string, MonitoringBucket>, limit: number): Array<{ ip: string; count: number }> {
  const totals = new Map<string, number>();
  for (const bucket of Object.values(buckets)) {
    for (const [ip, count] of Object.entries(bucket.ipCounts)) {
      totals.set(ip, (totals.get(ip) ?? 0) + count);
    }
  }
  return Array.from(totals.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function aggregateTopUsers(
  buckets: Record<string, MonitoringBucket>,
  limit: number,
): Array<{ userId: string; email: string | null; count: number }> {
  const totals = new Map<string, number>();
  for (const bucket of Object.values(buckets)) {
    for (const [userId, count] of Object.entries(bucket.userCounts ?? {})) {
      totals.set(userId, (totals.get(userId) ?? 0) + count);
    }
  }
  const top = Array.from(totals.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  if (top.length === 0) return [];
  const emails = new Map<string, string>();
  try {
    const placeholders = top.map(() => '?').join(',');
    const rows = getDb()
      .prepare(`SELECT id, email FROM users WHERE id IN (${placeholders})`)
      .all(...top.map((t) => t.userId)) as Array<{ id: string; email: string }>;
    for (const row of rows) emails.set(row.id, row.email);
  } catch {
    // If lookup fails, we still return userIds without emails.
  }
  return top.map((t) => ({ userId: t.userId, email: emails.get(t.userId) ?? null, count: t.count }));
}

type SignupDay = { basic: number; pro: number; public: number; paying: number; disclaimer: number };

type SignupStoreShape = {
  version: 1;
  days: Record<string, SignupDay>;
};

function readSignupStore(): SignupStoreShape {
  try {
    const raw = fs.readFileSync(SIGNUP_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SignupStoreShape>;
    if (parsed && parsed.version === 1 && parsed.days && typeof parsed.days === 'object') {
      const days: Record<string, SignupDay> = {};
      for (const [k, v] of Object.entries(parsed.days)) {
        days[k] = {
          basic: Number(v?.basic) || 0,
          pro: Number(v?.pro) || 0,
          public: Number(v?.public) || 0,
          paying: Number(v?.paying) || 0,
          disclaimer: Number(v?.disclaimer) || 0,
        };
      }
      return { version: 1, days };
    }
  } catch {
    // No file or parse failed: start fresh.
  }
  return { version: 1, days: {} };
}

function writeSignupStore(s: SignupStoreShape) {
  try {
    const dir = path.dirname(SIGNUP_STORE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${SIGNUP_STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s), 'utf8');
    fs.renameSync(tmp, SIGNUP_STORE_PATH);
  } catch {
    // Persist failures should not crash the request path.
  }
}

// Live headcount by billing tier. Legacy tier ids fold into the current
// tier system (starter -> basic, elite -> pro); admin excluded.
function currentTierCounts(): { basic: number; pro: number; public: number } {
  const counts = { basic: 0, pro: 0, public: 0 };
  try {
    const rows = getDb()
      .prepare('SELECT tier, COUNT(*) AS c FROM users GROUP BY tier')
      .all() as Array<{ tier: string; c: number }>;
    for (const row of rows) {
      const c = Number(row.c) || 0;
      if (row.tier === 'basic' || row.tier === 'starter') counts.basic += c;
      else if (row.tier === 'pro' || row.tier === 'elite') counts.pro += c;
      else if (row.tier === 'public') counts.public += c;
    }
  } catch {
    // If the count fails, fall back to zeros for this sample.
  }
  return counts;
}

// Users currently entitled to paid features via Stripe — mirrors the
// webhook's ACTIVE_STATUSES set ('active' + 'trialing'). Trial users are
// intentionally counted here: they have full access and the slot is taken.
// If they cancel before the trial ends, the subscription.deleted webhook
// flips their subscription_status off this list and they drop out of the
// count immediately. past_due users are excluded — the webhook downgrades
// them to public, so counting them as paying would overstate the bucket.
function currentPayingCount(): number {
  try {
    const row = getDb()
      .prepare(
        "SELECT COUNT(*) AS c FROM users WHERE subscription_status IN ('active', 'trialing')",
      )
      .get() as { c?: number } | undefined;
    return Number(row?.c) || 0;
  } catch {
    return 0;
  }
}

// Total users who have acknowledged the CURRENT disclaimer version. Mirrors
// the "Disclaimer" column in `make users`: stale acks against an older
// version don't count once the wording has been materially updated.
function currentDisclaimerCount(): number {
  try {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM users
         WHERE disclaimer_acknowledged_at IS NOT NULL
           AND disclaimer_version_acknowledged = ?`
      )
      .get(DISCLAIMER_VERSION) as { c?: number } | undefined;
    return Number(row?.c) || 0;
  } catch {
    return 0;
  }
}

// One plot point per ET day. Re-sampling the same day overwrites that
// day's point with the latest counts; a new point is only created once
// the day rolls over. Days with no sample carry the prior day forward so
// the area stays continuous. The x-axis spans MAX_DAILY days back to match
// the other daily charts on the page.
function buildSignupSeries(now: Date): SignupPoint[] {
  const today = etBucketKeys(now).day;
  const store = readSignupStore();
  const counts = currentTierCounts();
  const disclaimer = currentDisclaimerCount();
  const paying = currentPayingCount();
  const sample: SignupDay = {
    basic: counts.basic,
    pro: counts.pro,
    public: counts.public,
    paying,
    disclaimer,
  };
  const existing = store.days[today];
  if (
    !existing ||
    existing.basic !== sample.basic ||
    existing.pro !== sample.pro ||
    existing.public !== sample.public ||
    existing.paying !== sample.paying ||
    existing.disclaimer !== sample.disclaimer
  ) {
    store.days[today] = sample;
    writeSignupStore(store);
  }

  const dailyKeys = generateDailyKeys(now);
  const series: SignupPoint[] = [];
  let last: SignupDay = { basic: 0, pro: 0, public: 0, paying: 0, disclaimer: 0 };
  for (const day of dailyKeys) {
    if (store.days[day]) last = store.days[day];
    series.push({
      day,
      basic: last.basic,
      pro: last.pro,
      public: last.public,
      paying: last.paying,
      disclaimer: last.disclaimer,
    });
  }
  return series;
}

// Counts audit_events rows of `type` whose created_at is newer than
// `intervalSql` (e.g. '-1 day', '-7 days'). Empty/missing audit_events
// table is treated as zero so this never throws back to the API route.
function countAuditSince(type: string, intervalSql: string | null): number {
  try {
    const sql = intervalSql
      ? `SELECT COUNT(*) AS c FROM audit_events WHERE type = ? AND created_at > datetime('now', ?)`
      : `SELECT COUNT(*) AS c FROM audit_events WHERE type = ?`;
    const row = intervalSql
      ? (getDb().prepare(sql).get(type, intervalSql) as { c?: number } | undefined)
      : (getDb().prepare(sql).get(type) as { c?: number } | undefined);
    return Number(row?.c) || 0;
  } catch {
    return 0;
  }
}

// ±10 minutes is wide enough to catch the Stripe dunning burst that pairs
// an invoice.payment_failed with the subscription.updated events around it
// (kenji-style: 21s apart), but tight enough to avoid false-linking an
// unrelated later payment failure on the same sub.
const STALE_PAYMENT_LINK_WINDOW_MINUTES = 10;

type AuditRow = { created_at: string; message: string; email: string | null };

function parseStaleSkippedMessage(message: string): {
  subscriptionId: string | null;
  eventType: string | null;
  deltaSeconds: number | null;
} {
  // Skipped stale <eventType> (created=<old>) for sub <subId>; a newer event (created=<new>) was already processed
  const typeMatch = message.match(/Skipped stale (\S+) /);
  const subMatch = message.match(/for sub (sub_[A-Za-z0-9]+)/);
  const createds = Array.from(message.matchAll(/created=(\d+)/g)).map((m) => Number(m[1]));
  const [createdOld, createdNew] = createds;
  const deltaSeconds =
    Number.isFinite(createdOld) && Number.isFinite(createdNew) ? createdNew - createdOld : null;
  return {
    subscriptionId: subMatch?.[1] ?? null,
    eventType: typeMatch?.[1] ?? null,
    deltaSeconds,
  };
}

function findLinkedPaymentFailed(
  subscriptionId: string,
  createdAt: string,
): { createdAt: string; email: string | null; message: string } | null {
  try {
    const row = getDb()
      .prepare(
        `SELECT created_at, email, message FROM audit_events
         WHERE type = 'stripe_payment_failed'
           AND message LIKE ?
           AND ABS((julianday(created_at) - julianday(?)) * 1440) <= ?
         ORDER BY ABS(julianday(created_at) - julianday(?)) ASC
         LIMIT 1`,
      )
      .get(
        `%${subscriptionId}%`,
        createdAt,
        STALE_PAYMENT_LINK_WINDOW_MINUTES,
        createdAt,
      ) as AuditRow | undefined;
    if (!row) return null;
    return { createdAt: row.created_at, email: row.email, message: row.message };
  } catch {
    return null;
  }
}

function buildWebhookHealth(): WebhookHealth {
  let recentErrors: WebhookHealth['recentErrors'] = [];
  try {
    const rows = getDb()
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_webhook_error' AND created_at > datetime('now', '-7 days')
         ORDER BY created_at DESC LIMIT 10`,
      )
      .all() as Array<{ created_at: string; message: string }>;
    recentErrors = rows.map((r) => ({ createdAt: r.created_at, message: r.message }));
  } catch {
    recentErrors = [];
  }

  let recentStaleSkipped: WebhookHealth['recentStaleSkipped'] = [];
  try {
    const rows = getDb()
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_webhook_stale_skipped' AND created_at > datetime('now', '-7 days')
         ORDER BY created_at DESC LIMIT 10`,
      )
      .all() as Array<{ created_at: string; message: string }>;
    recentStaleSkipped = rows.map((r) => {
      const parsed = parseStaleSkippedMessage(r.message);
      const linked = parsed.subscriptionId
        ? findLinkedPaymentFailed(parsed.subscriptionId, r.created_at)
        : null;
      return {
        createdAt: r.created_at,
        message: r.message,
        subscriptionId: parsed.subscriptionId,
        eventType: parsed.eventType,
        deltaSeconds: parsed.deltaSeconds,
        linkedPaymentFailed: linked,
      };
    });
  } catch {
    recentStaleSkipped = [];
  }

  return {
    errors24h: countAuditSince('stripe_webhook_error', '-1 day'),
    errors7d: countAuditSince('stripe_webhook_error', '-7 days'),
    orphans24h: countAuditSince('stripe_webhook_orphan', '-1 day'),
    orphans7d: countAuditSince('stripe_webhook_orphan', '-7 days'),
    staleSkipped24h: countAuditSince('stripe_webhook_stale_skipped', '-1 day'),
    staleSkipped7d: countAuditSince('stripe_webhook_stale_skipped', '-7 days'),
    paymentFailed24h: countAuditSince('stripe_payment_failed', '-1 day'),
    paymentFailed7d: countAuditSince('stripe_payment_failed', '-7 days'),
    foundingRedeemed: countAuditSince('stripe_founding_redeemed', null),
    foundingLifetimeApplied: countAuditSince('stripe_founding_lifetime_applied', null),
    recentErrors,
    recentStaleSkipped,
  };
}

export function getSnapshot(): MonitoringSnapshot {
  // Read fresh from disk: the proxy bundle that calls recordRequest() is
  // a separate Next.js 16 runtime and its in-memory store is invisible
  // here. The file it persists every 60s is the only shared source of truth.
  const live = readStoreFromDisk();
  const now = new Date();
  const hourlyKeys = generateHourlyKeys(now);
  const dailyKeys = generateDailyKeys(now);
  return {
    signups: buildSignupSeries(now),
    hourly: hourlyKeys.map((key) => bucketToPoint(key, live.hourly[key])),
    daily: dailyKeys.map((key) => bucketToPoint(key, live.daily[key])),
    topIps: aggregateTopIps(live.daily, 10),
    topUsers: aggregateTopUsers(live.daily, 10),
    webhookHealth: buildWebhookHealth(),
    lastFlushAt: live.lastFlushAt,
    generatedAt: now.toISOString(),
  };
}

export function resolveUserIdFromCookie(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null;
  const cached = tokenCache.get(cookieValue);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.userId;

  const tokenHash = createHash('sha256').update(cookieValue).digest('hex');
  let userId: string | null = null;
  try {
    const row = getDb()
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ? LIMIT 1')
      .get(tokenHash) as { user_id?: string; expires_at?: string } | undefined;
    if (row?.user_id && row?.expires_at && new Date(row.expires_at).getTime() > now) {
      userId = row.user_id;
    }
  } catch {
    userId = null;
  }
  tokenCache.set(cookieValue, { userId, expiresAt: now + TOKEN_CACHE_TTL_MS });
  if (tokenCache.size > TOKEN_CACHE_MAX) {
    const oldestKey = tokenCache.keys().next().value;
    if (oldestKey !== undefined) tokenCache.delete(oldestKey);
  }
  return userId;
}
