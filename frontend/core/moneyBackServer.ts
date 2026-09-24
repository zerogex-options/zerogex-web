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
//   2. Refund first, cancel second. If a refund is refused nothing else
//      happens — the member keeps what they paid for and can try again. If its
//      outcome is unknown (a timeout, a Stripe 5xx: the refund may have gone
//      through), Stripe is re-read to see what actually moved, and while that
//      stays unknown the request is held 'pending' — never marked failed — and
//      the operator is told. If the cancel fails after the refund, the member
//      has their money and loses access locally now; the operator is alerted to
//      finish the cancel in Stripe (otherwise the next renewal would bill a
//      refunded member), and a re-run resumes and retries it. Each claim of the
//      request uses its own idempotency keys (Stripe replays a key's stored
//      ERROR for 24h, which would make every retry fail the same way); a retry
//      can still never refund twice, because every amount is re-read live from
//      the charge under the ledger claim, and Stripe itself refuses a refund
//      beyond what is left on the charge.
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
// A request that failed before any money moved (the member kept their plan) can
// be retried for this long after it was FIRST made, and a retry is judged as of
// that first request — a failure on our side never costs the member their
// window, and retrying never extends it. Past this, a new request is judged on
// its own terms.
const FAILED_RETRY_GRACE_MS = 7 * DAY_MS;

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

// A failed request past its retry grace is treated as if it never happened
// (see FAILED_RETRY_GRACE_MS). Measured from requested_at, which a retry never
// moves, so retrying cannot keep it alive.
function isLiveLedger(row: LedgerRow | null, nowMs: number): row is LedgerRow {
  if (!row) return false;
  if (row.status !== 'failed') return true;
  const age = nowMs - Date.parse(row.requested_at);
  return !Number.isFinite(age) || age < FAILED_RETRY_GRACE_MS;
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
    const creditNotesAmount =
      typeof invoice.post_payment_credit_notes_amount === 'number' ? invoice.post_payment_credit_notes_amount : 0;
    let chargeId = readInvoiceChargeId(invoice);
    const paymentIntentId = readInvoicePaymentIntentId(invoice);
    let charge = expandedCharge(invoice);

    if (invoice.status === 'paid' && amountPaid > 0 && !charge) {
      try {
        if (chargeId) {
          charge = await stripe.charges.retrieve(chargeId);
        } else if (paymentIntentId) {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
          const latest = intent.latest_charge;
          charge = latest && typeof latest !== 'string' ? latest : null;
        }
      } catch {
        // Left unknown: decideMoneyBack refuses rather than guessing.
      }
    }
    if (charge) chargeId = chargeId ?? charge.id;
    // What has gone back to the card, read from the charge (a refund leaves the
    // invoice itself reading paid in full). No charge and nothing that could
    // carry one: nothing was refunded to a card. A charge we could not read:
    // unknown.
    const amountRefunded = charge
      ? (charge.amount_refunded ?? 0)
      : chargeId || paymentIntentId
        ? null
        : 0;
    const card = cardFromCharge(charge);
    if (card) cardByInvoice.set(invoice.id, card);

    invoices.push({
      id: invoice.id,
      status: invoice.status ?? null,
      billingReason: invoice.billing_reason ?? null,
      amountPaid,
      amountRefunded,
      creditNotesAmount,
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
  opts: { nowMs: number; resuming: boolean; requestedAtMs?: number; refundCutoffMs?: number },
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
    requestedAtMs: opts.requestedAtMs,
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
      // Given back under this request so far, across every run of it.
      amountRefunded: number;
      currency: string;
      amountFormatted: string;
      refundIds: string[];
      canceled: boolean;
      // Everything is done: refunded in full and canceled. False means a step
      // is still being finished (the operator has been alerted); the member is
      // told to expect an email, which the completing run sends.
      complete: boolean;
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
  refund_failed: "We couldn't issue the refund just now. Nothing was charged or canceled\u00a0- please try again in a few minutes.",
  refund_disputed:
    "This payment is under dispute with your bank, so it can't be refunded here\u00a0- the dispute itself will settle it. Nothing was canceled.",
  refund_unconfirmed:
    "We couldn't confirm your refund went through. We've been alerted and will finish it\u00a0- you'll get an email as soon as it's done.",
  unavailable: "Couldn't reach billing just now. Please try again in a minute.",
};

function fail(reason: string, httpStatus = 409): MoneyBackResult {
  return { ok: false, httpStatus, reason, message: MESSAGES[reason] ?? 'Refund request failed.' };
}

type Claim = { id: string; stamp: string };

// Claim (or re-claim) the ledger row for this subscription, recording the card
// that paid at once so a concurrent request on another account with the same
// card sees it. Returns the claim, or null when another request holds it.
function claimLedger(input: {
  existing: LedgerRow | null;
  user: UserRow;
  subscriptionId: string;
  source: 'self_serve' | 'operator';
  feedback: string | null;
  comment: string | null;
  cardFingerprint: string | null;
  nowMs: number;
}): Claim | null {
  const db = getDb();
  const stamp = new Date(input.nowMs).toISOString();
  if (!input.existing) {
    const id = `mbr_${randomBytes(12).toString('hex')}`;
    try {
      db.prepare(
        `INSERT INTO money_back_refunds
           (id, subscription_id, user_id, email, email_canonical, customer_id, card_fingerprint, status, source,
            feedback, comment, requested_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.subscriptionId,
        input.user.id,
        input.user.email,
        canonicalEmail(input.user.email),
        input.user.stripe_customer_id,
        input.cardFingerprint,
        input.source,
        input.feedback,
        input.comment,
        stamp,
        stamp,
      );
      return { id, stamp };
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
      `UPDATE money_back_refunds
          SET status = 'pending', error = NULL, updated_at = ?, card_fingerprint = COALESCE(card_fingerprint, ?)
        WHERE id = ? AND status = ? AND updated_at = ?`,
    )
    .run(stamp, input.cardFingerprint, existing.id, existing.status, existing.updated_at) as { changes: number | bigint };
  return Number(claimed.changes) > 0 ? { id: existing.id, stamp } : null;
}

// Money that moved, recorded the moment it moves — so a run that dies after a
// refund still left a trace the next run (and the operator) can see.
function recordRefundProgress(ledgerId: string, amount: number, refundId: string | null, currency: string) {
  const db = getDb();
  const row = db.prepare('SELECT refund_ids FROM money_back_refunds WHERE id = ?').get(ledgerId) as
    | { refund_ids: string | null }
    | undefined;
  const ids = new Set((row?.refund_ids ?? '').split(',').filter(Boolean));
  if (refundId) ids.add(refundId);
  db.prepare(
    `UPDATE money_back_refunds
        SET amount_refunded = amount_refunded + ?, refund_ids = ?, currency = COALESCE(currency, ?), updated_at = ?
      WHERE id = ?`,
  ).run(amount, [...ids].join(','), currency, nowIso(), ledgerId);
}

function readLedgerProgress(ledgerId: string): { amount: number; refundIds: string[] } {
  const row = getDb().prepare('SELECT amount_refunded, refund_ids FROM money_back_refunds WHERE id = ?').get(ledgerId) as
    | { amount_refunded: number; refund_ids: string | null }
    | undefined;
  return {
    amount: Number(row?.amount_refunded ?? 0),
    refundIds: (row?.refund_ids ?? '').split(',').filter(Boolean),
  };
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

type RefundFailureKind = 'rejected' | 'disputed' | 'unknown';

async function refundOne(
  stripe: Stripe,
  item: RefundItem,
  meta: { userId: string; subscriptionId: string; claimKey: string },
): Promise<{ ok: true; refundId: string | null } | { ok: false; kind: RefundFailureKind; message: string }> {
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
      // Per claim: a network retry inside this run replays the same refund;
      // a later run (after a refused or unknown attempt) gets a fresh key rather
      // than Stripe's stored error. The amount is re-read live each run, and
      // Stripe refuses anything beyond what is left on the charge.
      { idempotencyKey: `zgx-money-back:${meta.claimKey}:${item.invoiceId}:${item.amount}` },
    );
    if (refund.status === 'failed' || refund.status === 'canceled') {
      return { ok: false, kind: 'rejected', message: `refund ${refund.id} ${refund.status}` };
    }
    return { ok: true, refundId: refund.id };
  } catch (err) {
    const e = err as { type?: string; code?: string } | undefined;
    const message = err instanceof Error ? err.message : 'refund failed';
    // Already fully refunded (a resumed request racing a read): the money is
    // back, which is the outcome we wanted.
    if (e?.code === 'charge_already_refunded') return { ok: true, refundId: null };
    if (e?.code === 'charge_disputed') return { ok: false, kind: 'disputed', message };
    // Stripe answered and refused the request: nothing moved. Anything else (a
    // timeout, a dropped connection, a Stripe 5xx) may have gone through.
    const refused =
      e?.type === 'StripeInvalidRequestError' ||
      e?.type === 'StripeCardError' ||
      e?.type === 'StripePermissionError' ||
      e?.type === 'StripeAuthenticationError' ||
      e?.type === 'StripeIdempotencyError';
    return { ok: false, kind: refused ? 'rejected' : 'unknown', message };
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

// Run a step whose failure must not stop the ones after it (money has already
// moved by the time these run): a throw becomes a problem the operator hears
// about, and the flow carries on to record and alert.
async function guarded(step: string, problems: string[], run: () => unknown | Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    problems.push(`${step} failed unexpectedly: ${err instanceof Error ? err.message : 'unknown error'}. Finish it by hand.`);
  }
}

type EligibleDecision = Extract<MoneyBackDecision, { eligible: true }>;

type Prepared =
  | { ok: false; result: MoneyBackResult }
  | {
      ok: true;
      stripe: Stripe;
      user: UserRow;
      subscriptionId: string;
      ledgerRow: LedgerRow | null;
      existing: LedgerRow | null;
      resuming: boolean;
      decision: EligibleDecision;
      live: LiveState;
      card: CardInfo | null;
      feedback: string | null;
      comment: string | null;
    };

// Everything up to the first write: which subscription, which ledger row, and
// the live decision. Shared by the request itself and the operator's dry run,
// so the dry run shows exactly what --yes would do.
async function prepare(request: MoneyBackRequest, deps: MoneyBackDeps, nowMs: number): Promise<Prepared> {
  const feedback = validateCancelFeedback(request.feedback);
  const comment = sanitizeCancellationComment(typeof request.comment === 'string' ? request.comment : null);

  const user = loadUser(request.userId);
  if (!user) return { ok: false, result: fail('no_subscription', 404) };
  if (normalizeTier(user.tier) === 'admin') return { ok: false, result: fail('no_subscription', 403) };

  // The subscription to act on: the one on the user row, or — when a previous
  // attempt already canceled it and the row was cleared — the unfinished
  // request's own subscription.
  const unfinishedForUser = user.stripe_subscription_id ? null : findUnfinishedLedgerForUser(user.id);
  const unfinished = isLiveLedger(unfinishedForUser, nowMs) ? unfinishedForUser : null;
  const subscriptionId = user.stripe_subscription_id ?? unfinished?.subscription_id ?? null;
  if (!subscriptionId) return { ok: false, result: fail('no_subscription', 400) };

  const ledgerRow = findLedgerForSubscription(subscriptionId);
  if (ledgerRow?.status === 'completed') return { ok: false, result: fail('already_refunded') };
  const existing = isLiveLedger(ledgerRow, nowMs) ? ledgerRow : null;
  // A pending request may already have moved money: finish it whatever the
  // window says (as does an operator's goodwill override). A failed one moved
  // nothing: it is retried as the request it was, judged as of when it was
  // first made.
  const resuming = existing?.status === 'pending' || !!request.overrideLimits;
  const firstAskedMs = existing ? Date.parse(existing.requested_at) : NaN;
  const requestedAtMs = Number.isFinite(firstAskedMs) ? firstAskedMs : nowMs;

  let stripe: Stripe;
  let evaluated: Awaited<ReturnType<typeof evaluateLive>>;
  try {
    stripe = deps.stripe ?? getStripe();
    evaluated = await evaluateLive(stripe, user, subscriptionId, {
      nowMs,
      resuming,
      requestedAtMs,
      refundCutoffMs: requestedAtMs,
    });
  } catch {
    return { ok: false, result: fail('unavailable', 502) };
  }
  const { decision, live, card } = evaluated;
  if (!decision.eligible) return { ok: false, result: fail(decision.reason) };
  return { ok: true, stripe, user, subscriptionId, ledgerRow, existing, resuming, decision, live, card, feedback, comment };
}

export type MoneyBackPreview =
  | {
      ok: true;
      subscriptionId: string;
      planLabel: string;
      resuming: boolean;
      refunds: Array<{ invoiceId: string; amountFormatted: string }>;
      totalFormatted: string;
      deadlineIso: string;
    }
  | { ok: false; reason: string; message: string };

// Read-only: exactly what requestMoneyBackRefund would refund right now.
export async function previewMoneyBackRefund(request: MoneyBackRequest, deps: MoneyBackDeps = {}): Promise<MoneyBackPreview> {
  const prepared = await prepare(request, deps, request.nowMs ?? Date.now());
  if (!prepared.ok) {
    const result = prepared.result;
    return result.ok ? { ok: false, reason: 'unknown', message: '' } : { ok: false, reason: result.reason, message: result.message };
  }
  const { decision } = prepared;
  return {
    ok: true,
    subscriptionId: prepared.subscriptionId,
    planLabel: planLabelFor(decision.firstPaidPriceId),
    resuming: prepared.resuming,
    refunds: decision.refunds.map((item) => ({
      invoiceId: item.invoiceId,
      amountFormatted: formatMinorAmount(item.amount, item.currency),
    })),
    totalFormatted: formatMinorAmount(decision.totalAmount, decision.currency),
    deadlineIso: new Date(decision.deadlineMs).toISOString(),
  };
}

export async function requestMoneyBackRefund(
  request: MoneyBackRequest,
  deps: MoneyBackDeps = {},
): Promise<MoneyBackResult> {
  const nowMs = request.nowMs ?? Date.now();
  const prepared = await prepare(request, deps, nowMs);
  if (!prepared.ok) return prepared.result;
  const { stripe, user, subscriptionId, ledgerRow, existing, resuming, decision, live, card, feedback, comment } = prepared;

  // The one-refund limit, re-checked with the card in the same synchronous
  // step as the claim, so two requests (two accounts on one card) cannot both
  // pass the check before either has claimed.
  if (
    !resuming &&
    hasPriorMoneyBackRefund({ userId: user.id, email: user.email, cardFingerprint: card?.fingerprint ?? null, subscriptionId })
  ) {
    return fail('prior_refund');
  }
  const claim = claimLedger({
    // A stale failed row is reused (UNIQUE per subscription) but claimed as if new.
    existing: existing ?? ledgerRow,
    user,
    subscriptionId,
    source: request.source,
    feedback,
    comment,
    cardFingerprint: card?.fingerprint ?? null,
    nowMs,
  });
  if (!claim) return fail('in_progress');
  const ledgerId = claim.id;
  const firstFailure = existing?.status !== 'failed';

  const planLabel = planLabelFor(decision.firstPaidPriceId);
  const sku = decision.firstPaidPriceId ? priceIdToSku(decision.firstPaidPriceId) : null;
  const problems: string[] = [];

  // --- 1. Refund ---------------------------------------------------------
  const failures: Array<{ item: RefundItem; kind: RefundFailureKind | 'moved'; message: string }> = [];
  for (const item of decision.refunds) {
    const outcome = await refundOne(stripe, item, { userId: user.id, subscriptionId, claimKey: `${claim.id}:${claim.stamp}` });
    if (outcome.ok) recordRefundProgress(ledgerId, item.amount, outcome.refundId, item.currency);
    else failures.push({ item, kind: outcome.kind, message: outcome.message });
  }
  // An outcome we could not see (a timeout, a 5xx) may still have gone
  // through: ask Stripe what actually moved before deciding anything.
  if (failures.some((f) => f.kind === 'unknown')) {
    try {
      const after = await loadLiveState(stripe, subscriptionId);
      for (const f of failures) {
        if (f.kind !== 'unknown') continue;
        const before = live.invoices.find((i) => i.id === f.item.invoiceId)?.amountRefunded ?? 0;
        const now = after.invoices.find((i) => i.id === f.item.invoiceId)?.amountRefunded;
        if (now == null) continue;
        if (now - before >= f.item.amount) {
          f.kind = 'moved';
          recordRefundProgress(ledgerId, f.item.amount, null, f.item.currency);
        } else if (now === before) {
          f.kind = 'rejected';
        }
      }
    } catch {
      // Still unknown; handled below.
    }
  }
  const open = failures.filter((f) => f.kind !== 'moved');
  for (const f of open) {
    problems.push(
      f.kind === 'unknown'
        ? `Refund of ${formatMinorAmount(f.item.amount, f.item.currency)} on invoice ${f.item.invoiceId} has an UNKNOWN outcome (${f.message}). Check the charge in Stripe before doing anything else.`
        : `Refund of ${formatMinorAmount(f.item.amount, f.item.currency)} on invoice ${f.item.invoiceId} ${f.kind === 'disputed' ? 'is blocked by a dispute' : 'failed'}: ${f.message}`,
    );
  }

  const progress = readLedgerProgress(ledgerId);
  if (decision.refunds.length > 0 && progress.amount === 0) {
    const unknown = open.some((f) => f.kind === 'unknown');
    const reason = unknown ? 'refund_unconfirmed' : open.some((f) => f.kind === 'disputed') ? 'refund_disputed' : 'refund_failed';
    // Unknown: money may have moved, so the request is held 'pending' (never
    // "failed" — that would drop it from the one-refund limit) and nothing is
    // canceled until someone knows. Refused: nothing moved; the member keeps
    // their plan and can retry.
    getDb()
      .prepare(`UPDATE money_back_refunds SET status = ?, error = ?, updated_at = ? WHERE id = ?`)
      .run(unknown ? 'pending' : 'failed', problems.join(' | ').slice(0, 1000), nowIso(), ledgerId);
    logAudit({
      type: unknown ? 'money_back_refund_unconfirmed' : 'money_back_refund_failed',
      userId: user.id,
      email: user.email,
      ip: request.ip,
      message: `Money-back refund on sub ${subscriptionId} ${unknown ? 'has an unconfirmed outcome' : 'failed before any money moved'}: ${problems.join(' | ')}`,
    });
    if (unknown || firstFailure) {
      await alertOperator(
        {
          kind: 'attention',
          email: user.email,
          planLabel,
          amountFormatted: formatMinorAmount(decision.totalAmount, decision.currency),
          source: request.source,
          reason: feedback,
          comment,
          problems: [
            ...problems,
            unknown
              ? 'Nothing was canceled. Check the charge in Stripe: if the refund went through, re-run the command below to cancel and finish; if not, re-running retries it.'
              : 'Nothing was refunded or canceled; the member was told to retry.',
          ],
          subscriptionId,
          refundIds: [],
        },
        user.id,
      );
    }
    return fail(reason, reason === 'refund_disputed' ? 409 : 502);
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
  await guarded('Removing access locally', problems, () => clearLocally(user, subscriptionId, cancel.ok, request.ip ?? null));

  let referralNote: string | null = null;
  try {
    referralNote = settleReferral(user.id);
  } catch (err) {
    problems.push(`Settling the referral failed unexpectedly: ${err instanceof Error ? err.message : 'unknown error'}. Finish it by hand.`);
  }

  // --- 4. Record --------------------------------------------------------
  // Done for the member: refunded and canceled with nothing left over. (The
  // referral note is for the operator only.)
  const finished = cancel.ok && problems.length === 0;
  if (referralNote) problems.push(referralNote);
  const recorded = readLedgerProgress(ledgerId);
  const stamp = nowIso();
  await guarded('Recording the refund', problems, () => {
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
           currency = COALESCE(currency, ?),
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
        decision.currency,
        finished ? null : problems.join(' | ').slice(0, 1000),
        stamp,
        finished ? 'completed' : 'pending',
        stamp,
        ledgerId,
      );
  });

  const amountFormatted = formatMinorAmount(recorded.amount, decision.currency);
  await guarded('Writing the audit row', problems, () =>
    logAudit({
      type: finished ? 'money_back_refund_issued' : 'money_back_refund_incomplete',
      userId: user.id,
      email: user.email,
      ip: request.ip,
      message:
        `Money-back refund (${request.source}) on sub ${subscriptionId}: refunded ${amountFormatted} ` +
        `[${recorded.refundIds.join(', ') || 'no refund id'}], ${cancel.ok ? 'subscription canceled' : 'CANCEL FAILED'}` +
        `${feedback ? `, reason=${feedback}` : ''}${comment ? `, comment="${comment}"` : ''}` +
        (problems.length ? ` — ${problems.join(' | ')}` : ''),
    }),
  );

  // --- 5. Tell people ----------------------------------------------------
  // The member hears once, when it is all done (it says the plan is canceled
  // and access has ended) — from whichever run completes the request.
  if (finished && recorded.amount > 0) {
    try {
      await sendMoneyBackRefundEmail(user.email, {
        amountFormatted,
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
  // Anything beyond the informational referral note — including a record or
  // audit write that failed after the member was done — needs a human.
  const needsAttention = !finished || problems.some((problem) => problem !== referralNote);
  await alertOperator(
    {
      kind: needsAttention ? 'attention' : 'issued',
      email: user.email,
      planLabel,
      amountFormatted,
      source: request.source,
      reason: feedback,
      comment,
      problems,
      subscriptionId,
      refundIds: recorded.refundIds,
    },
    user.id,
  );

  return {
    ok: true,
    amountRefunded: recorded.amount,
    currency: decision.currency,
    amountFormatted,
    refundIds: recorded.refundIds,
    canceled: cancel.ok,
    complete: finished,
    problems,
  };
}

// ---------------------------------------------------------------------------
// Stalled requests
// ---------------------------------------------------------------------------

// A request is 'pending' while it runs, and afterwards only when money moved
// and a step is still to finish (the operator is alerted inline then). One
// left pending with no alert — the process killed mid-request, say a deploy
// restart between the refund and the cancel — is caught here: the member may
// have their money back while still subscribed, and the next renewal would
// bill them. The hourly timer (deploy/steps/099.money-back-sweep) runs this.
const STALL_MS = 30 * 60 * 1000;

export type StalledMoneyBackRequest = {
  id: string;
  email: string;
  subscriptionId: string;
  amountFormatted: string;
  updatedAt: string;
};

export async function sweepStalledMoneyBackRequests(opts: {
  send: boolean;
  nowMs?: number;
}): Promise<{ stalled: StalledMoneyBackRequest[]; alerted: number; noRecipient: boolean }> {
  const nowMs = opts.nowMs ?? Date.now();
  const cutoff = new Date(nowMs - STALL_MS).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT id, subscription_id, user_id, email, amount_refunded, currency, refund_ids, tier, cadence,
              source, feedback, comment, error, updated_at
         FROM money_back_refunds
        WHERE status = 'pending' AND updated_at < ?
          AND (stale_alert_for IS NULL OR stale_alert_for <> updated_at)
        ORDER BY updated_at`,
    )
    .all(cutoff) as Array<{
    id: string;
    subscription_id: string;
    user_id: string;
    email: string;
    amount_refunded: number;
    currency: string | null;
    refund_ids: string | null;
    tier: string | null;
    cadence: string | null;
    source: 'self_serve' | 'operator';
    feedback: string | null;
    comment: string | null;
    error: string | null;
    updated_at: string;
  }>;

  const stalled = rows.map((row) => ({
    id: row.id,
    email: row.email,
    subscriptionId: row.subscription_id,
    amountFormatted: formatMinorAmount(Number(row.amount_refunded ?? 0), row.currency ?? 'usd'),
    updatedAt: row.updated_at,
  }));
  if (!opts.send || rows.length === 0) return { stalled, alerted: 0, noRecipient: false };

  const to = operatorRecipient();
  if (!to) return { stalled, alerted: 0, noRecipient: true };

  let alerted = 0;
  for (const row of rows) {
    const planLabel =
      row.tier === 'basic' || row.tier === 'pro'
        ? `${TIER_LABEL[row.tier]}${row.cadence ? ` (${row.cadence})` : ''}`
        : 'ZeroGEX';
    const moved = Number(row.amount_refunded ?? 0) > 0;
    try {
      await sendMoneyBackOperatorAlertEmail(to, {
        kind: 'attention',
        email: row.email,
        planLabel,
        amountFormatted: formatMinorAmount(Number(row.amount_refunded ?? 0), row.currency ?? 'usd'),
        source: row.source,
        reason: row.feedback,
        comment: row.comment,
        problems: [
          `This refund request stopped part-way (last activity ${row.updated_at}) and was never finished` +
            `${row.error ? ` — last error: ${row.error}` : ''}.`,
          moved
            ? 'Money HAS been refunded. If the subscription is still live in Stripe, the member will be billed again at renewal.'
            : 'No refund is recorded yet — check the charge in Stripe before assuming nothing moved.',
          'Re-run the command below: it resumes where the request stopped and never refunds twice.',
        ],
        subscriptionId: row.subscription_id,
        refundIds: (row.refund_ids ?? '').split(',').filter(Boolean),
      });
      getDb()
        .prepare('UPDATE money_back_refunds SET stale_alert_for = ? WHERE id = ? AND updated_at = ?')
        .run(row.updated_at, row.id, row.updated_at);
      logAudit({
        type: 'money_back_stalled_alert_sent',
        userId: row.user_id,
        email: row.email,
        message: `Stalled money-back request ${row.id} on sub ${row.subscription_id} (last activity ${row.updated_at}) reported to the operator`,
      });
      alerted += 1;
    } catch (err) {
      logAudit({
        type: 'money_back_operator_alert_error',
        userId: row.user_id,
        email: row.email,
        message: `Stalled-request alert for ${row.id} failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    }
  }
  return { stalled, alerted, noRecipient: false };
}
