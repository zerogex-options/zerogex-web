import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { getStripe, priceIdToSku } from '@/core/stripe';
import { verifyConvertToken } from '@/core/retentionToken';
import { resolveSaveCoupon, stackCoupon, subscriptionCouponIds, SAVE_PERCENT } from '@/core/retentionOffer';
import { canClaimTrialConversionOffer, shouldStackTrialDiscount } from '@/core/trialOffer';

// Pre-trial-end CONVERSION offer.
//
// RETIRED: nothing mints links to this route any more. The ~48h trial reminder
// used to carry a signed one-click "take {SAVE_PERCENT}% off" link, which handed
// a discount to the highest-intent cohort there is — a trialer with a card on
// file, about to be charged automatically — without them asking. It also spent
// the once-per-account retention latch below, so a member who took it here and
// later cancelled found the cancellation email's save button already claimed.
// The 25% is a win-back lever now (/save, and the ~1-month win-back email).
//
// The route is kept alive rather than deleted so the last reminders sent before
// the change don't 404 on anyone who clicks. It expires on its own: claiming
// requires subscription_status === 'trialing', so every outstanding link goes
// inert once that trial converts — within ~48h of the mail that carried it.
// Safe to delete once none are outstanding.
//
// It honors a valid link by stacking the standing retention coupon onto the
// member's TRIALING subscription so the trial-end charge (and the following
// year) is discounted, without an operator. Latched one claim per account via
// the SAME users.retention_offer_claimed_at as /save.
//
// Unlike /save, nothing here gates access: the trial converts on its own whether
// or not this is claimed, so the copy must never imply the member is clicking to
// stay subscribed. Claiming moves the PRICE, nothing else.
//
// GET renders a confirmation page with NO side effect (email link-prefetchers
// like Outlook SafeLinks must not silently claim). The visible button POSTs here
// to apply. Never stacks onto a subscription that already carries a coupon (promo
// / founding / referral) — that member already has an intro rate, so double-
// discounting would erode margin; they're simply told they're all set.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UserRow = {
  id: string;
  email: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  stripe_price_id: string | null;
  retention_offer_claimed_at: string | null;
};

function loadUser(userId: string): UserRow | null {
  try {
    return (
      (getDb()
        .prepare(
          `SELECT id, email, stripe_subscription_id, subscription_status, stripe_price_id,
                  retention_offer_claimed_at
           FROM users WHERE id = ?`,
        )
        .get(userId) as UserRow | undefined) ?? null
    );
  } catch {
    return null;
  }
}

type Eligibility =
  | { kind: 'eligible'; user: UserRow }
  | { kind: 'claimed'; user: UserRow }
  | { kind: 'not_trialing'; user: UserRow }
  | { kind: 'invalid' };

function evaluate(userId: string | null, token: string | null): Eligibility {
  if (!userId || !token || !verifyConvertToken(userId, token)) return { kind: 'invalid' };
  const user = loadUser(userId);
  if (!user) return { kind: 'invalid' };
  if (user.retention_offer_claimed_at) return { kind: 'claimed', user };
  if (
    !user.stripe_subscription_id ||
    !canClaimTrialConversionOffer({
      subscriptionStatus: user.subscription_status,
      retentionOfferClaimedAt: user.retention_offer_claimed_at,
    })
  ) {
    return { kind: 'not_trialing', user };
  }
  return { kind: 'eligible', user };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroGEX — Your subscription</title></head>
<body style="margin:0; padding:0 16px; background:#0f2234; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px; margin:12vh auto; background:#ffffff; border-radius:14px; padding:36px 34px; text-align:center;">
    <div style="font-size:22px; font-weight:800; letter-spacing:-0.4px; color:#12283c;">zerogex<span style="color:#f45854;">.io</span></div>
    <h1 style="font-size:20px; color:#12283c; margin:22px 0 10px;">${heading}</h1>
    ${bodyHtml}
  </div>
</body></html>`;
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const INVALID_PAGE = shell(
  'This link looks invalid',
  `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">We couldn&rsquo;t verify this offer link. Reply to your trial-reminder email and I&rsquo;ll sort it out for you.</p>`,
);
const CLAIMED_PAGE = shell(
  'You&rsquo;re all set',
  `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">You&rsquo;ve already claimed this offer — the discount is on your account, so there&rsquo;s nothing more to do.</p>`,
);
const NOT_TRIALING_PAGE = shell(
  'Nothing to claim here',
  `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">This offer is for members still in their free trial. If your trial has already converted, you&rsquo;re all set — manage your plan anytime from your account page.</p>`,
);
const ALREADY_DISCOUNTED_PAGE = shell(
  'Your rate is already locked in',
  `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">You already have an introductory rate on your account, so you&rsquo;re getting the deal — no need to stack another. Your trial converts automatically at that rate, so there&rsquo;s nothing for you to do.</p>`,
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get('u');
  const t = searchParams.get('t');
  const evalResult = evaluate(u, t);

  if (evalResult.kind === 'invalid') return htmlResponse(INVALID_PAGE, 400);
  if (evalResult.kind === 'claimed') return htmlResponse(CLAIMED_PAGE, 200);
  if (evalResult.kind === 'not_trialing') return htmlResponse(NOT_TRIALING_PAGE, 200);

  // Eligible: render a confirmation whose button POSTs to claim. GET is inert.
  const action = `/convert?u=${encodeURIComponent(u!)}&t=${encodeURIComponent(t!)}`;
  const body = `
    <p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0 0 18px;">
      Your trial turns into a paid subscription automatically, so your access continues either way.
      This offer changes the <strong>price</strong> only: take <strong>${SAVE_PERCENT}% off for a full year</strong>,
      and that&rsquo;s the rate you&rsquo;ll be charged when your trial converts. No re-entering a card.
    </p>
    <form method="POST" action="${escapeHtml(action)}" style="margin:0;">
      <button type="submit" style="display:inline-block; padding:13px 22px; background:#f5b400; color:#000; font-weight:700; font-size:15px; border:none; border-radius:8px; cursor:pointer;">
        Take ${SAVE_PERCENT}% off
      </button>
    </form>
    <p style="font-size:13px; line-height:1.5; color:#8a97a3; margin:16px 0 0;">
      Not interested? Just ignore this — your subscription starts as normal at the standard rate, and you
      can still cancel anytime before your trial ends.
    </p>`;
  return htmlResponse(shell(`Take ${SAVE_PERCENT}% off your subscription`, body), 200);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let u = searchParams.get('u');
  let t = searchParams.get('t');
  if (!u || !t) {
    try {
      const form = new URLSearchParams(await request.text());
      u = u ?? form.get('u');
      t = t ?? form.get('t');
    } catch {
      /* ignore malformed body */
    }
  }

  const evalResult = evaluate(u, t);
  if (evalResult.kind === 'invalid') return htmlResponse(INVALID_PAGE, 400);
  if (evalResult.kind === 'claimed') return htmlResponse(CLAIMED_PAGE, 200);
  if (evalResult.kind === 'not_trialing') return htmlResponse(NOT_TRIALING_PAGE, 200);

  const user = evalResult.user;
  const sku = user.stripe_price_id ? priceIdToSku(user.stripe_price_id) : null;
  if (!sku) {
    return htmlResponse(
      shell(
        'Reply and I&rsquo;ll set it up',
        // The member already took the offer and our automation is what failed,
        // so a human fallback is right here. No magic keyword: the emails never
        // taught one, so asking for it would send them hunting for nothing.
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t apply the discount automatically on your plan. Just reply to your trial-reminder email and I&rsquo;ll set up ${SAVE_PERCENT}% off for a year by hand.</p>`,
      ),
      200,
    );
  }

  const stripe = getStripe();

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id!, {
      expand: ['discounts'],
    });
  } catch {
    return htmlResponse(
      shell(
        'Something went wrong',
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t reach billing just now. Please try again in a minute, or reply to your trial-reminder email and I&rsquo;ll take care of it.</p>`,
      ),
      502,
    );
  }

  const currentCoupons = subscriptionCouponIds(subscription);

  // Already carries a promo / founding / referral coupon: they have an intro
  // rate, so don't stack a second (no over-discount). Don't consume the one-shot
  // latch either — they never received OUR discount.
  if (!shouldStackTrialDiscount(currentCoupons.length)) {
    getDb()
      .prepare(
        `INSERT INTO audit_events (id, type, user_id, email, message, created_at)
         VALUES (?, 'billing_trial_convert_offer_skipped', ?, ?, ?, ?)`,
      )
      .run(
        `audit_convert_skip_${user.id}_${new Date().toISOString()}`,
        user.id,
        user.email,
        `Trial-convert offer clicked but sub ${subscription.id} already carries [${currentCoupons.join(', ')}]; kept existing rate`,
        new Date().toISOString(),
      );
    return htmlResponse(ALREADY_DISCOUNTED_PAGE, 200);
  }

  let coupon: string;
  try {
    coupon = await resolveSaveCoupon(stripe, sku);
  } catch {
    return htmlResponse(
      shell(
        'Something went wrong',
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t set up the offer just now. Please try again in a minute, or reply to your trial-reminder email and I&rsquo;ll take care of it.</p>`,
      ),
      502,
    );
  }

  try {
    await stripe.subscriptions.update(subscription.id, {
      discounts: stackCoupon(currentCoupons, coupon).map((c) => ({ coupon: c })),
      // Never prorate/charge mid-trial; the discount rides the trial-end invoice.
      proration_behavior: 'none',
    });
  } catch {
    return htmlResponse(
      shell(
        'Something went wrong',
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t apply the offer just now. Please try again in a minute, or reply to your trial-reminder email and I&rsquo;ll take care of it.</p>`,
      ),
      502,
    );
  }

  // Latch the one-shot offer (COALESCE keeps the first claim instant on a
  // double-submit) and record it. Distinct audit type from the win-back honor:
  // this is a PRE-conversion claim, not a cancellation offset, so the growth-rate
  // dashboard must not treat it as netting out a cancellation.
  const nowIso = new Date().toISOString();
  try {
    getDb()
      .prepare(
        `UPDATE users SET
           retention_offer_claimed_at = COALESCE(retention_offer_claimed_at, ?),
           updated_at = ?
         WHERE id = ?`,
      )
      .run(nowIso, nowIso, user.id);
    getDb()
      .prepare(
        `INSERT INTO audit_events (id, type, user_id, email, message, created_at)
         VALUES (?, 'billing_trial_convert_offer_claimed', ?, ?, ?, ?)`,
      )
      .run(
        `audit_convert_${user.id}_${nowIso}`,
        user.id,
        user.email,
        `Pre-trial-end conversion offer claimed on sub ${subscription.id}: stacked ${coupon} (${SAVE_PERCENT}% off 1yr)`,
        nowIso,
      );
  } catch {
    // The Stripe write already succeeded (the source of truth); a local mirror
    // failure still leaves the discount applied. The webhook reconciles the row.
  }

  return htmlResponse(
    shell(
      'Locked in — welcome aboard',
      `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">Done. <strong>${SAVE_PERCENT}% off for a year</strong> is on your account, so when your trial converts you&rsquo;ll be charged the discounted rate — nothing else to do. Glad to have you staying with ZeroGEX.</p>`,
    ),
    200,
  );
}
