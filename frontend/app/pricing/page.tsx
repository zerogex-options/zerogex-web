import { cookies } from 'next/headers';
import {
  BILLABLE_TIERS,
  BILLING_CADENCES,
  getActivePromoCouponId,
  getActivePromoDeadlineLabel,
  getSellableCadences,
  getTrialPlans,
  priceIdToSku,
  type BillingCadence,
  type Sku,
} from '@/core/stripe';
import { getDb } from '@/core/db';
import { hasPriorMoneyBackRefund } from '@/core/moneyBackServer';
import { isReferralProgramEnabled } from '@/core/referrals';
import { normalizeCampaignCode } from '@/core/campaigns';
import { REFERRAL_COOKIE_NAME, requireSession } from '@/core/serverAuth';
import PricingClient from './Client';

// /pricing takes ~4,400 search impressions a quarter at position ~3 (it is a
// brand sitelink) and converts about 1% of them. The snippet names what the
// plans buy, the trial and the guarantee.
// The billing periods named are the ones actually on sale (quarterly appears
// once its prices are configured).
export function generateMetadata() {
  const billing = getSellableCadences().includes('quarterly')
    ? 'Monthly, quarterly or annual billing.'
    : 'Monthly or annual billing.';
  return {
    title: 'ZeroGEX Pricing: Basic & Pro Plans, 7-Day Free Trial',
    description: `ZeroGEX pricing: Basic and Pro plans for real-time GEX, dealer positioning and signals on SPX, SPY, QQQ and NDX. 7-day free trial on Basic monthly, 7-day money-back guarantee on every other plan. ${billing}`,
    alternates: { canonical: '/pricing' },
  };
}

// Public pricing page. Reads env state server-side (active promo coupon
// configuration per cadence, which billing periods have Stripe prices, which
// plans trial) and hands the client just enough to render the right CTAs. The
// actual price-charged decision is always the server's: the client passes
// (tier, cadence) and the /api/billing/checkout route resolves the Stripe price
// ID, the trial and the applicable coupon.
//
// The founding-member rate has its own page at /founding (server-gated by
// FOUNDING_PROMO_CODE env) — we don't surface a "Founding member?" code
// input here so the public pricing page reads clean.
export default async function PricingPage() {
  // A cadence's promo is live only when BOTH tiers carry the coupon — the page
  // shows one offer per cadence, never a half-configured one.
  const promoActiveByCadence = Object.fromEntries(
    BILLING_CADENCES.map((cadence) => [
      cadence,
      BILLABLE_TIERS.every((tier) => getActivePromoCouponId({ tier, cadence }) !== null),
    ]),
  ) as Record<BillingCadence, boolean>;
  const promoDeadlineLabel = getActivePromoDeadlineLabel();

  // A campaign visitor (business-card ?ref=TARGET) carries the zgx_ref cookie
  // set on /register. Classify it server-side so the client shows the neutral
  // discount banner rather than the person-to-person "a friend referred you"
  // copy — campaign codes resolve to a coupon, not a referrer.
  const cookieStore = await cookies();
  const campaignActive =
    normalizeCampaignCode(cookieStore.get(REFERRAL_COOKIE_NAME)?.value ?? null) !== null;

  // The signed-in member's plan and status, so a card is "Current plan" only
  // when tier AND billing period match, and the guarantee note appears only
  // where it would actually cover them. Read from the synced users row — the
  // same one checkout and change-plan act on.
  let currentPlan: Sku | null = null;
  let subscriptionStatus: string | null = null;
  let guaranteeUsed = false;
  const actor = await requireSession();
  if (actor) {
    const row = getDb()
      .prepare('SELECT stripe_subscription_id, stripe_price_id, subscription_status FROM users WHERE id = ?')
      .get(actor.user.id) as
      | { stripe_subscription_id: string | null; stripe_price_id: string | null; subscription_status: string | null }
      | undefined;
    if (row?.stripe_subscription_id) {
      currentPlan = row.stripe_price_id ? priceIdToSku(row.stripe_price_id) : null;
      subscriptionStatus = row.subscription_status;
    }
    guaranteeUsed = hasPriorMoneyBackRefund({
      userId: actor.user.id,
      email: actor.user.email,
      cardFingerprint: null,
      subscriptionId: '',
    });
  }

  return (
    <PricingClient
      promoActiveByCadence={promoActiveByCadence}
      promoDeadlineLabel={promoDeadlineLabel}
      sellableCadences={getSellableCadences()}
      trialPlanKeys={[...getTrialPlans()]}
      referralEnabled={isReferralProgramEnabled()}
      campaignActive={campaignActive}
      currentPlan={currentPlan}
      subscriptionStatus={subscriptionStatus}
      guaranteeUsed={guaranteeUsed}
    />
  );
}
