// Pure pricing + MRR math. No DB, no env side effects at import, no
// `server-only` — so this can be unit-tested directly with `node --test`.
// The monitoring layer (core/monitoring.ts) is responsible for reading the
// live subscriber rows out of SQLite and handing classified buckets here.

export type BillableTier = 'basic' | 'pro';
export type BillingCadence = 'monthly' | 'annual';
// Which price a subscriber is actually paying. `promo` (the time-boxed
// public discount) is intentionally absent: it can't be reconstructed from
// the local user row after checkout, so promo subscribers fall back to
// `list` and the resulting MRR is a documented slight over-estimate.
export type RateClass = 'list' | 'founding';
export type SubscriptionState = 'active' | 'trialing';

// Monthly-normalized USD per (tier, cadence, rate). Annual prices are the
// list/founding annual amounts divided by 12 so everything compares on one
// axis. Defaults mirror app/pricing/Client.tsx (DISPLAY) and the founding
// coupon net prices documented in core/stripe.ts.
export type AmountTable = Record<
  BillableTier,
  Record<BillingCadence, Record<RateClass, number>>
>;

export const DEFAULT_AMOUNTS: AmountTable = {
  basic: {
    monthly: { list: 39, founding: 12 },
    annual: { list: 199 / 12, founding: 120 / 12 },
  },
  pro: {
    monthly: { list: 59, founding: 19 },
    annual: { list: 299 / 12, founding: 190 / 12 },
  },
};

export type MrrConfig = {
  amounts: AmountTable;
  // Annual owner-earnings (SDE) goal — the income the business must throw
  // off to replace a day job. Defaults higher than the gross W-2 figure to
  // cover self-employment tax + lost employer benefits.
  targetGrossIncome: number;
  // Net margin assumption used to convert the income goal into required
  // revenue (income / margin = revenue).
  margin: number;
  // Hard override for the target MRR. When null, target is derived from
  // targetGrossIncome / margin / 12.
  targetMrrOverride: number | null;
};

export const DEFAULT_MRR_CONFIG: MrrConfig = {
  amounts: DEFAULT_AMOUNTS,
  targetGrossIncome: 175_000,
  margin: 0.75,
  targetMrrOverride: null,
};

// One classified group of subscribers sharing the same (tier, cadence,
// rate, state). `count` is how many users fall in that group.
export type SubscriberBucket = {
  tier: BillableTier;
  cadence: BillingCadence;
  rate: RateClass;
  state: SubscriptionState;
  count: number;
};

export type MrrBreakdownRow = {
  tier: BillableTier;
  cadence: BillingCadence;
  rate: RateClass;
  state: SubscriptionState;
  count: number;
  monthlyEach: number;
  monthlyTotal: number;
};

export type MrrSnapshot = {
  // Active subscriptions only — the revenue actually being collected.
  estMrr: number;
  // Active + trialing. Trials have a card on file and convert by default,
  // so this is the "committed" pipeline view.
  committedMrr: number;
  activeSubscribers: number;
  trialingSubscribers: number;
  // Active/trialing users whose price id didn't map to a known SKU, so they
  // couldn't be priced. Surfaced so the estimate stays honest rather than
  // silently dropping revenue.
  unpricedSubscribers: number;
  // estMrr / activeSubscribers (0 when there are no active subscribers).
  arpu: number;
  targetMrr: number;
  targetGrossIncome: number;
  margin: number;
  // estMrr / targetMrr * 100, clamped to [0, 100] for the progress bar.
  progressPct: number;
  // Remaining MRR to reach the target (0 once met).
  gapMrr: number;
  // Additional subscribers at the current ARPU needed to close the gap.
  // null when ARPU is 0 (no basis to extrapolate).
  subscribersToTarget: number | null;
  breakdown: MrrBreakdownRow[];
};

function monthlyAmount(amounts: AmountTable, b: SubscriberBucket): number {
  return amounts[b.tier][b.cadence][b.rate];
}

export function deriveTargetMrr(config: MrrConfig): number {
  if (config.targetMrrOverride !== null && config.targetMrrOverride > 0) {
    return config.targetMrrOverride;
  }
  const margin = config.margin > 0 ? config.margin : 1;
  return config.targetGrossIncome / margin / 12;
}

// Pure MRR computation. `unpricedActive` / `unpricedTrialing` are the
// subscriber counts the caller couldn't price (unknown price id); they're
// reported but contribute $0 so the estimate never silently inflates.
export function computeMrr(input: {
  buckets: SubscriberBucket[];
  unpricedActive: number;
  unpricedTrialing: number;
  config: MrrConfig;
}): MrrSnapshot {
  const { buckets, unpricedActive, unpricedTrialing, config } = input;
  const { amounts } = config;

  let estMrr = 0;
  let committedMrr = 0;
  let activeSubscribers = 0;
  let trialingSubscribers = 0;

  const breakdown: MrrBreakdownRow[] = [];
  for (const b of buckets) {
    if (b.count <= 0) continue;
    const monthlyEach = monthlyAmount(amounts, b);
    const monthlyTotal = monthlyEach * b.count;
    committedMrr += monthlyTotal;
    if (b.state === 'active') {
      estMrr += monthlyTotal;
      activeSubscribers += b.count;
    } else {
      trialingSubscribers += b.count;
    }
    breakdown.push({ ...b, monthlyEach, monthlyTotal });
  }

  activeSubscribers += unpricedActive;
  trialingSubscribers += unpricedTrialing;

  // Sort breakdown for stable, readable display: tier, then cadence, then
  // rate, then state.
  const tierOrder: Record<BillableTier, number> = { pro: 0, basic: 1 };
  const cadenceOrder: Record<BillingCadence, number> = { monthly: 0, annual: 1 };
  const rateOrder: Record<RateClass, number> = { list: 0, founding: 1 };
  const stateOrder: Record<SubscriptionState, number> = { active: 0, trialing: 1 };
  breakdown.sort(
    (a, b) =>
      tierOrder[a.tier] - tierOrder[b.tier] ||
      cadenceOrder[a.cadence] - cadenceOrder[b.cadence] ||
      rateOrder[a.rate] - rateOrder[b.rate] ||
      stateOrder[a.state] - stateOrder[b.state],
  );

  const pricedActive = activeSubscribers - unpricedActive;
  const arpu = pricedActive > 0 ? estMrr / pricedActive : 0;
  const targetMrr = deriveTargetMrr(config);
  const gapMrr = Math.max(0, targetMrr - estMrr);
  const progressPct = targetMrr > 0 ? Math.min(100, Math.max(0, (estMrr / targetMrr) * 100)) : 0;
  const subscribersToTarget = arpu > 0 ? Math.ceil(gapMrr / arpu) : null;

  return {
    estMrr,
    committedMrr,
    activeSubscribers,
    trialingSubscribers,
    unpricedSubscribers: unpricedActive + unpricedTrialing,
    arpu,
    targetMrr,
    targetGrossIncome: config.targetGrossIncome,
    margin: config.margin,
    progressPct,
    gapMrr,
    subscribersToTarget,
    breakdown,
  };
}

// Parse the optional MRR_PRICE_TABLE_JSON env override. Returns DEFAULT_AMOUNTS
// on any problem (missing, malformed, or wrong shape) so a bad env never
// takes the page down — only deep-merging the keys that are present.
export function parseAmountTable(raw: string | undefined): AmountTable {
  if (!raw) return DEFAULT_AMOUNTS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_AMOUNTS;
  }
  if (!parsed || typeof parsed !== 'object') return DEFAULT_AMOUNTS;
  const out: AmountTable = {
    basic: {
      monthly: { ...DEFAULT_AMOUNTS.basic.monthly },
      annual: { ...DEFAULT_AMOUNTS.basic.annual },
    },
    pro: {
      monthly: { ...DEFAULT_AMOUNTS.pro.monthly },
      annual: { ...DEFAULT_AMOUNTS.pro.annual },
    },
  };
  const tiers: BillableTier[] = ['basic', 'pro'];
  const cadences: BillingCadence[] = ['monthly', 'annual'];
  const rates: RateClass[] = ['list', 'founding'];
  const src = parsed as Record<string, unknown>;
  for (const tier of tiers) {
    const tierObj = src[tier];
    if (!tierObj || typeof tierObj !== 'object') continue;
    for (const cadence of cadences) {
      const cadObj = (tierObj as Record<string, unknown>)[cadence];
      if (!cadObj || typeof cadObj !== 'object') continue;
      for (const rate of rates) {
        const v = (cadObj as Record<string, unknown>)[rate];
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          out[tier][cadence][rate] = v;
        }
      }
    }
  }
  return out;
}

// One persisted/plotted point on the historical MRR line. `day` is an ET
// YYYY-MM-DD key (same axis as the signup series).
export type MrrPoint = {
  day: string;
  estMrr: number;
  committedMrr: number;
};

export type MrrTrend = {
  // Days between the first day that had real (estMrr > 0) data and the
  // latest day — the basis for the growth estimate.
  windowDays: number;
  startMrr: number;
  endMrr: number;
  changeMrr: number;
  // Compounded monthly growth rate over the window, as a fraction
  // (0.20 = +20%/mo). null when there isn't enough signal to compute it.
  monthlyGrowthRate: number | null;
  // Naive months to reach the target if the current monthly growth rate
  // holds: 0 when already at/over target, null when growth is flat/negative
  // (so it would never arrive) or can't be computed.
  monthsToTarget: number | null;
};

// Estimate MRR growth from the historical series. Leading carry-forward
// zeros (days before the first real sample) are skipped so a long empty
// runway doesn't dilute the rate. Compounded month-over-month so the
// extrapolation matches how SaaS actually grows. Returns null when the
// series has no real data or only a single day of it.
export function computeMrrTrend(
  points: ReadonlyArray<{ estMrr: number }>,
  targetMrr: number,
): MrrTrend | null {
  const firstIdx = points.findIndex((p) => p.estMrr > 0);
  if (firstIdx < 0) return null;
  const lastIdx = points.length - 1;
  const windowDays = lastIdx - firstIdx;
  if (windowDays <= 0) return null;

  const startMrr = points[firstIdx].estMrr;
  const endMrr = points[lastIdx].estMrr;
  const changeMrr = endMrr - startMrr;

  let monthlyGrowthRate: number | null = null;
  let monthsToTarget: number | null = null;
  if (startMrr > 0 && endMrr > 0) {
    const dailyGrowth = Math.pow(endMrr / startMrr, 1 / windowDays);
    monthlyGrowthRate = Math.pow(dailyGrowth, 30) - 1;
    if (endMrr >= targetMrr) {
      monthsToTarget = 0;
    } else if (monthlyGrowthRate > 0) {
      monthsToTarget = Math.log(targetMrr / endMrr) / Math.log(1 + monthlyGrowthRate);
    }
  }

  return { windowDays, startMrr, endMrr, changeMrr, monthlyGrowthRate, monthsToTarget };
}

// Selectable horizons for the MRR Trend extrapolation dropdown. Months keep
// the projection math simple (calendar-month arithmetic off today's date).
export const MRR_PROJECTION_HORIZONS = [
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 36, label: '3 years' },
] as const;

// How many trailing days set the extrapolation pace: "the growth rate of the
// last one week". Falls back to whatever history exists when short of a week.
export const MRR_PROJECTION_WINDOW_DAYS = 7;

// One extrapolated point on the forward MRR line. `day` is a future ET-style
// YYYY-MM-DD key continuing the historical series' axis.
export type MrrProjectionPoint = {
  day: string;
  projMrr: number;
};

export type MrrProjection = {
  // Trailing days actually used to set the pace — MRR_PROJECTION_WINDOW_DAYS
  // (7) once there's a full week of real data, fewer while history is thin.
  windowDays: number;
  // Absolute dollars-per-day added over that window (negative if MRR is
  // shrinking). A straight line, not compounding — hence "linear progression".
  slopePerDay: number;
  // Latest real MRR: the origin the projection line extends from.
  originMrr: number;
  // Latest historical day key; projection points start the day after.
  originDay: string;
  horizonMonths: number;
  // Projected MRR at the far end of the horizon (clamped at 0).
  horizonMrr: number;
  // Future points, one per day from originDay+1 out to the horizon.
  points: MrrProjectionPoint[];
};

function parseDayKey(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m, d };
}

function formatDayKey(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDayKey(day: string, add: number): string {
  const { y, m, d } = parseDayKey(day);
  return formatDayKey(new Date(Date.UTC(y, m - 1, d + add)));
}

function addMonthsToDayKey(day: string, addMonths: number): string {
  const { y, m, d } = parseDayKey(day);
  return formatDayKey(new Date(Date.UTC(y, m - 1 + addMonths, d)));
}

function diffDayKeys(a: string, b: string): number {
  const pa = parseDayKey(a);
  const pb = parseDayKey(b);
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000,
  );
}

// Extrapolate a straight-line MRR projection from today's value and the pace of
// the trailing `windowDays` (default one week). Linear — a constant dollar
// amount per day — so the dropdown horizons read as a plain runway rather than
// a compounding curve. Leading carry-forward zeros (before the first real
// sample) are skipped, and the pace window is clamped to the history available.
// Returns null when there isn't at least two days of real (estMrr > 0) history
// to set a slope, or the horizon is non-positive.
export function buildMrrProjection(
  series: ReadonlyArray<{ day: string; estMrr: number }>,
  horizonMonths: number,
  opts?: { windowDays?: number },
): MrrProjection | null {
  if (horizonMonths <= 0) return null;
  const firstIdx = series.findIndex((p) => p.estMrr > 0);
  if (firstIdx < 0) return null;
  const lastIdx = series.length - 1;
  const available = lastIdx - firstIdx;
  if (available <= 0) return null;

  const windowDays = Math.min(opts?.windowDays ?? MRR_PROJECTION_WINDOW_DAYS, available);
  const originDay = series[lastIdx].day;
  const originMrr = series[lastIdx].estMrr;
  const startMrr = series[lastIdx - windowDays].estMrr;
  const slopePerDay = (originMrr - startMrr) / windowDays;

  const horizonEnd = addMonthsToDayKey(originDay, horizonMonths);
  const totalDays = diffDayKeys(originDay, horizonEnd);
  const points: MrrProjectionPoint[] = [];
  for (let d = 1; d <= totalDays; d++) {
    points.push({
      day: addDaysToDayKey(originDay, d),
      projMrr: Math.max(0, originMrr + slopePerDay * d),
    });
  }
  const horizonMrr = points.length ? points[points.length - 1].projMrr : originMrr;

  return { windowDays, slopePerDay, originMrr, originDay, horizonMonths, horizonMrr, points };
}

// Tunable inputs for the interactive Growth Projections model. All rates are
// already normalized to per-month before they reach here (the UI converts the
// per-day/week/month acquisition dropdown), so this stays pure arithmetic.
export type GrowthProjectionInputs = {
  // Paying subscribers today — the projection's month-0 base.
  startingSubs: number;
  // Gross new paying subscribers in month 0.
  monthlyAdds: number;
  // Month-over-month acceleration of the add rate, as a fraction: 0 = linear
  // (a steady number of adds each month), 0.15 = adds grow +15%/mo, etc.
  monthlyAccel: number;
  // Fraction of the existing base lost each month. Applied to the base the
  // month's new adds have not joined yet (new signups don't churn same-month).
  monthlyChurn: number;
  // Share of the base on the Pro plan (0..1); the rest are Basic.
  proShare: number;
  proPrice: number;
  basicPrice: number;
  horizonMonths: number;
};

export type GrowthProjectionPoint = {
  // Months from today (0 = now).
  month: number;
  subs: number;
  proSubs: number;
  basicSubs: number;
  mrr: number;
  arr: number;
  // Gross adds and churned subs on the transition out of this month (0 at the
  // final point). Surfaced for the tooltip so the flow is auditable.
  adds: number;
  churned: number;
};

export type GrowthProjection = {
  points: GrowthProjectionPoint[];
  // Blended $/mo per subscriber at the chosen split and prices.
  blendedArpu: number;
  // Convenience handle on the horizon endpoint.
  end: GrowthProjectionPoint;
};

// Project paying subscribers, MRR and ARR forward month by month from today's
// base. Each step keeps the fraction of the base that didn't churn and adds
// that month's new signups, whose count compounds by `monthlyAccel` (0 keeps
// the add rate flat, i.e. linear growth). Pure and deterministic so the UI can
// recompute live on every dropdown/slider change and it can be unit-tested.
export function buildGrowthProjection(inp: GrowthProjectionInputs): GrowthProjection {
  const horizon = Math.max(0, Math.floor(inp.horizonMonths));
  const share = Math.min(1, Math.max(0, inp.proShare));
  const churn = Math.min(1, Math.max(0, inp.monthlyChurn));
  const accel = Math.max(-1, inp.monthlyAccel);
  const blendedArpu = share * inp.proPrice + (1 - share) * inp.basicPrice;

  const points: GrowthProjectionPoint[] = [];
  let subs = Math.max(0, inp.startingSubs);
  for (let m = 0; m <= horizon; m++) {
    const proSubs = subs * share;
    const mrr = subs * blendedArpu;
    const isLast = m === horizon;
    const adds = isLast ? 0 : inp.monthlyAdds * Math.pow(1 + accel, m);
    const churned = isLast ? 0 : subs * churn;
    points.push({
      month: m,
      subs,
      proSubs,
      basicSubs: subs - proSubs,
      mrr,
      arr: mrr * 12,
      adds,
      churned,
    });
    subs = Math.max(0, subs - churned + adds);
  }

  return { points, blendedArpu, end: points[points.length - 1] };
}
