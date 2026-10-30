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
import { PUBLISHER_REF, SITE_URL } from '@/core/articleRegistry';
import { pricingJsonLd } from '@/core/pricingJsonLd';
import { isTrialProUpgradeOpen } from '@/core/trialProUpgrade';
import PricingClient from './Client';

// The trial end, while a Basic monthly trialer is inside the two-day Pro upgrade
// window at this moment; null otherwise. A trialing subscription's period ends
// when its trial does. Outside the component so the render reads no clock.
function trialProUpgradeUntilNow(
  status: string | null,
  currentPlan: Sku | null,
  periodEndIso: string | null,
): string | null {
  const trialEndMs = periodEndIso ? Date.parse(periodEndIso) : null;
  return isTrialProUpgradeOpen({ status, current: currentPlan, trialEndMs, nowMs: Date.now() }) ? periodEndIso : null;
}

// /pricing takes ~4,400 search impressions a quarter at position ~3 (it is a
// brand sitelink) and converts about 1% of them. The snippet names what the
// plans buy, the trial and the guarantee, and stays under the ~160 characters
// Google shows before cutting a description mid-sentence. The billing periods
// on sale are in the structured data below rather than the snippet.
export const metadata = {
  title: 'ZeroGEX Pricing: Basic & Pro Plans, Free Trial on Basic',
  description:
    'ZeroGEX pricing: Basic and Pro plans for real-time GEX, dealer positioning and signals on SPX, SPY, QQQ, NDX. 7-day free trial on Basic, money-back guarantee.',
  alternates: { canonical: '/pricing' },
};

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
  // When the trial ends, for a Basic monthly trialer inside the two-day Pro
  // upgrade window (core/trialProUpgrade.ts): the Pro card then says the rest
  // of the trial stays free instead of promising the guarantee.
  let trialProUpgradeUntil: string | null = null;
  let guaranteeUsed = false;
  const actor = await requireSession();
  if (actor) {
    const row = getDb()
      .prepare(
        'SELECT stripe_subscription_id, stripe_price_id, subscription_status, current_period_end FROM users WHERE id = ?',
      )
      .get(actor.user.id) as
      | {
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          subscription_status: string | null;
          current_period_end: string | null;
        }
      | undefined;
    if (row?.stripe_subscription_id) {
      currentPlan = row.stripe_price_id ? priceIdToSku(row.stripe_price_id) : null;
      subscriptionStatus = row.subscription_status;
      trialProUpgradeUntil = trialProUpgradeUntilNow(subscriptionStatus, currentPlan, row.current_period_end);
    }
    guaranteeUsed = hasPriorMoneyBackRefund({
      userId: actor.user.id,
      email: actor.user.email,
      cardFingerprint: null,
      subscriptionId: '',
    });
  }

  // Offer structured data for the plans on sale. Quarterly appears only once
  // its Stripe prices exist, the same rule the cards follow; monthly and
  // annual are always sold, so an env with no price ids (local dev) still
  // describes the two the public page has always offered.
  const sellableCadences = getSellableCadences();
  const jsonLd = pricingJsonLd({
    siteUrl: SITE_URL,
    publisher: PUBLISHER_REF,
    cadences: sellableCadences.length ? sellableCadences : ['monthly', 'annual'],
  });

  return (
    <>
      <script
        type="application/ld+json"
        // Built from typed constants with no user input, same pattern as
        // components/SiteJsonLd.tsx.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingClient
        promoActiveByCadence={promoActiveByCadence}
        promoDeadlineLabel={promoDeadlineLabel}
        sellableCadences={sellableCadences}
        trialPlanKeys={[...getTrialPlans()]}
        referralEnabled={isReferralProgramEnabled()}
        campaignActive={campaignActive}
        currentPlan={currentPlan}
        subscriptionStatus={subscriptionStatus}
        trialProUpgradeUntil={trialProUpgradeUntil}
        guaranteeUsed={guaranteeUsed}
      />
    </>
  );
}
