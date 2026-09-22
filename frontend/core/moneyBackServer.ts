// The I/O half of the 7-day money-back guarantee: read the member's live
// subscription and invoices from Stripe, decide (core/moneyBackGuarantee.ts),
// and — on request — refund, cancel, end access and record it.
//
// Two callers, one code path: the Account page (app/api/billing/money-back)
// and the operator script (scripts/money-back-refund.mts, for a request that
// arrives by email). Because the script runs under plain `node`, every value
// import here is a relative `./x.ts` path — `@/` specifiers and `server-only`
// do not resolve outside Next.
//
// ORDER OF OPERATIONS, and why:
//
//   1. Claim the ledger row ('pending') BEFORE any money moves. A double click,
//      a retry, or a crash mid-flight then RESUMES this request instead of
//      starting a second one, and the one-refund-per-customer limit sees the
//      request the moment it begins.
//   2. Refund first, cancel second. If the refund fails nothing else happens —
//      the member keeps what they paid for and can try again. If the cancel
//      fails after the refund, the member has their money and loses access
//      locally now; the operator is alerted to finish the cancel in Stripe
//      (otherwise the next renewal would bill a refunded member), and a re-run
//      resumes and retries it. Every refund carries a Stripe idempotency key
//      derived from the invoice and amount, so no retry can refund twice.
//   3. Always a FULL refund of whatever is still unrefunded on each invoice —
//      never a pro-rata remainder. A partially refunded invoice on a canceled
//      subscription is exactly the case core/orphanPayment.ts refuses to decide
//      alone, and the daily orphan sweep would flag every one of them.
//   4. Clear the member locally with the same fields the webhook's
//      customer.subscription.deleted handler clears, so access ends now rather
//      than whenever the webhook lands, and deprovision API keys here — once
//      the tier is already 'public', the webhook no longer sees a drop to act on.

import { randomBytes } from 'node:crypto';
import type Stripe from 'stripe';
import { getDb } from './db.ts';
import { getStripe, priceIdToSku, skuHasMoneyBackGuarantee } from './stripe.ts';
import { MONEY_BACK_GUARANTEE_DAYS, type BillingCadence, type BillableTier } from './billingPlans.ts';
import {
  canonicalEmail,
  decideMoneyBack,
  paidInvoices,
  type GuaranteeInvoice,
  type GuaranteeSubscription,
  type MoneyBackDecision,
  type MoneyBackIneligibleReason,
  type RefundItem,
} from './moneyBackGuarantee.ts';
import {
  readInvoiceChargeId,
  readInvoicePaidAtUnix,
  readInvoicePaymentIntentId,
  readInvoicePriceId,
  readInvoiceRefundedAmount,
} from './stripeInvoice.ts';
import { normalizeTier } from './auth.ts';
import { revokeApiKeysIfTierDropped } from './apiKeyAdmin.ts';
import { sanitizeCancellationComment, validateCancelFeedback } from './cancellationReason.ts';
import {
  sendMoneyBackOperatorAlertEmail,
  sendMoneyBackRefundEmail,
  type MoneyBackOperatorAlert,
} from './mailer.ts';

const DAY_MS = 86_400_000;
// A 'pending' ledger row younger than this is a request still in flight; a
// second request inside it is refused rather than run concurrently. Older than
// this, a pending row is a request that died part-way and may be resumed.
const IN_FLIGHT_MS = 2 * 60 * 1000;
// A 'failed' request (nothing refunded, nothing canceled — the member kept
// their plan) stops being offered for retry after this. Past it the member has
// plainly carried on subscribing, and a new request is judged on its own terms.
const FAILED_REQUEST_TTL_MS = 30 * DAY_MS;

type UserRow = {
  id: string;
  email: string;
  tier: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  last_paid_subscription_id: string | null;
  last_paid_invoice_at: string | null;
};

type LedgerRow = {
  id: string;
  subscription_id: string;
  user_id: string;
  status: 'pending' | 'completed' | 'failed';
  amount_refunded: number;
  currency: string | null;
  refund_ids: string | null;
  card_fingerprint: string | null;
  requested_at: string;
  updated_at: string;
};

// A failed request that has sat untouched past its TTL is treated as if it
// never happened (see FAILED_REQUEST_TTL_MS).
function isLiveLedger(row: LedgerRow | null, nowMs: number): row is LedgerRow {
  if (!row) return false;
  if (row.status !== 'failed') return true;
  const age = nowMs - Date.parse(row.updated_at);
  return !Number.isFinite(age) || age < FAILED_REQUEST_TTL_MS;
}

type CardInfo = { fingerprint: string | null; brand: string | null; last4: string | null };

type LiveState = {
  subscription: GuaranteeSubscription | null;
  invoices: GuaranteeInvoice[];
  cardByInvoice: Map<string, CardInfo>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function logAudit(input: { type: string; userId?: string | null; email?: string | null; ip?: string | null; message: string }) {
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
      input.ip ?? 'money-back',
      input.message,
      nowIso(),
    );
}

function loadUser(userId: string): UserRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, email, tier, stripe_customer_id, stripe_subscription_id, stripe_price_id,
                subscription_status, last_paid_subscription_id, last_paid_invoice_at
           FROM users WHERE id = ? AND deleted_at IS NULL`,
      )
      .get(userId) as UserRow | undefined) ?? null
  );
}

function findLedgerForSubscription(subscriptionId: string): LedgerRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, subscription_id, user_id, status, amount_refunded, currency, refund_ids,
                card_fingerprint, requested_at, updated_at
           FROM money_back_refunds WHERE subscription_id = ?`,
      )
      .get(subscriptionId) as LedgerRow | undefined) ?? null
  );
}

// An unfinished request of this member's whose subscription is no longer on
// the user row — the cancel went through (or the webhook cleared the row) but
// the request never reached 'completed'. Resumable by the same member.
function findUnfinishedLedgerForUser(userId: string): LedgerRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, subscription_id, user_id, status, amount_refunded, currency, refund_ids,
                card_fingerprint, requested_at, updated_at
           FROM money_back_refunds
          WHERE user_id = ? AND status IN ('pending', 'failed')
          ORDER BY requested_at DESC LIMIT 1`,
      )
      .get(userId) as LedgerRow | undefined) ?? null
  );
}

// The one-refund-per-customer limit: a pending or completed guarantee refund on
// ANY OTHER subscription that shares this account, canonical email or card.
export function hasPriorMoneyBackRefund(input: {
  userId: string;
  email: string;
  cardFingerprint: string | null;
  subscriptionId: string;
}): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS hit FROM money_back_refunds
        WHERE status IN ('pending', 'completed')
          AND subscription_id <> ?
          AND (user_id = ? OR email_canonical = ?
               OR (card_fingerprint IS NOT NULL AND card_fingerprint = ?))
        LIMIT 1`,
    )
    .get(input.subscriptionId, input.userId, canonicalEmail(input.email), input.cardFingerprint ?? '') as
    | { hit: number }
    | undefined;
  return !!row;
}

function cardFromCharge(charge: Stripe.Charge | null | undefined): CardInfo | null {
  if (!charge) return null;
  const card = charge.payment_method_details?.card;
  return {
    fingerprint: card?.fingerprint ?? null,
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
  };
}

function expandedCharge(invoice: Stripe.Invoice): Stripe.Charge | null {
  const raw = (invoice as unknown as { charge?: unknown }).charge;
  return raw && typeof raw === 'object' && 'amount_refunded' in (raw as object) ? (raw as Stripe.Charge) : null;
}

// Every invoice on the subscription, with its refund state read LIVE — a
// refund is invisible on the invoice itself (it stays status=paid with
// amount_paid untouched), so the charge has to be read.
async function loadLiveState(stripe: Stripe, subscriptionId: string): Promise<LiveState> {
  let raw: Stripe.Subscription | null = null;
  try {
    raw = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code;
    if (code !== 'resource_missing') throw err;
  }

  let list: Stripe.ApiList<Stripe.Invoice>;
  try {
    list = await stripe.invoices.list({ subscription: subscriptionId, limit: 24, expand: ['data.charge'] });
  } catch {
    // The expansion is an optimization (see resolveRefundedAmount in the
    // webhook); a plainer read plus per-charge lookups below answers the same.
    list = await stripe.invoices.list({ subscription: subscriptionId, limit: 24 });
  }

  const invoices: GuaranteeInvoice[] = [];
  const cardByInvoice = new Map<string, CardInfo>();
  for (const invoice of list.data) {
    if (!invoice.id) continue;
    const amountPaid = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0;
    let amountRefunded = readInvoiceRefundedAmount(invoice);
    let chargeId = readInvoiceChargeId(invoice);
    const paymentIntentId = readInvoicePaymentIntentId(invoice);
    let card = cardFromCharge(expandedCharge(invoice));

    if (invoice.status === 'paid' && amountPaid > 0 && (amountRefunded == null || !card)) {
      try {
        let charge: Stripe.Charge | null = null;
        if (chargeId) {
          charge = await stripe.charges.retrieve(chargeId);
        } else if (paymentIntentId) {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
          const latest = intent.latest_charge;
          charge = latest && typeof latest !== 'string' ? latest : null;
        }
        if (charge) {
          chargeId = chargeId ?? charge.id;
          if (amountRefunded == null) {
            const creditNotes =
              typeof invoice.post_payment_credit_notes_amount === 'number'
                ? invoice.post_payment_credit_notes_amount
                : 0;
            amountRefunded = creditNotes + (charge.amount_refunded ?? 0);
          }
          card = card ?? cardFromCharge(charge);
        }
      } catch {
        // Left unknown: decideMoneyBack refuses rather than guessing.
      }
    }
    if (card) cardByInvoice.set(invoice.id, card);

    invoices.push({
      id: invoice.id,
      status: invoice.status ?? null,
      billingReason: invoice.billing_reason ?? null,
      amountPaid,
      amountRefunded,
      paidAtUnix: readInvoicePaidAtUnix(invoice),
      createdUnix: typeof invoice.created === 'number' ? invoice.created : null,
      priceId: readInvoicePriceId(invoice),
      chargeId,
      paymentIntentId,
      currency: invoice.currency ?? null,
    });
  }

  const subscription: GuaranteeSubscription | null = raw
    ? {
        id: raw.id,
        status: raw.status,
        trialEndUnix: typeof raw.trial_end === 'number' ? raw.trial_end : null,
        stampedMoneyBack: (raw.metadata ?? {}).money_back === '1',
      }
    : null;
  return { subscription, invoices, cardByInvoice };
}

function priceCovered(priceId: string | null): boolean {
  const sku = priceId ? priceIdToSku(priceId) : null;
  return sku ? skuHasMoneyBackGuarantee(sku) : false;
}

const TIER_LABEL: Record<BillableTier, string> = { basic: 'Basic', pro: 'Pro' };
const CADENCE_LABEL: Record<BillingCadence, string> = { monthly: 'monthly', quarterly: 'quarterly', annual: 'annual' };

function planLabelFor(priceId: string | null): string {
  const sku = priceId ? priceIdToSku(priceId) : null;
  return sku ? `${TIER_LABEL[sku.tier]} (${CADENCE_LABEL[sku.cadence]})` : 'ZeroGEX';
}

export function formatMinorAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      amount / 100,
    );
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// ---------------------------------------------------------------------------
// Status (what the Account page shows)
// ---------------------------------------------------------------------------

export type MoneyBackStatus =
  | {
      state: 'eligible';
      deadlineIso: string;
      amount: number;
      currency: string;
      amountFormatted: string;
      planLabel: string;
    }
  // A request was started and did not finish (or its cancel still has to go
  // through). The member can re-submit; it resumes, it never double-refunds.
  | { state: 'unfinished'; subscriptionId: string }
  | { state: 'ineligible'; reason: MoneyBackIneligibleReason | 'unavailable'; deadlineIso: string | null };

// The Stripe client, injectable so the whole flow is exercised in
// tests/moneyBackServer.test.ts against a scripted fake rather than trusted to
// work by inspection. Production callers never pass it.
export type MoneyBackDeps = { stripe?: Stripe };

// Cheap local answers first, so the Account page only reaches Stripe for a
// member who could plausibly be inside their window.
export async function getMoneyBackStatus(
  userId: string,
  nowMs = Date.now(),
  deps: MoneyBackDeps = {},
): Promise<MoneyBackStatus> {
  const user = loadUser(userId);
  if (!user) return { state: 'ineligible', reason: 'no_subscription', deadlineIso: null };

  const ledger = user.stripe_subscription_id
    ? findLedgerForSubscription(user.stripe_subscription_id)
    : findUnfinishedLedgerForUser(user.id);
  if (isLiveLedger(ledger, nowMs)) {
    if (ledger.status === 'completed') {
      return { state: 'ineligible', reason: 'already_refunded', deadlineIso: null };
    }
    return { state: 'unfinished', subscriptionId: ledger.subscription_id };
  }

  if (!user.stripe_subscription_id) return { state: 'ineligible', reason: 'no_subscription', deadlineIso: null };
  // A trial has taken no money; there is nothing to refund (and the trial plan
  // carries no guarantee anyway — cancelling before it ends costs nothing).
  if (user.subscription_status === 'trialing') return { state: 'ineligible', reason: 'no_payment', deadlineIso: null };
  // The LATEST payment on this subscription is already outside the window, so
  // its first one is too. (A recent payment may be a renewal; that case falls
  // through to the live read, which decides it properly.)
  if (user.last_paid_subscription_id === user.stripe_subscription_id && user.last_paid_invoice_at) {
    const lastPaidMs = Date.parse(user.last_paid_invoice_at);
    if (Number.isFinite(lastPaidMs) && nowMs - lastPaidMs > (MONEY_BACK_GUARANTEE_DAYS + 1) * DAY_MS) {
      return { state: 'ineligible', reason: 'window_elapsed', deadlineIso: null };
    }
  }

  try {
    const { decision } = await evaluateLive(deps.stripe ?? getStripe(), user, user.stripe_subscription_id, {
      nowMs,
      resuming: false,
    });
    if (!decision.eligible) {
      return {
        state: 'ineligible',
        reason: decision.reason,
        deadlineIso: decision.deadlineMs != null ? new Date(decision.deadlineMs).toISOString() : null,
      };
    }
    return {
      state: 'eligible',
      deadlineIso: new Date(decision.deadlineMs).toISOString(),
      amount: decision.totalAmount,
      currency: decision.currency,
      amountFormatted: formatMinorAmount(decision.totalAmount, decision.currency),
      planLabel: planLabelFor(decision.firstPaidPriceId),
    };
  } catch {
    return { state: 'ineligible', reason: 'unavailable', deadlineIso: null };
  }
}

async function evaluateLive(
  stripe: Stripe,
  user: UserRow,
  subscriptionId: string,
  opts: { nowMs: number; resuming: boolean; refundCutoffMs?: number },
): Promise<{ decision: MoneyBackDecision; live: LiveState; card: CardInfo | null }> {
  const live = await loadLiveState(stripe, subscriptionId);
  const first = paidInvoices(live.invoices)[0] ?? null;
  const card = first ? live.cardByInvoice.get(first.id) ?? null : null;
  const priorRefundElsewhere = hasPriorMoneyBackRefund({
    userId: user.id,
    email: user.email,
    cardFingerprint: card?.fingerprint ?? null,
    subscriptionId,
  });
  const decision = decideMoneyBack({
    nowMs: opts.nowMs,
    windowDays: MONEY_BACK_GUARANTEE_DAYS,
    subscription: live.subscription,
    invoices: live.invoices,
    priceCovered,
    priorRefundElsewhere,
    resuming: opts.resuming,
    refundCutoffMs: opts.refundCutoffMs,
  });
  return { decision, live, card };
}

// ---------------------------------------------------------------------------
// The refund itself
// ---------------------------------------------------------------------------

export type MoneyBackRequest = {
  userId: string;
  source: 'self_serve' | 'operator';
  feedback?: unknown;
  comment?: unknown;
  ip?: string | null;
  // Operator only: honor a request outside the window or past the one-refund
  // limit (a goodwill refund). Never set from a member request.
  overrideLimits?: boolean;
  nowMs?: number;
};

export type MoneyBackResult =
  | {
      ok: true;
      amountRefunded: number;
      currency: string;
      amountFormatted: string;
      refundIds: string[];
      canceled: boolean;
      // Anything the flow could not finish; the operator has been alerted.
      problems: string[];
    }
  | { ok: false; httpStatus: number; reason: string; message: string };

const MESSAGES: Record<string, string> = {
  no_subscription: "There's no active subscription on this account to refund.",
  subscription_ended: 'This subscription has already ended.',
  no_payment: "Nothing has been charged on this subscription yet, so there's nothing to refund. You can cancel from the billing portal at no cost.",
  not_covered:
    'This plan is not covered by the money-back guarantee (the Basic monthly plan has a free trial instead).',
  window_elapsed: 'The 7-day money-back window for this payment has closed.',
  prior_refund: 'The money-back guarantee is limited to one refund per customer, and it has already been used.',
  already_refunded: 'This payment has already been refunded.',
  refund_state_unknown: "We couldn't confirm this payment's refund status automatically. Please contact support and we'll sort it out.",
  needs_manual_refund: "This payment can't be refunded automatically. Please contact support and we'll handle it.",
  in_progress: 'Your refund is already being processed.',
  refund_failed: "We couldn't issue the refund just now. Nothing was charged or canceled — please try again in a few minutes.",
  unavailable: "Couldn't reach billing just now. Please try again in a minute.",
};

function fail(reason: string, httpStatus = 409): MoneyBackResult {
  return { ok: false, httpStatus, reason, message: MESSAGES[reason] ?? 'Refund request failed.' };
}

// Claim (or re-claim) the ledger row for this subscription. Returns the row id,
// or null when another request holds it.
function claimLedger(input: {
  existing: LedgerRow | null;
  user: UserRow;
  subscriptionId: string;
  source: 'self_serve' | 'operator';
  feedback: string | null;
  comment: string | null;
  nowMs: number;
}): string | null {
  const db = getDb();
  const stamp = new Date(input.nowMs).toISOString();
  if (!input.existing) {
    const id = `mbr_${randomBytes(12).toString('hex')}`;
    try {
      db.prepare(
        `INSERT INTO money_back_refunds
           (id, subscription_id, user_id, email, email_canonical, customer_id, status, source,
            feedback, comment, requested_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.subscriptionId,
        input.user.id,
        input.user.email,
        canonicalEmail(input.user.email),
        input.user.stripe_customer_id,
        input.source,
        input.feedback,
        input.comment,
        stamp,
        stamp,
      );
      return id;
    } catch {
      // UNIQUE(subscription_id): a concurrent request claimed it first.
      return null;
    }
  }
  const existing = input.existing;
  if (existing.status === 'completed') return null;
  if (existing.status === 'pending') {
    const age = input.nowMs - Date.parse(existing.updated_at);
    if (Number.isFinite(age) && age < IN_FLIGHT_MS) return null;
  }
  const claimed = db
    .prepare(
      `UPDATE money_back_refunds SET status = 'pending', error = NULL, updated_at = ?
        WHERE id = ? AND status = ? AND updated_at = ?`,
    )
    .run(stamp, existing.id, existing.status, existing.updated_at) as { changes: number | bigint };
  return Number(claimed.changes) > 0 ? existing.id : null;
}

function isAlreadyCanceledError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  if (e?.code === 'resource_missing') return true;
  return /cancel(l)?ed subscription|already been canceled|is canceled/i.test(e?.message ?? '');
}

async function cancelSubscriptionNow(
  stripe: Stripe,
  subscriptionId: string,
  details: { feedback: string | null; comment: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const params: Stripe.SubscriptionCancelParams = {
    invoice_now: false,
    prorate: false,
    ...(details.feedback || details.comment
      ? {
          cancellation_details: {
            ...(details.feedback
              ? { feedback: details.feedback as Stripe.SubscriptionCancelParams.CancellationDetails.Feedback }
              : {}),
            ...(details.comment ? { comment: details.comment } : {}),
          },
        }
      : {}),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await stripe.subscriptions.cancel(subscriptionId, params);
      return { ok: true };
    } catch (err) {
      if (isAlreadyCanceledError(err)) return { ok: true };
      if (attempt === 1) return { ok: false, message: err instanceof Error ? err.message : 'cancel failed' };
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  return { ok: false, message: 'cancel failed' };
}

async function refundOne(
  stripe: Stripe,
  item: RefundItem,
  meta: { userId: string; subscriptionId: string },
): Promise<{ ok: true; refundId: string | null } | { ok: false; message: string }> {
  try {
    const refund = await stripe.refunds.create(
      {
        ...(item.chargeId ? { charge: item.chargeId } : { payment_intent: item.paymentIntentId as string }),
        amount: item.amount,
        reason: 'requested_by_customer',
        metadata: {
          money_back: '1',
          user_id: meta.userId,
          subscription_id: meta.subscriptionId,
          invoice_id: item.invoiceId,
        },
      },
      // Same invoice + same remaining amount = same refund, on any retry.
      { idempotencyKey: `zgx-money-back:${item.invoiceId}:${item.amount}` },
    );
    return { ok: true, refundId: refund.id };
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code;
    // Already fully refunded (a resumed request racing a read): the money is
    // back, which is the outcome we wanted.
    if (code === 'charge_already_refunded') return { ok: true, refundId: null };
    return { ok: false, message: err instanceof Error ? err.message : 'refund failed' };
  }
}

// End access now, with the same fields the webhook's
// customer.subscription.deleted handler clears (so its later run is a no-op),
// and deprovision API keys while we still know the tier they had.
async function clearLocally(user: UserRow, subscriptionId: string, canceled: boolean, ip: string | null) {
  const db = getDb();
  const stamp = nowIso();
  const previousTier = normalizeTier(user.tier);
  const result = canceled
    ? (db
        .prepare(
          `UPDATE users SET
             tier = 'public',
             stripe_subscription_id = NULL,
             stripe_price_id = NULL,
             last_paid_subscription_id = NULL,
             last_paid_invoice_at = NULL,
             subscription_status = 'canceled',
             current_period_end = NULL,
             cancel_at_period_end = 0,
             subscription_lapsed = 1,
             payment_recovery_pending = 0,
             payment_grace_started_at = NULL,
             payment_grace_reason = NULL,
             updated_at = ?
           WHERE id = ? AND stripe_subscription_id = ?`,
        )
        .run(stamp, user.id, subscriptionId) as { changes: number | bigint })
    : // The cancel did not go through: keep the subscription on the row (so a
      // re-run can find and finish it) but end access now — the member has
      // their money back.
      (db
        .prepare(`UPDATE users SET tier = 'public', updated_at = ? WHERE id = ? AND tier <> 'admin'`)
        .run(stamp, user.id) as { changes: number | bigint });

  if (Number(result.changes) === 0) return;
  try {
    const revocation = await revokeApiKeysIfTierDropped(user.email, previousTier, 'public');
    if (revocation.status === 'revoked' && revocation.revoked > 0) {
      logAudit({
        type: 'api_key_auto_revoked',
        userId: user.id,
        email: user.email,
        ip,
        message: `Revoked ${revocation.revoked} API key(s): money-back refund dropped ${previousTier} → public`,
      });
    } else if (revocation.status === 'unconfigured') {
      logAudit({
        type: 'api_key_revoke_skipped_unconfigured',
        userId: user.id,
        email: user.email,
        ip,
        message:
          `API keys NOT revoked on money-back refund (${previousTier} → public): key administration ` +
          `is not configured (ZEROGEX_API_TOKEN / ZEROGEX_ADMIN_TOKEN). Any key this member holds is still live.`,
      });
    }
  } catch (err) {
    logAudit({
      type: 'api_key_auto_revoke_error',
      userId: user.id,
      email: user.email,
      ip,
      message: `API key revoke on money-back refund failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    });
  }
}

// A referred member's friend bonus: void a reward not yet paid out, and report
// one that already was (a free month credited to the referrer) so a human can
// decide whether this looks like reward farming.
function settleReferral(userId: string): string | null {
  const db = getDb();
  db.prepare(`UPDATE referrals SET status = 'refunded' WHERE referee_user_id = ? AND status = 'pending'`).run(userId);
  const rewarded = db
    .prepare(
      `SELECT u.email AS referrer_email FROM referrals r
         JOIN users u ON u.id = r.referrer_user_id
        WHERE r.referee_user_id = ? AND r.status = 'rewarded'`,
    )
    .get(userId) as { referrer_email: string } | undefined;
  return rewarded
    ? `Their referrer ${rewarded.referrer_email} was already given a free month for this signup. Reverse it by hand if this looks like reward farming.`
    : null;
}

function operatorRecipient(): string | null {
  for (const key of ['REFUND_ALERT_EMAIL', 'CANCELLATION_ALERT_EMAIL', 'SIGNUP_ALARM_EMAIL', 'FOH_REMINDER_EMAIL']) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

async function alertOperator(alert: MoneyBackOperatorAlert, userId: string): Promise<void> {
  const to = operatorRecipient();
  if (!to) {
    logAudit({
      type: 'money_back_operator_alert_skipped',
      userId,
      email: alert.email,
      message: 'No REFUND_ALERT_EMAIL (or fallback) configured; operator was not emailed about this refund.',
    });
    return;
  }
  try {
    await sendMoneyBackOperatorAlertEmail(to, alert);
  } catch (err) {
    logAudit({
      type: 'money_back_operator_alert_error',
      userId,
      email: alert.email,
      message: `Operator alert for money-back refund failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    });
  }
}

export async function requestMoneyBackRefund(
  request: MoneyBackRequest,
  deps: MoneyBackDeps = {},
): Promise<MoneyBackResult> {
  const nowMs = request.nowMs ?? Date.now();
  const feedback = validateCancelFeedback(request.feedback);
  const comment = sanitizeCancellationComment(typeof request.comment === 'string' ? request.comment : null);

  const user = loadUser(request.userId);
  if (!user) return fail('no_subscription', 404);
  if (normalizeTier(user.tier) === 'admin') return fail('no_subscription', 403);

  // The subscription to act on: the one on the user row, or — when a previous
  // attempt already canceled it and the row was cleared — the unfinished
  // request's own subscription.
  const unfinishedForUser = user.stripe_subscription_id ? null : findUnfinishedLedgerForUser(user.id);
  const unfinished = isLiveLedger(unfinishedForUser, nowMs) ? unfinishedForUser : null;
  const subscriptionId = user.stripe_subscription_id ?? unfinished?.subscription_id ?? null;
  if (!subscriptionId) return fail('no_subscription', 400);

  const ledgerRow = findLedgerForSubscription(subscriptionId);
  if (ledgerRow?.status === 'completed') return fail('already_refunded');
  const existing = isLiveLedger(ledgerRow, nowMs) ? ledgerRow : null;
  const resuming = !!existing || !!request.overrideLimits;
  // A resumed request refunds only what had been paid when it was first made.
  const requestedAtMs = existing ? Date.parse(existing.requested_at) : NaN;
  const refundCutoffMs = Number.isFinite(requestedAtMs) ? requestedAtMs : nowMs;

  let stripe: Stripe;
  let evaluated: Awaited<ReturnType<typeof evaluateLive>>;
  try {
    stripe = deps.stripe ?? getStripe();
    evaluated = await evaluateLive(stripe, user, subscriptionId, { nowMs, resuming, refundCutoffMs });
  } catch {
    return fail('unavailable', 502);
  }
  const { decision, live, card } = evaluated;
  if (!decision.eligible) return fail(decision.reason);

  const ledgerId = claimLedger({
    // A stale failed row is reused (UNIQUE per subscription) but claimed as if new.
    existing: existing ?? ledgerRow,
    user,
    subscriptionId,
    source: request.source,
    feedback,
    comment,
    nowMs,
  });
  if (!ledgerId) return fail('in_progress');

  const planLabel = planLabelFor(decision.firstPaidPriceId);
  const sku = decision.firstPaidPriceId ? priceIdToSku(decision.firstPaidPriceId) : null;

  // --- 1. Refund ---------------------------------------------------------
  const refundIds: string[] = [];
  const problems: string[] = [];
  let refundedNow = 0;
  for (const item of decision.refunds) {
    const outcome = await refundOne(stripe, item, { userId: user.id, subscriptionId });
    if (outcome.ok) {
      refundedNow += item.amount;
      if (outcome.refundId) refundIds.push(outcome.refundId);
    } else {
      problems.push(
        `Refund of ${formatMinorAmount(item.amount, item.currency)} on invoice ${item.invoiceId} failed: ${outcome.message}`,
      );
    }
  }

  const alreadyRefunded = existing?.amount_refunded ?? 0;
  if (decision.refunds.length > 0 && refundedNow === 0 && alreadyRefunded === 0) {
    // Nothing moved. Leave everything as it was so the member can simply retry.
    getDb()
      .prepare(`UPDATE money_back_refunds SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
      .run(problems.join(' | ').slice(0, 1000), nowIso(), ledgerId);
    logAudit({
      type: 'money_back_refund_failed',
      userId: user.id,
      email: user.email,
      ip: request.ip,
      message: `Money-back refund on sub ${subscriptionId} failed before any money moved: ${problems.join(' | ')}`,
    });
    await alertOperator(
      {
        kind: 'attention',
        email: user.email,
        planLabel,
        amountFormatted: formatMinorAmount(decision.totalAmount, decision.currency),
        source: request.source,
        reason: feedback,
        comment,
        problems: [...problems, 'Nothing was refunded or canceled; the member was told to retry.'],
        subscriptionId,
        refundIds: [],
      },
      user.id,
    );
    return fail('refund_failed', 502);
  }

  // --- 2. Cancel ---------------------------------------------------------
  const alreadyEnded = live.subscription == null || live.subscription.status === 'canceled';
  const cancel = alreadyEnded ? ({ ok: true } as const) : await cancelSubscriptionNow(stripe, subscriptionId, { feedback, comment });
  if (!cancel.ok) {
    problems.push(
      `Stripe would not cancel subscription ${subscriptionId} (${cancel.message}). Cancel it in the Stripe Dashboard now, or the member will be billed again at renewal. Their access has already been removed here.`,
    );
  }

  // --- 3. End access locally --------------------------------------------
  await clearLocally(user, subscriptionId, cancel.ok, request.ip ?? null);

  const referralNote = settleReferral(user.id);
  if (referralNote) problems.push(referralNote);

  // --- 4. Record --------------------------------------------------------
  // What has now been given back on this subscription in total, from the live
  // read plus this run — right even when an earlier run refunded and then died
  // before it could record the amount.
  const refundedBeforeRun = paidInvoices(live.invoices).reduce((sum, invoice) => sum + (invoice.amountRefunded ?? 0), 0);
  const totalRefunded = refundedBeforeRun + refundedNow;
  const finished = cancel.ok && problems.every((p) => p === referralNote);
  const priorIds = existing?.refund_ids ? existing.refund_ids.split(',').filter(Boolean) : [];
  const allRefundIds = [...new Set([...priorIds, ...refundIds])];
  const stamp = nowIso();
  getDb()
    .prepare(
      `UPDATE money_back_refunds SET
         status = ?,
         card_fingerprint = COALESCE(card_fingerprint, ?),
         price_id = ?,
         tier = ?,
         cadence = ?,
         first_invoice_id = ?,
         first_paid_at = ?,
         amount_refunded = ?,
         currency = ?,
         refund_ids = ?,
         error = ?,
         updated_at = ?,
         completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END
       WHERE id = ?`,
    )
    .run(
      finished ? 'completed' : 'pending',
      card?.fingerprint ?? null,
      decision.firstPaidPriceId,
      sku?.tier ?? null,
      sku?.cadence ?? null,
      decision.firstPaidInvoiceId,
      new Date(decision.firstPaidAtMs).toISOString(),
      totalRefunded,
      decision.currency,
      allRefundIds.join(','),
      finished ? null : problems.join(' | ').slice(0, 1000),
      stamp,
      finished ? 'completed' : 'pending',
      stamp,
      ledgerId,
    );

  const amountFormatted = formatMinorAmount(totalRefunded, decision.currency);
  logAudit({
    type: finished ? 'money_back_refund_issued' : 'money_back_refund_incomplete',
    userId: user.id,
    email: user.email,
    ip: request.ip,
    message:
      `Money-back refund (${request.source}) on sub ${subscriptionId}: refunded ${amountFormatted} ` +
      `[${allRefundIds.join(', ') || 'no new refund'}], ${cancel.ok ? 'subscription canceled' : 'CANCEL FAILED'}` +
      `${feedback ? `, reason=${feedback}` : ''}${comment ? `, comment="${comment}"` : ''}` +
      (problems.length ? ` — ${problems.join(' | ')}` : ''),
  });

  // --- 5. Tell people ----------------------------------------------------
  if (refundedNow > 0) {
    try {
      await sendMoneyBackRefundEmail(user.email, {
        amountFormatted: formatMinorAmount(refundedNow, decision.currency),
        planLabel,
        cardBrand: card?.brand ?? null,
        cardLast4: card?.last4 ?? null,
      });
    } catch (err) {
      logAudit({
        type: 'money_back_refund_email_error',
        userId: user.id,
        email: user.email,
        message: `Refund confirmation email failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    }
  }
  await alertOperator(
    {
      kind: finished ? 'issued' : 'attention',
      email: user.email,
      planLabel,
      amountFormatted,
      source: request.source,
      reason: feedback,
      comment,
      problems,
      subscriptionId,
      refundIds: allRefundIds,
    },
    user.id,
  );

  return {
    ok: true,
    amountRefunded: totalRefunded,
    currency: decision.currency,
    amountFormatted,
    refundIds: allRefundIds,
    canceled: cancel.ok,
    problems,
  };
}
