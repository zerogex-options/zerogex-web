import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { TierId } from '@/core/auth';
import {
  getCurrentPeriodEndUnix,
  getFoundingLifetimeCouponId,
  getStripe,
  priceIdToTier,
} from '@/core/stripe';

export const runtime = 'nodejs';

type UserRow = {
  id: string;
  email: string;
  founding_member_started_at: string | null;
  founding_lifetime_applied_at: string | null;
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

function findUserByCustomerId(customerId: string): UserRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, email, founding_member_started_at, founding_lifetime_applied_at
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

  await maybeApplyFoundingLifetime(subscription.id, user);
}

function clearSubscriptionFromUser(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = findUserByCustomerId(customerId);
  if (!user) return;

  getDb()
    .prepare(
      `UPDATE users SET
         tier = 'public',
         stripe_subscription_id = NULL,
         stripe_price_id = NULL,
         subscription_status = ?,
         current_period_end = NULL,
         cancel_at_period_end = 0,
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
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
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
        clearSubscriptionFromUser(event.data.object as Stripe.Subscription);
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
              ? `Invoice ${invoice.id} payment failed for sub ${invoiceSub}`
              : `Invoice ${invoice.id} payment failed`,
          });
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
