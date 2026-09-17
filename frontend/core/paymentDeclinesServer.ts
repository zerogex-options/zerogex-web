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
  reconciled: { recovered: number; lost: number };
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

/**
 * Close out open declines whose closing event never arrived. Two passes, in
 * order of certainty:
 *
 *   1. The invoice IS paid according to the invoice ledger — the webhook's own
 *      resolve was missed (an outage, or the decline was backfilled after the
 *      payment). Recovered, dated by the payment.
 *   2. The attempt is older than STALE_OPEN_DAYS with nothing since. Closed as
 *      'unknown' — "never seen to recover", not "known lost".
 *
 * Idempotent and cheap: both passes touch only rows still marked open.
 */
export function reconcileOpenDeclines(nowMs: number = Date.now()): { recovered: number; lost: number } {
  let recovered = 0;
  let lost = 0;
  try {
    const db = getDb();
    const open = db
      .prepare(`SELECT DISTINCT invoice_id FROM payment_declines WHERE outcome = 'open'`)
      .all() as Array<{ invoice_id: string }>;
    if (open.length === 0) return { recovered: 0, lost: 0 };
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
    const cutoff = new Date(nowMs - STALE_OPEN_DAYS * 86_400_000).toISOString();
    const stale = db
      .prepare(
        `UPDATE payment_declines
            SET outcome = 'lost', resolved_at = failed_at, lost_reason = 'unknown'
          WHERE outcome = 'open' AND failed_at < ?`,
      )
      .run(cutoff) as { changes: number | bigint };
    lost = Number(stale.changes) || 0;
  } catch {
    // A reconcile that cannot run must not blank the report.
  }
  return { recovered, lost };
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
  const reconciled = options.reconcile === false ? { recovered: 0, lost: 0 } : reconcileOpenDeclines(nowMs);

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
  scanned: number;
  inserted: number;
  skipped: number;
  recovered: number;
  lost: number;
};

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
  const result: BackfillResult = { scanned: 0, inserted: 0, skipped: 0, recovered: 0, lost: 0 };
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

  // The amount at risk is not in the audit message. The subscription's own most
  // recent successful invoice is the best available stand-in — it is the same
  // plan at the same price — and it is marked as an estimate by being absent
  // from the codes: a decline with no amount would drop out of every money
  // figure, which understates the loss rather than approximating it.
  const amountForSub = (subscriptionId: string | null, before: string): number => {
    if (!subscriptionId) return 0;
    const list = paidBySub.get(subscriptionId) ?? [];
    let best = 0;
    for (const invoice of list) {
      if (invoice.amountPaid > 0 && invoice.paidAt <= before) best = invoice.amountPaid;
    }
    if (best > 0) return best;
    const anyPositive = list.find((invoice) => invoice.amountPaid > 0);
    return anyPositive?.amountPaid ?? 0;
  };

  for (const row of rows) {
    const match = row.message.match(FAILED_MESSAGE);
    const invoiceId = match?.[1];
    if (!invoiceId || invoiceId === 'undefined') {
      result.skipped += 1;
      continue;
    }
    result.scanned += 1;
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
      amountDue: amountForSub(subscriptionId, row.created_at),
      failedAt: row.created_at,
    });
    if (inserted) result.inserted += 1;
    else result.skipped += 1;
  }

  const closed = reconcileOpenDeclines(nowMs);
  result.recovered = closed.recovered;
  result.lost = closed.lost;
  return result;
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
                amount_due = MAX(COALESCE(?, 0), amount_due),
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

/** Invoices with a decline on record but no reason — the enrichment worklist. */
export function listDeclinesMissingReason(limit = 500): Array<{
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
          WHERE decline_code IS NULL AND failure_code IS NULL AND network_decline_code IS NULL
          ORDER BY failed_at DESC
          LIMIT ?`,
      )
      .all(Math.max(1, Math.trunc(limit))) as Array<{
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
