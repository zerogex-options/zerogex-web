import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { TierId } from '@/core/auth';
import {
  sendCancellationEmail,
  sendFoundingWelcomeEmail,
  sendPaidWelcomeEmail,
  sendPaymentFailedEmail,
  sendWelcomeBackEmail,
} from '@/core/mailer';
import {
  getActivePromoCouponId,
  getActivePromoCouponIds,
  getCurrentPeriodEndUnix,
  getFoundingIntroCouponId,
  getFoundingLifetimeCouponId,
  getManagedCadenceCouponIds,
  getStripe,
  priceIdToSku,
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
import { captureTwitterConversion } from '@/core/telemetry/twitter-server';
import { TelemetryEvent } from '@/core/telemetry/events';
import { TwitterEvent } from '@/core/telemetry/twitter-events';

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
  // Last-synced price id, read pre-UPDATE so a plan/cadence switch (old price
  // != new price) can be detected and the member's rate carried across it.
  stripe_price_id: string | null;
  // Last-synced Stripe status, used to detect transitions (e.g. trialing →
  // active) so the funnel events fire exactly once on the actual change.
  subscription_status: string | null;
  // Last-synced cancel_at_period_end flag (0/1). Read pre-UPDATE so the
  // 0→1 transition fires the cancellation acknowledgement email once.
  cancel_at_period_end: number;
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

// Returns a short label like "first 6 months" or "first year" when the
// subscription carries one of the active limited-time promo coupons,
// otherwise null. The webhook hands this to the welcome email so the copy
// can mention the intro window without hardcoding tier/cadence specifics.
function describePromoIfPresent(subscription: Stripe.Subscription): string | null {
  const activePromoIds = new Set(getActivePromoCouponIds());
  if (activePromoIds.size === 0) return null;

  // Subscription discounts can be expanded objects or just IDs depending on
  // the source — the webhook payload often gives us coupon objects directly.
  type SubDiscount = {
    coupon?: { id?: string; duration?: string; duration_in_months?: number | null } | string | null;
  };
  // Cast through unknown so we don't pin to a moving Stripe.Subscription.Discount shape.
  const rawDiscounts = ((subscription as unknown as { discounts?: SubDiscount[] }).discounts ?? []) as SubDiscount[];

  let matchedCoupon: { id?: string; duration?: string; duration_in_months?: number | null } | null = null;
  for (const d of rawDiscounts) {
    const coupon = d?.coupon;
    if (!coupon) continue;
    const couponId = typeof coupon === 'string' ? coupon : coupon.id;
    if (!couponId || !activePromoIds.has(couponId)) continue;
    matchedCoupon = typeof coupon === 'string' ? { id: couponId } : coupon;
    break;
  }
  if (!matchedCoupon) return null;

  // Prefer a derived "first N months" / "first year" label from the coupon
  // shape (which is the source of truth for how long the discount lasts).
  // Falls back to a generic label if duration isn't expanded on the object.
  if (matchedCoupon.duration === 'repeating' && matchedCoupon.duration_in_months) {
    return `first ${matchedCoupon.duration_in_months} months`;
  }
  if (matchedCoupon.duration === 'once') {
    return 'first year';
  }
  return 'introductory period';
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
              stripe_price_id, subscription_status, cancel_at_period_end
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

// The coupon ids currently attached to a subscription, de-duplicated and in
// order. Discounts on a webhook payload may be expanded coupon objects or bare
// ids — handle both, the same shape juggling describePromoIfPresent does above.
function subscriptionCouponIds(subscription: Stripe.Subscription): string[] {
  type SubDiscount = { coupon?: { id?: string } | string | null };
  const raw = ((subscription as unknown as { discounts?: SubDiscount[] }).discounts ??
    []) as SubDiscount[];
  const ids: string[] = [];
  for (const d of raw) {
    const c = d?.coupon;
    const id = typeof c === 'string' ? c : c?.id;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// When a member switches plan/cadence in the customer portal, Stripe changes the
// price but LEAVES any existing coupon on the subscription. Our founding/promo
// coupons are cadence-specific, so the old coupon is wrong for the new line item
// on a monthly<->annual switch: e.g. the monthly promo ($20 off, repeating for 6
// months) keeps discounting an ANNUAL invoice instead of the annual promo ($49
// off, once). Reconcile the subscription's discounts to what's correct for the
// NEW (tier, cadence).
//
// Reconciliation, not just carry-forward — this is the crux of the fix:
//   1. Resolve the correct cadence-specific coupon for the NEW price (may be
//      null — window closed, or that coupon isn't configured).
//   2. Strip any coupon we manage (getManagedCadenceCouponIds: promo + founding
//      intro, every tier/cadence) that ISN'T the correct one. This is what stops
//      a stale monthly coupon from riding along on an annual invoice EVEN WHEN
//      there's no replacement to grant — the previous version returned early in
//      that case and left the wrong coupon applied.
//   3. Ensure the correct coupon (if any) is present.
// Coupons we don't manage (founding lifetime — not cadence-specific — plus
// win-back / referral one-shots) are preserved untouched.
//
// Precedence mirrors checkout's resolveDiscount, derived from the account's
// persistent entitlements (there's no request context here):
//   • Founding member: founding-managed rate, and an EXCLUSIVE branch — never
//     fall through to the public promo. Once the 25%-forever lifetime coupon is
//     applied (~month 12) it persists on its own, so leave the subscription's
//     discounts entirely untouched. Before that, the correct coupon is the
//     founding intro for the NEW (tier, cadence).
//   • Everyone else: the correct coupon is the ACTIVE public promo for the NEW
//     (tier, cadence), or null once the window has closed (in which case the
//     stale coupon is stripped and the member renews at rack rate).
//
// Fires only on an actual switch — a prior synced price that differs from the
// new one — of an active/trialing sub. It never fires on initial signup or
// resubscribe (null oldPriceId), where checkout already applied the correct
// discount. No-ops when there's nothing stale to strip and the correct coupon is
// already present, so webhook redeliveries and the follow-up
// customer.subscription.updated our own update triggers can't reset a repeating
// coupon's clock or loop. Runs BEFORE maybeApplyFoundingLifetime so a lifetime
// coupon coming due in the same sync takes final precedence.
async function maybeReconcileDiscountOnPlanSwitch(
  subscription: Stripe.Subscription,
  user: UserRow,
  oldPriceId: string | null,
  newPriceId: string | null,
): Promise<void> {
  if (!ACTIVE_STATUSES.has(subscription.status)) return;
  // Require a prior synced price: a null oldPriceId is the first sync of a new or
  // resubscribed subscription, where checkout already set the discount.
  if (!oldPriceId || !newPriceId || oldPriceId === newPriceId) return; // only real switches
  const newSku = priceIdToSku(newPriceId);
  if (!newSku) return;

  // The correct cadence-specific coupon for the NEW price (may be null).
  let correctCoupon: string | null;
  if (user.founding_member_started_at) {
    // Founding is exclusive: never fall through to the public promo. Once the
    // lifetime coupon is on, it isn't cadence-specific and validly persists —
    // leave the subscription's discounts untouched.
    if (user.founding_lifetime_applied_at) return;
    correctCoupon = getFoundingIntroCouponId(newSku.tier, newSku.cadence);
  } else {
    correctCoupon = getActivePromoCouponId(newSku);
  }

  const managed = new Set(getManagedCadenceCouponIds());
  const current = subscriptionCouponIds(subscription);
  const stale = current.filter((id) => managed.has(id) && id !== correctCoupon);
  const correctPresent = correctCoupon != null && current.includes(correctCoupon);

  // Nothing to do: no stale managed coupon to strip and the correct coupon (if
  // any) is already present.
  if (stale.length === 0 && (correctCoupon == null || correctPresent)) return;

  // Rebuild the discount list: keep every coupon we DON'T manage (founding
  // lifetime, win-back, referral, anything hand-applied), drop stale managed
  // ones, and ensure the correct coupon is present.
  const keep = current.filter((id) => !managed.has(id) || id === correctCoupon);
  if (correctCoupon && !keep.includes(correctCoupon)) keep.push(correctCoupon);

  try {
    await getStripe().subscriptions.update(subscription.id, {
      discounts: keep.map((coupon) => ({ coupon })),
    });
    logAudit({
      type: 'billing_discount_reconciled_on_switch',
      userId: user.id,
      email: user.email,
      message:
        `Reconciled discounts on sub ${subscription.id} after switch to ${newSku.tier}/${newSku.cadence} ` +
        `(price ${newPriceId}): stripped [${stale.join(', ') || 'none'}], applied ${correctCoupon ?? 'none'}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'reconcile discount failed';
    logAudit({
      type: 'stripe_webhook_error',
      userId: user.id,
      email: user.email,
      message: `Reconcile discount on sub ${subscription.id} after switch failed: ${message}`,
    });
    // Swallow — the tier sync already succeeded; a later sub event can retry.
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
  const previousCancelAtPeriodEnd = user.cancel_at_period_end ? 1 : 0;
  const nextCancelAtPeriodEnd = subscription.cancel_at_period_end ? 1 : 0;

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
    // Report the trial start to X via the Conversions API (server-side truth,
    // survives ad-blockers). Keyed to the subscription id for dedup.
    await captureTwitterConversion({
      eventId: TwitterEvent.trialStart,
      conversionId: subscription.id,
      email: user.email,
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
    await captureTwitterConversion({
      eventId: TwitterEvent.purchase,
      conversionId: subscription.id,
      email: user.email,
    });
  }

  // Reconcile the member's founding/promo rate across a plan or cadence switch
  // (portal monthly<->annual or tier change): swap in the cadence-correct coupon
  // and strip any stale one Stripe carried over. Runs before the lifetime step so
  // a lifetime coupon coming due in the same sync wins. `user.stripe_price_id` is
  // the pre-UPDATE snapshot (old price); `priceId` is the new one.
  await maybeReconcileDiscountOnPlanSwitch(subscription, user, user.stripe_price_id, priceId);

  await maybeApplyFoundingLifetime(subscription.id, user);

  if (isActive) {
    await maybeSendPaidWelcomeEmail(user, subscription);
  }

  // Referral rewards must reflect a REAL paid conversion, not a trial start.
  // `trialing` counts as active for tier/access above, but a trial that never
  // converts must not reward the referrer or consume the subscriber's banked
  // credit — so gate referral processing on the paid `active` status only,
  // never on `trialing`. This fires on the trialing→active transition (and on
  // a no-trial signup that lands straight in `active`); the latches inside
  // core/referrals keep it idempotent across renewals and webhook redeliveries.
  if (subscription.status === 'active') {
    await maybeProcessReferral(user, subscription);
  }

  await maybeHandleCancelAckTransition(user, {
    previous: previousCancelAtPeriodEnd,
    next: nextCancelAtPeriodEnd,
    periodEndIso,
    subscriptionId: subscription.id,
  });
}

// Fires the cancellation acknowledgement email on the 0→1 transition of
// cancel_at_period_end (the moment the customer clicks Cancel), and clears
// the send-latch on the reverse 1→0 (reactivation) so a future re-cancel
// can re-fire. Idempotent via CAS-claim on cancel_ack_email_sent_at, so
// webhook redeliveries can't double-send. Best-effort: failures never
// unwind the tier sync.
async function maybeHandleCancelAckTransition(
  user: UserRow,
  opts: {
    previous: number;
    next: number;
    periodEndIso: string | null;
    subscriptionId: string;
  },
): Promise<void> {
  if (opts.previous === 0 && opts.next === 1) {
    const stamp = nowIso();
    const claim = getDb()
      .prepare(
        `UPDATE users SET cancel_ack_email_sent_at = ?, updated_at = ?
         WHERE id = ? AND cancel_ack_email_sent_at IS NULL`,
      )
      .run(stamp, stamp, user.id) as { changes: number | bigint };

    if (Number(claim.changes) === 0) return;

    try {
      await sendCancellationEmail(user.email, { periodEndIso: opts.periodEndIso });
      logAudit({
        type: 'cancellation_ack_email_sent',
        userId: user.id,
        email: user.email,
        message: `Sent cancellation ack email for sub ${opts.subscriptionId}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'cancellation ack email send failed';
      logAudit({
        type: 'cancellation_ack_email_error',
        userId: user.id,
        email: user.email,
        message: `Cancellation ack email send failed for sub ${opts.subscriptionId}: ${message}`,
      });
    }
    return;
  }

  if (opts.previous === 1 && opts.next === 0) {
    getDb()
      .prepare(
        `UPDATE users SET cancel_ack_email_sent_at = NULL, updated_at = ?
         WHERE id = ? AND cancel_ack_email_sent_at IS NOT NULL`,
      )
      .run(nowIso(), user.id);
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
    // Promo only meaningful on the non-founding path — founding has its own
    // (richer) intro discount and that email already speaks to it.
    const promoIntroLabel = isFounding ? null : describePromoIfPresent(subscription);
    try {
      if (isFounding) {
        await sendFoundingWelcomeEmail(user.email, { trialEndIso });
      } else {
        await sendPaidWelcomeEmail(user.email, { trialEndIso, promoIntroLabel });
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
      // Clearing winback_email_sent_at on the same 1 → 0 transition re-arms the
      // ~1-month win-back campaign (scripts/send-winback.mts) for this account:
      // if the returning customer churns again later, they qualify for a fresh
      // win-back instead of being permanently latched out by their first one.
      `UPDATE users SET subscription_lapsed = 0, winback_email_sent_at = NULL, updated_at = ?
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
