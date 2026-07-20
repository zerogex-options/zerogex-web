import 'server-only';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/core/db';
import { DISCLAIMER_VERSION } from '@/core/disclaimer';
import { priceIdToSku } from '@/core/stripe';
import {
  computeMrr,
  computeMrrTrend,
  parseAmountTable,
  type MrrConfig,
  type MrrPoint,
  type MrrSnapshot,
  type MrrTrend,
  type SubscriberBucket,
  type SubscriptionState,
} from '@/core/pricing';
import {
  MAX_DAILY,
  MAX_HOURLY,
  etBucketKeys,
  generateDailyKeys,
  generateHourlyKeys,
} from '@/core/monitoringBuckets';

const STORE_PATH = process.env.MONITORING_STORE_PATH ?? path.join(process.cwd(), 'data', 'monitoring.json');
const SIGNUP_STORE_PATH = process.env.SIGNUP_STORE_PATH ?? path.join(process.cwd(), 'data', 'signups.json');
const MRR_STORE_PATH = process.env.MRR_STORE_PATH ?? path.join(process.cwd(), 'data', 'mrr.json');
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
  // Full subscribers — Stripe subscription_status='active'. Mirrors what
  // `make users PAID=yes` lists.
  paying: number;
  // Free-trial users — subscription_status='trialing'. Card on file but
  // not yet charged. Mirrors `make users TRIAL=yes`.
  trialing: number;
  disclaimer: number;
};

// Per-day paid-subscription flow plus account registrations, sourced from the
// audit_events log. The paid flow counts each user's own Stripe signup/cancel:
//   • basicAdd / proAdd     — a subscription's first paid observation (conversion)
//   • basicCancel / proCancel — a VOLUNTARY cancellation: the sub ended while not
//                               in a payment-failure state (stored negative so it
//                               stacks straight below the x-axis)
//   • basicPaymentFail / proPaymentFail — an INVOLUNTARY downgrade: the sub ended
//                               out of a dunning (past_due/unpaid) state, i.e. it
//                               was lost to a failed payment rather than cancelled
//                               (also stored negative)
// Every ended subscription is booked into exactly ONE of the cancel /
// payment-fail pairs, so the two never double-count the same churn.
// `registrations` is the number of new self-serve accounts that day (any tier —
// everyone starts on Public at email registration), for the separate line chart.
export type SignupFlowPoint = {
  day: string;
  basicAdd: number;
  proAdd: number;
  basicCancel: number;
  proCancel: number;
  basicPaymentFail: number;
  proPaymentFail: number;
  registrations: number;
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
  mrr: MrrSnapshot;
  mrrSeries: MrrPoint[];
  mrrTrend: MrrTrend | null;
  signups: SignupPoint[];
  signupFlow: SignupFlowPoint[];
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

type SignupDay = {
  basic: number;
  pro: number;
  public: number;
  paying: number;
  trialing: number;
  disclaimer: number;
};

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
        // Pre-split samples only stored a single `paying` covering both
        // active + trialing. Trial signups only existed for a brief window
        // before this split landed, so attributing legacy `paying` entirely
        // to the Full Subscriber bucket is a small, bounded distortion and
        // keeps the historical area continuous.
        days[k] = {
          basic: Number(v?.basic) || 0,
          pro: Number(v?.pro) || 0,
          public: Number(v?.public) || 0,
          paying: Number(v?.paying) || 0,
          trialing: Number(v?.trialing) || 0,
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

// Headcount split by Stripe subscription state:
//   active   — fully paying subscribers (matches `make users PAID=yes`).
//   trialing — card on file, free-trial window still running (matches
//              `make users TRIAL=yes`). Promoted to 'active' on first
//              charge, demoted to 'public' if the user cancels mid-trial.
// past_due is intentionally excluded — the webhook downgrades those users
// to the public tier, so counting them as paying would overstate the bucket.
function currentPayingCounts(): { active: number; trialing: number } {
  try {
    const rows = getDb()
      .prepare(
        `SELECT subscription_status, COUNT(*) AS c
         FROM users
         WHERE subscription_status IN ('active', 'trialing')
         GROUP BY subscription_status`,
      )
      .all() as Array<{ subscription_status: string; c: number }>;
    let active = 0;
    let trialing = 0;
    for (const row of rows) {
      const c = Number(row.c) || 0;
      if (row.subscription_status === 'active') active = c;
      else if (row.subscription_status === 'trialing') trialing = c;
    }
    return { active, trialing };
  } catch {
    return { active: 0, trialing: 0 };
  }
}

// Build the income-replacement MRR snapshot from live subscriber rows.
// Estimates MRR locally (no live Stripe call, matching the rest of this
// page) by mapping each active/trialing subscriber's stripe_price_id to a
// (tier, cadence) SKU and pricing it at the founding rate when the user is a
// current founding member, otherwise list. Subscribers whose price id can't
// be mapped are counted as `unpriced` and contribute $0 so the estimate
// never silently inflates. Promo-rate subscribers fall back to list (the
// per-user promo can't be reconstructed post-checkout), making this a small,
// documented over-estimate — calibrate via MRR_PRICE_TABLE_JSON if needed.
function mrrConfigFromEnv(): MrrConfig {
  const grossRaw = Number(process.env.MRR_TARGET_GROSS_INCOME);
  const marginRaw = Number(process.env.MRR_TARGET_MARGIN);
  const overrideRaw = Number(process.env.MRR_TARGET);
  return {
    amounts: parseAmountTable(process.env.MRR_PRICE_TABLE_JSON),
    targetGrossIncome: Number.isFinite(grossRaw) && grossRaw > 0 ? grossRaw : 175_000,
    margin: Number.isFinite(marginRaw) && marginRaw > 0 && marginRaw <= 1 ? marginRaw : 0.75,
    targetMrrOverride: Number.isFinite(overrideRaw) && overrideRaw > 0 ? overrideRaw : null,
  };
}

function buildMrr(): MrrSnapshot {
  const config = mrrConfigFromEnv();
  const buckets: SubscriberBucket[] = [];
  let unpricedActive = 0;
  let unpricedTrialing = 0;
  try {
    // founding = current founding member still on the intro rate (started,
    // lifetime 25%-off not yet applied). Post-lifetime founders fold into
    // `list` here; the lifetime coupon doesn't fire until ~12 months after
    // the first redemption, so this matches reality during the intro window.
    const rows = getDb()
      .prepare(
        `SELECT stripe_price_id AS priceId,
                subscription_status AS status,
                CASE WHEN founding_member_started_at IS NOT NULL
                       AND founding_lifetime_applied_at IS NULL
                     THEN 1 ELSE 0 END AS founding,
                COUNT(*) AS c
           FROM users
          WHERE subscription_status IN ('active', 'trialing')
          GROUP BY priceId, status, founding`,
      )
      .all() as Array<{
        priceId: string | null;
        status: string;
        founding: number;
        c: number;
      }>;
    for (const row of rows) {
      const count = Number(row.c) || 0;
      if (count <= 0) continue;
      const state: SubscriptionState = row.status === 'active' ? 'active' : 'trialing';
      const sku = row.priceId ? priceIdToSku(row.priceId) : null;
      if (!sku) {
        if (state === 'active') unpricedActive += count;
        else unpricedTrialing += count;
        continue;
      }
      buckets.push({
        tier: sku.tier,
        cadence: sku.cadence,
        rate: row.founding ? 'founding' : 'list',
        state,
        count,
      });
    }
  } catch {
    // On any query failure, fall through with empty buckets so the snapshot
    // still renders (estMrr 0) rather than 500-ing the admin page.
  }
  return computeMrr({ buckets, unpricedActive, unpricedTrialing, config });
}

type MrrDaySample = {
  estMrr: number;
  committedMrr: number;
  activeSubscribers: number;
  trialingSubscribers: number;
};

type MrrStoreShape = {
  version: 1;
  days: Record<string, MrrDaySample>;
};

function readMrrStore(): MrrStoreShape {
  try {
    const raw = fs.readFileSync(MRR_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MrrStoreShape>;
    if (parsed && parsed.version === 1 && parsed.days && typeof parsed.days === 'object') {
      const days: Record<string, MrrDaySample> = {};
      for (const [k, v] of Object.entries(parsed.days)) {
        days[k] = {
          estMrr: Number(v?.estMrr) || 0,
          committedMrr: Number(v?.committedMrr) || 0,
          activeSubscribers: Number(v?.activeSubscribers) || 0,
          trialingSubscribers: Number(v?.trialingSubscribers) || 0,
        };
      }
      return { version: 1, days };
    }
  } catch {
    // No file or parse failed: start fresh.
  }
  return { version: 1, days: {} };
}

function writeMrrStore(s: MrrStoreShape) {
  try {
    const dir = path.dirname(MRR_STORE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${MRR_STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s), 'utf8');
    fs.renameSync(tmp, MRR_STORE_PATH);
  } catch {
    // Persist failures should not crash the request path.
  }
}

// One MRR plot point per ET day, mirroring buildSignupSeries: re-sampling the
// same day overwrites that day's point with the latest estimate; a new point
// is only created once the day rolls over. Days with no sample carry the prior
// day forward so the line stays continuous, and the x-axis spans MAX_DAILY
// days back to align with the signup and traffic charts.
function buildMrrSeries(now: Date, current: MrrSnapshot): MrrPoint[] {
  const today = etBucketKeys(now).day;
  const store = readMrrStore();
  const sample: MrrDaySample = {
    estMrr: current.estMrr,
    committedMrr: current.committedMrr,
    activeSubscribers: current.activeSubscribers,
    trialingSubscribers: current.trialingSubscribers,
  };
  const existing = store.days[today];
  if (
    !existing ||
    existing.estMrr !== sample.estMrr ||
    existing.committedMrr !== sample.committedMrr ||
    existing.activeSubscribers !== sample.activeSubscribers ||
    existing.trialingSubscribers !== sample.trialingSubscribers
  ) {
    store.days[today] = sample;
    writeMrrStore(store);
  }

  const dailyKeys = generateDailyKeys(now);
  const series: MrrPoint[] = [];
  let last: MrrDaySample = {
    estMrr: 0,
    committedMrr: 0,
    activeSubscribers: 0,
    trialingSubscribers: 0,
  };
  for (const day of dailyKeys) {
    if (store.days[day]) last = store.days[day];
    series.push({ day, estMrr: last.estMrr, committedMrr: last.committedMrr });
  }
  return series;
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
  const paying = currentPayingCounts();
  const sample: SignupDay = {
    basic: counts.basic,
    pro: counts.pro,
    public: counts.public,
    paying: paying.active,
    trialing: paying.trialing,
    disclaimer,
  };
  const existing = store.days[today];
  if (
    !existing ||
    existing.basic !== sample.basic ||
    existing.pro !== sample.pro ||
    existing.public !== sample.public ||
    existing.paying !== sample.paying ||
    existing.trialing !== sample.trialing ||
    existing.disclaimer !== sample.disclaimer
  ) {
    store.days[today] = sample;
    writeSignupStore(store);
  }

  const dailyKeys = generateDailyKeys(now);
  const series: SignupPoint[] = [];
  let last: SignupDay = {
    basic: 0,
    pro: 0,
    public: 0,
    paying: 0,
    trialing: 0,
    disclaimer: 0,
  };
  for (const day of dailyKeys) {
    if (store.days[day]) last = store.days[day];
    series.push({
      day,
      basic: last.basic,
      pro: last.pro,
      public: last.public,
      paying: last.paying,
      trialing: last.trialing,
      disclaimer: last.disclaimer,
    });
  }
  return series;
}

type PaidTier = 'basic' | 'pro';

type FlowAcc = {
  basicAdd: number;
  proAdd: number;
  basicCancel: number;
  proCancel: number;
  basicPaymentFail: number;
  proPaymentFail: number;
  registrations: number;
};

function emptyFlowAcc(): FlowAcc {
  return {
    basicAdd: 0,
    proAdd: 0,
    basicCancel: 0,
    proCancel: 0,
    basicPaymentFail: 0,
    proPaymentFail: 0,
    registrations: 0,
  };
}

// Stripe subscription ids are always `sub_...`; the audit messages embed exactly
// one. Mirrors the pattern parseStaleSkippedMessage already relies on.
function parseSubIdFromMessage(message: string): string | null {
  const m = message.match(/sub_[A-Za-z0-9]+/);
  return m ? m[0] : null;
}

// stripe_subscription_sync messages read "... tier=<pro|basic|public> ...". Only
// pro/basic count as a paid state; public (an inactive/lapsed sub) returns null
// so it neither starts a paid signup nor overwrites the last-known paid tier.
function parseSyncTier(message: string): PaidTier | null {
  const m = message.match(/\btier=(\w+)/);
  if (m?.[1] === 'pro') return 'pro';
  if (m?.[1] === 'basic') return 'basic';
  return null;
}

// stripe_subscription_sync messages read "... status=<stripe status> tier=...".
// The Stripe status is what distinguishes an involuntary payment-failure
// downgrade (past_due/unpaid) from a healthy sub, so a later deletion can be
// attributed to dunning vs. a voluntary cancel.
function parseSyncStatus(message: string): string | null {
  const m = message.match(/\bstatus=([A-Za-z_]+)/);
  return m ? m[1] : null;
}

// Stripe statuses that mean the subscription is failing payment (in dunning).
// A sub observed in one of these has already been downgraded to public locally
// (the webhook's ACTIVE_STATUSES excludes them); if it goes on to be deleted,
// the deletion is booked as a payment-failure downgrade rather than a cancel.
const DUNNING_STATUSES = new Set(['past_due', 'unpaid']);

// Per-day paid-subscription flow and account registrations, sourced from the
// audit_events log, spanning the same MAX_DAILY window as the other daily charts.
//
//   • Paid adds        — the FIRST `stripe_subscription_sync` that saw a given
//     subscription in a paid tier (pro/basic): the day that user converted.
//   • Paid cancellations / payment-failure downgrades — one per
//     `stripe_subscription_deleted` row (the sub actually ended; tier recovered
//     from its most recent paid sync), split by cause: a sub whose last synced
//     status was a dunning state (past_due/unpaid) is booked as an involuntary
//     payment-failure downgrade, everything else as a voluntary cancellation.
//     Both are stored negative so they stack below the axis, and they partition
//     the deleted subs so the same churn is never counted twice.
//   • Registrations    — new rows in the `users` table, counted by `created_at`
//     (one per account, matching `make users`). Deliberately NOT sourced from
//     `register`/`oauth_login` audit events: before 2026-06-18, `oauth_login`
//     fired on every OAuth login (not just signup), so returning logins inflated
//     the count and produced day spikes. The users table has exactly one row per
//     account, so it can't double-count.
//
// Subscription rows are bucketed onto the ET day axis (etBucketKeys) to line up
// with the other charts, since created_at is stored in UTC. Mid-tier
// upgrades/downgrades (basic↔pro) aren't a first-conversion, so they don't count
// as an add.
function buildSignupFlowSeries(now: Date): SignupFlowPoint[] {
  const dailyKeys = generateDailyKeys(now);
  const acc: Record<string, FlowAcc> = {};
  for (const day of dailyKeys) acc[day] = emptyFlowAcc();

  const etDay = (createdAt: string): string | null => {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return null;
    return etBucketKeys(d).day;
  };

  try {
    const db = getDb();

    // Subscription tier history from sync events, oldest first so a single pass
    // yields both the first paid observation (the conversion) and the latest paid
    // tier (for cancellation attribution). Bounded to ~2.2y: long enough to
    // cover a cancelling sub's lifetime, capped so the scan can't grow forever.
    const syncRows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_subscription_sync' AND created_at > datetime('now', '-800 days')
         ORDER BY created_at ASC`,
      )
      .all() as Array<{ created_at: string; message: string }>;
    const firstPaid = new Map<string, { day: string; tier: PaidTier }>();
    const lastPaidTier = new Map<string, PaidTier>();
    // Latest synced Stripe status per subscription, tracked for EVERY sync
    // (including the tier=public dunning syncs that parseSyncTier skips) so a
    // later deletion can be attributed to payment failure vs. voluntary cancel.
    const lastStatus = new Map<string, string>();
    for (const row of syncRows) {
      const subId = parseSubIdFromMessage(row.message);
      if (!subId) continue;
      const status = parseSyncStatus(row.message);
      if (status) lastStatus.set(subId, status);
      const tier = parseSyncTier(row.message);
      if (!tier) continue;
      const day = etDay(row.created_at);
      if (!day) continue;
      if (!firstPaid.has(subId)) firstPaid.set(subId, { day, tier });
      lastPaidTier.set(subId, tier);
    }

    // Paid adds: one per subscription, on the day it first went paid.
    for (const { day, tier } of firstPaid.values()) {
      const bucket = acc[day];
      if (!bucket) continue; // conversion day predates the window
      if (tier === 'pro') bucket.proAdd += 1;
      else bucket.basicAdd += 1;
    }

    // Paid churn: one per deleted subscription, tier from its last paid sync
    // (fall back to Basic if unrecoverable so a real churn is never lost). Split
    // by cause: a sub whose last synced status was a dunning state
    // (past_due/unpaid) was lost to a failed payment — an involuntary
    // downgrade; anything else is a voluntary cancellation. The two are mutually
    // exclusive, so net-onboards never subtracts the same churn twice.
    const deletedRows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_subscription_deleted' AND created_at > datetime('now', '-100 days')`,
      )
      .all() as Array<{ created_at: string; message: string }>;
    for (const row of deletedRows) {
      const day = etDay(row.created_at);
      if (!day || !acc[day]) continue;
      const subId = parseSubIdFromMessage(row.message);
      const tier = (subId ? lastPaidTier.get(subId) : null) ?? 'basic';
      const endedInDunning = subId ? DUNNING_STATUSES.has(lastStatus.get(subId) ?? '') : false;
      if (endedInDunning) {
        if (tier === 'pro') acc[day].proPaymentFail -= 1;
        else acc[day].basicPaymentFail -= 1;
      } else {
        if (tier === 'pro') acc[day].proCancel -= 1;
        else acc[day].basicCancel -= 1;
      }
    }

    // Registrations: authoritative new-account count from the users table (one
    // row per account), by the day the row was created.
    const userRows = db
      .prepare(
        `SELECT created_at FROM users
         WHERE created_at > datetime('now', '-100 days')`,
      )
      .all() as Array<{ created_at: string }>;
    for (const row of userRows) {
      const day = etDay(row.created_at);
      if (day && acc[day]) acc[day].registrations += 1;
    }
  } catch {
    // On any query/parse failure, fall through with the zero-filled window so
    // the charts render empty rather than 500-ing the admin page.
  }

  return dailyKeys.map((day) => ({ day, ...acc[day] }));
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
  const mrr = buildMrr();
  const mrrSeries = buildMrrSeries(now, mrr);
  return {
    mrr,
    mrrSeries,
    mrrTrend: computeMrrTrend(mrrSeries, mrr.targetMrr),
    signups: buildSignupSeries(now),
    signupFlow: buildSignupFlowSeries(now),
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
