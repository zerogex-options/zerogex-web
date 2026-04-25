import Stripe from 'stripe';
import { TierId } from '@/core/auth';

export type BillableTier = Extract<TierId, 'starter' | 'pro' | 'elite'>;

export const BILLABLE_TIERS: readonly BillableTier[] = ['starter', 'pro', 'elite'];

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

export function tierToPriceId(tier: BillableTier): string {
  const map: Record<BillableTier, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    elite: process.env.STRIPE_PRICE_ELITE,
  };
  const id = map[tier];
  if (!id) {
    throw new Error(`Stripe price not configured for tier: ${tier}`);
  }
  return id;
}

export function priceIdToTier(priceId: string): BillableTier | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_ELITE) return 'elite';
  return null;
}

export function isBillableTier(value: unknown): value is BillableTier {
  return typeof value === 'string' && (BILLABLE_TIERS as readonly string[]).includes(value);
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
