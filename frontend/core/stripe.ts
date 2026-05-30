import Stripe from 'stripe';
import { TierId } from '@/core/auth';

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

export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  cachedClient = new Stripe(key);
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

// Time-boxed public promo: auto-applies to monthly checkouts while
// PROMO_END_AT is in the future. Returns the coupon ID to attach, or null.
// Annual is intentionally not eligible (per spec: promo is monthly-only).
export function getActivePromoCouponId(sku: Sku): string | null {
  if (sku.cadence !== 'monthly') return null;
  const endAt = process.env.PROMO_END_AT;
  if (!endAt) return null;
  const endTs = Date.parse(endAt);
  if (!Number.isFinite(endTs) || endTs <= Date.now()) return null;
  const envKey =
    sku.tier === 'basic' ? 'STRIPE_COUPON_PROMO_BASIC_MONTHLY' : 'STRIPE_COUPON_PROMO_PRO_MONTHLY';
  return process.env[envKey] ?? null;
}

// Founding intro coupon for the 12-month locked rate ($12 basic / $19 pro).
// Monthly-only; pro coupon for pro, basic for basic. Returns null if not
// configured for that tier (in which case the redemption should be refused).
export function getFoundingIntroCouponId(tier: BillableTier): string | null {
  const envKey =
    tier === 'basic' ? 'STRIPE_COUPON_FOUNDING_BASIC_INTRO' : 'STRIPE_COUPON_FOUNDING_PRO_INTRO';
  return process.env[envKey] ?? null;
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

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function getCurrentPeriodEndUnix(subscription: Stripe.Subscription): number | null {
  // API versions from 2024-onwards expose current_period_end on the subscription item.
  // Older versions had it on the subscription itself. Read both for compatibility.
  const item = subscription.items?.data?.[0];
  const itemValue = (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  if (typeof itemValue === 'number') return itemValue;
  const subValue = (subscription as unknown as { current_period_end?: number }).current_period_end;
  if (typeof subValue === 'number') return subValue;
  return null;
}
