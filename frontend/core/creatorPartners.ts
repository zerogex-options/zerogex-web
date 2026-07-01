import { randomBytes } from 'crypto';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { getStripe, type BillingCadence } from '@/core/stripe';

// Master switch. The whole program is inert (no creator-tier flips, no
// audience coupons applied at checkout, no commissions accrued) unless the
// operator opts in, mirroring isReferralProgramEnabled().
export function isCreatorPartnerProgramEnabled(): boolean {
  return process.env.CREATOR_PARTNER_PROGRAM_ENABLED === '1';
}

export type CreatorPartnerRow = {
  id: string;
  email: string;
  referral_code: string | null;
  partner_tier: string | null;
  partner_commission_bps: number;
  partner_commission_window_months: number;
  partner_audience_coupon_id: string | null;
  partner_audience_promo_code: string | null;
  partner_disclosure_url: string | null;
  partner_activated_at: string | null;
  partner_pro_grant_expires_at: string | null;
};

const PARTNER_SELECT_COLUMNS = `
  id, email, referral_code, partner_tier, partner_commission_bps,
  partner_commission_window_months, partner_audience_coupon_id,
  partner_audience_promo_code, partner_disclosure_url, partner_activated_at,
  partner_pro_grant_expires_at
`;

// True only when the user's partner_tier was set by the grant script AND the
// program is enabled. Returning false when disabled is intentional: it makes
// every partner-only code path a no-op the moment the kill switch is flipped.
export function isCreatorPartner(row: { partner_tier: string | null } | null | undefined): boolean {
  if (!isCreatorPartnerProgramEnabled()) return false;
  return row?.partner_tier === 'creator';
}

// Resolve a referral code to the creator partner who owns it, if any. Used
// at checkout to decide whether to apply the partner audience coupon vs. the
// standard referee coupon. Returns null for unknown codes, codes owned by
// standard (non-creator) users, or when the program is disabled.
//
// Matches against BOTH the 8-char auto-minted `referral_code` and the
// human-readable `partner_audience_promo_code`, so the same code works in
// `?ref=` whether the creator shared their link or just told their audience
// "use code SPYLEVELS25". The two columns are independently unique and
// belong to disjoint sets of users (only partners have the promo column
// populated), so a single OR query is unambiguous.
export function findCreatorByReferralCode(code: string): CreatorPartnerRow | null {
  if (!isCreatorPartnerProgramEnabled()) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const row = getDb()
    .prepare(
      `SELECT ${PARTNER_SELECT_COLUMNS}
       FROM users
       WHERE partner_tier = 'creator'
         AND (referral_code = ? OR partner_audience_promo_code = ?)`,
    )
    .get(normalized, normalized) as CreatorPartnerRow | undefined;
  return row ?? null;
}

// Resolve a Stripe promotion_code's metadata.partner_user_id back to the
// partner record. Used by the webhook back-attribution path so an audience
// member who skipped the `?ref=` link and typed the code at Stripe's
// checkout still gets attributed to the right partner. Defensive: returns
// null if the id isn't a real partner (e.g. a stale promotion code that
// outlived its partner's account).
export function findCreatorByUserId(userId: string): CreatorPartnerRow | null {
  if (!isCreatorPartnerProgramEnabled()) return null;
  const row = getDb()
    .prepare(
      `SELECT ${PARTNER_SELECT_COLUMNS}
       FROM users
       WHERE id = ? AND partner_tier = 'creator'`,
    )
    .get(userId) as CreatorPartnerRow | undefined;
  return row ?? null;
}

// The Stripe coupon ID to apply to a checkout where the referrer is a
// creator partner. Per-partner override wins so a top-tier creator can be
// given a richer audience deal; falls back to the global env coupon. The
// partner-audience coupon is recommended to be `duration:repeating,
// duration_in_months:3` for 25% off the first three months, monthly cadence
// only — see .env.example.
//
// Returns null for annual cadence: the partner offer is designed around the
// monthly path. An annual referee under a creator falls through to the
// standard annual referee coupon (or none).
export function getPartnerAudienceCouponId(
  partner: CreatorPartnerRow,
  cadence: BillingCadence,
): string | null {
  if (cadence !== 'monthly') return null;
  if (partner.partner_audience_coupon_id) return partner.partner_audience_coupon_id;
  const globalId = process.env.STRIPE_COUPON_PARTNER_AUDIENCE;
  return globalId && globalId.length > 0 ? globalId : null;
}

// -- Commission accrual (Phase 3) ------------------------------------------

export type AccrualOutcome =
  | { kind: 'none'; reason: string }
  | { kind: 'accrued'; commissionAmount: number; billedAmount: number; currency: string }
  | { kind: 'duplicate' };

// Called from the Stripe webhook when an `invoice.paid` event fires. Walks
// invoice -> referee -> referrer, gates on partner state + commission
// window, and inserts one row into partner_commissions. Idempotent via
// UNIQUE(stripe_invoice_id): Stripe retries and out-of-order deliveries
// no-op. Never throws — a commission miscount must not unwind the
// webhook's tier sync.
export async function maybeAccruePartnerCommission(
  invoice: Stripe.Invoice,
): Promise<AccrualOutcome> {
  if (!isCreatorPartnerProgramEnabled()) return { kind: 'none', reason: 'program_disabled' };

  const invoiceId = invoice.id;
  if (!invoiceId) return { kind: 'none', reason: 'no_invoice_id' };

  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return { kind: 'none', reason: 'no_customer' };

  const db = getDb();
  const referee = db
    .prepare(
      `SELECT id, referred_by_code FROM users WHERE stripe_customer_id = ?`,
    )
    .get(customerId) as { id: string; referred_by_code: string | null } | undefined;
  if (!referee) return { kind: 'none', reason: 'no_referee' };
  if (!referee.referred_by_code) return { kind: 'none', reason: 'organic' };

  // Resolve the referrer — must be a creator partner. Standard referrers
  // are handled by the free-month path in core/referrals.ts.
  const partner = findCreatorByReferralCode(referee.referred_by_code);
  if (!partner) return { kind: 'none', reason: 'referrer_not_partner' };
  if (partner.id === referee.id) return { kind: 'none', reason: 'self_referral' };

  // Amount collected AFTER any discounts / credits — commission is on the
  // real dollars we received, not on the list price. Zero-amount invoices
  // (fully covered by the audience coupon in month 1, banked credits, etc.)
  // don't accrue.
  const billed = invoice.amount_paid ?? 0;
  if (billed <= 0) return { kind: 'none', reason: 'zero_amount' };
  const currency = invoice.currency ?? 'usd';

  // Window check. Measured from the FIRST accrual for this (partner,
  // referee) pair — i.e. the referee's first paid invoice under this
  // partner. Anchor the window there rather than at partner.activated_at
  // so a partner attracted 3 months before their first paying referee
  // doesn't lose 3 months of eligibility.
  const firstAccrual = db
    .prepare(
      `SELECT MIN(created_at) AS m FROM partner_commissions
       WHERE partner_user_id = ? AND referee_user_id = ?`,
    )
    .get(partner.id, referee.id) as { m: string | null };
  if (firstAccrual.m) {
    const start = new Date(firstAccrual.m);
    if (!Number.isNaN(start.getTime())) {
      const deadline = new Date(start);
      deadline.setMonth(deadline.getMonth() + partner.partner_commission_window_months);
      if (Date.now() > deadline.getTime()) {
        return { kind: 'none', reason: 'window_expired' };
      }
    }
  }

  const commissionAmount = Math.round((billed * partner.partner_commission_bps) / 10000);
  if (commissionAmount <= 0) return { kind: 'none', reason: 'zero_commission' };

  const commissionId = `pc_${randomBytes(12).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO partner_commissions
       (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount,
        commission_amount, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'accrued', ?)`,
    )
    .run(
      commissionId,
      partner.id,
      referee.id,
      invoiceId,
      billed,
      commissionAmount,
      currency,
      nowIso,
    ) as { changes: number | bigint };

  if (Number(result.changes) === 0) return { kind: 'duplicate' };
  return { kind: 'accrued', commissionAmount, billedAmount: billed, currency };
}

// Called from the Stripe webhook when a `charge.refunded` or
// `charge.dispute.created` event flips a paid invoice's money-received
// state to no-longer-ours. Flips any 'accrued' rows on that invoice to
// 'reversed'. Doesn't touch already-'paid' rows — those are out the
// door and require an out-of-band clawback (payout reversal). Doesn't
// touch already-'reversed' rows either, so redelivery is a no-op.
// Returns the number of rows flipped for audit-log purposes.
export function reversePartnerCommissionsForInvoice(invoiceId: string): number {
  const result = getDb()
    .prepare(
      `UPDATE partner_commissions SET status = 'reversed'
       WHERE stripe_invoice_id = ? AND status = 'accrued'`,
    )
    .run(invoiceId) as { changes: number | bigint };
  return Number(result.changes);
}

// Race defense: when the Stripe webhook stamps referred_by_code via
// back-attribution on `checkout.session.completed`, there's a small
// window where `invoice.paid` for the same signup can arrive first and
// be dropped as 'organic' (no referred_by_code yet). Called from the
// back-attribution path AFTER the row is stamped so any invoices the
// referee already has paid get retroactively accrued. Best-effort — a
// Stripe list-invoices failure just means we miss the backfill; the
// next invoice.paid will accrue normally.
export async function accrueMissedInvoicesForReferee(
  refereeUserId: string,
): Promise<Stripe.Invoice[]> {
  const row = getDb()
    .prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
    .get(refereeUserId) as { stripe_customer_id: string | null } | undefined;
  if (!row?.stripe_customer_id) return [];
  try {
    // 10 is generous — under the race, at most 1 paid invoice exists at
    // this moment. We over-fetch to be defensive against a manual signup
    // flow that racked up invoices before we ran back-attribution.
    const invoices = await getStripe().invoices.list({
      customer: row.stripe_customer_id,
      status: 'paid',
      limit: 10,
    });
    const accrued: Stripe.Invoice[] = [];
    for (const inv of invoices.data) {
      const outcome = await maybeAccruePartnerCommission(inv);
      if (outcome.kind === 'accrued') accrued.push(inv);
    }
    return accrued;
  } catch {
    return [];
  }
}
