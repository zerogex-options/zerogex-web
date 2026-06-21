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
