import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { getStripe, priceIdToSku } from '@/core/stripe';
import { verifySaveToken } from '@/core/retentionToken';
import { resolveSaveCoupon, stackCoupon, subscriptionCouponIds } from '@/core/retentionOffer';

// Self-serve retention SAVE. The cancellation email carries a one-click
// "keep my access + claim your discount" link (buildSaveUrl, signed by
// core/retentionToken). This route honors that offer WITHOUT an operator or a
// reply — the automated twin of `make honor-winback-discount`:
//   • stacks the standing win-back coupon (25% off for a year) onto the member's
//     existing subscription, preserving any coupon already there, and
//   • clears cancel_at_period_end so the sub is retained — a trialing sub
//     converts to paid at trial end, an active sub renews — on the card on file.
//
// GET renders a confirmation page with NO side effect (so email link-prefetchers
// like Outlook SafeLinks can't silently claim a discount / un-cancel someone who
// didn't click). The visible button POSTs here to actually apply. One claim per
// account, latched by users.retention_offer_claimed_at.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UserRow = {
  id: string;
  email: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  cancel_at_period_end: number | null;
  current_period_end: string | null;
  stripe_price_id: string | null;
  retention_offer_claimed_at: string | null;
};

const LIVE_STATUSES = new Set(['trialing', 'active']);

// resolveSaveCoupon / SAVE_PERCENT and the coupon-stacking helpers now live in
// core/retentionOffer.ts so the in-app cancellation flow shares them verbatim.

function loadUser(userId: string): UserRow | null {
  try {
    return (getDb()
      .prepare(
        `SELECT id, email, stripe_subscription_id, subscription_status, cancel_at_period_end,
                current_period_end, stripe_price_id, retention_offer_claimed_at
         FROM users WHERE id = ?`,
      )
      .get(userId) as UserRow | undefined) ?? null;
  } catch {
    return null;
  }
}

// What state is this member's save offer in? Drives both the GET page and the
// POST guard so they never disagree.
type Eligibility =
  | { kind: 'eligible'; user: UserRow }
  | { kind: 'claimed'; user: UserRow }
  | { kind: 'not_cancelling'; user: UserRow }
  | { kind: 'invalid' };

function evaluate(userId: string | null, token: string | null): Eligibility {
  if (!userId || !token || !verifySaveToken(userId, token)) return { kind: 'invalid' };
  const user = loadUser(userId);
  if (!user) return { kind: 'invalid' };
  if (user.retention_offer_claimed_at) return { kind: 'claimed', user };
  const live = LIVE_STATUSES.has(user.subscription_status ?? '');
  const cancelling = Number(user.cancel_at_period_end) === 1;
  if (!user.stripe_subscription_id || !live || !cancelling) return { kind: 'not_cancelling', user };
  return { kind: 'eligible', user };
}

function formatDate(iso: string | null): string {
  if (!iso) return 'the end of your current period';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'the end of your current period';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
<title>ZeroGEX — Keep your access</title></head>
<body style="margin:0; background:#0f2234; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
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
  `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">We couldn&rsquo;t verify this offer link. Reply to your cancellation email and I&rsquo;ll sort it out for you.</p>`,
);
const CLAIMED_PAGE = shell(
  'You&rsquo;re all set',
  `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">You&rsquo;ve already claimed this offer — your access continues and the discount is on your account. Nothing more to do.</p>`,
);
const NOT_CANCELLING_PAGE = shell(
  'Nothing to restore',
  `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">Your subscription isn&rsquo;t scheduled to cancel, so there&rsquo;s nothing to undo here. If you meant to make a change, manage your plan from your account page.</p>`,
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get('u');
  const t = searchParams.get('t');
  const evalResult = evaluate(u, t);

  if (evalResult.kind === 'invalid') return htmlResponse(INVALID_PAGE, 400);
  if (evalResult.kind === 'claimed') return htmlResponse(CLAIMED_PAGE, 200);
  if (evalResult.kind === 'not_cancelling') return htmlResponse(NOT_CANCELLING_PAGE, 200);

  // Eligible: render the confirmation with a button that POSTs to claim. GET
  // itself changes nothing.
  const endsOn = formatDate(evalResult.user.current_period_end);
  const action = `/save?u=${encodeURIComponent(u!)}&t=${encodeURIComponent(t!)}`;
  const body = `
    <p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0 0 18px;">
      Before you go — I&rsquo;d rather keep you than lose you. Claim <strong>25% off for a full year</strong>
      and your access stays on, no re-subscribe and no re-entering a card. You&rsquo;ll simply be charged the
      discounted rate at ${escapeHtml(endsOn)} instead of canceling.
    </p>
    <form method="POST" action="${escapeHtml(action)}" style="margin:0;">
      <button type="submit" style="display:inline-block; padding:13px 22px; background:#f5b400; color:#000; font-weight:700; font-size:15px; border:none; border-radius:8px; cursor:pointer;">
        Keep my access &amp; apply 25% off
      </button>
    </form>
    <p style="font-size:13px; line-height:1.5; color:#8a97a3; margin:16px 0 0;">
      Prefer to still cancel? Just ignore this — nothing changes and your cancellation stands.
    </p>`;
  return htmlResponse(shell('Wait — here&rsquo;s 25% off to stay', body), 200);
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
  if (evalResult.kind === 'not_cancelling') return htmlResponse(NOT_CANCELLING_PAGE, 200);

  const user = evalResult.user;
  const sku = user.stripe_price_id ? priceIdToSku(user.stripe_price_id) : null;

  // A price that doesn't map to a known SKU (a misconfigured STRIPE_PRICE_* env)
  // leaves us unable to pick a coupon cadence — don't silently un-cancel at full
  // price; fall back to the reply-'discount' path the email already offers.
  if (!sku) {
    return htmlResponse(
      shell(
        'Reply and I&rsquo;ll set it up',
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t apply the discount automatically on your plan. Just reply <strong>&ldquo;discount&rdquo;</strong> to your cancellation email and I&rsquo;ll set up 25% off for a year by hand — no re-subscribe needed.</p>`,
      ),
      200,
    );
  }

  const stripe = getStripe();

  // Resolve the 25%/yr save coupon — operator-configured if present, else
  // create-or-reuse a deterministic one — so the one-click save works out of the
  // box even when the STRIPE_COUPON_WINBACK_* envs aren't set.
  let winbackCoupon: string;
  try {
    winbackCoupon = await resolveSaveCoupon(stripe, sku);
  } catch {
    return htmlResponse(
      shell(
        'Something went wrong',
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t set up the offer just now. Please try again in a minute, or reply to your cancellation email and I&rsquo;ll take care of it.</p>`,
      ),
      502,
    );
  }

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id!, {
      expand: ['discounts'],
    });
  } catch {
    return htmlResponse(
      shell(
        'Something went wrong',
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t reach billing just now. Please try again in a minute, or reply to your cancellation email and I&rsquo;ll take care of it.</p>`,
      ),
      502,
    );
  }

  // Preserve any coupon already on the sub — STACK the win-back one, never strip
  // (mirrors scripts/honor-winback-discount.mts). Dedup so a re-submit can't add
  // it twice.
  const resultingCouponIds = stackCoupon(subscriptionCouponIds(subscription), winbackCoupon);

  try {
    await stripe.subscriptions.update(subscription.id, {
      discounts: resultingCouponIds.map((coupon) => ({ coupon })),
      cancel_at_period_end: false,
      // Never prorate/charge mid-period; the stacked discount rides the next
      // (conversion/renewal) invoice only.
      proration_behavior: 'none',
    });
  } catch {
    return htmlResponse(
      shell(
        'Something went wrong',
        `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">I couldn&rsquo;t apply the offer just now. Please try again in a minute, or reply to your cancellation email and I&rsquo;ll take care of it.</p>`,
      ),
      502,
    );
  }

  // Mirror the change locally (the webhook reconciles to the same values later,
  // idempotently): clear the cancellation flag + its ack latch so a future
  // re-cancel re-acks, and stamp the one-shot save latch (COALESCE keeps the
  // first claim instant on any double-submit).
  const nowIso = new Date().toISOString();
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
      .run(nowIso, nowIso, user.id);
    // Audit as a win-back honor so the Forward-Looking Growth Rate nets this
    // cancellation out (buildGrowthRates keys the win-back offset on this type +
    // the "cleared cancel_at_period_end" phrase).
    getDb()
      .prepare(
        `INSERT INTO audit_events (id, type, user_id, email, message, created_at)
         VALUES (?, 'billing_winback_discount_honored', ?, ?, ?, ?)`,
      )
      .run(
        `audit_save_${user.id}_${nowIso}`,
        user.id,
        user.email,
        `Self-serve retention save on sub ${subscription.id}: stacked ${winbackCoupon}, cleared cancel_at_period_end`,
        nowIso,
      );
  } catch {
    // The Stripe write already succeeded (the source of truth); a local mirror
    // failure still leaves the member saved. The webhook will reconcile the row.
  }

  const endsOn = formatDate(user.current_period_end);
  return htmlResponse(
    shell(
      'You&rsquo;re staying — welcome back',
      `<p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">Done. Your access continues and <strong>25% off for a year</strong> is on your account. You&rsquo;ll be charged the discounted rate at ${escapeHtml(endsOn)} — nothing else to do. Thanks for giving ZeroGEX another shot.</p>`,
    ),
    200,
  );
}
