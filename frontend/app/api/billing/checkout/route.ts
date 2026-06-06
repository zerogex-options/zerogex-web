import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { appendAuditEvent, getClientIp, requireSession, validateCsrf } from '@/core/serverAuth';
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

type UserBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  founding_eligible: number;
  email_verified_at: string | null;
  referred_by_code: string | null;
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
      'SELECT stripe_customer_id, stripe_subscription_id, founding_eligible, email_verified_at, referred_by_code FROM users WHERE id = ?',
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
      },
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
    message: `tier=${tier} cadence=${cadence} founding=${discountResult.foundingApplied ? '1' : '0'} referral=${discountResult.referralApplied ? '1' : '0'} session=${session.id}`,
  });

  return NextResponse.json({ url: session.url });
}

type DiscountResolution =
  | { ok: true; couponId: string | null; foundingApplied: boolean; referralApplied: boolean }
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
    if (input.cadence !== 'monthly') {
      return {
        ok: false,
        status: 400,
        error: 'The founding-member rate is available on monthly plans only.',
      };
    }
    const couponId = getFoundingIntroCouponId(input.tier);
    if (!couponId) {
      return {
        ok: false,
        status: 500,
        error: 'Founding-member discount is not configured for this plan.',
      };
    }
    return { ok: true, couponId, foundingApplied: true, referralApplied: false };
  }

  const promoCouponId = getActivePromoCouponId({ tier: input.tier, cadence: input.cadence });
  if (promoCouponId) {
    return { ok: true, couponId: promoCouponId, foundingApplied: false, referralApplied: false };
  }

  // Referee discount: a referred user gets first-month-free (monthly) or
  // 10%-off-first-year (annual). Lowest priority — founding and the time-boxed
  // promo above intentionally win so discounts never stack.
  if (input.referredByCode && isReferralProgramEnabled()) {
    const refereeCoupon = getRefereeCouponId(input.cadence);
    if (refereeCoupon) {
      // Defense-in-depth: the monthly referee coupon is 100%-off (first month
      // free). On an annual line item that same coupon would make the entire
      // first YEAR free. The coupon is already keyed to cadence, but guard the
      // env-misconfig case where the annual var was pointed at the monthly
      // coupon — drop the discount rather than give away a free year.
      const monthlyCoupon = getRefereeCouponId('monthly');
      if (input.cadence === 'annual' && monthlyCoupon && refereeCoupon === monthlyCoupon) {
        return { ok: true, couponId: null, foundingApplied: false, referralApplied: false };
      }
      return { ok: true, couponId: refereeCoupon, foundingApplied: false, referralApplied: true };
    }
  }

  return { ok: true, couponId: null, foundingApplied: false, referralApplied: false };
}
