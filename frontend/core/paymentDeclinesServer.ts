// The SQL half of the decline tracker: capture at webhook time, resolution as
// the money moves (or stops), reconstruction of the history that predates it,
// and the read that assembles the admin report.
//
// Deliberately NOT marked `server-only`, and using explicit `./x.ts` imports —
// the same exception core/dailyMetrics.ts, core/excludedAccountsServer.ts and
// core/cohortRetentionServer.ts take, for the same reason:
// scripts/backfill-payment-declines.mts loads this under bare Node, where the
// guard throws and the "@/" alias does not resolve. It is still server code; it
// opens the SQLite DB through ./db.ts.
//
// THE CAPTURE PROBLEM this exists to solve. Stripe hands you a decline reason
// exactly once, in the webhook, on the charge that failed. It is not on the
// invoice, it is not on the subscription, and it is not replayable: to read it
// later you must walk back through the Stripe API one charge at a time. So the
// reason is written down at failure time, in full, and everything else — did it
// recover, how long did it take, what did it cost — is stamped onto that same
// row as it happens.
//
// EVERY WRITE IS BEST-EFFORT. Recording a decline must never be able to fail the
// webhook: a 500 there makes Stripe retry, which double-sends the member's
// dunning email. Observability that can break billing is worse than no
// observability, so each entry point swallows its own errors and returns a
// count the caller may ignore.

import { getDb } from './db.ts';
import { classifyDecline, type ChargeDecline, type DeclineCategory } from './declineReason.ts';
import { loadExcludedAccounts } from './excludedAccountsServer.ts';
import { summarizeExcluded, type ExcludedAccountsSummary } from './excludedAccounts.ts';
import {
  buildDeclineReport,
  classifyAttemptKind,
  type DeclineKind,
  type DeclineRecord,
  type DeclineReport,
  type DeclineSource,
  type PaidInvoice,
} from './paymentDeclines.ts';
import { priceIdToSku } from './stripe.ts';

export type PaymentDeclinePayload = DeclineReport & {
  /** Who is held out of every number above, and under which rule. */
  excluded: ExcludedAccountsSummary;
  /** Open declines closed out by this read's reconcile pass. */
  reconciled: ReconcileResult;
};

/**
 * What a reconcile pass closed, split by HOW it knew. Kept apart rather than
 * summed into one "lost" count because the two are different claims: a
 * cancellation is a fact the audit log recorded, an age-out is only the absence
 * of one.
 */
export type ReconcileResult = {
  /** Found paid in the invoice ledger. */
  recovered: number;
  /** Closed because the subscription was deleted. */
  cancelled: number;
  /** Closed because nothing happened on the invoice for STALE_OPEN_DAYS. */
  agedOut: number;
};

/**
 * How long an open decline is given before the report stops calling it "in
 * flight". Stripe's Smart Retry schedule runs out at about three weeks, after
 * which the subscription is canceled or marked unpaid — and both of those emit
 * an event that closes the row properly. Thirty days is the backstop for the
 * rows whose closing event never arrived (a webhook outage, a subscription
 * deleted before this tracker shipped). They close as 'unknown', which the UI
 * renders as "Unresolved": never seen to recover is not the same claim as
 * known to be lost, and the report must not make the stronger one.
 */
const STALE_OPEN_DAYS = 30;

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

type DeclineRow = {
  id: string;
  invoice_id: string;
  attempt_count: number;
  charge_id: string | null;
  user_id: string | null;
  email: string | null;
  customer_id: string | null;
  subscription_id: string | null;
  price_id: string | null;
  tier: string | null;
  cadence: string | null;
  kind: string;
  billing_reason: string | null;
  amount_due: number;
  currency: string | null;
  failure_code: string | null;
  decline_code: string | null;
  network_decline_code: string | null;
  failure_message: string | null;
  seller_message: string | null;
  category: string;
  card_brand: string | null;
  card_last4: string | null;
  card_funding: string | null;
  card_country: string | null;
  next_attempt_at: string | null;
  grace_until: string | null;
  failed_at: string;
  outcome: string;
  resolved_at: string | null;
  recovered_amount: number | null;
  recovery_route: string | null;
  lost_reason: string | null;
  source: string;
};

const KINDS = new Set<string>(['trial_conversion', 'first_charge', 'renewal', 'other', 'unknown']);
const CATEGORIES = new Set<string>([
  'insufficient_funds',
  'issuer_block',
  'card_problem',
  'authentication_required',
  'try_again',
  'blocked_by_risk',
  'unknown',
]);
const OUTCOMES = new Set<string>(['open', 'recovered', 'lost']);
const SOURCES = new Set<string>(['webhook', 'audit_backfill', 'stripe_backfill']);

function toRecord(row: DeclineRow): DeclineRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    attemptCount: Number(row.attempt_count) || 1,
    chargeId: row.charge_id,
    userId: row.user_id,
    email: row.email,
    subscriptionId: row.subscription_id,
    priceId: row.price_id,
    tier: row.tier,
    cadence: row.cadence,
    // Anything unrecognized degrades to the honest bucket rather than throwing:
    // a row written by a newer deploy must not break an older reader.
    kind: (KINDS.has(row.kind) ? row.kind : 'unknown') as DeclineKind,
    billingReason: row.billing_reason,
    amountDue: Number(row.amount_due) || 0,
    currency: row.currency,
    failureCode: row.failure_code,
    declineCode: row.decline_code,
    networkDeclineCode: row.network_decline_code,
    failureMessage: row.failure_message,
    sellerMessage: row.seller_message,
    category: (CATEGORIES.has(row.category) ? row.category : 'unknown') as DeclineCategory,
    cardBrand: row.card_brand,
    cardLast4: row.card_last4,
    cardFunding: row.card_funding,
    cardCountry: row.card_country,
    nextAttemptAt: row.next_attempt_at,
    graceUntil: row.grace_until,
    failedAt: row.failed_at,
    outcome: (OUTCOMES.has(row.outcome) ? row.outcome : 'open') as DeclineRecord['outcome'],
    resolvedAt: row.resolved_at,
    recoveredAmount: row.recovered_amount == null ? null : Number(row.recovered_amount),
    recoveryRoute: row.recovery_route,
    lostReason: row.lost_reason,
    source: (SOURCES.has(row.source) ? row.source : 'webhook') as DeclineSource,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  // Collision-proof enough for a table keyed on (invoice, attempt) anyway; the
  // id is a handle, not the identity.
  return `decl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export type RecordDeclineInput = {
  invoiceId: string;
  attemptCount: number;
  chargeId?: string | null;
  userId?: string | null;
  email?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  priceId?: string | null;
  billingReason?: string | null;
  amountDue?: number | null;
  currency?: string | null;
  decline?: ChargeDecline | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  cardFunding?: string | null;
  cardCountry?: string | null;
  nextAttemptAt?: string | null;
  graceUntil?: string | null;
  failedAt?: string | null;
  /**
   * Authoritative trial-conversion answer from the subscription's `trial_end`
   * (core/trialDunning), when the caller could resolve one. Null means "could
   * not tell", and the kind is then inferred from invoice history.
   */
  trialConversion?: boolean | null;
  source?: DeclineSource;
};

/**
 * Write one declined attempt. Idempotent on (invoice, attempt): a redelivered
 * webhook updates the row in place rather than inflating the attempt count, and
 * a row already resolved is left alone so a late redelivery cannot reopen a
 * recovered invoice.
 *
 * Returns true when a row was written or refreshed; false when the write failed
 * (which is logged by the caller's audit row, never raised).
 */
export function recordPaymentDecline(input: RecordDeclineInput): boolean {
  try {
    const db = getDb();
    const failedAt = input.failedAt ?? nowIso();
    const sku = input.priceId ? priceIdToSku(input.priceId) : null;
    const kind = resolveKindForInvoice(input);
    const category = classifyDecline(input.decline ?? null);
    db.prepare(
      `INSERT INTO payment_declines (
         id, invoice_id, attempt_count, charge_id, user_id, email, customer_id,
         subscription_id, price_id, tier, cadence, kind, billing_reason,
         amount_due, currency, failure_code, decline_code, network_decline_code,
         failure_message, seller_message, category, card_brand, card_last4,
         card_funding, card_country, next_attempt_at, grace_until, failed_at,
         outcome, source, recorded_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
       ON CONFLICT(invoice_id, attempt_count) DO UPDATE SET
         charge_id = COALESCE(excluded.charge_id, payment_declines.charge_id),
         user_id = COALESCE(excluded.user_id, payment_declines.user_id),
         email = COALESCE(excluded.email, payment_declines.email),
         customer_id = COALESCE(excluded.customer_id, payment_declines.customer_id),
         subscription_id = COALESCE(excluded.subscription_id, payment_declines.subscription_id),
         price_id = COALESCE(excluded.price_id, payment_declines.price_id),
         tier = COALESCE(excluded.tier, payment_declines.tier),
         cadence = COALESCE(excluded.cadence, payment_declines.cadence),
         billing_reason = COALESCE(excluded.billing_reason, payment_declines.billing_reason),
         amount_due = MAX(excluded.amount_due, payment_declines.amount_due),
         currency = COALESCE(excluded.currency, payment_declines.currency),
         failure_code = COALESCE(excluded.failure_code, payment_declines.failure_code),
         decline_code = COALESCE(excluded.decline_code, payment_declines.decline_code),
         network_decline_code = COALESCE(excluded.network_decline_code, payment_declines.network_decline_code),
         failure_message = COALESCE(excluded.failure_message, payment_declines.failure_message),
         seller_message = COALESCE(excluded.seller_message, payment_declines.seller_message),
         card_brand = COALESCE(excluded.card_brand, payment_declines.card_brand),
         card_last4 = COALESCE(excluded.card_last4, payment_declines.card_last4),
         card_funding = COALESCE(excluded.card_funding, payment_declines.card_funding),
         card_country = COALESCE(excluded.card_country, payment_declines.card_country),
         next_attempt_at = COALESCE(excluded.next_attempt_at, payment_declines.next_attempt_at),
         grace_until = COALESCE(excluded.grace_until, payment_declines.grace_until),
         -- A real reason never loses to 'unknown', and a resolved row is never
         -- reopened by a redelivery of the failure that started it.
         category = CASE WHEN excluded.category = 'unknown' THEN payment_declines.category ELSE excluded.category END,
         kind = CASE WHEN excluded.kind = 'unknown' THEN payment_declines.kind ELSE excluded.kind END,
         source = CASE WHEN payment_declines.source = 'audit_backfill' THEN excluded.source ELSE payment_declines.source END`,
    ).run(
      randomId(),
      input.invoiceId,
      Math.max(1, Math.trunc(input.attemptCount || 1)),
      input.chargeId ?? null,
      input.userId ?? null,
      input.email ?? null,
      input.customerId ?? null,
      input.subscriptionId ?? null,
      input.priceId ?? null,
      sku?.tier ?? null,
      sku?.cadence ?? null,
      kind,
      input.billingReason ?? null,
      Math.max(0, Math.trunc(input.amountDue ?? 0)),
      input.currency ?? null,
      input.decline?.code ?? null,
      input.decline?.declineCode ?? null,
      input.decline?.networkDeclineCode ?? null,
      input.decline?.message ?? null,
      input.decline?.sellerMessage ?? null,
      category,
      input.cardBrand ?? null,
      input.cardLast4 ?? null,
      input.cardFunding ?? null,
      input.cardCountry ?? null,
      input.nextAttemptAt ?? null,
      input.graceUntil ?? null,
      failedAt,
      input.source ?? 'webhook',
      nowIso(),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Which kind of charge this invoice was, resolved against the subscription's own
 * payment history. The caller's `trialConversion` flag wins where it exists
 * because it is read from `trial_end` and cannot be fooled by event ordering;
 * the history is what answers it otherwise.
 */
function resolveKindForInvoice(input: RecordDeclineInput): DeclineKind {
  let hadPriorPaidCharge = false;
  let hadTrialOpener = false;
  if (input.subscriptionId) {
    try {
      // Scoped to this subscription rather than loading the whole ledger: this
      // runs on the webhook's hot path, once per declined attempt.
      const history = loadPaidInvoicesForSubscription(input.subscriptionId);
      for (const invoice of history) {
        if (invoice.amountPaid === 0 && invoice.billingReason?.toLowerCase() === 'subscription_create') {
          hadTrialOpener = true;
        } else if (invoice.amountPaid > 0 && invoice.invoiceId !== input.invoiceId) {
          hadPriorPaidCharge = true;
        }
      }
    } catch {
      // No history is not a reason to guess: classifyAttemptKind falls back to
      // the billing reason, and to 'unknown' when even that says nothing.
    }
  }
  return classifyAttemptKind({
    billingReason: input.billingReason ?? null,
    hadPriorPaidCharge,
    hadTrialOpener,
    trialConversion: input.trialConversion ?? null,
  });
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * WHO recovered the payment — the difference between a system that fixed itself
 * and a customer who had to be chased.
 *
 *   auto_retry     Stripe's own Smart Retry collected it. Nothing was asked of
 *                  the member, and nothing needs to be built to make it happen
 *                  again.
 *   member_action  the money arrived BEFORE the next scheduled retry, which only
 *                  happens when the member did something: paid the hosted
 *                  invoice, updated the card, or called their bank. This is the
 *                  cohort a better dunning email actually moves.
 *   unknown        no retry was scheduled to compare against.
 */
export type RecoveryRoute = 'auto_retry' | 'member_action' | 'unknown';

/**
 * Stripe schedules a retry within a minute or two of the failure but fires it on
 * its own clock; a payment landing slightly early is still that retry, not the
 * member. Fifteen minutes of slack keeps a clock skew from being reported as a
 * customer rescuing their own subscription.
 */
const RETRY_ATTRIBUTION_SLACK_MS = 15 * 60_000;

/**
 * Which route recovered this invoice, inferred from WHEN the money landed
 * relative to the retry Stripe had queued. Inference, not fact: Stripe publishes
 * no "who paid this" field, and asking for one costs an API call per paid
 * invoice on the hot webhook path. The rule is stated here so the number is read
 * for what it is.
 */
function inferRecoveryRoute(invoiceId: string, resolvedAtIso: string): RecoveryRoute {
  try {
    const row = getDb()
      .prepare(
        `SELECT MAX(next_attempt_at) AS next_attempt_at
           FROM payment_declines
          WHERE invoice_id = ? AND next_attempt_at IS NOT NULL`,
      )
      .get(invoiceId) as { next_attempt_at: string | null } | undefined;
    const nextAttemptAt = row?.next_attempt_at;
    if (!nextAttemptAt) return 'unknown';
    const scheduled = Date.parse(nextAttemptAt);
    const resolved = Date.parse(resolvedAtIso);
    if (!Number.isFinite(scheduled) || !Number.isFinite(resolved)) return 'unknown';
    return resolved + RETRY_ATTRIBUTION_SLACK_MS >= scheduled ? 'auto_retry' : 'member_action';
  } catch {
    return 'unknown';
  }
}

/**
 * The money arrived after all. Stamps EVERY open attempt on the invoice, so the
 * invoice reads as recovered no matter which attempt is looked at.
 *
 * Returns the number of attempts closed — zero for the overwhelming majority of
 * paid invoices, which never declined in the first place.
 */
export function resolveDeclinesForInvoice(
  invoiceId: string,
  options: { resolvedAt?: string | null; recoveredAmount?: number | null; route?: RecoveryRoute } = {},
): number {
  try {
    const resolvedAt = options.resolvedAt ?? nowIso();
    const route = options.route ?? inferRecoveryRoute(invoiceId, resolvedAt);
    const result = getDb()
      .prepare(
        `UPDATE payment_declines
            SET outcome = 'recovered',
                resolved_at = ?,
                recovered_amount = COALESCE(?, amount_due),
                recovery_route = ?,
                lost_reason = NULL
          WHERE invoice_id = ? AND outcome != 'recovered'`,
      )
      .run(resolvedAt, options.recoveredAmount ?? null, route, invoiceId) as { changes: number | bigint };
    return Number(result.changes) || 0;
  } catch {
    return 0;
  }
}

export type LostReasonInput = 'canceled' | 'uncollectible' | 'voided' | 'grace_expired' | 'unknown';

/** This invoice is never going to be paid. Only ever closes OPEN attempts. */
export function markDeclinesLostForInvoice(
  invoiceId: string,
  reason: LostReasonInput,
  at?: string | null,
): number {
  try {
    const result = getDb()
      .prepare(
        `UPDATE payment_declines
            SET outcome = 'lost', resolved_at = ?, lost_reason = ?
          WHERE invoice_id = ? AND outcome = 'open'`,
      )
      .run(at ?? nowIso(), reason, invoiceId) as { changes: number | bigint };
    return Number(result.changes) || 0;
  } catch {
    return 0;
  }
}

/**
 * The subscription ended with declines still open — the money is gone. Called
 * from customer.subscription.deleted, which is the event that turns "Stripe is
 * still retrying" into "nobody is going to pay this".
 */
export function markDeclinesLostForSubscription(
  subscriptionId: string,
  reason: LostReasonInput = 'canceled',
  at?: string | null,
): number {
  try {
    const result = getDb()
      .prepare(
        `UPDATE payment_declines
            SET outcome = 'lost', resolved_at = ?, lost_reason = ?
          WHERE subscription_id = ? AND outcome = 'open'`,
      )
      .run(at ?? nowIso(), reason, subscriptionId) as { changes: number | bigint };
    return Number(result.changes) || 0;
  } catch {
    return 0;
  }
}

/** `Subscription sub_123 ended; tier reset to public` */
const SUB_DELETED_MESSAGE = /^Subscription (\S+) ended/;

/**
 * The reconcile-side cancellation close. Unlike markDeclinesLostForSubscription
 * — which the webhook calls, where only an OPEN attempt may be closed — this
 * also upgrades an attempt previously aged out as 'unknown': learning that the
 * subscription was deleted turns "we never heard anything" into a reason, and
 * refusing the upgrade would leave the better answer unused. It never touches a
 * recovered attempt or one already attributed to a different cause.
 */
function attributeLostToCancellation(subscriptionId: string, at: string): number {
  try {
    const result = getDb()
      .prepare(
        `UPDATE payment_declines
            SET outcome = 'lost', resolved_at = ?, lost_reason = 'canceled'
          WHERE subscription_id = ?
            AND (outcome = 'open' OR (outcome = 'lost' AND lost_reason = 'unknown'))`,
      )
      .run(at, subscriptionId) as { changes: number | bigint };
    return Number(result.changes) || 0;
  } catch {
    return 0;
  }
}

/**
 * Close out open declines whose closing event never arrived. Three passes, in
 * descending order of certainty — and in this order for a reason: money that
 * actually arrived outranks a cancellation, and a known cancellation outranks
 * mere silence.
 *
 *   1. The invoice IS paid according to the invoice ledger — the webhook's own
 *      resolve was missed (an outage, or the decline was backfilled after the
 *      payment). Recovered, dated by the payment.
 *   2. The subscription was deleted, per the audit log. Lost to a cancellation,
 *      dated by that event. This is the real reason most declines die, and
 *      reading it here is what stops a cancelled member's unpaid invoice from
 *      sitting as "recoverable" until the age sweep below eventually gives up
 *      on it with no reason attached.
 *   3. Nothing has happened on the INVOICE for STALE_OPEN_DAYS. Closed as
 *      'unknown' — "never seen to recover", not "known lost".
 *
 * The age sweep works per invoice, not per attempt: an invoice Stripe retried
 * last week is not stale because its FIRST attempt was five weeks ago, and
 * closing only the old attempt would leave one invoice half open and half lost,
 * with the surviving attempt carrying no reason.
 *
 * AN 'unknown' CLOSE IS NOT FINAL, and this is what makes the whole thing
 * honest. It records an absence of evidence, and the evidence can arrive later:
 * running `make backfill-stripe-invoices` imports years of paid invoices the
 * ledger could not previously see, and any decline aged out for want of exactly
 * that record should then be re-read as recovered. So passes 1 and 2 reconsider
 * rows already closed as 'unknown' alongside the open ones. A cancellation or a
 * write-off is a FACT the log recorded and is never revisited; only the weak
 * claim is revisable, which is the point of having made the weak claim.
 *
 * Idempotent and cheap: nothing is reopened, only upgraded to a better-supported
 * outcome.
 */
export function reconcileOpenDeclines(nowMs: number = Date.now()): ReconcileResult {
  let recovered = 0;
  let cancelled = 0;
  let agedOut = 0;
  try {
    const db = getDb();
    const open = db
      .prepare(
        `SELECT DISTINCT invoice_id, subscription_id FROM payment_declines
          WHERE outcome = 'open' OR (outcome = 'lost' AND lost_reason = 'unknown')`,
      )
      .all() as Array<{ invoice_id: string; subscription_id: string | null }>;
    if (open.length === 0) return { recovered: 0, cancelled: 0, agedOut: 0 };

    // 1 — money that arrived.
    const paidByInvoice = new Map(loadPaidInvoices().map((p) => [p.invoiceId, p]));
    for (const row of open) {
      const paid = paidByInvoice.get(row.invoice_id);
      if (paid && paid.amountPaid > 0) {
        recovered += resolveDeclinesForInvoice(row.invoice_id, {
          resolvedAt: paid.paidAt,
          recoveredAmount: paid.amountPaid,
        });
      }
    }

    // 2 — subscriptions the audit log says are gone. Scoped to the
    // subscriptions that actually have an open decline, so this is a handful of
    // lookups rather than a scan of every cancellation the product ever had.
    const openSubs = new Set(open.map((row) => row.subscription_id).filter((id): id is string => !!id));
    if (openSubs.size > 0) {
      const deletions = db
        .prepare(
          `SELECT created_at, message FROM audit_events
            WHERE type = 'stripe_subscription_deleted' ORDER BY created_at ASC`,
        )
        .all() as Array<{ created_at: string; message: string }>;
      for (const row of deletions) {
        const subscriptionId = row.message.match(SUB_DELETED_MESSAGE)?.[1];
        if (!subscriptionId || !openSubs.has(subscriptionId)) continue;
        cancelled += attributeLostToCancellation(subscriptionId, row.created_at);
      }
    }

    // 3 — silence.
    const cutoff = new Date(nowMs - STALE_OPEN_DAYS * 86_400_000).toISOString();
    const stale = db
      .prepare(
        `UPDATE payment_declines
            SET outcome = 'lost',
                resolved_at = (
                  SELECT MAX(p2.failed_at) FROM payment_declines p2
                   WHERE p2.invoice_id = payment_declines.invoice_id
                ),
                lost_reason = 'unknown'
          WHERE outcome = 'open'
            AND invoice_id IN (
              SELECT invoice_id FROM payment_declines
               GROUP BY invoice_id
              HAVING MAX(failed_at) < ?
            )`,
      )
      .run(cutoff) as { changes: number | bigint };
    agedOut = Number(stale.changes) || 0;
  } catch {
    // A reconcile that cannot run must not blank the report.
  }
  return { recovered, cancelled, agedOut };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** `Invoice in_123 paid for sub sub_456 amount=4900 billing_reason=subscription_cycle …` */
const PAID_MESSAGE = /^Invoice (\S+) paid for sub (\S+)/;
/** `Invoice in_123 payment failed for sub sub_456 (attempt 2)` — sub optional. */
const FAILED_MESSAGE = /^Invoice (\S+) payment failed(?: for sub (\S+))? \(attempt (\d+)\)/;

function field(message: string, name: string): string | null {
  const match = message.match(new RegExp(`\\b${name}=(\\S+)`));
  const value = match?.[1];
  return value && value !== 'unknown' ? value : null;
}

/**
 * Every successful subscription invoice we can see, from BOTH sources, deduped
 * on invoice id:
 *
 *   stripe_invoice_history  imported from the Stripe API by
 *                           scripts/backfill-stripe-invoices.mts — the only
 *                           record of invoices older than the audit event.
 *   stripe_invoice_paid     the audit row the webhook writes for every paid
 *                           subscription invoice since that event shipped.
 *
 * This is the DENOMINATOR. Without it a decline count has no scale, and the
 * conversion-loss rate cannot be computed at all.
 */
export function loadPaidInvoices(): PaidInvoice[] {
  const byId = new Map<string, PaidInvoice>();
  const db = getDb();
  try {
    const rows = db
      .prepare(
        `SELECT invoice_id, subscription_id, billing_reason, amount_paid, paid_at
           FROM stripe_invoice_history
          WHERE status = 'paid'`,
      )
      .all() as Array<{
      invoice_id: string;
      subscription_id: string | null;
      billing_reason: string | null;
      amount_paid: number;
      paid_at: string;
    }>;
    for (const row of rows) {
      byId.set(row.invoice_id, {
        invoiceId: row.invoice_id,
        subscriptionId: row.subscription_id,
        billingReason: row.billing_reason,
        amountPaid: Number(row.amount_paid) || 0,
        paidAt: row.paid_at,
      });
    }
  } catch {
    // Table absent on a deploy that predates the migration — degrade, never throw.
  }
  try {
    const rows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
          WHERE type = 'stripe_invoice_paid' ORDER BY created_at ASC`,
      )
      .all() as Array<{ created_at: string; message: string }>;
    for (const row of rows) {
      const match = row.message.match(PAID_MESSAGE);
      const invoiceId = match?.[1];
      if (!invoiceId || invoiceId === 'undefined') continue;
      const amountRaw = field(row.message, 'amount');
      const amountPaid = amountRaw != null ? Number(amountRaw) : NaN;
      const existing = byId.get(invoiceId);
      // The imported row is richer (it carries the real Stripe timestamps), so
      // it wins on conflict; the audit row fills the gap after the import's
      // cut-off.
      if (existing) continue;
      byId.set(invoiceId, {
        invoiceId,
        subscriptionId: match?.[2] && match[2] !== 'unknown' ? match[2] : null,
        billingReason: field(row.message, 'billing_reason'),
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
        paidAt: row.created_at,
      });
    }
  } catch {
    // Same rule.
  }
  return [...byId.values()].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
}

/**
 * The same two sources as `loadPaidInvoices`, narrowed to ONE subscription in
 * SQL. The full read walks every invoice the product has ever collected, which
 * is the right shape for the report and the wrong shape for a webhook handler
 * that only needs to know whether this subscription has been paid before.
 */
export function loadPaidInvoicesForSubscription(subscriptionId: string): PaidInvoice[] {
  const byId = new Map<string, PaidInvoice>();
  const db = getDb();
  try {
    const rows = db
      .prepare(
        `SELECT invoice_id, subscription_id, billing_reason, amount_paid, paid_at
           FROM stripe_invoice_history
          WHERE status = 'paid' AND subscription_id = ?`,
      )
      .all(subscriptionId) as Array<{
      invoice_id: string;
      subscription_id: string | null;
      billing_reason: string | null;
      amount_paid: number;
      paid_at: string;
    }>;
    for (const row of rows) {
      byId.set(row.invoice_id, {
        invoiceId: row.invoice_id,
        subscriptionId: row.subscription_id,
        billingReason: row.billing_reason,
        amountPaid: Number(row.amount_paid) || 0,
        paidAt: row.paid_at,
      });
    }
  } catch {
    // Table absent on a deploy that predates the migration.
  }
  try {
    const rows = db
      .prepare(
        `SELECT created_at, message FROM audit_events
          WHERE type = 'stripe_invoice_paid' AND message LIKE ?
          ORDER BY created_at ASC`,
      )
      .all(`%${subscriptionId}%`) as Array<{ created_at: string; message: string }>;
    for (const row of rows) {
      const match = row.message.match(PAID_MESSAGE);
      const invoiceId = match?.[1];
      // The LIKE is a prefilter, not the test: it would also match a message
      // that merely mentions this id. The parsed subscription is the authority.
      if (!invoiceId || invoiceId === 'undefined' || match?.[2] !== subscriptionId) continue;
      if (byId.has(invoiceId)) continue;
      const amountRaw = field(row.message, 'amount');
      const amountPaid = amountRaw != null ? Number(amountRaw) : NaN;
      byId.set(invoiceId, {
        invoiceId,
        subscriptionId,
        billingReason: field(row.message, 'billing_reason'),
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
        paidAt: row.created_at,
      });
    }
  } catch {
    // Same rule.
  }
  return [...byId.values()].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
}

/**
 * How much payment history this database can actually see — the ceiling on how
 * many declines can ever be settled as recovered. `imported` is the Stripe
 * import specifically, because that is the half an operator can go and fetch.
 */
export function countPaidInvoices(): { total: number; imported: number; newestAt: string | null } {
  let imported = 0;
  try {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS c FROM stripe_invoice_history WHERE status = 'paid'`)
      .get() as { c?: number } | undefined;
    imported = Number(row?.c) || 0;
  } catch {
    imported = 0;
  }
  const all = loadPaidInvoices();
  return {
    total: all.length,
    imported,
    newestAt: all.length > 0 ? all[all.length - 1].paidAt : null,
  };
}

function loadDeclineRecords(sinceIso: string | null, excludedUserIds: ReadonlySet<string>): DeclineRecord[] {
  try {
    const sql = sinceIso
      ? `SELECT * FROM payment_declines WHERE failed_at >= ? ORDER BY failed_at ASC`
      : `SELECT * FROM payment_declines ORDER BY failed_at ASC`;
    const statement = getDb().prepare(sql);
    const rows = (sinceIso ? statement.all(sinceIso) : statement.all()) as DeclineRow[];
    return rows
      .filter((row) => !(row.user_id && excludedUserIds.has(row.user_id)))
      .map(toRecord);
  } catch {
    return [];
  }
}

export type DeclineReportOptions = {
  /** Window in days, or null for all time. */
  windowDays?: number | null;
  nowMs?: number;
  /** Skip the write pass — used by read-only callers such as the backfill dry run. */
  reconcile?: boolean;
};

/**
 * The whole Payment Declines report, as the admin page consumes it.
 *
 * EXCLUDES the operator's own account, comped members and creator partners on a
 * granted tier — the same accounts core/excludedAccounts.ts holds out of every
 * growth number, for the same reason: a decline on a card that was never going
 * to be charged commercially is not lost revenue.
 */
export function getPaymentDeclineReport(options: DeclineReportOptions = {}): PaymentDeclinePayload {
  const nowMs = options.nowMs ?? Date.now();
  const windowDays = options.windowDays === undefined ? 90 : options.windowDays;
  const reconciled: ReconcileResult =
    options.reconcile === false ? { recovered: 0, cancelled: 0, agedOut: 0 } : reconcileOpenDeclines(nowMs);

  let excludedAccounts: ReturnType<typeof loadExcludedAccounts> = [];
  try {
    excludedAccounts = loadExcludedAccounts();
  } catch {
    excludedAccounts = [];
  }
  const excludedIds = new Set(excludedAccounts.map((account) => account.id));

  // Two windows of rows are loaded, not one: the report reports the trend
  // against the immediately preceding window of equal length.
  const sinceIso =
    windowDays == null ? null : new Date(nowMs - windowDays * 2 * 86_400_000).toISOString();
  const declines = loadDeclineRecords(sinceIso, excludedIds);
  const paid = loadPaidInvoices();

  const report = buildDeclineReport({ declines, paid, windowDays, nowMs });
  return { ...report, excluded: summarizeExcluded(excludedAccounts), reconciled };
}

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

export type BackfillResult = {
  /** Audit rows read — the true total, including the ones nothing could be made of. */
  scanned: number;
  /** New decline rows written. */
  inserted: number;
  /** Rows whose (invoice, attempt) was already on record. */
  duplicates: number;
  /** Rows carrying no usable invoice id — nothing to reconstruct from. */
  unparseable: number;
} & ReconcileResult;

/**
 * Reconstruct decline history from the `stripe_payment_failed` audit rows that
 * predate this table.
 *
 * WHAT IT CAN AND CANNOT RECOVER. The audit message carries the invoice, the
 * subscription and the attempt number — enough to count declines, place them in
 * time, split trial conversions from renewals against the invoice ledger, and
 * settle each one against the payments that followed. It does NOT carry the
 * decline code, because nothing ever wrote one down: those rows land with
 * category 'unknown' and source 'audit_backfill', and the report states the
 * split rather than presenting them as a mystery.
 *
 * Idempotent: UNIQUE(invoice_id, attempt_count) means re-running adds only what
 * is new, and a row already captured by the webhook (with its real reason) is
 * never downgraded — the upsert refuses to overwrite a known category with
 * 'unknown'.
 */
export function backfillDeclinesFromAudit(options: { nowMs?: number } = {}): BackfillResult {
  const nowMs = options.nowMs ?? Date.now();
  const result: BackfillResult = {
    scanned: 0,
    inserted: 0,
    duplicates: 0,
    unparseable: 0,
    recovered: 0,
    cancelled: 0,
    agedOut: 0,
  };
  const db = getDb();

  let rows: Array<{ created_at: string; user_id: string | null; email: string | null; message: string }> = [];
  try {
    rows = db
      .prepare(
        `SELECT created_at, user_id, email, message FROM audit_events
          WHERE type = 'stripe_payment_failed' ORDER BY created_at ASC`,
      )
      .all() as typeof rows;
  } catch {
    return result;
  }

  const paid = loadPaidInvoices();
  const paidBySub = new Map<string, PaidInvoice[]>();
  for (const invoice of paid) {
    if (!invoice.subscriptionId) continue;
    const list = paidBySub.get(invoice.subscriptionId);
    if (list) list.push(invoice);
    else paidBySub.set(invoice.subscriptionId, [invoice]);
  }
  const paidByUser = loadPaidInvoicesByUser();

  // The amount at risk is not in the audit message, so it is ESTIMATED here and
  // replaced with the real figure by the Stripe pass of
  // scripts/backfill-payment-declines.mts (see enrichDeclineWithReason).
  //
  // The fallback chain matters more than it looks. The obvious implementation —
  // "use another invoice on the same subscription" — returns zero for exactly
  // the cohort that matters most: a TRIAL CONVERSION that declined and never
  // recovered has, by definition, no successful positive invoice on its
  // subscription, only the $0 trial opener. Every lost conversion then reports
  // as costing nothing, and the headline loss figure reads $0 while real money
  // is walking out of the door. Under-reporting a loss as zero is the worst of
  // the available errors; an estimate at the product's own prevailing price is
  // approximately right and is superseded the moment the Stripe pass runs.
  const positiveAmounts = paid.filter((p) => p.amountPaid > 0).map((p) => p.amountPaid).sort((a, b) => a - b);
  // Median rather than mean: one annual plan among monthlies would drag a mean
  // far above what a typical declined invoice is worth.
  const typicalAmount = positiveAmounts.length > 0 ? positiveAmounts[Math.floor(positiveAmounts.length / 2)] : 0;

  const amountForSub = (subscriptionId: string | null, userId: string | null, before: string): number => {
    const list = subscriptionId ? (paidBySub.get(subscriptionId) ?? []) : [];
    // 1. what this subscription was last actually charged before it failed
    let best = 0;
    for (const invoice of list) {
      if (invoice.amountPaid > 0 && invoice.paidAt <= before) best = invoice.amountPaid;
    }
    if (best > 0) return best;
    // 2. anything this subscription was ever charged
    const anyPositive = list.find((invoice) => invoice.amountPaid > 0);
    if (anyPositive) return anyPositive.amountPaid;
    // 3. what this MEMBER pays on any other subscription — covers a trial that
    //    died and was re-taken later, and a plan switch onto a new sub id
    if (userId) {
      const byUser = paidByUser.get(userId) ?? [];
      const userPositive = byUser.find((invoice) => invoice.amountPaid > 0);
      if (userPositive) return userPositive.amountPaid;
    }
    // 4. the product's prevailing charge
    return typicalAmount;
  };

  for (const row of rows) {
    result.scanned += 1;
    const match = row.message.match(FAILED_MESSAGE);
    const invoiceId = match?.[1];
    if (!invoiceId || invoiceId === 'undefined') {
      result.unparseable += 1;
      continue;
    }
    const subscriptionId = match?.[2] && match[2] !== 'unknown' ? match[2] : null;
    const attemptCount = Number(match?.[3]) || 1;
    const history = subscriptionId ? (paidBySub.get(subscriptionId) ?? []) : [];
    const hadTrialOpener = history.some(
      (invoice) => invoice.amountPaid === 0 && invoice.billingReason?.toLowerCase() === 'subscription_create',
    );
    const hadPriorPaidCharge = history.some(
      (invoice) => invoice.amountPaid > 0 && invoice.paidAt < row.created_at && invoice.invoiceId !== invoiceId,
    );
    const kind = classifyAttemptKind({
      // The audit row never carried one. Left null so the inference below runs
      // off history rather than off a guessed billing reason.
      billingReason: null,
      hadPriorPaidCharge,
      hadTrialOpener,
    });
    const inserted = insertBackfillRow({
      invoiceId,
      attemptCount,
      userId: row.user_id,
      email: row.email,
      subscriptionId,
      kind,
      amountDue: amountForSub(subscriptionId, row.user_id, row.created_at),
      failedAt: row.created_at,
    });
    if (inserted) result.inserted += 1;
    else result.duplicates += 1;
  }

  const closed = reconcileOpenDeclines(nowMs);
  result.recovered = closed.recovered;
  result.cancelled = closed.cancelled;
  result.agedOut = closed.agedOut;
  return result;
}

/**
 * Paid invoices grouped by the member who paid them. Only the imported ledger
 * carries a user id — the audit-derived rows do not — so this is a narrower
 * index than loadPaidInvoices and is used only as a price fallback.
 */
function loadPaidInvoicesByUser(): Map<string, PaidInvoice[]> {
  const byUser = new Map<string, PaidInvoice[]>();
  try {
    const rows = getDb()
      .prepare(
        `SELECT user_id, invoice_id, subscription_id, billing_reason, amount_paid, paid_at
           FROM stripe_invoice_history
          WHERE status = 'paid' AND user_id IS NOT NULL AND amount_paid > 0
          ORDER BY paid_at DESC`,
      )
      .all() as Array<{
      user_id: string;
      invoice_id: string;
      subscription_id: string | null;
      billing_reason: string | null;
      amount_paid: number;
      paid_at: string;
    }>;
    for (const row of rows) {
      const invoice: PaidInvoice = {
        invoiceId: row.invoice_id,
        subscriptionId: row.subscription_id,
        billingReason: row.billing_reason,
        amountPaid: Number(row.amount_paid) || 0,
        paidAt: row.paid_at,
      };
      const list = byUser.get(row.user_id);
      if (list) list.push(invoice);
      else byUser.set(row.user_id, [invoice]);
    }
  } catch {
    // Table absent on a deploy that predates the migration.
  }
  return byUser;
}

function insertBackfillRow(input: {
  invoiceId: string;
  attemptCount: number;
  userId: string | null;
  email: string | null;
  subscriptionId: string | null;
  kind: DeclineKind;
  amountDue: number;
  failedAt: string;
}): boolean {
  try {
    const result = getDb()
      .prepare(
        `INSERT INTO payment_declines (
           id, invoice_id, attempt_count, user_id, email, subscription_id, kind,
           amount_due, category, failed_at, outcome, source, recorded_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unknown', ?, 'open', 'audit_backfill', ?)
         ON CONFLICT(invoice_id, attempt_count) DO NOTHING`,
      )
      .run(
        randomId(),
        input.invoiceId,
        input.attemptCount,
        input.userId,
        input.email,
        input.subscriptionId,
        input.kind,
        Math.max(0, Math.trunc(input.amountDue)),
        input.failedAt,
        nowIso(),
      ) as { changes: number | bigint };
    return Number(result.changes) > 0;
  } catch {
    return false;
  }
}

/**
 * Re-run the CATEGORY classifier over codes already stored.
 *
 * The category is decided at write time from whatever the issuer said, so a code
 * that core/declineReason.ts did not recognise then lands as 'unknown' and stays
 * there — even after the mapping is added. That is the wrong behaviour for a
 * table whose whole purpose is naming causes: the codes are on the rows, the
 * classifier has improved, and nothing was re-asking it. Every decline that ever
 * carried an unmapped code would sit in "no usable decline code" forever, which
 * is precisely the bucket nobody can act on.
 *
 * Only ever moves a row OFF 'unknown'. A category already decided is left alone,
 * so a mapping change can add knowledge but never rewrite a settled answer.
 */
export function recategorizeFromStoredCodes(): { examined: number; recategorized: number } {
  const result = { examined: 0, recategorized: 0 };
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, failure_code, decline_code, network_decline_code
           FROM payment_declines
          WHERE category = 'unknown'
            AND (decline_code IS NOT NULL OR network_decline_code IS NOT NULL OR failure_code IS NOT NULL)`,
      )
      .all() as Array<{
      id: string;
      failure_code: string | null;
      decline_code: string | null;
      network_decline_code: string | null;
    }>;
    const update = db.prepare(`UPDATE payment_declines SET category = ? WHERE id = ? AND category = 'unknown'`);
    for (const row of rows) {
      result.examined += 1;
      const category = classifyDecline({
        code: row.failure_code,
        declineCode: row.decline_code,
        networkDeclineCode: row.network_decline_code,
        message: null,
        sellerMessage: null,
      });
      if (category === 'unknown') continue;
      const changed = update.run(category, row.id) as { changes: number | bigint };
      if (Number(changed.changes) > 0) result.recategorized += 1;
    }
  } catch {
    // Leaves the rows honest at 'unknown'.
  }
  return result;
}

/**
 * Collapse an invoice whose attempts disagree about what kind of charge it was.
 *
 * Retries are one charge, so an invoice holding two kinds is counted once under
 * each and every per-kind total is quietly inflated — the exact double-count the
 * invoice-level fold exists to prevent, arriving through the back door. It
 * happens when one attempt is classified from one source and a sibling from
 * another.
 *
 * Which kind wins, in order:
 *
 *   1. one the WEBHOOK recorded. That came from the subscription's own
 *      trial_end, which is the only source event ordering cannot corrupt, and it
 *      beats anything inferred from invoice history afterwards.
 *   2. otherwise the earliest attempt's, because the first classification was
 *      made closest to the event.
 *
 * Distinct from reclassifyUnknownKinds, which cannot see these rows at all: they
 * are not unknown, they are inconsistent.
 */
export function unifyInvoiceKinds(): { split: number; unified: number } {
  const result = { split: 0, unified: 0 };
  try {
    const db = getDb();
    const conflicted = db
      .prepare(
        `SELECT invoice_id FROM payment_declines
          GROUP BY invoice_id
         HAVING COUNT(DISTINCT kind) > 1`,
      )
      .all() as Array<{ invoice_id: string }>;
    const pick = db.prepare(
      `SELECT kind, source, attempt_count FROM payment_declines
        WHERE invoice_id = ? AND kind != 'unknown'
        ORDER BY (source = 'webhook') DESC, attempt_count ASC
        LIMIT 1`,
    );
    const update = db.prepare(`UPDATE payment_declines SET kind = ? WHERE invoice_id = ? AND kind != ?`);
    for (const row of conflicted) {
      result.split += 1;
      const winner = pick.get(row.invoice_id) as { kind: string } | undefined;
      if (!winner || !KINDS.has(winner.kind)) continue;
      const changed = update.run(winner.kind, row.invoice_id, winner.kind) as { changes: number | bigint };
      if (Number(changed.changes) > 0) result.unified += 1;
    }
  } catch {
    // Leaves the rows as they are; the report's own fold still reads the invoice
    // by its last attempt, so a split shows up in raw queries rather than on the
    // dashboard.
  }
  return result;
}

/**
 * Re-decide the CHARGE KIND of rows still sitting on 'unknown', using evidence
 * that has arrived since they were written.
 *
 * Why they are unknown in the first place: a row reconstructed from the audit
 * log has no billing reason — the audit message never carried one — so
 * classification falls back to needing the $0 trial-opening invoice as proof
 * that the subscription had a trial. And `make backfill-stripe-invoices`
 * deliberately skips zero-amount invoices, because they are not payments. Both
 * decisions are individually right and together they leave every reconstructed
 * decline unclassifiable: the marker that says "this was a trial" is the one
 * record nobody imports.
 *
 * What rescues them is the Stripe enrichment pass, which fetches each real
 * invoice and stamps its actual `billing_reason`. With that on the row, the
 * ordinary rule applies and needs no trial marker at all: a `subscription_cycle`
 * invoice on a subscription that has never collected money IS the first charge
 * at the end of a trial. This pass simply re-runs the classifier now that the
 * input exists.
 *
 * Only ever moves a row OFF 'unknown'. It never revises a kind that was decided
 * with better evidence — least of all one the webhook set from the
 * subscription's own trial_end.
 */
export function reclassifyUnknownKinds(): { examined: number; reclassified: number } {
  const result = { examined: 0, reclassified: 0 };
  try {
    const db = getDb();
    // Grouped by invoice so every attempt on it gets the same answer: they are
    // retries of one charge, and `hadPriorPaidCharge` is judged at the moment
    // the invoice FIRST failed rather than per attempt.
    const invoices = db
      .prepare(
        `SELECT invoice_id, subscription_id, billing_reason, MIN(failed_at) AS first_failed_at
           FROM payment_declines
          WHERE kind = 'unknown' AND billing_reason IS NOT NULL
          GROUP BY invoice_id, subscription_id, billing_reason`,
      )
      .all() as Array<{
      invoice_id: string;
      subscription_id: string | null;
      billing_reason: string;
      first_failed_at: string;
    }>;
    const update = db.prepare(`UPDATE payment_declines SET kind = ? WHERE invoice_id = ? AND kind = 'unknown'`);
    // An invoice whose OTHER attempts already carry a kind takes that one rather
    // than deriving a second answer. Retries are one charge, and letting an
    // invoice hold two kinds at once makes it count twice in any per-kind total
    // — the exact double-count the invoice-level fold exists to prevent.
    const settled = db.prepare(
      `SELECT kind FROM payment_declines
        WHERE invoice_id = ? AND kind != 'unknown' ORDER BY attempt_count ASC LIMIT 1`,
    );
    for (const row of invoices) {
      result.examined += 1;
      const known = settled.get(row.invoice_id) as { kind: string } | undefined;
      if (known && KINDS.has(known.kind)) {
        const changed = update.run(known.kind, row.invoice_id) as { changes: number | bigint };
        if (Number(changed.changes) > 0) result.reclassified += 1;
        continue;
      }
      const history = row.subscription_id ? loadPaidInvoicesForSubscription(row.subscription_id) : [];
      const hadTrialOpener = history.some(
        (invoice) => invoice.amountPaid === 0 && invoice.billingReason?.toLowerCase() === 'subscription_create',
      );
      const hadPriorPaidCharge = history.some(
        (invoice) =>
          invoice.amountPaid > 0 &&
          invoice.invoiceId !== row.invoice_id &&
          invoice.paidAt < row.first_failed_at,
      );
      const kind = classifyAttemptKind({
        billingReason: row.billing_reason,
        hadPriorPaidCharge,
        hadTrialOpener,
      });
      if (kind === 'unknown') continue;
      const changed = update.run(kind, row.invoice_id) as { changes: number | bigint };
      if (Number(changed.changes) > 0) result.reclassified += 1;
    }
  } catch {
    // A classification that cannot run leaves the rows honest at 'unknown'.
  }
  return result;
}

/**
 * Attach a real decline reason to a row that has none — the enrichment half of
 * `make backfill-payment-declines`, which re-reads each backfilled invoice's
 * charge from the Stripe API. Kept here rather than in the script so the write
 * (and its refusal to overwrite a reason already known) is tested.
 */
export function enrichDeclineWithReason(
  invoiceId: string,
  attemptCount: number,
  decline: ChargeDecline | null,
  extras: {
    chargeId?: string | null;
    amountDue?: number | null;
    currency?: string | null;
    billingReason?: string | null;
    priceId?: string | null;
    cardBrand?: string | null;
    cardLast4?: string | null;
    cardFunding?: string | null;
    cardCountry?: string | null;
  } = {},
): boolean {
  try {
    const category = classifyDecline(decline);
    const sku = extras.priceId ? priceIdToSku(extras.priceId) : null;
    const result = getDb()
      .prepare(
        `UPDATE payment_declines
            SET charge_id = COALESCE(?, charge_id),
                failure_code = COALESCE(?, failure_code),
                decline_code = COALESCE(?, decline_code),
                network_decline_code = COALESCE(?, network_decline_code),
                failure_message = COALESCE(?, failure_message),
                seller_message = COALESCE(?, seller_message),
                category = CASE WHEN ? = 'unknown' THEN category ELSE ? END,
                -- The fetched amount is the TRUTH and replaces the backfill's
                -- estimate, including when it is smaller. A MAX() here would
                -- pin a member on a cheap plan to an over-estimate forever.
                amount_due = CASE WHEN COALESCE(?, 0) > 0 THEN ? ELSE amount_due END,
                currency = COALESCE(?, currency),
                billing_reason = COALESCE(?, billing_reason),
                price_id = COALESCE(?, price_id),
                tier = COALESCE(?, tier),
                cadence = COALESCE(?, cadence),
                card_brand = COALESCE(?, card_brand),
                card_last4 = COALESCE(?, card_last4),
                card_funding = COALESCE(?, card_funding),
                card_country = COALESCE(?, card_country),
                source = CASE WHEN source = 'audit_backfill' THEN 'stripe_backfill' ELSE source END
          WHERE invoice_id = ? AND attempt_count = ?`,
      )
      .run(
        extras.chargeId ?? null,
        decline?.code ?? null,
        decline?.declineCode ?? null,
        decline?.networkDeclineCode ?? null,
        decline?.message ?? null,
        decline?.sellerMessage ?? null,
        category,
        category,
        extras.amountDue ?? null,
        extras.amountDue ?? null,
        extras.currency ?? null,
        extras.billingReason ?? null,
        extras.priceId ?? null,
        sku?.tier ?? null,
        sku?.cadence ?? null,
        extras.cardBrand ?? null,
        extras.cardLast4 ?? null,
        extras.cardFunding ?? null,
        extras.cardCountry ?? null,
        invoiceId,
        attemptCount,
      ) as { changes: number | bigint };
    return Number(result.changes) > 0;
  } catch {
    return false;
  }
}

/**
 * Record that this attempt's invoice has been READ from Stripe — whatever came
 * back. `source = 'stripe_backfill'` means the question has been put, which is a
 * different fact from never having asked, and it is the single stop condition
 * for the enrichment worklist below.
 *
 * Without it the worklist never drains: an invoice Stripe has no decline reason
 * for still has no codes, so every future run re-fetches it and the command can
 * never report "nothing to do".
 */
export function markDeclineInvoiceRead(invoiceId: string, attemptCount: number): boolean {
  try {
    const result = getDb()
      .prepare(
        `UPDATE payment_declines SET source = 'stripe_backfill'
          WHERE invoice_id = ? AND attempt_count = ? AND source != 'stripe_backfill'`,
      )
      .run(invoiceId, attemptCount) as { changes: number | bigint };
    return Number(result.changes) > 0;
  } catch {
    return false;
  }
}

/**
 * Attempts whose invoice is worth reading from Stripe — the enrichment worklist.
 *
 * TWO reasons to fetch, not one:
 *
 *   no decline reason   the cause is missing. A `webhook` row with no codes is
 *                       included: its lookup failed at capture time, possibly
 *                       transiently, and is worth one more try.
 *   no billing reason   the row cannot be CLASSIFIED at all — the billing reason
 *                       is what tells a lost conversion from a lost customer —
 *                       and the same read brings back the invoice's real amount,
 *                       which replaces the backfill's estimate.
 *
 * The second reason existed only implicitly before, and the rows that needed it
 * most were exactly the ones the first clause had already written off.
 *
 * Both are gated on the invoice not having been read yet, so one read settles
 * the row either way and the list always drains.
 *
 * `includeAlreadyRead` lifts that gate, for the one case it exists for: a row
 * read by an EARLIER version of the reader that kept less than this one does.
 * Operator-driven (`RECHECK=1`) rather than automatic, because it spends an API
 * call per row to re-ask a question already asked.
 */
export function listDeclinesNeedingInvoiceRead(
  limit = 500,
  options: { includeAlreadyRead?: boolean } = {},
): Array<{
  invoiceId: string;
  attemptCount: number;
  subscriptionId: string | null;
  failedAt: string;
}> {
  try {
    const rows = getDb()
      .prepare(
        `SELECT invoice_id, attempt_count, subscription_id, failed_at
           FROM payment_declines
          WHERE (? = 1 OR source != 'stripe_backfill')
            AND ((decline_code IS NULL AND failure_code IS NULL AND network_decline_code IS NULL)
                 OR billing_reason IS NULL)
          ORDER BY failed_at DESC
          LIMIT ?`,
      )
      .all(options.includeAlreadyRead ? 1 : 0, Math.max(1, Math.trunc(limit))) as Array<{
      invoice_id: string;
      attempt_count: number;
      subscription_id: string | null;
      failed_at: string;
    }>;
    return rows.map((row) => ({
      invoiceId: row.invoice_id,
      attemptCount: Number(row.attempt_count) || 1,
      subscriptionId: row.subscription_id,
      failedAt: row.failed_at,
    }));
  } catch {
    return [];
  }
}
