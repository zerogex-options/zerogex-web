import Stripe from 'stripe';
import type { TierId } from '@/core/auth';

export type BillableTier = Extract<TierId, 'basic' | 'pro'>;
export type BillingCadence = 'monthly' | 'annual';

export const BILLABLE_TIERS: readonly BillableTier[] = ['basic', 'pro'];
export const BILLING_CADENCES: readonly BillingCadence[] = ['monthly', 'annual'];

export type Sku = {
  tier: BillableTier;
  cadence: BillingCadence;
};

// Stripe price IDs map many-to-one onto tiers (monthly + annual both flow to
// the same tier). The lookup is built once at module load from env vars; any
// missing env just means that SKU isn't sellable until configured.
const SKU_BY_PRICE_ID: Map<string, Sku> = (() => {
  const map = new Map<string, Sku>();
  const add = (priceId: string | undefined, sku: Sku) => {
    if (priceId) map.set(priceId, sku);
  };
  add(process.env.STRIPE_PRICE_BASIC_MONTHLY, { tier: 'basic', cadence: 'monthly' });
  add(process.env.STRIPE_PRICE_BASIC_ANNUAL, { tier: 'basic', cadence: 'annual' });
  add(process.env.STRIPE_PRICE_PRO_MONTHLY, { tier: 'pro', cadence: 'monthly' });
  add(process.env.STRIPE_PRICE_PRO_ANNUAL, { tier: 'pro', cadence: 'annual' });
  return map;
})();

const PRICE_ID_BY_SKU: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [priceId, sku] of SKU_BY_PRICE_ID) {
    map.set(`${sku.tier}:${sku.cadence}`, priceId);
  }
  return map;
})();

let cachedClient: Stripe | null = null;

// The Stripe API version this code is written against, pinned EXPLICITLY rather
// than inheriting stripe-node's built-in default. A future SDK bump must not
// silently change the API version and with it the shape of objects we depend on
// — e.g. subscription.current_period_end moved from the subscription to the
// subscription item in a 2024 version (see getCurrentPeriodEndUnix), and
// pending_setup_intent gating (webhook) assumes the current shapes. stripe-node
// types `apiVersion` as its LATEST known version, so when a newer SDK drops this
// literal from that type, tsc fails HERE — turning an otherwise-silent
// API-version drift into a deliberate, reviewed upgrade. This value is the one
// stripe@17.7.0 already sends by default, so pinning it is a no-op today.
const STRIPE_API_VERSION = '2025-02-24.acacia';

export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  cachedClient = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return cachedClient;
}

export function skuToPriceId(sku: Sku): string {
  const id = PRICE_ID_BY_SKU.get(`${sku.tier}:${sku.cadence}`);
  if (!id) {
    throw new Error(`Stripe price not configured for sku: ${sku.tier}/${sku.cadence}`);
  }
  return id;
}

export function priceIdToSku(priceId: string): Sku | null {
  return SKU_BY_PRICE_ID.get(priceId) ?? null;
}

export function priceIdToTier(priceId: string): BillableTier | null {
  return priceIdToSku(priceId)?.tier ?? null;
}

export function isBillableTier(value: unknown): value is BillableTier {
  return typeof value === 'string' && (BILLABLE_TIERS as readonly string[]).includes(value);
}

export function isBillingCadence(value: unknown): value is BillingCadence {
  return typeof value === 'string' && (BILLING_CADENCES as readonly string[]).includes(value);
}

// Env var that holds the public-promo coupon for a given (tier, cadence). One
// coupon per pair so monthly and annual carry independent Stripe coupons:
//   monthly: repeating, duration_in_months=6 (intro rate for first 6 invoices)
//   annual:  once (intro rate for the first annual invoice)
function promoCouponEnvKey(sku: Sku): string {
  if (sku.cadence === 'monthly') {
    return sku.tier === 'basic'
      ? 'STRIPE_COUPON_PROMO_BASIC_MONTHLY'
      : 'STRIPE_COUPON_PROMO_PRO_MONTHLY';
  }
  return sku.tier === 'basic'
    ? 'STRIPE_COUPON_PROMO_BASIC_ANNUAL'
    : 'STRIPE_COUPON_PROMO_PRO_ANNUAL';
}

// Whether the time-boxed public promo window is currently open.
export function isPromoWindowOpen(): boolean {
  const endAt = process.env.PROMO_END_AT;
  if (!endAt) return false;
  const endTs = Date.parse(endAt);
  return Number.isFinite(endTs) && endTs > Date.now();
}

// The configured promo coupon for a (tier, cadence), regardless of whether the
// promo window is open. Use this when you need to reason about the coupon that
// WOULD be (or already was) attached — e.g. detecting a stale coupon Stripe
// carried across a plan switch after the window has since closed. For the
// "should we attach a promo at checkout" decision, use getActivePromoCouponId.
export function getConfiguredPromoCouponId(sku: Sku): string | null {
  return process.env[promoCouponEnvKey(sku)] ?? null;
}

// Time-boxed public promo: auto-applies while PROMO_END_AT is in the future.
// Returns the coupon ID to attach, or null. If the matching coupon env isn't
// set, the cadence is treated as ineligible even with PROMO_END_AT live.
export function getActivePromoCouponId(sku: Sku): string | null {
  if (!isPromoWindowOpen()) return null;
  return getConfiguredPromoCouponId(sku);
}

// Convenience: returns the list of Stripe coupon IDs currently configured for
// the time-boxed promo (across all tier/cadence pairs). Empty array when
// PROMO_END_AT is unset, in the past, or no matching coupon env is set.
// Used by the webhook + email layer to detect whether a given subscription
// is on the promo by inspecting its applied discounts.
export function getActivePromoCouponIds(): string[] {
  const out: string[] = [];
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      const id = getActivePromoCouponId({ tier, cadence });
      if (id) out.push(id);
    }
  }
  return out;
}

// Display label for the active promo deadline (e.g., "August 15, 2026"), or
// null when the promo is not active. ET-bound so it matches how we describe
// deadlines elsewhere (founding lock-in uses 09:30 ET).
export function getActivePromoDeadlineLabel(): string | null {
  const endAt = process.env.PROMO_END_AT;
  if (!endAt) return null;
  const endTs = Date.parse(endAt);
  if (!Number.isFinite(endTs) || endTs <= Date.now()) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(endTs));
}

// Always-on win-back coupon, applied at checkout when a churned member returns
// through the ?winback=1 link in the ~1-month win-back email (see
// scripts/send-winback.mts and the winback branch of resolveDiscount in
// app/api/billing/checkout/route.ts). Deliberately NOT gated by PROMO_END_AT:
// the public promo is a time-boxed acquisition offer for everyone, whereas the
// win-back is a standing, per-user reactivation offer that only reaches an
// eligible churner (subscription_lapsed=1 AND a win-back email on record). One
// coupon per (tier, cadence), same env structure as the promo coupons above.
// Returns null when the matching coupon env isn't set, which makes the whole
// automated path degrade to the email's evergreen reply-'discount' offer.
export function getWinbackCouponId(sku: Sku): string | null {
  const envKey = (() => {
    if (sku.cadence === 'monthly') {
      return sku.tier === 'basic'
        ? 'STRIPE_COUPON_WINBACK_BASIC_MONTHLY'
        : 'STRIPE_COUPON_WINBACK_PRO_MONTHLY';
    }
    return sku.tier === 'basic'
      ? 'STRIPE_COUPON_WINBACK_BASIC_ANNUAL'
      : 'STRIPE_COUPON_WINBACK_PRO_ANNUAL';
  })();
  return process.env[envKey] ?? null;
}

// Founding intro coupon for the locked rate during the first 12 months.
// Stripe has 4 distinct coupons here, one per (tier, cadence) combo:
//   basic monthly: $27 off (locks $39 -> $12/mo, applies for 12 invoices)
//   basic annual:  $79 off (locks $199 -> $120/yr, applies for 1 invoice)
//   pro monthly:   $40 off (locks $59 -> $19/mo, applies for 12 invoices)
//   pro annual:    $109 off (locks $299 -> $190/yr, applies for 1 invoice)
// Returns null if the matching coupon env isn't set — the page-level
// configuration check 404s the /founding route when monthly coupons are
// missing, and the annual cadence is opt-in (toggle only renders when both
// annual coupons exist).
export function getFoundingIntroCouponId(
  tier: BillableTier,
  cadence: BillingCadence,
): string | null {
  if (cadence === 'monthly') {
    const envKey =
      tier === 'basic' ? 'STRIPE_COUPON_FOUNDING_BASIC_INTRO' : 'STRIPE_COUPON_FOUNDING_PRO_INTRO';
    return process.env[envKey] ?? null;
  }
  const envKey =
    tier === 'basic'
      ? 'STRIPE_COUPON_FOUNDING_BASIC_INTRO_ANNUAL'
      : 'STRIPE_COUPON_FOUNDING_PRO_INTRO_ANNUAL';
  return process.env[envKey] ?? null;
}

// Every cadence-specific "rate" coupon the app manages: the public promo and
// the founding intro coupons, across all (tier, cadence) combos. Read straight
// from env and deliberately NOT gated by the promo window — a promo coupon left
// on a subscription after its window closed is still one of ours to reconcile.
//
// The webhook uses this on a plan/cadence switch to recognize a stale,
// cadence-mismatched coupon Stripe carried across the switch (e.g. a 6-month
// monthly promo that must not ride along on the annual invoice) so it can be
// swapped for the correct one or removed. Win-back and referral coupons are
// intentionally excluded: they're one-shot signup offers the webhook does not
// re-derive on a switch, and the founding lifetime coupon is excluded because
// it isn't cadence-specific and validly persists across any switch.
export function getManagedCadenceCouponIds(): string[] {
  const ids = new Set<string>();
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      const promo = getConfiguredPromoCouponId({ tier, cadence });
      if (promo) ids.add(promo);
      const founding = getFoundingIntroCouponId(tier, cadence);
      if (founding) ids.add(founding);
    }
  }
  return [...ids];
}

// 25%-off lifetime coupon, applied by the webhook 12 months after founding
// redemption. Applies on any cadence the user may have switched to.
export function getFoundingLifetimeCouponId(): string | null {
  return process.env.STRIPE_COUPON_FOUNDING_LIFETIME ?? null;
}

export function getFoundingPromoCode(): string | null {
  const code = process.env.FOUNDING_PROMO_CODE;
  return code && code.length > 0 ? code : null;
}

export function isPaidSignupDisabled(): boolean {
  return process.env.BILLING_PAID_SIGNUP_DISABLED === '1';
}

// Payment-recovery grace window, in days, for an established (previously
// `active`) subscription whose RENEWAL charge fails. Within this window the
// webhook keeps the member on their paid tier while Stripe's Smart Retries work
// the card, instead of dropping them to 'public' on the first `past_due` event.
// This targets INVOLUNTARY churn: a good customer with a momentary decline
// (insufficient funds, a bank fraud hold, an expired card they fix in the
// portal) shouldn't be locked out instantly when the charge would very likely
// recover on retry.
//
// Deliberately bounded and env-tunable so it can never become "weeks of free
// premium": default 3 days, clamped to [0, 14]. Set BILLING_PAYMENT_GRACE_DAYS=0
// to restore the old instant-downgrade behavior. The SAME window length is used
// for trial-conversion failures when trial grace is enabled (see
// getTrialGraceEnabled) — a trial requires a card at checkout, so its first
// charge declining is the same recoverable case as a renewal decline.
const DEFAULT_PAYMENT_GRACE_DAYS = 3;
export function getPaymentGraceDays(): number {
  const raw = Number(process.env.BILLING_PAYMENT_GRACE_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_PAYMENT_GRACE_DAYS;
  return Math.max(0, Math.min(14, Math.floor(raw)));
}

// Whether a trial-conversion failure (trialing → past_due at trial end) also
// gets the bounded payment-recovery grace window above, instead of dropping to
// 'public' the instant the first charge fails. Trials already require a card at
// checkout, so a declined first charge is usually a recoverable decline
// (insufficient funds that day, a bank hold), not a bogus card — grace lets
// Stripe's Smart Retries recover the conversion. Defaults ON; set
// BILLING_TRIAL_GRACE_ENABLED=0 to restore the hard trial-end downgrade. Has no
// effect when grace is globally disabled (BILLING_PAYMENT_GRACE_DAYS=0).
export function getTrialGraceEnabled(): boolean {
  return process.env.BILLING_TRIAL_GRACE_ENABLED !== '0';
}

// Whether the Stripe webhook may automatically restore a member whose payment
// was ORPHANED — i.e. Stripe canceled their subscription for nonpayment, they
// then paid the still-open invoice from a dunning email, and no
// customer.subscription.* event exists to grant their tier back (see
// core/orphanPayment.ts). Recovery re-creates the same plan with billing
// anchored at the end of the period they just paid for, so they are never
// charged twice.
//
// Defaults ON: leaving collected money with no entitlement is the worse
// failure, and the decision is narrow (paid, non-zero, member on 'public', a
// cataloged price, a period that has not elapsed). Set
// BILLING_ORPHAN_RECOVERY_ENABLED=0 to detect-and-log only — the
// billing_orphan_payment_detected audit row is written either way, so nothing
// goes silent when this is off; recover by hand with
// `make recover-orphan-payment EMAIL=<addr> YES=1`.
export function getOrphanPaymentRecoveryEnabled(): boolean {
  return process.env.BILLING_ORPHAN_RECOVERY_ENABLED !== '0';
}

// Billing portal configuration id (bpc_...). When set, the portal route
// passes it explicitly as `configuration` so we use this exact configuration
// regardless of Stripe's account-level default. When unset, the portal falls
// back to Stripe's default config (Stripe's API does not allow flipping the
// is_default flag via update — only at creation — so pinning the id here is
// the auditable, env-driven alternative).
export function getPortalConfigId(): string | null {
  const id = process.env.STRIPE_PORTAL_CONFIG_ID;
  return id && id.length > 0 ? id : null;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// Create a Stripe billing-portal session for a customer, pinning
// STRIPE_PORTAL_CONFIG_ID when set (else Stripe's account-default config). Shared
// by the portal route and the change-plan route so both open the SAME configured
// portal — the one setup-billing-portal.mts provisions with plan switching +
// continue-trial. Keeping it in one place means a portal-config change can't apply
// to one entry point and not the other.
export function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  const portalConfigId = getPortalConfigId();
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    ...(portalConfigId ? { configuration: portalConfigId } : {}),
  });
}

export function getCurrentPeriodEndUnix(subscription: Stripe.Subscription): number | null {
  // API versions from 2024-onward expose current_period_end on the subscription item.
  // Older versions had it on the subscription itself. Read both for compatibility.
  const item = subscription.items?.data?.[0];
  const itemValue = (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  if (typeof itemValue === 'number') return itemValue;
  const subValue = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof subValue === 'number') return subValue;
  return null;
}
