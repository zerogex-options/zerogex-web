import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { appendAuditEvent, getClientIp, requireSession, validateCsrf } from '@/core/serverAuth';
import { FOUNDING_LOCKIN_DEADLINE_ISO } from '@/core/foundingLockin';
import {
  getActivePromoCouponId,
  getAppUrl,
  getFoundingIntroCouponId,
  getFoundingPromoCode,
  getStripe,
  isBillableTier,
  isBillingCadence,
  isPaidSignupDisabled,
  skuToPriceId,
  type BillableTier,
  type BillingCadence,
} from '@/core/stripe';
import { getRefereeCouponId, isReferralProgramEnabled } from '@/core/referrals';
import {
  findCreatorByReferralCode,
  getPartnerAudienceCouponId,
  isCreatorPartnerProgramEnabled,
} from '@/core/creatorPartners';

// Card is collected at checkout (Stripe subscription mode defaults
// payment_method_collection to 'always'); tier is granted immediately
// because the webhook treats 'trialing' as active. Once-per-account: a
// churned member resubscribing has paid_welcome_email_sent_at set, so the
// trial is suppressed below — no farming a fresh free week on every cycle.
const TRIAL_PERIOD_DAYS = 7;

// Stripe rejects a trial_end that's effectively now; require at least a
// 48h cushion so timezone slop / clock skew can't push it past the cutoff
// between this branch and the API call.
const MIN_TRIAL_END_BUFFER_MS = 48 * 60 * 60 * 1000;

type UserBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  founding_eligible: number;
  email_verified_at: string | null;
  referred_by_code: string | null;
  paid_welcome_email_sent_at: string | null;
  subscription_lapsed: number;
};

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  if (isPaidSignupDisabled()) {
    return NextResponse.json(
      { error: 'Subscriptions are temporarily unavailable. Please try again later.' },
      { status: 503 },
    );
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (actor.user.tier === 'admin') {
    return NextResponse.json({ error: 'Admin accounts cannot subscribe.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    tier?: unknown;
    cadence?: unknown;
    foundingCode?: unknown;
  };

  if (!isBillableTier(body.tier)) {
    return NextResponse.json({ error: 'tier must be one of basic, pro' }, { status: 400 });
  }
  if (!isBillingCadence(body.cadence)) {
    return NextResponse.json({ error: 'cadence must be one of monthly, annual' }, { status: 400 });
  }
  const tier: BillableTier = body.tier;
  const cadence = body.cadence;
  const foundingCode =
    typeof body.foundingCode === 'string' && body.foundingCode.length > 0
      ? body.foundingCode
      : null;

  const db = getDb();
  const row = db
    .prepare(
      'SELECT stripe_customer_id, stripe_subscription_id, founding_eligible, email_verified_at, referred_by_code, paid_welcome_email_sent_at, subscription_lapsed FROM users WHERE id = ?',
    )
    .get(actor.user.id) as UserBillingRow | undefined;

  if (row?.stripe_subscription_id) {
    return NextResponse.json(
      { error: 'You already have an active subscription. Use the billing portal to change plans.' },
      { status: 409 },
    );
  }

  // Verification gate. The migration backfilled every pre-cutover account, so
  // this only blocks brand-new self-signups who haven't clicked the link yet.
  // The stable `code` lets the pricing client distinguish this from generic
  // failures and surface the "verify your email" banner inline instead of a
  // red error toast.
  if (!row?.email_verified_at) {
    return NextResponse.json(
      {
        error: 'EMAIL_NOT_VERIFIED',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before subscribing.',
      },
      { status: 403 },
    );
  }

  // Resolve any discount before talking to Stripe so we can fail fast on
  // misconfiguration (e.g. founding code accepted but coupon env unset)
  // without leaving a half-created customer behind on retries.
  const discountResult = resolveDiscount({
    tier,
    cadence,
    foundingCode,
    foundingEligible: (row?.founding_eligible ?? 0) === 1,
    referredByCode: row?.referred_by_code ?? null,
  });
  if (!discountResult.ok) {
    return NextResponse.json({ error: discountResult.error }, { status: discountResult.status });
  }

  // Once-per-account trial gate. Anyone who has previously held a paid
  // sub on this account (either a stamped welcome email or the lapsed
  // flag set by clearSubscriptionFromUser) is ineligible.
  const hasPriorPaidSubscription =
    row?.paid_welcome_email_sent_at != null || (row?.subscription_lapsed ?? 0) === 1;
  const trialDays = hasPriorPaidSubscription ? null : TRIAL_PERIOD_DAYS;

  // Founding members get the deferral-to-July-1 trial instead of the 7-day
  // one. Absolute trial_end (not a day count) so every founding member
  // converges on the same first-charge date regardless of when they
  // activate. Intentionally NOT gated by hasPriorPaidSubscription: the
  // deferral is a fixed-deadline founder offer (no recurring-trial-farming
  // risk) and the founding cohort is small and vetted, so a returning
  // founder gets the deferral too. Falls back to trialDays above if the
  // deadline is <48h out or already passed (Stripe would reject the
  // near/past trial_end).
  const foundingDeadlineMs = Date.parse(FOUNDING_LOCKIN_DEADLINE_ISO);
  const foundingTrialEndUnix =
    discountResult.foundingApplied &&
    Number.isFinite(foundingDeadlineMs) &&
    foundingDeadlineMs - Date.now() >= MIN_TRIAL_END_BUFFER_MS
      ? Math.floor(foundingDeadlineMs / 1000)
      : null;

  const stripe = getStripe();
  const appUrl = getAppUrl();

  let customerId = row?.stripe_customer_id ?? null;
  if (customerId) {
    // Verify the cached customer still exists on Stripe before reusing it.
    // Customers can vanish from under us: test-mode artifacts from a
    // previous Stripe env, dashboard deletes, the 5-year inactivity sweep.
    // Without this probe, the next sessions.create blows up with "No such
    // customer" and the user sees the generic "Billing request failed"
    // toast. resource_missing → null the cached id and fall through to
    // re-provision; any other error is real and should propagate.
    try {
      await stripe.customers.retrieve(customerId);
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === 'resource_missing') {
        appendAuditEvent({
          type: 'billing_customer_reprovisioned',
          userId: actor.user.id,
          email: actor.user.email,
          ip: getClientIp(request),
          message: `Stripe customer ${customerId} returned resource_missing; provisioning a fresh customer`,
        });
        customerId = null;
      } else {
        throw err;
      }
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: actor.user.email,
      metadata: { user_id: actor.user.id },
    });
    customerId = customer.id;
    db.prepare('UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?').run(
      customerId,
      new Date().toISOString(),
      actor.user.id,
    );
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    customer: customerId,
    client_reference_id: actor.user.id,
    line_items: [{ price: skuToPriceId({ tier, cadence }), quantity: 1 }],
    success_url: `${appUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    // Stripe Tax: enabled so the Tax engine evaluates every session. Today
    // we have no tax registrations, so Stripe calculates $0 tax for every
    // jurisdiction and nothing changes on the customer's bill. When we
    // register in a state later (Stripe Dashboard → Tax → Registrations),
    // tax automatically starts being charged for customers in that state
    // without a code redeploy.
    //
    // customer_update.address/name is required when automatic_tax is on
    // with an existing customer: Stripe needs explicit permission to write
    // the address it collects during checkout back to the customer object
    // (otherwise the API errors at session-create time).
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    subscription_data: {
      metadata: {
        user_id: actor.user.id,
        tier,
        cadence,
        ...(discountResult.foundingApplied ? { founding: '1' } : {}),
        ...(discountResult.partnerApplied ? { partner_referred: '1' } : {}),
      },
      // Stripe accepts only one of trial_end / trial_period_days. Founding
      // members get the absolute July-1 trial_end; everyone else (first-time
      // only) gets the 7-day day-count trial.
      ...(foundingTrialEndUnix
        ? { trial_end: foundingTrialEndUnix }
        : trialDays
          ? { trial_period_days: trialDays }
          : {}),
    },
  };

  if (discountResult.couponId) {
    // Server-applied discount. Disallow Stripe's promo-code field so customers
    // can't stack a second discount on top of an auto-applied promo or a
    // founding rate.
    sessionParams.discounts = [{ coupon: discountResult.couponId }];
  } else {
    sessionParams.allow_promotion_codes = true;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
  }

  // Funnel marker. The webhook later logs stripe_subscription_sync on
  // payment-complete; pairing the two lets us count "started checkout but
  // didn't pay" without scraping the Stripe dashboard.
  appendAuditEvent({
    type: 'billing_checkout_started',
    userId: actor.user.id,
    email: actor.user.email,
    ip: getClientIp(request),
    message: `tier=${tier} cadence=${cadence} founding=${discountResult.foundingApplied ? '1' : '0'} referral=${discountResult.referralApplied ? '1' : '0'} partner=${discountResult.partnerApplied ? '1' : '0'} trial=${foundingTrialEndUnix ? 'founding_july1' : trialDays ? '7d' : '0'} session=${session.id}`,
  });

  return NextResponse.json({ url: session.url });
}

type DiscountResolution =
  | {
      ok: true;
      couponId: string | null;
      foundingApplied: boolean;
      referralApplied: boolean;
      partnerApplied: boolean;
    }
  | { ok: false; status: number; error: string };

function resolveDiscount(input: {
  tier: BillableTier;
  cadence: BillingCadence;
  foundingCode: string | null;
  foundingEligible: boolean;
  referredByCode: string | null;
}): DiscountResolution {
  if (input.foundingCode) {
    const expected = getFoundingPromoCode();
    if (!expected || input.foundingCode !== expected) {
      return { ok: false, status: 400, error: 'Invalid founding-member code.' };
    }
    if (!input.foundingEligible) {
      return {
        ok: false,
        status: 403,
        error: 'This account is not eligible for the founding-member offer.',
      };
    }
    // Founding intro is per-(tier, cadence). Monthly + annual coupons live in
    // separate env keys; getFoundingIntroCouponId returns null when the
    // matching coupon isn't configured (e.g. annual founding rolled out
    // without the annual coupons being created in Stripe yet).
    const couponId = getFoundingIntroCouponId(input.tier, input.cadence);
    if (!couponId) {
      return {
        ok: false,
        status: 500,
        error: `Founding-member discount is not configured for this plan (${input.tier}/${input.cadence}).`,
      };
    }
    return {
      ok: true,
      couponId,
      foundingApplied: true,
      referralApplied: false,
      partnerApplied: false,
    };
  }

  const promoCouponId = getActivePromoCouponId({ tier: input.tier, cadence: input.cadence });
  if (promoCouponId) {
    return {
      ok: true,
      couponId: promoCouponId,
      foundingApplied: false,
      referralApplied: false,
      partnerApplied: false,
    };
  }

  // Referral-derived discounts. The code can resolve to either:
  //   - a creator partner -> partner audience coupon (richer, monthly only)
  //   - a standard user   -> standard referee coupon (one-shot)
  // Partner wins when both apply because the partner offer is the curated
  // deal we negotiated with the creator and is what their audience was
  // promised. Standard referee is the fallback for everyone else.
  if (input.referredByCode) {
    if (isCreatorPartnerProgramEnabled()) {
      const partner = findCreatorByReferralCode(input.referredByCode);
      if (partner) {
        const partnerCoupon = getPartnerAudienceCouponId(partner, input.cadence);
        if (partnerCoupon) {
          return {
            ok: true,
            couponId: partnerCoupon,
            foundingApplied: false,
            referralApplied: false,
            partnerApplied: true,
          };
        }
        // Partner resolved but no monthly coupon configured / annual cadence.
        // Fall through to the standard referee path so the referee still gets
        // SOMETHING (and the partner still gets attribution + commission via
        // the referred_by_code that's already recorded on the user row).
      }
    }

    if (isReferralProgramEnabled()) {
      const refereeCoupon = getRefereeCouponId(input.cadence);
      if (refereeCoupon) {
        // Defense-in-depth: the monthly referee coupon is 100%-off (first
        // month free). On an annual line item that same coupon would make the
        // entire first YEAR free. The coupon is already keyed to cadence, but
        // guard the env-misconfig case where the annual var was pointed at
        // the monthly coupon — drop the discount rather than give away a
        // free year.
        const monthlyCoupon = getRefereeCouponId('monthly');
        if (input.cadence === 'annual' && monthlyCoupon && refereeCoupon === monthlyCoupon) {
          return {
            ok: true,
            couponId: null,
            foundingApplied: false,
            referralApplied: false,
            partnerApplied: false,
          };
        }
        return {
          ok: true,
          couponId: refereeCoupon,
          foundingApplied: false,
          referralApplied: true,
          partnerApplied: false,
        };
      }
    }
  }

  return {
    ok: true,
    couponId: null,
    foundingApplied: false,
    referralApplied: false,
    partnerApplied: false,
  };
}
