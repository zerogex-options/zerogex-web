import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { appendAuditEvent, getClientIp, requireSession, validateCsrf } from '@/core/serverAuth';
import { getStripe, priceIdToSku } from '@/core/stripe';
import {
  resolveSaveCoupon,
  stackCoupon,
  subscriptionCouponIds,
  SAVE_PERCENT,
} from '@/core/retentionOffer';
import { canOfferRetentionDiscount, discountAuditType } from '@/core/cancelRetention';
import { sanitizeCancellationComment, validateCancelFeedback } from '@/core/cancellationReason';
import { clampPauseMonths, computeResumesAtUnix } from '@/core/subscriptionPause';

// In-app cancellation RETENTION flow — the destination of the account page's
// "Cancel subscription" button (components/CancelRetentionModal). It intercepts a
// member at the moment of cancel intent, BEFORE they reach Stripe's one-click
// portal cancel, and lets us try to keep them:
//
//   • action 'discount' — apply the standing 25%/yr save coupon to the member's
//     current subscription (the same coupon the email-driven /save route uses,
//     via core/retentionOffer), clear any pending cancel, and latch the one-shot
//     retention offer. This is the highest-converting retention moment there is.
//
//   • action 'cancel' — the member declined the offer. Schedule the cancel in
//     app (cancel_at_period_end) AND forward the reason they gave us as Stripe
//     cancellation_details, so the webhook's existing cancel-ack path fires the
//     save email and logs stripe_cancellation_requested WITH the reason — which
//     is what populates the "Why Members Cancel" dashboard. Capturing the reason
//     here means it's collected even when the operator never enabled Stripe's
//     portal cancellation survey.
//
// CSRF + session gated exactly like app/api/billing/change-plan/route.ts.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UserBillingRow = {
  id: string;
  email: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  cancel_at_period_end: number | null;
  current_period_end: string | null;
  stripe_price_id: string | null;
  retention_offer_claimed_at: string | null;
};

function loadBillingRow(userId: string): UserBillingRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, email, stripe_subscription_id, subscription_status, cancel_at_period_end,
                current_period_end, stripe_price_id, retention_offer_claimed_at
         FROM users WHERE id = ?`,
      )
      .get(userId) as UserBillingRow | undefined) ?? null
  );
}

function nowIso() {
  return new Date().toISOString();
}

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (actor.user.tier === 'admin') {
    return NextResponse.json({ error: 'Admin accounts have no subscription.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    feedback?: unknown;
    comment?: unknown;
    months?: unknown;
  };
  const action = body.action;
  if (action !== 'discount' && action !== 'cancel' && action !== 'pause' && action !== 'resume') {
    return NextResponse.json(
      { error: "action must be 'discount', 'pause', 'resume', or 'cancel'" },
      { status: 400 },
    );
  }

  const row = loadBillingRow(actor.user.id);
  if (!row?.stripe_subscription_id) {
    return NextResponse.json(
      { error: 'No active subscription on file.' },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  // -------------------------------------------------------------------------
  // Save: stack the 25%/yr coupon and keep the member.
  // -------------------------------------------------------------------------
  if (action === 'discount') {
    if (
      !canOfferRetentionDiscount({
        subscriptionId: row.stripe_subscription_id,
        subscriptionStatus: row.subscription_status,
        retentionOfferClaimedAt: row.retention_offer_claimed_at,
      })
    ) {
      // Already claimed, or the sub isn't in an offerable state. The modal falls
      // back to letting them proceed to cancel.
      return NextResponse.json(
        { ok: false, reason: row.retention_offer_claimed_at ? 'offer_claimed' : 'not_offerable' },
        { status: 409 },
      );
    }

    const sku = row.stripe_price_id ? priceIdToSku(row.stripe_price_id) : null;
    // A price that doesn't map to a known SKU (misconfigured STRIPE_PRICE_* env)
    // leaves us unable to pick a coupon cadence — don't silently discount at the
    // wrong duration; tell the modal to fall back to the manual path.
    if (!sku) {
      return NextResponse.json({ ok: false, reason: 'unmapped_price' }, { status: 409 });
    }

    let coupon: string;
    try {
      coupon = await resolveSaveCoupon(stripe, sku);
    } catch {
      return NextResponse.json(
        { error: "Couldn't set up the offer just now. Please try again in a minute." },
        { status: 502 },
      );
    }

    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
        expand: ['discounts'],
      });
    } catch {
      return NextResponse.json(
        { error: "Couldn't reach billing just now. Please try again in a minute." },
        { status: 502 },
      );
    }

    // Snapshot BEFORE the update: were they already scheduled to cancel? Drives
    // which audit event we write (win-back offset vs. plain acceptance) so the
    // growth-rate dashboard stays honest. See core/cancelRetention.
    const wasCancelling = Number(row.cancel_at_period_end) === 1;
    const nextCouponIds = stackCoupon(subscriptionCouponIds(subscription), coupon);

    try {
      await stripe.subscriptions.update(subscription.id, {
        discounts: nextCouponIds.map((c) => ({ coupon: c })),
        // Un-cancel (a no-op if they weren't canceling). Never prorate/charge
        // mid-period; the stacked discount rides the next invoice only.
        cancel_at_period_end: false,
        proration_behavior: 'none',
      });
    } catch {
      return NextResponse.json(
        { error: "Couldn't apply the offer just now. Please try again in a minute." },
        { status: 502 },
      );
    }

    // Mirror locally (the webhook reconciles to the same values, idempotently):
    // clear the cancel flag + its ack latch so a future re-cancel re-acks, and
    // stamp the one-shot save latch (COALESCE keeps the first claim instant on a
    // double-submit).
    const stamp = nowIso();
    try {
      getDb()
        .prepare(
          `UPDATE users SET
             cancel_at_period_end = 0,
             cancel_ack_email_sent_at = NULL,
             retention_offer_claimed_at = COALESCE(retention_offer_claimed_at, ?),
             updated_at = ?
           WHERE id = ?`,
        )
        .run(stamp, stamp, row.id);
    } catch {
      // The Stripe write already succeeded (the source of truth); a local mirror
      // failure still leaves the member saved. The webhook reconciles the row.
    }

    // Audit as a win-back honor ONLY when it nets out a counted cancellation;
    // otherwise a distinct type the growth-rate dashboard doesn't offset, so an
    // intercepted-pre-cancel save can't inflate net growth.
    const audit = discountAuditType(wasCancelling);
    appendAuditEvent({
      type: audit.type,
      userId: row.id,
      email: row.email,
      ip: getClientIp(request),
      message: audit.offsetsCountedCancellation
        ? `In-app retention save on sub ${subscription.id}: stacked ${coupon} (${SAVE_PERCENT}% off 1yr), cleared cancel_at_period_end`
        : `In-app retention save on sub ${subscription.id}: stacked ${coupon} (${SAVE_PERCENT}% off 1yr) before any cancel`,
    });

    return NextResponse.json({
      ok: true,
      action: 'discount',
      percentOff: SAVE_PERCENT,
      currentPeriodEnd: row.current_period_end,
    });
  }

  // -------------------------------------------------------------------------
  // Pause instead of cancel: a bounded 1–3 month break (no charge, no access)
  // that auto-resumes. The webhook drops the tier while paused and syncs
  // paused_until, but keeps the sub alive — a break, not churn.
  // -------------------------------------------------------------------------
  if (action === 'pause') {
    // Only a live sub can be paused; a past_due member should fix payment, not
    // pause. (The UI only surfaces pause for active/trialing subs.)
    if (row.subscription_status !== 'active' && row.subscription_status !== 'trialing') {
      return NextResponse.json({ ok: false, reason: 'not_pausable' }, { status: 409 });
    }
    const months = clampPauseMonths(body.months);
    const resumesAt = computeResumesAtUnix(Date.now(), months);
    try {
      await stripe.subscriptions.update(row.stripe_subscription_id, {
        pause_collection: { behavior: 'void', resumes_at: resumesAt },
        // Choosing pause supersedes any pending cancel.
        cancel_at_period_end: false,
      });
    } catch {
      return NextResponse.json(
        { error: "Couldn't pause your subscription just now. Please try again in a minute." },
        { status: 502 },
      );
    }
    const resumesAtIso = new Date(resumesAt * 1000).toISOString();
    appendAuditEvent({
      type: 'billing_pause_requested',
      userId: row.id,
      email: row.email,
      ip: getClientIp(request),
      message: `In-app pause requested for sub ${row.stripe_subscription_id}: ${months} month(s), resumes ${resumesAtIso}`,
    });
    return NextResponse.json({ ok: true, action: 'pause', months, resumesAt: resumesAtIso });
  }

  // -------------------------------------------------------------------------
  // Resume a paused subscription now (clear pause_collection).
  // -------------------------------------------------------------------------
  if (action === 'resume') {
    try {
      await stripe.subscriptions.update(row.stripe_subscription_id, {
        // An empty string clears pause_collection in the Stripe API.
        pause_collection: '',
      });
    } catch {
      return NextResponse.json(
        { error: "Couldn't resume your subscription just now. Please try again in a minute." },
        { status: 502 },
      );
    }
    appendAuditEvent({
      type: 'billing_resume_requested',
      userId: row.id,
      email: row.email,
      ip: getClientIp(request),
      message: `In-app resume requested for sub ${row.stripe_subscription_id}`,
    });
    return NextResponse.json({ ok: true, action: 'resume' });
  }

  // -------------------------------------------------------------------------
  // Cancel: schedule at period end, forwarding the reason to Stripe so the
  // webhook's existing cancel-ack path captures the "why".
  // -------------------------------------------------------------------------
  const feedback = validateCancelFeedback(body.feedback);
  const comment = sanitizeCancellationComment(typeof body.comment === 'string' ? body.comment : null);

  const updateParams: Stripe.SubscriptionUpdateParams = { cancel_at_period_end: true };
  if (feedback || comment) {
    const details: { feedback?: string; comment?: string } = {};
    if (feedback) details.feedback = feedback;
    if (comment) details.comment = comment;
    // feedback is validated to Stripe's fixed enum, so this cast is sound.
    updateParams.cancellation_details = details as Stripe.SubscriptionUpdateParams.CancellationDetails;
  }

  try {
    await stripe.subscriptions.update(row.stripe_subscription_id, updateParams);
  } catch {
    return NextResponse.json(
      { error: "Couldn't schedule the cancellation just now. Please try again in a minute." },
      { status: 502 },
    );
  }

  // Deliberately DO NOT mirror cancel_at_period_end=1 locally: the webhook fires
  // the cancellation-ack email (with the save link) and logs
  // stripe_cancellation_requested on the genuine 0→1 transition it reads from
  // this row. Pre-setting it here would mask that transition and suppress both.
  // We log a separate breadcrumb so the in-app origin is queryable; the reason
  // itself is recorded once by the webhook from cancellation_details.
  appendAuditEvent({
    type: 'billing_cancel_flow_submitted',
    userId: row.id,
    email: row.email,
    ip: getClientIp(request),
    message: `In-app cancellation scheduled for sub ${row.stripe_subscription_id}${
      feedback ? ` (reason ${feedback})` : ' (no reason given)'
    }`,
  });

  return NextResponse.json({
    ok: true,
    action: 'cancel',
    currentPeriodEnd: row.current_period_end,
  });
}
