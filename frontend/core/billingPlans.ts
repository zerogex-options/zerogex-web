// The plan catalogue and the two policies that hang off it — which plans start
// with a free trial, and which are sold under the 7-day money-back guarantee —
// in one PURE module (no Stripe, no DB, no env reads at import), so the pricing
// page, checkout, the plan-switch route, the refund flow and the unit tests all
// read the same answers.
//
// THE POLICY (effective October 2026):
//   • Basic monthly is the only plan with a free trial: card on file, nothing
//     charged until the trial ends, cancel any time before then.
//   • Every other plan — Pro monthly, and both tiers quarterly and annual — is
//     paid up front and covered by a 7-day money-back guarantee instead: ask for
//     a refund within 7 days of paying and it is refunded in full and access
//     ends at once. Limit one refund per customer.
//
// So each plan carries exactly one of the two protections. That coupling is
// deliberate and is why BILLING_TRIAL_PLANS (see parseTrialPlans) is the only
// knob: putting a plan back on a trial takes it off the guarantee, and vice
// versa, so the page can never promise both or neither.
//
// Stripe is the source of truth for what is actually CHARGED (price ids and
// coupons in env, read by core/stripe.ts). The dollar figures below are what the
// pricing page SHOWS; scripts/setup-pricing.mts --verify checks them against the
// live Stripe objects before launch, so the two cannot drift silently.

export type BillableTier = 'basic' | 'pro';
export type BillingCadence = 'monthly' | 'quarterly' | 'annual';

export type Sku = {
  tier: BillableTier;
  cadence: BillingCadence;
};

export const BILLABLE_TIERS: readonly BillableTier[] = ['basic', 'pro'];
export const BILLING_CADENCES: readonly BillingCadence[] = ['monthly', 'quarterly', 'annual'];

// Months covered by one invoice at each cadence.
export const CADENCE_MONTHS: Record<BillingCadence, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

// List price per billing period, in whole US dollars.
export const LIST_PRICE_USD: Record<BillableTier, Record<BillingCadence, number>> = {
  basic: { monthly: 39, quarterly: 75, annual: 199 },
  pro: { monthly: 59, quarterly: 115, annual: 299 },
};

// The public limited-time promo as ADVERTISED: a fixed amount off the monthly
// plans for the first N monthly invoices. Only a plan the page advertises the
// promo on is ever discounted by it (isPromoAdvertised, enforced by
// core/stripe.ts getActivePromoCouponId), so a promo coupon left configured for
// a cadence the page does not advertise — an old annual promo coupon still in
// .env.local, say — can never discount a checkout silently.
export const MONTHLY_PROMO = {
  amountOffUsd: 10,
  months: 12,
} as const;

// Days after a guarantee-covered payment during which a full refund can be
// requested. Counted from the moment the first payment on the subscription
// cleared.
export const MONEY_BACK_GUARANTEE_DAYS = 7;

export function isBillableTier(value: unknown): value is BillableTier {
  return typeof value === 'string' && (BILLABLE_TIERS as readonly string[]).includes(value);
}

export function isBillingCadence(value: unknown): value is BillingCadence {
  return typeof value === 'string' && (BILLING_CADENCES as readonly string[]).includes(value);
}

export function skuKey(sku: Sku): string {
  return `${sku.tier}:${sku.cadence}`;
}

// ---------------------------------------------------------------------------
// Trial vs. guarantee
// ---------------------------------------------------------------------------

export const DEFAULT_TRIAL_PLANS: readonly string[] = ['basic:monthly'];

// Parse BILLING_TRIAL_PLANS: a comma-separated list of tier:cadence pairs that
// start with a free trial, e.g. "basic:monthly,pro:monthly". Unset or blank means
// the default (Basic monthly only). The literal "none" turns trials off
// everywhere. Unrecognized entries are ignored rather than fatal — a typo must
// not take checkout down — but if NOTHING recognizable is left, the default
// applies, so a garbled value can never silently remove the free trial from the
// plan the site advertises it on.
//
// This exists as an operational lever, not a feature: restoring the old
// behaviour (every plan trials) is BILLING_TRIAL_PLANS=basic:monthly,pro:monthly,
// basic:annual,pro:annual plus a restart, no deploy.
export function parseTrialPlans(raw: string | null | undefined): ReadonlySet<string> {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return new Set(DEFAULT_TRIAL_PLANS);
  if (value === 'none') return new Set();
  const out = new Set<string>();
  for (const part of value.split(',')) {
    const [tier, cadence] = part.trim().split(':').map((s) => s?.trim());
    if (isBillableTier(tier) && isBillingCadence(cadence)) out.add(`${tier}:${cadence}`);
  }
  return out.size > 0 ? out : new Set(DEFAULT_TRIAL_PLANS);
}

export function planHasFreeTrial(sku: Sku, trialPlans: ReadonlySet<string>): boolean {
  return trialPlans.has(skuKey(sku));
}

// Every plan that does not trial is sold under the money-back guarantee.
export function planHasMoneyBackGuarantee(sku: Sku, trialPlans: ReadonlySet<string>): boolean {
  return !planHasFreeTrial(sku, trialPlans);
}

// ---------------------------------------------------------------------------
// Display math
// ---------------------------------------------------------------------------

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

// The monthly-equivalent of a plan's list price: what the page quotes as
// "≈ $25/mo" so every cadence reads on one axis.
export function perMonthEquivalentUsd(sku: Sku): number {
  return roundCents(LIST_PRICE_USD[sku.tier][sku.cadence] / CADENCE_MONTHS[sku.cadence]);
}

// Whole-percent saving of a plan versus paying the monthly LIST price for the
// same months. Null for the monthly plan itself.
export function savingsVsMonthlyPct(sku: Sku): number | null {
  if (sku.cadence === 'monthly') return null;
  const monthly = LIST_PRICE_USD[sku.tier].monthly;
  const perMonth = LIST_PRICE_USD[sku.tier][sku.cadence] / CADENCE_MONTHS[sku.cadence];
  return Math.round((1 - perMonth / monthly) * 100);
}

// The largest saving any tier gets at this cadence — the "Save up to N%" badge
// on the cadence toggle.
export function maxSavingsPct(cadence: BillingCadence): number | null {
  const values = BILLABLE_TIERS.map((tier) => savingsVsMonthlyPct({ tier, cadence })).filter(
    (v): v is number => v != null,
  );
  return values.length ? Math.max(...values) : null;
}

// The advertised promo price for one billing period, or null when the promo is
// not advertised on that plan. Monthly plans only.
export function promoPriceUsd(sku: Sku): number | null {
  if (sku.cadence !== 'monthly') return null;
  return Math.max(0, LIST_PRICE_USD[sku.tier].monthly - MONTHLY_PROMO.amountOffUsd);
}

export function isPromoAdvertised(sku: Sku): boolean {
  return promoPriceUsd(sku) != null;
}

export type PlanDisplay = {
  tier: BillableTier;
  cadence: BillingCadence;
  // Amount billed each period at list price.
  listPrice: number;
  // listPrice spread over the months it covers.
  perMonth: number;
  // Saving versus the monthly list price; null on monthly.
  savingsPct: number | null;
  // Advertised promo price per period, when the promo covers this cadence.
  promoPrice: number | null;
  // How many billing periods the promo price lasts.
  promoPeriods: number | null;
};

export function planDisplay(sku: Sku): PlanDisplay {
  const promoPrice = promoPriceUsd(sku);
  return {
    tier: sku.tier,
    cadence: sku.cadence,
    listPrice: LIST_PRICE_USD[sku.tier][sku.cadence],
    perMonth: perMonthEquivalentUsd(sku),
    savingsPct: savingsVsMonthlyPct(sku),
    promoPrice,
    promoPeriods: promoPrice == null ? null : MONTHLY_PROMO.months,
  };
}

// "$25" for whole dollars, "$16.58" otherwise.
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

// What a member is billed, in whole dollars ("$199"). Every list and promo
// price is a whole-dollar amount; rounding only guards display.
export function formatBilledUsd(amount: number): string {
  return `$${Math.round(amount)}`;
}

// A monthly equivalent, always to the cent ("$16.58", "$25.00"), so the
// per-month column reads uniformly.
export function formatPerMonthUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
