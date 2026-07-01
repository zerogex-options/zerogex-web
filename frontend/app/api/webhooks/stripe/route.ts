import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { TierId } from '@/core/auth';
import {
  sendFoundingWelcomeEmail,
  sendPaidWelcomeEmail,
  sendPaymentFailedEmail,
  sendWelcomeBackEmail,
} from '@/core/mailer';
import {
  getCurrentPeriodEndUnix,
  getFoundingLifetimeCouponId,
  getStripe,
  priceIdToTier,
} from '@/core/stripe';
import {
  backAttributeReferral,
  redeemBankedReferralCredit,
  rewardReferrerForConvertedReferee,
} from '@/core/referrals';
import {
  accrueMissedInvoicesForReferee,
  findCreatorByUserId,
  isCreatorPartnerProgramEnabled,
  maybeAccruePartnerCommission,
  reversePartnerCommissionsForInvoice,
} from '@/core/creatorPartners';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';

export const runtime = 'nodejs';

type UserRow = {
  id: string;
  email: string;
  founding_member_started_at: string | null;
  founding_lifetime_applied_at: string | null;
  referred_by_code: string | null;
  referral_credit_months: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  // Last-synced Stripe status, used to detect transitions (e.g. trialing →
  // active) so the funnel events fire exactly once on the actual change.
  subscription_status: string | null;
};

// `past_due` is intentionally NOT active: once a payment fails Stripe moves
// the subscription to past_due and emits customer.subscription.updated, so
// excluding it here downgrades the user to 'public' immediately instead of
// granting weeks of free premium through Stripe's dunning window. A
// recovered payment flips the subscription back to 'active' and re-promotes.
const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing']);

// Subscription-state events whose ordering matters: applying a stale one
// (e.g. an old 'active' redelivered after 'deleted') would re-promote a
// cancelled user. Guarded by event.created vs the newest processed event
// for the same subscription.
const LIFECYCLE_EVENT_TYPES = new Set<string>([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.resumed',
  'customer.subscription.paused',
  'customer.subscription.deleted',
]);

// 11 months chosen so the lifetime coupon is on the subscription before the
// post-intro renewal invoice is generated. The intro coupon exhausts after
// 12 invoices, so applying at month 11 lets the cycle-13 invoice pick up the
// 25% lifetime instead of charging full rack rate once.
const FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS = 11;

function extractSubscriptionId(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  if (event.type === 'checkout.session.completed') {
    const sub = (obj as { subscription?: string | { id?: string } | null }).subscription;
    if (typeof sub === 'string') return sub;
    return sub?.id ?? null;
  }
  if (event.type.startsWith('customer.subscription.')) {
    const id = (obj as { id?: string }).id;
    return typeof id === 'string' ? id : null;
  }
  if (event.type === 'invoice.payment_failed') {
    const sub = (obj as { subscription?: string | { id?: string } | null }).subscription;
    if (typeof sub === 'string') return sub;
    return sub?.id ?? null;
  }
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

function formatInvoiceAmount(invoice: Stripe.Invoice): string | null {
  if (typeof invoice.amount_due !== 'number') return null;
  if (typeof invoice.currency !== 'string') return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency.toUpperCase(),
    }).format(invoice.amount_due / 100);
  } catch {
    return null;
  }
}

function findUserByCustomerId(customerId: string): UserRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, email, founding_member_started_at, founding_lifetime_applied_at,
              referred_by_code, referral_credit_months, stripe_customer_id, stripe_subscription_id,
              subscription_status
       FROM users WHERE stripe_customer_id = ?`,
    )
    .get(customerId) as UserRow | undefined;
  return row ?? null;
}

function logAudit(input: { type: string; userId?: string; email?: string; message: string }) {
  getDb()
    .prepare(
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `audit_${randomBytes(12).toString('hex')}`,
      input.type,
      input.userId ?? null,
      null,
      input.email ?? null,
      'stripe-webhook',
      input.message,
      nowIso(),
    );
}

function shouldApplyFoundingLifetime(user: UserRow): boolean {
  if (!user.founding_member_started_at) return false;
  if (user.founding_lifetime_applied_at) return false;
  const start = new Date(user.founding_member_started_at);
  if (Number.isNaN(start.getTime())) return false;
  const eligibleAt = new Date(start);
  eligibleAt.setMonth(eligibleAt.getMonth() + FOUNDING_LIFETIME_ELIGIBLE_AFTER_MONTHS);
  return eligibleAt.getTime() <= Date.now();
}

async function maybeApplyFoundingLifetime(
  subscriptionId: string,
  user: UserRow,
): Promise<void> {
  if (!shouldApplyFoundingLifetime(user)) return;
  const couponId = getFoundingLifetimeCouponId();
  if (!couponId) {
    logAudit({
      type: 'stripe_webhook_error',
      userId: user.id,
      email: user.email,
      message: `Founding lifetime due for sub ${subscriptionId} but STRIPE_COUPON_FOUNDING_LIFETIME is unset`,
    });
    return;
  }
  try {
    await getStripe().subscriptions.update(subscriptionId, {
      discounts: [{ coupon: couponId }],
    });
    const stamp = nowIso();
    getDb()
      .prepare('UPDATE users SET founding_lifetime_applied_at = ?, updated_at = ? WHERE id = ?')
      .run(stamp, stamp, user.id);
    logAudit({
      type: 'stripe_founding_lifetime_applied',
      userId: user.id,
      email: user.email,
      message: `Lifetime 25% coupon ${couponId} applied to sub ${subscriptionId}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'apply lifetime failed';
    logAudit({
      type: 'stripe_webhook_error',
      userId: user.id,
      email: user.email,
      message: `Apply founding lifetime to sub ${subscriptionId} failed: ${message}`,
    });
    // Swallow — the tier sync above already succeeded; retry on next sub event.
  }
}

async function syncSubscriptionToUser(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = findUserByCustomerId(customerId);
  if (!user) {
    logAudit({
      type: 'stripe_webhook_orphan',
      message: `No local user for stripe customer ${customerId} (sub ${subscription.id})`,
    });
    return;
  }

  // Last-synced status, read before the UPDATE below overwrites it. Used to
  // emit funnel events only on the actual transition (so trial_started and
  // subscription_paid each fire once, not on every poll/redelivery).
  const previousStatus = user.subscription_status;

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const mappedTier = priceId ? priceIdToTier(priceId) : null;
  const isActive = ACTIVE_STATUSES.has(subscription.status);
  const nextTier: TierId = isActive && mappedTier ? mappedTier : 'public';

  const periodEndUnix = getCurrentPeriodEndUnix(subscription);
  const periodEndIso = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  // Founding redemption is signalled by subscription.metadata.founding='1',
  // set at checkout time. First sync after redemption stamps the column;
  // COALESCE keeps the original timestamp on subsequent syncs.
  const subMetadata = (subscription.metadata ?? {}) as Record<string, string | undefined>;
  const stampFoundingStart =
    subMetadata.founding === '1' && !user.founding_member_started_at;
  const newlyStampedAt = stampFoundingStart ? nowIso() : null;

  getDb()
    .prepare(
      `UPDATE users SET
         tier = ?,
         stripe_subscription_id = ?,
         stripe_price_id = ?,
         subscription_status = ?,
         current_period_end = ?,
         cancel_at_period_end = ?,
         founding_member_started_at = COALESCE(founding_member_started_at, ?),
         updated_at = ?
       WHERE id = ?`,
    )
    .run(
      nextTier,
      subscription.id,
      priceId,
      subscription.status,
      periodEndIso,
      subscription.cancel_at_period_end ? 1 : 0,
      newlyStampedAt,
      nowIso(),
      user.id,
    );

  if (stampFoundingStart) {
    user.founding_member_started_at = newlyStampedAt;
    logAudit({
      type: 'stripe_founding_redeemed',
      userId: user.id,
      email: user.email,
      message: `Founding redemption recorded for sub ${subscription.id}`,
    });
  }

  logAudit({
    type: 'stripe_subscription_sync',
    userId: user.id,
    email: user.email,
    message: `Subscription ${subscription.id} status=${subscription.status} tier=${nextTier} cancelAtPeriodEnd=${subscription.cancel_at_period_end}`,
  });

  // Funnel analytics (server-side conversion truth). Keyed to transitions off
  // the previous status so each event fires exactly once. Best-effort.
  const founding = subMetadata.founding === '1';
  if (previousStatus !== 'trialing' && subscription.status === 'trialing') {
    const trialEndIso =
      typeof subscription.trial_end === 'number'
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;
    await captureServer(user.id, TelemetryEvent.TrialStarted, {
      tier: nextTier,
      founding,
      trial_end: trialEndIso,
    });
    // Re-arm the ~48h reminder for this new trial window. Without this,
    // a user who cancels mid-trial and resubscribes never gets the nudge
    // because the latch stays set from their first trial.
    getDb()
      .prepare(
        'UPDATE users SET trial_reminder_email_sent_at = NULL, updated_at = ? WHERE id = ?',
      )
      .run(nowIso(), user.id);
  }
  if (previousStatus !== 'active' && subscription.status === 'active') {
    // Fires on first paid activation, including a trial converting to paid.
    await captureServer(user.id, TelemetryEvent.SubscriptionPaid, {
      tier: nextTier,
      founding,
      subscription_id: subscription.id,
      period_end: periodEndIso,
    });
  }

  await maybeApplyFoundingLifetime(subscription.id, user);

  if (isActive) {
    await maybeProcessReferral(user, subscription);
    await maybeSendPaidWelcomeEmail(user, subscription);
  }
}

// Referral side-effects, run once the subscription is active (first paid
// invoice). Two independent concerns:
//   1. If THIS user was referred, reward their referrer with a free month.
//   2. If THIS user is a referrer with banked free months, cash them into a
//      balance credit now that they have a priceable subscription.
// All latched inside core/referrals so webhook retries can't double-apply, and
// all best-effort: a failure here must never unwind the tier sync above.
async function maybeProcessReferral(user: UserRow, subscription: Stripe.Subscription): Promise<void> {
  try {
    if (user.referred_by_code) {
      const outcome = await rewardReferrerForConvertedReferee(user.id);
      if (outcome.kind === 'credited') {
        logAudit({
          type: 'referral_reward_credited',
          userId: user.id,
          email: user.email,
          message: `Referee ${user.id} converted; referrer credited ${outcome.amount} ${outcome.currency}`,
        });
      } else if (outcome.kind === 'banked') {
        logAudit({
          type: 'referral_reward_banked',
          userId: user.id,
          email: user.email,
          message: `Referee ${user.id} converted; referrer free month banked (no active sub)`,
        });
      } else if (outcome.kind === 'error') {
        logAudit({
          type: 'referral_reward_error',
          userId: user.id,
          email: user.email,
          message: `Crediting referrer for referee ${user.id} failed (banked as fallback): ${outcome.message}`,
        });
      }
    }

    if (user.referral_credit_months > 0) {
      const redeemed = await redeemBankedReferralCredit(user, subscription);
      if (redeemed) {
        logAudit({
          type: 'referral_credit_redeemed',
          userId: user.id,
          email: user.email,
          message: `Banked referral credit redeemed: ${redeemed.amount} ${redeemed.currency}`,
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'referral processing error';
    logAudit({
      type: 'referral_processing_error',
      userId: user.id,
      email: user.email,
      message: `Referral processing for ${user.id} failed: ${message}`,
    });
  }
}

// Called from syncSubscriptionToUser whenever a subscription has just been
// observed in an active+paid state. Three branches, all decided race-safely
// via atomic CAS UPDATEs — no pre-state snapshot is read, so concurrent
// customer.subscription.* events for the same signup flow can't influence
// the outcome:
//
//   1. First-time paid signup → CAS-claim paid_welcome_email_sent_at
//      (NULL → stamp). The single event that wins sends paid (or founding,
//      based on subscription.metadata.founding) and also clears
//      subscription_lapsed in the same UPDATE so a stale-but-still-set
//      lapse flag from before this column existed can't double-fire.
//   2. Welcome-back after a prior cancel → CAS-claim subscription_lapsed
//      (1 → 0). Only set to 1 by clearSubscriptionFromUser on
//      customer.subscription.deleted, which is a different event from the
//      welcome triggers, so the flag is never raced.
//   3. Pure upgrade (paid → paid, no intervening cancel) → both CAS
//      UPDATEs no-op and the function returns silently.
//
// Webhook-level idempotency in stripe_webhook_events plus the two CAS
// claims together guarantee at most one welcome / welcome-back per
// signup, regardless of redelivery, retries, or which lifecycle event
// arrives first.
async function maybeSendPaidWelcomeEmail(
  user: UserRow,
  subscription: Stripe.Subscription,
): Promise<void> {
  if (!ACTIVE_STATUSES.has(subscription.status)) return;

  const stamp = nowIso();

  const firstTimeClaim = getDb()
    .prepare(
      `UPDATE users SET paid_welcome_email_sent_at = ?, subscription_lapsed = 0, updated_at = ?
       WHERE id = ? AND paid_welcome_email_sent_at IS NULL`,
    )
    .run(stamp, stamp, user.id) as { changes: number | bigint };

  if (Number(firstTimeClaim.changes) > 0) {
    const subMetadata = (subscription.metadata ?? {}) as Record<string, string | undefined>;
    const isFounding = subMetadata.founding === '1';
    // Derive the trial-end date the email mentions from the real Stripe
    // trial_end so the copy can't drift from what Stripe will actually
    // charge. Only meaningful while still in 'trialing' — if the sub
    // already activated past the trial (no trial set, or trial elapsed),
    // emit the no-trial copy.
    const trialEndIso =
      subscription.status === 'trialing' && typeof subscription.trial_end === 'number'
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;
    try {
      if (isFounding) {
        await sendFoundingWelcomeEmail(user.email, { trialEndIso });
      } else {
        await sendPaidWelcomeEmail(user.email, { trialEndIso });
      }
      logAudit({
        type: 'paid_welcome_email_sent',
        userId: user.id,
        email: user.email,
        message: isFounding
          ? `Sent founding welcome email for sub ${subscription.id}`
          : `Sent paid welcome email for sub ${subscription.id}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'welcome email send failed';
      logAudit({
        type: 'paid_welcome_email_error',
        userId: user.id,
        email: user.email,
        message: `Welcome email send failed for sub ${subscription.id}: ${message}`,
      });
      // Swallow — the stamp is set, so a webhook retry will no-op rather
      // than re-send. Manual recovery via scripts/send-welcome-email.mts.
    }
    return;
  }

  const welcomeBackClaim = getDb()
    .prepare(
      `UPDATE users SET subscription_lapsed = 0, updated_at = ?
       WHERE id = ? AND subscription_lapsed = 1`,
    )
    .run(stamp, user.id) as { changes: number | bigint };

  if (Number(welcomeBackClaim.changes) === 0) return;

  try {
    await sendWelcomeBackEmail(user.email);
    logAudit({
      type: 'paid_welcome_back_email_sent',
      userId: user.id,
      email: user.email,
      message: `Sent welcome-back email for sub ${subscription.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'welcome-back email send failed';
    logAudit({
      type: 'paid_welcome_email_error',
      userId: user.id,
      email: user.email,
      message: `Welcome-back email send failed for sub ${subscription.id}: ${message}`,
    });
  }
}

async function clearSubscriptionFromUser(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = findUserByCustomerId(customerId);
  if (!user) return;

  // subscription_lapsed = 1 is the signal maybeSendPaidWelcomeEmail consumes
  // (race-safely, via CAS) to fire a welcome-back if and when the customer
  // resubscribes. Cleared back to 0 atomically in that send path.
  getDb()
    .prepare(
      `UPDATE users SET
         tier = 'public',
         stripe_subscription_id = NULL,
         stripe_price_id = NULL,
         subscription_status = ?,
         current_period_end = NULL,
         cancel_at_period_end = 0,
         subscription_lapsed = 1,
         updated_at = ?
       WHERE id = ?`,
    )
    .run(subscription.status, nowIso(), user.id);

  logAudit({
    type: 'stripe_subscription_deleted',
    userId: user.id,
    email: user.email,
    message: `Subscription ${subscription.id} ended; tier reset to public`,
  });

  // Funnel: churn. Best-effort server-side event.
  await captureServer(user.id, TelemetryEvent.SubscriptionCancelled, {
    subscription_id: subscription.id,
    status: subscription.status,
  });
}

// Best-effort back-attribution for an audience member who skipped the
// `?ref=` link entirely and typed the partner's promo code at Stripe's
// checkout form. The session itself carries the applied promo code; we
// resolve it to the partner via `promotion_code.metadata.partner_user_id`
// (stamped by scripts/grant-partner-pro.mts when the code was created) and
// stamp `referred_by_code` on the referee row.
//
// CAS-guarded in core/referrals so re-runs can't overwrite a referee who
// already attributed via the link path. Errors are swallowed: a transient
// Stripe lookup failure must not 500 the webhook (which would re-trigger
// retries and double-fire the welcome path that runs after this).
async function maybeBackAttributeFromCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (!isCreatorPartnerProgramEnabled()) return;
  const refereeUserId = session.client_reference_id;
  if (!refereeUserId) return;

  // session.discounts is not expanded by default on webhook payloads. Re-fetch
  // when the field is empty so we don't miss a promotion_code that's actually
  // present — but only if there's a session id to fetch by.
  let discounts: Stripe.Checkout.Session.Discount[] = session.discounts ?? [];
  if (discounts.length === 0 && session.id) {
    try {
      const full = await getStripe().checkout.sessions.retrieve(session.id, {
        expand: ['discounts'],
      });
      discounts = full.discounts ?? [];
    } catch {
      return;
    }
  }

  for (const d of discounts) {
    const promoCodeId =
      typeof d.promotion_code === 'string' ? d.promotion_code : d.promotion_code?.id ?? null;
    if (!promoCodeId) continue;
    try {
      const promo = await getStripe().promotionCodes.retrieve(promoCodeId);
      const partnerUserId = promo.metadata?.partner_user_id;
      if (!partnerUserId) continue;
      const partner = findCreatorByUserId(partnerUserId);
      if (!partner || !partner.referral_code) continue;

      const attributed = backAttributeReferral(
        refereeUserId,
        partner.id,
        partner.referral_code,
      );
      if (attributed) {
        logAudit({
          type: 'partner_back_attributed',
          userId: refereeUserId,
          message: `Back-attributed to partner ${partner.id} via promo code ${promoCodeId} on session ${session.id}`,
        });
        // Race defense: invoice.paid can arrive BEFORE checkout.session.completed
        // (Stripe orders events best-effort). Any already-paid invoice for this
        // referee was dropped as 'organic' at accrual time; now that
        // referred_by_code is stamped, retroactively accrue anything we missed.
        // Best-effort: a Stripe list failure just means the operator recovers
        // via scripts/list-partner-commissions later, or we catch it on the next
        // invoice.
        const backfilled = await accrueMissedInvoicesForReferee(refereeUserId);
        for (const inv of backfilled) {
          logAudit({
            type: 'partner_commission_accrued',
            userId: refereeUserId,
            message: `Backfilled accrual for invoice ${inv.id} after back-attribution (session ${session.id})`,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'promo code lookup failed';
      logAudit({
        type: 'partner_back_attribute_error',
        userId: refereeUserId,
        message: `Promo code ${promoCodeId} on session ${session.id}: ${message}`,
      });
    }
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature';
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  // --- Idempotency + ordering -------------------------------------------
  // Stripe retries any non-2xx and can deliver events out of order. Without
  // these guards a retried event double-applies and an out-of-order replay
  // (old 'active' after 'deleted') silently re-grants premium to a
  // cancelled user.
  const db = getDb();
  const subscriptionId = extractSubscriptionId(event);

  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO stripe_webhook_events (id, type, subscription_id, created, processed_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(event.id, event.type, subscriptionId, event.created, nowIso()) as {
    changes: number | bigint;
  };
  if (Number(inserted.changes) === 0) {
    // Already recorded → this is a redelivery/retry of a handled event.
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (subscriptionId && LIFECYCLE_EVENT_TYPES.has(event.type)) {
    const newest = db
      .prepare(
        `SELECT MAX(created) AS m FROM stripe_webhook_events
         WHERE subscription_id = ? AND id <> ?`,
      )
      .get(subscriptionId, event.id) as { m: number | null } | undefined;
    if (newest?.m != null && newest.m > event.created) {
      logAudit({
        type: 'stripe_webhook_stale_skipped',
        message: `Skipped stale ${event.type} (created=${event.created}) for sub ${subscriptionId}; a newer event (created=${newest.m}) was already processed`,
      });
      return NextResponse.json({ received: true, stale: true });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Stamp partner attribution from a typed-in promo code BEFORE the
        // subscription sync runs — syncSubscriptionToUser snapshots the user
        // row once at its top, so the referred_by_code we set here is what
        // its referral-processing branch reads.
        await maybeBackAttributeFromCheckoutSession(session);
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          // syncSubscriptionToUser drives the welcome internally via the
          // CAS-based maybeSendPaidWelcomeEmail, so this handler no longer
          // needs to pre-snapshot any state.
          await syncSubscriptionToUser(subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed':
      case 'customer.subscription.paused': {
        await syncSubscriptionToUser(event.data.object as Stripe.Subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        await clearSubscriptionFromUser(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.paid': {
        // Creator Partner commission accrual (Phase 3). Every paid invoice
        // whose customer was referred by a creator partner earns a
        // commission ledger row via UNIQUE(stripe_invoice_id) — retries
        // and out-of-order deliveries are safe.
        const invoice = event.data.object as Stripe.Invoice;
        const outcome = await maybeAccruePartnerCommission(invoice);
        if (outcome.kind === 'accrued') {
          logAudit({
            type: 'partner_commission_accrued',
            message: `Invoice ${invoice.id}: accrued ${outcome.commissionAmount} on billed ${outcome.billedAmount} ${outcome.currency}`,
          });
        }
        break;
      }
      case 'charge.refunded': {
        // Any refund on a paid invoice reverses that invoice's accrued
        // commission. Partial vs full refund is treated identically —
        // the whole commission flips to 'reversed'. Anything already
        // marked 'paid' (out the door) needs a manual clawback.
        const charge = event.data.object as Stripe.Charge;
        const invoiceId =
          typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id ?? null;
        if (invoiceId) {
          const reversed = reversePartnerCommissionsForInvoice(invoiceId);
          if (reversed > 0) {
            logAudit({
              type: 'partner_commission_reversed',
              message: `Charge ${charge.id} refunded on invoice ${invoiceId}; ${reversed} commission(s) reversed`,
            });
          }
        }
        break;
      }
      case 'charge.dispute.created': {
        // A chargeback usually means Stripe pulls the money back. Reverse
        // proactively so we don't pay out a commission we're about to lose.
        // If the dispute is later WON (`charge.dispute.closed` with
        // status=won), operator can restore via a manual UPDATE — most
        // disputes on trading-tool subs are lost, so revert is the right
        // default.
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null;
        if (chargeId) {
          try {
            const charge = await getStripe().charges.retrieve(chargeId);
            const invoiceId =
              typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id ?? null;
            if (invoiceId) {
              const reversed = reversePartnerCommissionsForInvoice(invoiceId);
              if (reversed > 0) {
                logAudit({
                  type: 'partner_commission_reversed',
                  message: `Dispute ${dispute.id} opened on invoice ${invoiceId}; ${reversed} commission(s) reversed`,
                });
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'charge lookup failed';
            logAudit({
              type: 'partner_commission_reverse_error',
              message: `Dispute ${dispute.id} charge lookup failed: ${message}`,
            });
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const user = customerId ? findUserByCustomerId(customerId) : null;
        if (user) {
          const invoiceSub =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription?.id ?? null;
          logAudit({
            type: 'stripe_payment_failed',
            userId: user.id,
            email: user.email,
            message: invoiceSub
              ? `Invoice ${invoice.id} payment failed for sub ${invoiceSub} (attempt ${invoice.attempt_count})`
              : `Invoice ${invoice.id} payment failed (attempt ${invoice.attempt_count})`,
          });

          // Only email on the first failure for this invoice. Smart Retries
          // emit additional invoice.payment_failed events with attempt_count
          // 2, 3, ... — re-sending on each would spam the customer.
          if (invoice.attempt_count === 1) {
            const amountFormatted = formatInvoiceAmount(invoice);
            try {
              await sendPaymentFailedEmail(user.email, { amountFormatted });
              logAudit({
                type: 'payment_failed_email_sent',
                userId: user.id,
                email: user.email,
                message: `Sent payment-failed email for invoice ${invoice.id}`,
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'payment-failed email send failed';
              logAudit({
                type: 'payment_failed_email_error',
                userId: user.id,
                email: user.email,
                message: `Payment-failed email send failed for invoice ${invoice.id}: ${message}`,
              });
              // Swallow — the audit row above records the underlying failure;
              // the email is a courtesy nudge on top of Stripe's own dunning
              // emails, so a transient Resend error must not 500 the webhook
              // (which would make Stripe retry and double-log).
            }
          }
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged; Stripe will not retry.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'webhook handler error';
    // Handling failed — drop the idempotency row so Stripe's retry is
    // actually reprocessed instead of being skipped as a duplicate.
    try {
      db.prepare('DELETE FROM stripe_webhook_events WHERE id = ?').run(event.id);
    } catch {
      /* best effort; a stuck row only blocks retries of this one event */
    }
    logAudit({ type: 'stripe_webhook_error', message: `${event.type}: ${message}` });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
