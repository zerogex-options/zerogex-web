import 'server-only';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/core/db';
import { DISCLAIMER_VERSION } from '@/core/disclaimer';
import { getPaymentGraceDays, priceIdToSku } from '@/core/stripe';
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
import {
  accumulateSubscriptionFlow,
  parseSyncTierStrict,
  type FlowDeleteEvent,
  type FlowSyncEvent,
} from '@/core/subscriptionFlow';
import {
  cancellationFeedbackLabel,
  parseCancellationReasonFromMessage,
  NO_FEEDBACK,
} from '@/core/cancellationReason';
import {
  buildSubscriberLedger,
  summarizeLedger,
  type LedgerDeleteEvent,
  type LedgerRow,
  type LedgerSyncEvent,
} from '@/core/subscriberBucket';
import {
  accumulateTrialOutcomes,
  classifyRider,
  NOMINAL_TRIAL_DAYS,
  projectFullSubscribers,
  type SubscriberProjectionPoint,
  sortRidersByDeadline,
  summarizeRiders,
  summarizeTrialOutcomes,
  type ConveyorDeleteEvent,
  type ConveyorOutcomes,
  type ConveyorRider,
  type ConveyorSyncEvent,
  type ConveyorTotals,
} from '@/core/trialConveyor';

const STORE_PATH = process.env.MONITORING_STORE_PATH ?? path.join(process.cwd(), 'data', 'monitoring.json');
const SIGNUP_STORE_PATH = process.env.SIGNUP_STORE_PATH ?? path.join(process.cwd(), 'data', 'signups.json');
const MRR_STORE_PATH = process.env.MRR_STORE_PATH ?? path.join(process.cwd(), 'data', 'mrr.json');
const FLUSH_INTERVAL_MS = 60_000;
const PRUNE_INTERVAL_MS = 60 * 60_000;
// How often the background sampler captures a daily MRR/subscriber point so the
// series don't depend on an admin opening the page (see initMonitoring).
const SAMPLE_INTERVAL_MS = 6 * 60 * 60_000;
// First sample shortly after boot, so a day that only sees process restarts
// (e.g. a deploy, which resets the interval timer) still records a point.
const INITIAL_SAMPLE_DELAY_MS = 30_000;
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
  // Trial-conversion grace users — the free trial lapsed, the first real charge
  // was DECLINED, and they are inside the bounded payment-recovery window
  // (subscription_status='past_due', paid tier retained, payment_grace_reason
  // ='trial'). Still subscribers — Stripe's retries may yet convert them — but
  // they have never completed a payment, so they are neither Full Subscriber nor
  // Free Trial. See core/paymentGrace.ts.
  graceTrial: number;
  disclaimer: number;
};

// Per-day paid-subscription flow plus account registrations, sourced from the
// audit_events log. The paid flow counts each user's own Stripe signup/cancel:
//   • basicAdd / proAdd     — a NEW paid activation: a subscription's first paid
//                             observation (first conversion). Recovered subs are
//                             counted separately as reactivations (below), so a
//                             brand-new customer is distinguishable from a
//                             returning one.
//   • basicReactivate / proReactivate — a RE-activation: the day a previously
//                             dropped sub climbs back to a paid tier (public ->
//                             paid), e.g. a payment recovered AFTER the grace
//                             window had already expired. Positive like an add but
//                             kept in its own family. A payment that recovers
//                             DURING grace is a non-event (the sub never dropped),
//                             so it produces neither a reactivation nor a loss.
//   • basicPaymentFail / proPaymentFail — an INVOLUNTARY downgrade to public,
//                               booked the day access ACTUALLY drops (tier ->
//                               public): a failed renewal after any grace window
//                               ends, a trial whose first charge fails at trial
//                               end, or a sub Stripe deletes out of dunning. A
//                               member still in grace is NOT counted here — they
//                               stay a subscriber until the real drop, keeping
//                               this reconciled with Total Subscribers. Stored
//                               negative so it stacks below the x-axis.
//   • basicCancel / proCancel — a VOLUNTARY cancellation: the sub was deleted
//                               without having been downgraded for payment failure
//                               (also stored negative)
// The two churn causes partition each lost sub, so they never double-count.
// `registrations` is the number of new self-serve accounts that day (any tier —
// everyone starts on Public at email registration), for the separate line chart.
export type SignupFlowPoint = {
  day: string;
  basicAdd: number;
  proAdd: number;
  basicReactivate: number;
  proReactivate: number;
  basicCancel: number;
  proCancel: number;
  basicPaymentFail: number;
  proPaymentFail: number;
  registrations: number;
};

export type GrowthRatePoint = {
  days: 1 | 7 | 14 | 30;
  signups: number;
  cancellations: number;
  paymentFailures: number;
  net: number;
  dailyRate: number;
};

// The "why" behind recent cancellations, parsed from the Stripe cancellation
// survey folded into the audit log (see core/cancellationReason.ts + the Stripe
// webhook). `total` is the number of cancel-click events in the window;
// `captured` is how many carried a reason (a feedback enum or a comment) —
// their ratio is the survey's coverage. `byFeedback` tallies the fixed enum
// (with a `none` bucket for silent cancels); `recentComments` surfaces the
// free-text verbatims, the richest churn signal.
export type CancellationReasonsSummary = {
  windowDays: number;
  total: number;
  captured: number;
  byFeedback: Array<{ feedback: string; label: string; count: number }>;
  recentComments: Array<{
    createdAt: string;
    email: string | null;
    feedback: string | null;
    comment: string;
  }>;
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

// The live trial→paying assembly line behind the admin "Conversion Conveyor"
// tab: every free trial currently in flight, each with the instant it is due to
// be charged, plus what happened to the trials that already reached the end of
// the belt. See core/trialConveyor.ts for the state machine.
export type TrialConveyorSnapshot = {
  // Riders currently on the belt, soonest deadline first. Bounded by
  // CONVEYOR_MAX_RIDERS so a promo spike can't balloon the admin payload;
  // `truncated` is how many were cut (the totals always count everyone).
  riders: ConveyorRider[];
  truncated: number;
  totals: ConveyorTotals;
  outcomes: ConveyorOutcomes;
  // Paying subscribers who have already clicked Cancel and are counting down to
  // the day their access actually ends. They still count as Full Subscribers
  // until then, so without this the drop lands as a surprise weeks later.
  departures: ConveyorRider[];
  departingValue: number;
  // Nominal free-trial length, for labelling the belt's scale.
  trialDays: number;
  // Length of the payment-recovery window a stalled trial gets, in days.
  graceDays: number;
  generatedAt: string;
};

// Reverse-chronological record of every change to the subscriber headcount:
// who it happened to, what happened, and what it did to each line of the Total
// Subscribers chart. See core/subscriberBucket for how it's derived.
export type SubscriberLedgerSnapshot = {
  windowDays: number;
  rows: LedgerRow[];
  truncated: number;
  // Net movement of each chart line across the window, which the rows account for.
  net: { fullSubscriber: number; freeTrial: number; trialGrace: number };
  generatedAt: string;
};

// Dashed continuation of the Full Subscriber line: what the count becomes over
// the next SUBSCRIBER_PROJECTION_DAYS if nothing NEW happens, driven entirely by
// events already scheduled in the Conversion Conveyor. See
// projectFullSubscribers in core/trialConveyor for what is and isn't counted.
export type SubscriberProjection = {
  horizonDays: number;
  // Day the projection departs from — the chart's last real point, so the
  // dashed line starts exactly where the solid one ends.
  anchorDay: string | null;
  anchorPaying: number;
  points: SubscriberProjectionPoint[];
  // Trials sitting in the payment-recovery window, deliberately excluded from
  // the line because they are genuinely undecided. Surfaced so the projection
  // can say how much of the picture it is leaving out.
  undecidedStalled: number;
};

export type MonitoringSnapshot = {
  mrr: MrrSnapshot;
  mrrSeries: MrrPoint[];
  mrrTrend: MrrTrend | null;
  signups: SignupPoint[];
  signupFlow: SignupFlowPoint[];
  growthRates: GrowthRatePoint[];
  cancellationReasons: CancellationReasonsSummary;
  trialConveyor: TrialConveyorSnapshot;
  subscriberLedger: SubscriberLedgerSnapshot;
  subscriberProjection: SubscriberProjection;
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
let sampleTimer: NodeJS.Timeout | null = null;

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
  if (sampleTimer === null) {
    // Capture a daily MRR/subscriber sample even on days no admin opens the
    // Monitoring page. getSnapshot() writes today's point as a side effect and
    // is idempotent — it only writes when the day's value is new or changed, so
    // an unchanged tick is a couple of cheap COUNT queries and no disk write.
    // Without this, buildMrrSeries/buildSignupSeries only sampled on an admin
    // view, leaving permanent gaps in the daily history on quiet days.
    const sample = () => {
      try {
        getSnapshot();
      } catch {
        /* transient DB/FS error — the next tick (or an admin view) retries */
      }
    };
    sampleTimer = setInterval(sample, SAMPLE_INTERVAL_MS);
    if (typeof sampleTimer.unref === 'function') sampleTimer.unref();
    // Defer the first sample slightly so it lands after the app/DB have settled
    // rather than mid-boot; unref'd so it never holds the process open.
    const initialSample = setTimeout(sample, INITIAL_SAMPLE_DELAY_MS);
    if (typeof initialSample.unref === 'function') initialSample.unref();
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
  graceTrial: number;
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
          // Samples written before the trial-grace split have no `graceTrial`
          // key; 0 leaves those days reading exactly as they did then (that
          // cohort was counted inside `paying`), so the area stays continuous.
          graceTrial: Number(v?.graceTrial) || 0,
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

// Headcount split by subscription state, for the Total Subscribers chart:
//   active     — fully paying subscribers, PLUS members in a RENEWAL-failure
//                payment-recovery grace window (subscription `past_due` but tier
//                still pro/basic: a failed renewal Stripe is still retrying, with
//                access retained — see BILLING_PAYMENT_GRACE_DAYS). Those are
//                established payers whose access hasn't dropped, so counting them
//                here keeps this reconciled with the subscription-flow chart,
//                which books the loss only at the real downgrade (tier ->
//                public), not at past_due entry.
//   trialing   — card on file, free-trial window still running.
//   graceTrial — the trial lapsed, the first conversion charge was DECLINED, and
//                the member is inside the same bounded grace window
//                (payment_grace_reason='trial'). Broken out of `active` because
//                they have never actually completed a payment: they are neither a
//                full subscriber nor still on trial, and the bucket sizes the
//                revenue at risk at the trial→paid step specifically.
// A past_due row whose tier has ALREADY gone 'public' (grace expired or disabled)
// is a genuine downgrade and is excluded here, as are unpaid/canceled/public.
// A past_due row with no recorded reason (a window opened before the reason
// column existed) counts as `active`, exactly as every past_due grace row did
// before the split, so no history is retroactively re-attributed.
function currentPayingCounts(): { active: number; trialing: number; graceTrial: number } {
  try {
    const rows = getDb()
      .prepare(
        `SELECT
           CASE
             WHEN subscription_status = 'trialing' THEN 'trialing'
             WHEN subscription_status = 'past_due' AND payment_grace_reason = 'trial' THEN 'graceTrial'
             ELSE 'active'
           END AS bucket,
           COUNT(*) AS c
         FROM users
         WHERE subscription_status IN ('active', 'trialing')
            OR (subscription_status = 'past_due' AND tier IN ('pro', 'basic'))
         GROUP BY bucket`,
      )
      .all() as Array<{ bucket: string; c: number }>;
    let active = 0;
    let trialing = 0;
    let graceTrial = 0;
    for (const row of rows) {
      const c = Number(row.c) || 0;
      if (row.bucket === 'active') active = c;
      else if (row.bucket === 'trialing') trialing = c;
      else if (row.bucket === 'graceTrial') graceTrial = c;
    }
    return { active, trialing, graceTrial };
  } catch {
    return { active: 0, trialing: 0, graceTrial: 0 };
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

// Daily x-axis keys for a series whose samples are RETAINED FOREVER (the MRR
// and subscriber stores are append-only and never pruned). Defaults to the
// usual MAX_DAILY window, but once history reaches past that window it widens
// the axis to start at the earliest stored sample so the full retained history
// renders instead of being truncated at 90 days. The floor case returns the
// exact MAX_DAILY window (unchanged behavior); only genuinely older stores
// extend. Derived series that are recomputed from bounded event-log windows
// (signup flow / registrations) deliberately keep the fixed MAX_DAILY window.
function retainedDailyKeys(now: Date, storedDays: string[]): string[] {
  const base = generateDailyKeys(now);
  if (storedDays.length === 0) return base;
  const earliest = storedDays.reduce((a, b) => (a < b ? a : b));
  // Earliest sample already inside the default window → nothing to widen.
  if (earliest >= base[0]) return base;
  const todayKey = etBucketKeys(now).day;
  const start = Date.parse(`${earliest}T00:00:00Z`);
  const end = Date.parse(`${todayKey}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return base;
  const span = Math.round((end - start) / 86400_000) + 1;
  // +2 buffer absorbs DST drift in the fixed-24h walk; trim any keys that land
  // before the first sample so no empty pre-history day is prepended.
  return generateDailyKeys(now, span + 2).filter((k) => k >= earliest);
}

// One MRR plot point per ET day, mirroring buildSignupSeries: re-sampling the
// same day overwrites that day's point with the latest estimate; a new point
// is only created once the day rolls over. Days with no sample carry the prior
// day forward so the line stays continuous. The x-axis spans MAX_DAILY days by
// default and widens to the earliest retained sample once history exceeds it.
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

  const dailyKeys = retainedDailyKeys(now, Object.keys(store.days));
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
// the area stays continuous. The x-axis spans MAX_DAILY days by default and
// widens to the earliest retained sample once history exceeds that window
// (these counts are stored forever, so the chart shows all of them).
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
    graceTrial: paying.graceTrial,
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
    existing.graceTrial !== sample.graceTrial ||
    existing.disclaimer !== sample.disclaimer
  ) {
    store.days[today] = sample;
    writeSignupStore(store);
  }

  const dailyKeys = retainedDailyKeys(now, Object.keys(store.days));
  const series: SignupPoint[] = [];
  let last: SignupDay = {
    basic: 0,
    pro: 0,
    public: 0,
    paying: 0,
    trialing: 0,
    graceTrial: 0,
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
      graceTrial: last.graceTrial,
      disclaimer: last.disclaimer,
    });
  }
  return series;
}

type FlowAcc = {
  basicAdd: number;
  proAdd: number;
  basicReactivate: number;
  proReactivate: number;
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
    basicReactivate: 0,
    proReactivate: 0,
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
// stripe_subscription_sync messages read "... status=<stripe status> tier=...".
// The Stripe status is what distinguishes an involuntary payment-failure
// downgrade (past_due/unpaid) from a healthy sub, so a later deletion can be
// attributed to dunning vs. a voluntary cancel.
function parseSyncStatus(message: string): string | null {
  const m = message.match(/\bstatus=([A-Za-z_]+)/);
  return m ? m[1] : null;
}

// How far back the flow / registration charts DISPLAY. Unlike the traffic
// buckets (pruned at 90 days), these recompute from the retained, append-only
// audit_events + users logs every request, so they can show far more history.
// ~2 years; the axis then trims to the earliest day with real activity (floored
// at MAX_DAILY), so a young product still shows the usual 90-day window.
const FLOW_WINDOW_DAYS = 730;
// The sync scan reaches a bit further than the displayed window: attributing a
// cancel/payment-fail near the oldest displayed day to the right tier needs
// that subscription's earlier sync history as context. Bookings still only land
// inside the FLOW_WINDOW_DAYS display window.
const FLOW_SYNC_WINDOW_DAYS = 850;

// A flow day on which nothing happened — no adds, cancels, payment-failure
// downgrades, or registrations. Leading (oldest) empty days are trimmed off the
// display so the chart starts at the first real activity instead of a long flat
// lead-in for products younger than FLOW_WINDOW_DAYS.
function isFlowDayEmpty(p: SignupFlowPoint): boolean {
  return (
    p.proAdd === 0 &&
    p.basicAdd === 0 &&
    p.proReactivate === 0 &&
    p.basicReactivate === 0 &&
    p.proCancel === 0 &&
    p.basicCancel === 0 &&
    p.proPaymentFail === 0 &&
    p.basicPaymentFail === 0 &&
    p.registrations === 0
  );
}

// ET day-bucket key for an audit row's created_at (stored UTC), or null when
// the timestamp is unparseable. Shared by every builder that folds audit events
// onto the same day axis as the charts.
function etDayKey(createdAt: string): string | null {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return etBucketKeys(d).day;
}

// Per-day paid-subscription flow and account registrations, sourced from the
// audit_events log. Displays up to FLOW_WINDOW_DAYS of history (trimmed to the
// earliest day with activity, floored at MAX_DAILY) since it recomputes from the
// retained event log rather than a pruned bucket store.
//
// The paid-flow bookings all derive from the tier the webhook synced (paid<->
// public transitions) in accumulateSubscriptionFlow, so they reconcile with the
// Total Subscribers headcount day by day — including grace: a member in the
// payment-recovery window keeps a paid tier and is booked as neither a loss nor,
// on recovery, a reactivation.
//   • Paid adds        — a NEW paid conversion: the FIRST time a subscription is
//     seen in a paid tier (pro/basic) — the day that user converted. Positive.
//   • Reactivations    — a previously dropped sub climbing back to a paid tier
//     (public -> paid), e.g. a payment recovered after grace had already expired.
//     Positive, in its own family so a recovery isn't conflated with a brand-new
//     conversion. A recovery DURING grace is a non-event (no prior drop).
//   • Payment-failure downgrades — booked the day access ACTUALLY drops to public
//     (tier -> public): a failed renewal after any grace window ends, a trial
//     whose first charge fails at trial end, or a sub Stripe deletes straight out
//     of dunning. A member still in grace is NOT booked here — that's the fix that
//     keeps this line reconciled with Total Subscribers. Tier is the one held
//     just before the drop; stored negative.
//   • Paid cancellations — one per `stripe_subscription_deleted` row whose sub was
//     still a subscriber and did NOT end in dunning (those are payment-failure
//     downgrades), i.e. a voluntary cancel; tier from its last paid sync, stored
//     negative. The two churn causes partition each lost sub so the same loss is
//     never counted twice.
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
  const dailyKeys = generateDailyKeys(now, FLOW_WINDOW_DAYS);
  const acc: Record<string, FlowAcc> = {};
  for (const day of dailyKeys) acc[day] = emptyFlowAcc();

  const etDay = etDayKey;

  try {
    const db = getDb();

    // Paid-subscription flow, driven off the tier the webhook synced on each
    // event. Two audit streams:
    //   • stripe_subscription_sync — the per-event tier/status history, scanned
    //     oldest-first by accumulateSubscriptionFlow to track each sub's paid↔
    //     public transitions (add / reactivation / payment-failure downgrade).
    //     Bounded to FLOW_SYNC_WINDOW_DAYS — a bit longer than the display window
    //     so a sub shown near the oldest day still has its prior history for
    //     correct attribution — and capped so the scan can't grow forever.
    //   • stripe_subscription_deleted — terminal removals, classified against the
    //     sub's last synced state (dunning ⇒ terminal payment failure, else a
    //     voluntary cancel) and skipped when the sub already dropped via a sync.
    const syncRows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_subscription_sync' AND created_at > datetime('now', '-${FLOW_SYNC_WINDOW_DAYS} days')
         ORDER BY created_at ASC`,
      )
      .all() as Array<{ created_at: string; message: string }>;
    const deletedRows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_subscription_deleted' AND created_at > datetime('now', '-${FLOW_WINDOW_DAYS} days')`,
      )
      .all() as Array<{ created_at: string; message: string }>;

    const syncEvents: FlowSyncEvent[] = syncRows.map((row) => ({
      subId: parseSubIdFromMessage(row.message) ?? '',
      status: parseSyncStatus(row.message),
      tier: parseSyncTierStrict(row.message),
      day: etDay(row.created_at),
    }));
    const deleteEvents: FlowDeleteEvent[] = deletedRows.map((row) => ({
      subId: parseSubIdFromMessage(row.message),
      day: etDay(row.created_at),
    }));

    // Merge the pure accumulator's per-day deltas into the display window. A day
    // outside the seeded window (e.g. an attribution older than FLOW_WINDOW_DAYS)
    // is dropped here, exactly as the direct bookings were before.
    for (const [day, delta] of accumulateSubscriptionFlow(syncEvents, deleteEvents)) {
      const bucket = acc[day];
      if (!bucket) continue;
      bucket.proAdd += delta.proAdd;
      bucket.basicAdd += delta.basicAdd;
      bucket.proReactivate += delta.proReactivate;
      bucket.basicReactivate += delta.basicReactivate;
      bucket.proPaymentFail += delta.proPaymentFail;
      bucket.basicPaymentFail += delta.basicPaymentFail;
      bucket.proCancel += delta.proCancel;
      bucket.basicCancel += delta.basicCancel;
    }

    // Registrations: authoritative new-account count from the users table (one
    // row per account), by the day the row was created.
    const userRows = db
      .prepare(
        `SELECT created_at FROM users
         WHERE created_at > datetime('now', '-${FLOW_WINDOW_DAYS} days')`,
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

  const points = dailyKeys.map((day) => ({ day, ...acc[day] }));
  // Trim the leading run of all-empty days (before the product's first activity)
  // so the axis starts at real data, but never trim into the most recent
  // MAX_DAILY days — a quiet or brand-new product keeps its familiar 90-day
  // window instead of collapsing to a couple of points.
  const floorStart = Math.max(0, points.length - MAX_DAILY);
  const firstActive = points.findIndex((p) => !isFlowDayEmpty(p));
  const start = firstActive < 0 ? floorStart : Math.min(firstActive, floorStart);
  return points.slice(start);
}

// Trailing acquisition velocity, intentionally measured at the customer's
// decision/failure moment rather than at the later access downgrade. A first
// paid-tier sync includes `trialing`, so it represents a free-trial start.
// Cancellation acknowledgements provide historical coverage; the dedicated
// request audit is the durable source going forward. Grouping cancellation
// rows by user/day prevents the acknowledgement and request rows emitted for
// the same click from being counted twice.
//
// Win-backs offset cancellations: an honor-winback-discount run that clears a
// scheduled cancellation (billing_winback_discount_honored, "cleared
// cancel_at_period_end") means the member was retained on the same
// subscription — no re-subscribe, so no offsetting signup ever lands. We
// subtract in-window win-backs from the in-window cancellation count (floored
// at 0) so a cancelled-then-won-back member nets to zero rather than showing as
// a loss. This is a count-level offset within the same window (simplest): a
// win-back whose original cancel fell outside the window slightly under-counts
// cancellations, and --keep-cancellation runs (which don't clear the cancel)
// are excluded.
function buildGrowthRates(now: Date): GrowthRatePoint[] {
  const horizons = [1, 7, 14, 30] as const;
  const days = generateDailyKeys(now, 30);
  const signups = new Set<string>();
  const cancellations = new Set<string>();
  const paymentFailures = new Set<string>();
  const winbacks = new Set<string>();

  try {
    const rows = getDb().prepare(
      `SELECT type, user_id, created_at, message FROM audit_events
       WHERE type IN (
         'stripe_subscription_sync',
         'stripe_cancellation_requested',
         'cancellation_ack_email_sent',
         'stripe_payment_failed',
         'billing_winback_discount_honored'
       ) AND created_at > datetime('now', '-850 days')
       ORDER BY created_at ASC`,
    ).all() as Array<{ type: string; user_id: string | null; created_at: string; message: string }>;

    const seenSubscriptions = new Set<string>();
    for (const row of rows) {
      const parsed = new Date(row.created_at);
      if (Number.isNaN(parsed.getTime())) continue;
      const day = etBucketKeys(parsed).day;
      if (row.type === 'stripe_subscription_sync') {
        const subId = parseSubIdFromMessage(row.message);
        const tier = parseSyncTierStrict(row.message);
        if (subId && tier && tier !== 'public' && !seenSubscriptions.has(subId)) {
          seenSubscriptions.add(subId);
          if (days.includes(day)) signups.add(`${day}:${subId}`);
        }
      } else if (!days.includes(day)) {
        continue;
      } else if (row.type === 'stripe_payment_failed' && /\(attempt 1\)/.test(row.message)) {
        const invoice = row.message.match(/Invoice (in_[A-Za-z0-9]+)/)?.[1] ?? row.message;
        paymentFailures.add(`${day}:${invoice}`);
      } else if (row.type === 'billing_winback_discount_honored') {
        // Only a win-back that actually un-cancelled offsets a cancellation;
        // the script stamps "cleared cancel_at_period_end" into the message
        // exactly on that path, so --keep-cancellation runs (coupon pre-load
        // only, member still cancelling) are skipped.
        if (/cleared cancel_at_period_end/.test(row.message)) {
          winbacks.add(`${day}:${row.user_id ?? parseSubIdFromMessage(row.message) ?? row.message}`);
        }
      } else if (row.type === 'stripe_cancellation_requested' || row.type === 'cancellation_ack_email_sent') {
        cancellations.add(`${day}:${row.user_id ?? parseSubIdFromMessage(row.message) ?? row.message}`);
      }
    }
  } catch {
    // Keep the monitoring response available if audit history is unavailable.
  }

  const countSince = (values: Set<string>, windowDays: number) => {
    const included = new Set(generateDailyKeys(now, windowDays));
    return Array.from(values).filter((value) => included.has(value.slice(0, 10))).length;
  };
  return horizons.map((windowDays) => {
    const signupCount = countSince(signups, windowDays);
    const winbackCount = countSince(winbacks, windowDays);
    // Net win-backs out of the cancellation count so a cancelled-then-won-back
    // member doesn't read as a loss. Floored at 0 so more win-backs than
    // in-window cancels can't invent phantom growth.
    const cancellationCount = Math.max(0, countSince(cancellations, windowDays) - winbackCount);
    const failureCount = countSince(paymentFailures, windowDays);
    const net = signupCount - cancellationCount - failureCount;
    return {
      days: windowDays,
      signups: signupCount,
      cancellations: cancellationCount,
      paymentFailures: failureCount,
      net,
      dailyRate: net / windowDays,
    };
  });
}

// How far back the cancellation-reasons summary looks. Matches the widest
// growth-rate window so the "why" lines up with the "how many".
const CANCEL_REASONS_WINDOW_DAYS = 30;

// The "why" behind recent cancellations. Reads the cancel-click audit rows in a
// trailing window, parses the Stripe survey folded into each message, and rolls
// them up: a per-feedback tally (with a `none` bucket for silent cancels) plus
// the recent free-text verbatims. Empty/missing audit history returns a zeroed
// summary so it never throws back to the API route.
function buildCancellationReasons(): CancellationReasonsSummary {
  const empty: CancellationReasonsSummary = {
    windowDays: CANCEL_REASONS_WINDOW_DAYS,
    total: 0,
    captured: 0,
    byFeedback: [],
    recentComments: [],
  };
  try {
    const rows = getDb()
      .prepare(
        `SELECT created_at, email, message FROM audit_events
         WHERE type = 'stripe_cancellation_requested'
           AND created_at > datetime('now', '-${CANCEL_REASONS_WINDOW_DAYS} days')
         ORDER BY created_at DESC`,
      )
      .all() as Array<{ created_at: string; email: string | null; message: string }>;

    const counts = new Map<string, number>();
    const recentComments: CancellationReasonsSummary['recentComments'] = [];
    let captured = 0;
    for (const row of rows) {
      const { feedback, comment } = parseCancellationReasonFromMessage(row.message);
      if (feedback || comment) captured += 1;
      const key = feedback ?? NO_FEEDBACK;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (comment && recentComments.length < 10) {
        recentComments.push({ createdAt: row.created_at, email: row.email, feedback, comment });
      }
    }

    const byFeedback = Array.from(counts.entries())
      .map(([feedback, count]) => ({ feedback, label: cancellationFeedbackLabel(feedback), count }))
      // Real reasons first (desc by count); the `none` bucket always sinks last.
      .sort((a, b) => {
        if (a.feedback === NO_FEEDBACK) return 1;
        if (b.feedback === NO_FEEDBACK) return -1;
        return b.count - a.count;
      });

    return {
      windowDays: CANCEL_REASONS_WINDOW_DAYS,
      total: rows.length,
      captured,
      byFeedback,
      recentComments,
    };
  } catch {
    return empty;
  }
}




// ── Committed forward projection ───────────────────────────────────────────
const SUBSCRIBER_PROJECTION_DAYS = 7;

// Roll the Full Subscriber line forward off the conveyor's own contents. Every
// input is already scheduled — a trial in flight has a first-charge date, a
// cancelled member has a last day — so this is a commitment rather than a
// forecast, and it anchors to the series' last real point so the dashed line
// continues the solid one instead of floating beside it.
function buildSubscriberProjection(
  now: Date,
  signups: SignupPoint[],
  conveyor: TrialConveyorSnapshot,
): SubscriberProjection {
  const last = signups.length > 0 ? signups[signups.length - 1] : null;
  const anchorDay = last?.day ?? null;
  const anchorPaying = last?.paying ?? 0;

  // The horizon starts the day AFTER the anchor: the anchor is a real, observed
  // point and must not be overwritten by a projected one.
  const keys = generateDailyKeys(
    new Date(now.getTime() + SUBSCRIBER_PROJECTION_DAYS * 86_400_000),
    SUBSCRIBER_PROJECTION_DAYS + 1,
  );
  const days = anchorDay ? keys.filter((d) => d > anchorDay) : keys;

  const dayOf = (iso: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return etBucketKeys(d).day;
  };

  return {
    horizonDays: SUBSCRIBER_PROJECTION_DAYS,
    anchorDay,
    anchorPaying,
    points: projectFullSubscribers({
      startCount: anchorPaying,
      days,
      // Only trials still heading for a charge become paying subscribers; a
      // rolling-off trialer never joins this line, so they move it by nothing.
      conversionDays: conveyor.riders
        .filter((r) => r.state === 'running')
        .map((r) => dayOf(r.convertsAt)),
      departureDays: conveyor.departures.map((d) => dayOf(d.convertsAt)),
    }),
    undecidedStalled: conveyor.totals.stalled,
  };
}

// ── Subscriber ledger ──────────────────────────────────────────────────────
const LEDGER_WINDOW_DAYS = 30;
// Cap on rows serialized to the client. Well above a normal window's traffic;
// the net totals are computed over every row, so only the list is trimmed.
const LEDGER_MAX_ROWS = 200;

// Reconstruct the headcount's recent history from the same audit streams the
// flow charts read. Named with a trailing underscore because the pure builder it
// delegates to owns the plain name. Any failure yields an empty ledger rather
// than 500-ing the admin page.
function buildSubscriberLedger_(now: Date): SubscriberLedgerSnapshot {
  const empty: SubscriberLedgerSnapshot = {
    windowDays: LEDGER_WINDOW_DAYS,
    rows: [],
    truncated: 0,
    net: { fullSubscriber: 0, freeTrial: 0, trialGrace: 0 },
    generatedAt: now.toISOString(),
  };
  try {
    const db = getDb();
    // Scanned oldest-first so each subscription's prior state is known before
    // the transition that changes it. A sub's history may start before the
    // display window, so the scan reaches further back than the window and the
    // rows are filtered to the window afterwards — otherwise a member whose
    // first sync predates it would render as a spurious "new subscriber".
    const since = LEDGER_WINDOW_DAYS * 2;
    const syncRows = db
      .prepare(
        `SELECT created_at, user_id, email, message FROM audit_events
         WHERE type = 'stripe_subscription_sync'
           AND created_at > datetime('now', '-${since} days')
         ORDER BY created_at ASC`,
      )
      .all() as Array<{ created_at: string; user_id: string | null; email: string | null; message: string }>;
    const deletedRows = db
      .prepare(
        `SELECT created_at, user_id, email, message FROM audit_events
         WHERE type = 'stripe_subscription_deleted'
           AND created_at > datetime('now', '-${since} days')`,
      )
      .all() as Array<{ created_at: string; user_id: string | null; email: string | null; message: string }>;

    const syncs: LedgerSyncEvent[] = [];
    for (const row of syncRows) {
      const subId = parseSubIdFromMessage(row.message);
      if (!subId) continue;
      syncs.push({
        subId,
        userId: row.user_id,
        email: row.email,
        at: toIsoInstant(row.created_at),
        status: parseSyncStatus(row.message),
        tier: parseSyncTierRaw(row.message),
        cancelAtPeriodEnd: /cancelAtPeriodEnd=true/.test(row.message),
      });
    }
    const deletes: LedgerDeleteEvent[] = deletedRows.map((row) => ({
      subId: parseSubIdFromMessage(row.message),
      userId: row.user_id,
      email: row.email,
      at: toIsoInstant(row.created_at),
      reason: parseCancellationReasonFromMessage(row.message).feedback,
    }));

    const cutoffMs = now.getTime() - LEDGER_WINDOW_DAYS * 86_400_000;
    const all = buildSubscriberLedger(syncs, deletes).filter((r) => Date.parse(r.at) >= cutoffMs);
    return {
      windowDays: LEDGER_WINDOW_DAYS,
      rows: all.slice(0, LEDGER_MAX_ROWS),
      truncated: Math.max(0, all.length - LEDGER_MAX_ROWS),
      net: summarizeLedger(all),
      generatedAt: now.toISOString(),
    };
  } catch {
    return empty;
  }
}

// audit_events.created_at is written by SQLite's datetime() as "YYYY-MM-DD
// HH:MM:SS" with no zone marker, and it is UTC. Normalize to a real ISO instant
// so Date.parse doesn't read it as local time.
function toIsoInstant(createdAt: string): string {
  const trimmed = createdAt.trim();
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed.replace(' ', 'T')}Z`;
}

// The tier token exactly as the sync message carries it, for the ledger's bucket
// classification (which folds the legacy ids itself). parseSyncTierStrict maps
// unknown tokens to null, which would read as "no tier"; here an unrecognized
// token should simply not be a paid tier.
function parseSyncTierRaw(message: string): string | null {
  const m = message.match(/\btier=(\w+)/);
  return m ? m[1] : null;
}

// ── Conversion Conveyor ────────────────────────────────────────────────────
// How far back the audit scan reaches for BOTH the boarding times of trials
// currently in flight and the historical outcome tally. Comfortably longer than
// the longest routine trial (REACTIVATION_TRIAL_DAYS, 30) so an in-flight
// rider's boarding event is still in range, and far cheaper than the 850-day
// flow scan next door — audit_events has no (type, created_at) index.
const CONVEYOR_SYNC_WINDOW_DAYS = 120;
// Trailing window the conversion rate is measured over.
const CONVEYOR_OUTCOMES_WINDOW_DAYS = 30;
// Cap on riders serialized to the client. The belt is naturally small (a 7-day
// trial window), but a promo spike shouldn't balloon the admin payload; the
// totals are computed over ALL riders, so only the visible queue is trimmed.
const CONVEYOR_MAX_RIDERS = 60;

const CONVEYOR_DAY_MS = 86_400_000;

type ConveyorUserRow = {
  id: string;
  email: string | null;
  subId: string | null;
  priceId: string | null;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: number;
  graceStartedAt: string | null;
  graceReason: string | null;
  founding: number;
};

// The live trial→paying assembly line. Three reads, all bounded:
//   • the users table for every trial currently in flight (the riders),
//   • the `stripe_subscription_sync` audit stream for when each one BOARDED
//     (its first `trialing` sync) and for the historical outcomes,
//   • the deletion stream, so a trial cancelled outright is booked as a
//     roll-off rather than silently vanishing.
// Every failure path falls through to an empty belt: this panel must never
// 500 the admin page.
function buildTrialConveyor(now: Date): TrialConveyorSnapshot {
  const graceDays = getPaymentGraceDays();
  const empty: TrialConveyorSnapshot = {
    riders: [],
    truncated: 0,
    departures: [],
    departingValue: 0,
    totals: summarizeRiders([]),
    outcomes: summarizeTrialOutcomes(new Map(), [], CONVEYOR_OUTCOMES_WINDOW_DAYS),
    trialDays: NOMINAL_TRIAL_DAYS,
    graceDays,
    generatedAt: now.toISOString(),
  };

  try {
    const db = getDb();
    const amounts = mrrConfigFromEnv().amounts;

    const userRows = db
      .prepare(
        `SELECT id,
                email,
                stripe_subscription_id AS subId,
                stripe_price_id AS priceId,
                subscription_status AS status,
                current_period_end AS periodEnd,
                cancel_at_period_end AS cancelAtPeriodEnd,
                payment_grace_started_at AS graceStartedAt,
                payment_grace_reason AS graceReason,
                CASE WHEN founding_member_started_at IS NOT NULL
                       AND founding_lifetime_applied_at IS NULL
                     THEN 1 ELSE 0 END AS founding
           FROM users
          WHERE deleted_at IS NULL
            AND (subscription_status = 'trialing'
                 OR (subscription_status = 'past_due' AND payment_grace_reason = 'trial')
                 OR (subscription_status = 'active' AND cancel_at_period_end = 1))`,
      )
      .all() as ConveyorUserRow[];

    const syncRows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_subscription_sync'
           AND created_at > datetime('now', '-${CONVEYOR_SYNC_WINDOW_DAYS} days')
         ORDER BY created_at ASC`,
      )
      .all() as Array<{ created_at: string; message: string }>;
    const deletedRows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
         WHERE type = 'stripe_subscription_deleted'
           AND created_at > datetime('now', '-${CONVEYOR_SYNC_WINDOW_DAYS} days')`,
      )
      .all() as Array<{ created_at: string; message: string }>;

    // First `trialing` sync per subscription = the instant it boarded the belt.
    // Rows are already oldest-first, so the first hit wins.
    const boardedBySub = new Map<string, string>();
    const syncEvents: ConveyorSyncEvent[] = [];
    for (const row of syncRows) {
      const subId = parseSubIdFromMessage(row.message);
      if (!subId) continue;
      const status = parseSyncStatus(row.message);
      if (status === 'trialing' && !boardedBySub.has(subId)) {
        boardedBySub.set(subId, row.created_at);
      }
      syncEvents.push({ subId, status, day: etDayKey(row.created_at) });
    }
    const deleteEvents: ConveyorDeleteEvent[] = deletedRows.map((row) => ({
      subId: parseSubIdFromMessage(row.message),
      day: etDayKey(row.created_at),
    }));

    const riders: ConveyorRider[] = [];
    const departures: ConveyorRider[] = [];
    for (const row of userRows) {
      const state = classifyRider({
        subscriptionStatus: row.status,
        cancelAtPeriodEnd: Number(row.cancelAtPeriodEnd) === 1,
        paymentGraceReason: row.graceReason,
      });
      // A PAYING subscriber with a scheduled cancel isn't on the belt — they
      // already converted — but they are the other thing an operator must not be
      // surprised by, so they get the same countdown treatment below.
      const isScheduledDeparture =
        !state && row.status === 'active' && Number(row.cancelAtPeriodEnd) === 1;
      if (!state && !isScheduledDeparture) continue;

      // The deadline the belt counts down to. A running/rolling-off rider is
      // due at the trial end (Stripe's current_period_end while `trialing`);
      // a stalled one is counted down to the end of its recovery window — the
      // last moment a retry can still convert it.
      let convertsAt: string | null = row.periodEnd;
      if (state === 'stalled') {
        const startedMs = row.graceStartedAt ? Date.parse(row.graceStartedAt) : NaN;
        convertsAt = Number.isFinite(startedMs)
          ? new Date(startedMs + graceDays * CONVEYOR_DAY_MS).toISOString()
          : null;
      }

      // Priced exactly like the MRR snapshot: unmappable price ids contribute
      // $0 rather than a guess, so the belt's value can't silently inflate.
      const sku = row.priceId ? priceIdToSku(row.priceId) : null;
      const founding = Number(row.founding) === 1;
      const monthlyValue = sku ? amounts[sku.tier][sku.cadence][founding ? 'founding' : 'list'] : 0;

      const entry: ConveyorRider = {
        userId: row.id,
        email: row.email,
        // A scheduled departure is presented in the rolling-off lane: same
        // meaning (leaving, not paying again), different stage of the funnel.
        state: state ?? 'rollingOff',
        tier: sku?.tier ?? null,
        cadence: sku?.cadence ?? null,
        founding,
        boardedAt: row.subId ? (boardedBySub.get(row.subId) ?? null) : null,
        convertsAt,
        monthlyValue,
      };
      if (state) riders.push(entry);
      else departures.push(entry);
    }

    const totals = summarizeRiders(riders);
    const ordered = sortRidersByDeadline(riders);
    const outcomes = summarizeTrialOutcomes(
      accumulateTrialOutcomes(syncEvents, deleteEvents),
      generateDailyKeys(now, CONVEYOR_OUTCOMES_WINDOW_DAYS),
      CONVEYOR_OUTCOMES_WINDOW_DAYS,
    );

    return {
      riders: ordered.slice(0, CONVEYOR_MAX_RIDERS),
      truncated: Math.max(0, ordered.length - CONVEYOR_MAX_RIDERS),
      departures: sortRidersByDeadline(departures).slice(0, CONVEYOR_MAX_RIDERS),
      departingValue: departures.reduce((sum, d) => sum + d.monthlyValue, 0),
      totals,
      outcomes,
      trialDays: NOMINAL_TRIAL_DAYS,
      graceDays,
      generatedAt: now.toISOString(),
    };
  } catch {
    // Query/parse failure: render an empty belt rather than 500-ing the page.
    return empty;
  }
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
  // Built once and shared: the projection reads both, and anchoring it to the
  // series' own last point is what makes the dashed line meet the solid one.
  const signups = buildSignupSeries(now);
  const trialConveyor = buildTrialConveyor(now);
  return {
    mrr,
    mrrSeries,
    // The chart shows all retained history, but the headline growth-rate /
    // months-to-target stat stays on the trailing MAX_DAILY window it has
    // always used — otherwise widening the series would silently redefine the
    // rate as a long-run average. (The forward projection line is computed
    // client-side from a shorter trailing window and is unaffected either way.)
    mrrTrend: computeMrrTrend(mrrSeries.slice(-MAX_DAILY), mrr.targetMrr),
    signups,
    signupFlow: buildSignupFlowSeries(now),
    growthRates: buildGrowthRates(now),
    cancellationReasons: buildCancellationReasons(),
    trialConveyor,
    subscriberLedger: buildSubscriberLedger_(now),
    subscriberProjection: buildSubscriberProjection(now, signups, trialConveyor),
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
