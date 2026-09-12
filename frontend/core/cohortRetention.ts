import { cancellationFeedbackLabel, parseCancellationReasonFromMessage } from './cancellationReason.ts';
import { parseSyncTierStrict, type PaidTier } from './subscriptionFlow.ts';

// WHAT HAPPENED TO EVERY ACCOUNT, reconstructed from the append-only Stripe
// audit trail. The dashboard's arithmetic all hangs off the per-user facts this
// module derives, so the definitions here are the definitions the business runs
// on. Four of them are load-bearing and easy to get subtly wrong:
//
//   PAID ACCESS (entitlement). The spans during which the customer could
//   actually use what they bought. A scheduled cancellation does NOT end a span
//   — the customer paid for the rest of the period and still has it. Only a
//   terminal downgrade or a Stripe subscription deletion ends one. (This is a
//   deliberate change from the previous "economic retention" reading, which cut
//   the span at cancel-intent and therefore reported a customer with three more
//   paid weeks as already gone.)
//
//   INTERRUPTION vs. PERMANENT LOSS. A customer can lose access and come back.
//   `firstAccessEndedAt` is the first time access stopped; `lastAccessEndedAt`
//   is null whenever they are entitled right now. Anything labelled "lost" in
//   the UI must read the second one, or a resubscriber is counted as churn
//   forever.
//
//   RETENTION ELIGIBILITY. A customer is eligible for the N-day milestone when
//   N days have passed since their first payment OR when they have already lost
//   access for good before day N. Excluding the second case — which the previous
//   implementation did — drops exactly the fastest churners out of the
//   denominator and makes retention look better the worse it gets.
//
//   RENEWAL. Money moving a second time, evidenced by a `subscription_cycle`
//   invoice. Never inferred from access having lasted about a month; see
//   core/renewalRetention.ts.

const DAY_MS = 86_400_000;
export const RETENTION_DAYS = [30, 60, 90] as const;

/** Tiers the product treats as paid access. */
const ENTITLED_TIERS = ['basic', 'pro', 'starter', 'elite'];
/** Subscription statuses that still carry access (past_due is the grace window). */
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];

export type BillingCadence = 'monthly' | 'annual';

/**
 * Where a customer's billing cadence came from. `current_price` is the live
 * Stripe price on the users row; the other two are reconstructions for accounts
 * whose price id was nulled when their subscription was deleted — without them
 * every churned customer silently vanishes from a cadence-filtered view.
 */
export type CadenceSource = 'current_price' | 'invoice_price' | 'invoice_period' | 'checkout_audit' | 'unknown';

export type CohortUserInput = {
  id: string;
  email: string;
  createdAt: string;
  firstPaymentAt: string | null;
  currentStatus: string | null;
  currentTier: string;
  currentPriceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  signupUtmSource: string | null;
  foundingRate: boolean;
  /** Resolved by the caller, which owns the price-id → SKU table. */
  cadence: BillingCadence | null;
  cadenceSource: CadenceSource;
};

export type CohortAuditInput = {
  userId: string;
  type: string;
  message: string;
  createdAt: string;
};

/** One successful, non-zero invoice. */
export type PaidInvoice = {
  invoiceId: string;
  subId: string | null;
  /** When the money cleared. */
  paidAt: string;
  amountCents: number;
  /**
   * Stripe's own word for why the invoice exists. `subscription_create` is the
   * first charge, `subscription_cycle` is a renewal, `subscription_update` is a
   * mid-period proration — which is money, but is NOT a renewal and must never
   * be counted as one.
   */
  billingReason: string | null;
  /** Start of the period this invoice paid for. */
  periodStart: string | null;
  /** End of the period this invoice paid for; the moment the next one is due. */
  periodEnd: string | null;
  priceId: string | null;
};

export type ChurnKind = 'voluntary' | 'payment_failure' | 'other';
export type PaidCustomerState = 'active' | 'voluntarily_churned' | 'involuntarily_churned' | 'other_unknown';

export type CohortUser = {
  id: string;
  email: string;
  cohort: string;
  registeredAt: string;
  trialStartedAt: string | null;
  firstPaidAt: string | null;
  /** Started a trial AND later paid — the only numerator trial→paid may use. */
  paidAfterTrial: boolean;
  /** Paid with no trial on record. Excluded from the trial→paid numerator. */
  directToPaid: boolean;
  cancellationAt: string | null;
  /** First time paid access stopped. An interruption, not necessarily the end. */
  firstAccessEndedAt: string | null;
  /** Most recent end of paid access; null whenever the customer is entitled now. */
  lastAccessEndedAt: string | null;
  /** A future end already on the books (cancel_at_period_end). Never a loss yet. */
  scheduledAccessEndAt: string | null;
  /** End of the billing period in flight — when the next renewal falls due. */
  currentPeriodEnd: string | null;
  currentlyEntitled: boolean;
  /** Lost access at some point and is entitled again now. */
  reactivatedAfterInterruption: boolean;
  currentStatus: string | null;
  /** Days from first payment to the first interruption. */
  daysToFirstInterruption: number | null;
  /** Days of paid access before the loss that still stands. Null if entitled. */
  daysPaidBeforePermanentLoss: number | null;
  churnKind: ChurnKind | null;
  paidCustomerState: PaidCustomerState | null;
  tier: string;
  plan: string | null;
  cadence: BillingCadence | null;
  cadenceSource: CadenceSource;
  foundingRate: boolean;
  acquisitionSource: string | null;
  cancellationReason: string | null;
  failedPaymentAttempts: number;
  paymentFailureState: 'recovered' | 'retrying' | 'lost' | null;
  classificationExplanation: string | null;
  auditEvents: CohortAuditInput[];
  /** Successful invoices that represent a billing period, oldest first. */
  cycleInvoices: PaidInvoice[];
  /** All successful non-zero invoices, prorations included. */
  paidInvoices: PaidInvoice[];
  /** Per milestone: true kept, false lost, null not yet answerable. */
  retained: Record<string, boolean | null>;
};

export type CohortRow = {
  cohort: string;
  registered: number;
  trialStarted: number;
  becamePaid: number;
  /** Trial starters who later paid — the trial→paid numerator for this cohort. */
  trialThenPaid: number;
  directToPaid: number;
  retention: Record<string, { eligible: number; retained: number; rate: number | null }>;
  churn: { voluntary: number; paymentFailure: number; other: number; stillActive: number };
  /** First paid-access interruption inside N days. Includes customers who came back. */
  interrupted: Record<string, { count: number; rate: number | null }>;
  /** Interruptions inside N days that the customer has NOT returned from. */
  permanentlyLost: Record<string, { count: number; rate: number | null }>;
};

export type CohortReport = {
  generatedAt: string;
  cohorts: CohortRow[];
  users: CohortUser[];
  summary: {
    registrations: number;
    trialStarts: number;
    becamePaid: number;
    trialThenPaid: number;
    directToPaid: number;
    registrationToPaid: number | null;
    /** trial starters who later paid / trial starters. Never > 1. */
    trialToPaid: number | null;
    retention: Record<string, { eligible: number; retained: number; rate: number | null }>;
    voluntaryChurn: number;
    paymentFailureChurn: number;
    failedPaymentCustomers: number;
    failedPaymentAttempts: number;
    paymentRecovered: number;
    paymentRetrying: number;
    paidCustomerStates: Record<PaidCustomerState, number>;
    neverPaidFailedPaymentCustomers: number;
    neverPaidFailedPaymentEvents: number;
    /** Ever-paid customers who lost access at least once and are back. */
    reactivated: number;
  };
  limitations: string[];
};

type Interval = { start: number; end: number | null };
type ParsedSync = { at: number; subId: string; status: string | null; tier: string | null; cancelAtPeriodEnd: boolean };

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function subId(message: string): string | null {
  const id = message.match(/\bsub_\S+/)?.[0] ?? null;
  // Trim trailing punctuation the surrounding sentence may have added.
  return id == null ? null : id.replace(/[.,;:)]+$/, '');
}

function syncStatus(message: string): string | null {
  return message.match(/\bstatus=([a-z_]+)/)?.[1] ?? null;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function inIntervals(at: number, intervals: ReadonlyArray<Interval>): boolean {
  return intervals.some((interval) => interval.start <= at && (interval.end == null || at < interval.end));
}

/**
 * Parse `Invoice in_x paid for sub sub_y amount=N billing_reason=R
 * period_end=UNIX price=P`, the shape the Stripe webhook writes. Tokens the
 * message predates come back null rather than guessed.
 */
export function parsePaidInvoice(event: CohortAuditInput): PaidInvoice | null {
  const paidAt = time(event.createdAt);
  // Positional, not a pattern for what a Stripe id looks like. Matching
  // `in_[A-Za-z0-9]+` with a word boundary silently rejects any id containing an
  // underscore, and a parser that returns null on an id it dislikes erases a real
  // payment rather than reporting a bad message.
  const invoiceId = event.message.match(/^Invoice (\S+) paid\b/)?.[1]
    ?? event.message.match(/\b(in_\S+)/)?.[1]
    ?? null;
  if (paidAt == null || invoiceId == null) return null;
  const amount = Number(event.message.match(/\bamount=(\d+)/)?.[1]);
  const periodStartUnix = Number(event.message.match(/\bperiod_start=(\d+)/)?.[1]);
  const periodEndUnix = Number(event.message.match(/\bperiod_end=(\d+)/)?.[1]);
  const priceToken = event.message.match(/\bprice=(\S+)/)?.[1] ?? null;
  return {
    invoiceId,
    subId: subId(event.message),
    paidAt: new Date(paidAt).toISOString(),
    amountCents: Number.isFinite(amount) ? amount : 0,
    billingReason: event.message.match(/\bbilling_reason=([a-z_]+)/)?.[1] ?? null,
    periodStart: Number.isFinite(periodStartUnix) ? new Date(periodStartUnix * 1000).toISOString() : null,
    periodEnd: Number.isFinite(periodEndUnix) ? new Date(periodEndUnix * 1000).toISOString() : null,
    // `unknown` is what the webhook writes when Stripe gave it nothing; it is an
    // absent price, not a price literally called "unknown".
    priceId: priceToken == null || priceToken === 'unknown' ? null : priceToken,
  };
}

/**
 * Billing reasons that represent a subscription PERIOD rather than an
 * adjustment inside one. A `subscription_update` proration is real money and
 * belongs in revenue, but counting it as a renewal turns one plan change into a
 * retained customer.
 */
const PERIOD_BILLING_REASONS = new Set(['subscription_create', 'subscription_cycle', 'subscription']);

export function isPeriodInvoice(invoice: PaidInvoice): boolean {
  // A null reason predates the token in the audit message; those rows are kept,
  // because dropping them would erase the only evidence of a real payment.
  return invoice.billingReason == null || PERIOD_BILLING_REASONS.has(invoice.billingReason);
}

/**
 * The spans during which the customer had paid access, oldest first.
 *
 * A sync carrying a paid tier opens or continues a span; a sync that drops to a
 * non-paid tier, or a terminal deletion, closes one. `cancel_at_period_end` is
 * deliberately NOT a closing event: the customer has paid through the end of the
 * period and still has everything they bought until Stripe actually deletes the
 * subscription.
 */
function buildEntitlementIntervals(
  firstPaid: number,
  syncs: ReadonlyArray<ParsedSync>,
  deletions: ReadonlyArray<CohortAuditInput>,
): Interval[] {
  const events: Array<{ at: number; entitled: boolean }> = [];
  for (const sync of syncs) {
    if (sync.at < firstPaid || sync.tier == null) continue;
    events.push({ at: sync.at, entitled: ENTITLED_TIERS.includes(sync.tier) });
  }
  for (const deletion of deletions) {
    const at = time(deletion.createdAt);
    if (at != null && at >= firstPaid) events.push({ at, entitled: false });
  }
  // Same instant, both readings: take the losing one, so a deletion that lands
  // in the same millisecond as a stale sync still closes the span.
  events.sort((a, b) => a.at - b.at || Number(a.entitled) - Number(b.entitled));

  const intervals: Interval[] = [];
  let start: number | null = firstPaid;
  for (const event of events) {
    if (!event.entitled && start != null && event.at >= start) {
      intervals.push({ start, end: event.at });
      start = null;
    } else if (event.entitled && start == null) {
      start = event.at;
    }
  }
  if (start != null) intervals.push({ start, end: null });
  return intervals;
}

/**
 * Did this customer still have paid access `day` days after their first payment?
 *
 *   true   they did
 *   false  they did not — either the milestone has passed, or access has ended
 *          for good before it, which settles the question early
 *   null   not answerable yet: the milestone is in the future and the customer
 *          still has access (or could still get it back before the date)
 *
 * The `false` branch for a customer whose milestone has not arrived is the whole
 * point. Someone who paid ten days ago and lost access on day seven cannot reach
 * day thirty; leaving them out of the denominator until day thirty arrives
 * removes the fastest churners from every retention rate.
 */
function retentionAt(
  day: number,
  firstPaid: number | null,
  now: number,
  intervals: ReadonlyArray<Interval>,
  lastAccessEnd: number | null,
): boolean | null {
  if (firstPaid == null) return null;
  const milestone = firstPaid + day * DAY_MS;
  if (now >= milestone) return inIntervals(milestone, intervals);
  // Not there yet. Only a standing loss earlier than the milestone settles it.
  if (lastAccessEnd != null && lastAccessEnd < milestone) return false;
  return null;
}

export function buildCohortReport(
  sourceUsers: ReadonlyArray<CohortUserInput>,
  sourceEvents: ReadonlyArray<CohortAuditInput>,
  nowIso = new Date().toISOString(),
): CohortReport {
  const now = time(nowIso) ?? Date.now();
  const byUser = new Map<string, CohortAuditInput[]>();
  for (const event of sourceEvents) {
    const list = byUser.get(event.userId) ?? [];
    list.push(event);
    byUser.set(event.userId, list);
  }

  const users: CohortUser[] = sourceUsers.flatMap((user) => {
    const registered = time(user.createdAt);
    if (registered == null) return [];
    const events = (byUser.get(user.id) ?? []).sort((a, b) => (time(a.createdAt) ?? 0) - (time(b.createdAt) ?? 0));
    const syncs: ParsedSync[] = events
      .filter((event) => event.type === 'stripe_subscription_sync')
      .flatMap((event) => {
        const at = time(event.createdAt);
        const subscription = subId(event.message);
        return at == null || subscription == null
          ? []
          : [{
            at,
            subId: subscription,
            status: syncStatus(event.message),
            tier: parseSyncTierStrict(event.message),
            cancelAtPeriodEnd: /\bcancelAtPeriodEnd=true\b/.test(event.message),
          }];
      });
    const trial = syncs.find((event) => event.status === 'trialing');
    const paidAudit = events.find((event) => event.type === 'stripe_first_payment');
    const paidInvoices = events
      .filter((event) => event.type === 'stripe_invoice_paid')
      .flatMap((event) => {
        const invoice = parsePaidInvoice(event);
        return invoice == null || invoice.amountCents === 0 ? [] : [invoice];
      })
      // Deduped by invoice id: the same invoice can reach us from the webhook
      // audit row AND from the Stripe history backfill.
      .filter((invoice, index, all) => all.findIndex((other) => other.invoiceId === invoice.invoiceId) === index)
      .sort((a, b) => Date.parse(a.paidAt) - Date.parse(b.paidAt));
    const cycleInvoices = paidInvoices.filter(isPeriodInvoice);

    // THE EARLIEST EVIDENCE OF MONEY, not the first source that happens to have
    // a value. `users.first_payment_at` was backfilled from `updated_at` for
    // rows that were active at migration time, so for anyone who paid before
    // that migration it reads LATER than the real first payment — in production
    // by up to two months. Taking it in preference to a real invoice pushed
    // every retention milestone forward by the same amount, which emptied the
    // 60- and 90-day denominators of everyone still subscribed and left them
    // holding only customers who were eligible by having already churned. That
    // is how a healthy product reports 0% retention at 90 days.
    //
    // A paid invoice is ground truth. The backfilled column can still win when
    // it is EARLIER — which means a payment exists that the invoice import did
    // not reach — so the answer is the minimum of what we have, never the first
    // non-null.
    const firstPaid = [
      time(cycleInvoices[0]?.paidAt),
      time(paidAudit?.createdAt),
      time(user.firstPaymentAt),
    ].filter((value): value is number => value != null)
      .reduce<number | null>((earliest, value) => (earliest == null || value < earliest ? value : earliest), null);
    const deletions = events.filter((event) => event.type === 'stripe_subscription_deleted');
    const cancelRequests = events.filter((event) => event.type === 'stripe_cancellation_requested');
    const intervals = firstPaid == null ? [] : buildEntitlementIntervals(firstPaid, syncs, deletions);

    // Every moment paid access stopped, in order. The first is the first
    // interruption; the last is a standing loss only when no span is open.
    const accessEnds = intervals.flatMap((interval) => (interval.end == null ? [] : [interval.end]));
    const currentlyEntitled = intervals.some((interval) => interval.end == null)
      // A users row the webhook has already reconciled is the tie-breaker for a
      // customer whose spans cannot be rebuilt (no sync rows in the retained
      // audit window) but who is plainly a live subscriber right now.
      || (ENTITLED_TIERS.includes(user.currentTier) && LIVE_STATUSES.includes(user.currentStatus ?? ''));
    const firstAccessEnd = accessEnds[0] ?? null;
    const lastAccessEnd = currentlyEntitled ? null : (accessEnds[accessEnds.length - 1] ?? null);

    const firstSub = paidAudit ? subId(paidAudit.message) : null;
    const terminalEnd = lastAccessEnd ?? firstAccessEnd;
    const relevantEnd = terminalEnd == null
      ? null
      : deletions.find((event) => time(event.createdAt) === terminalEnd) ?? null;
    const relevantCancel = [...cancelRequests].reverse().find((event) => {
      const at = time(event.createdAt);
      return at != null && firstPaid != null && at >= firstPaid && (terminalEnd == null || at <= terminalEnd)
        && (firstSub == null || subId(event.message) === firstSub);
    }) ?? null;
    const failures = events.filter((event) => event.type === 'stripe_payment_failed');
    const failureBeforeEnd = lastAccessEnd == null ? null : [...failures].reverse().find((event) => {
      const at = time(event.createdAt);
      return at != null && at <= lastAccessEnd && at >= lastAccessEnd - 35 * DAY_MS;
    }) ?? null;

    // Churn kind describes a loss that STILL STANDS. A customer who lapsed and
    // came back has no churn kind — they are a current subscriber who once had
    // an interruption, and the interruption columns are where that shows.
    let churnKind: ChurnKind | null = null;
    if (lastAccessEnd != null) {
      if (relevantCancel) churnKind = 'voluntary';
      else if (failureBeforeEnd) churnKind = 'payment_failure';
      else churnKind = 'other';
    }
    const reasonEvent = relevantCancel ?? relevantEnd;
    const parsedReason = reasonEvent ? parseCancellationReasonFromMessage(reasonEvent.message) : null;
    const cancellationReason = parsedReason && (parsedReason.feedback || parsedReason.comment)
      ? [parsedReason.feedback ? cancellationFeedbackLabel(parsedReason.feedback) : null, parsedReason.comment].filter(Boolean).join(': ')
      : null;

    const retained: Record<string, boolean | null> = {};
    for (const day of RETENTION_DAYS) {
      retained[String(day)] = retentionAt(day, firstPaid, now, intervals, lastAccessEnd);
    }

    const lastPaidTier = [...syncs].reverse().find((event) => event.tier != null && ENTITLED_TIERS.includes(event.tier))?.tier;
    const lastFailureAt = time(failures.at(-1)?.createdAt ?? null);
    const recoveredAfterFailure = lastFailureAt != null && events.some((event) => {
      const at = time(event.createdAt);
      return at != null && at > lastFailureAt
        && (event.type === 'stripe_invoice_paid' || event.type === 'payment_recovered_email_sent');
    });
    const paymentFailureState = failures.length === 0 ? null
      : churnKind === 'payment_failure' ? 'lost'
      : user.currentStatus === 'past_due' ? 'retrying'
      : recoveredAfterFailure ? 'recovered'
      : null;
    const classificationExplanation = churnKind === 'other'
      ? 'Paid access ended without a matching cancellation-request event or a payment-failure event in the 35 days before loss; the available audit trail cannot attribute a cause.'
      : churnKind === 'voluntary' ? 'Matched to an explicit cancellation-request event before paid access ended.'
      : churnKind === 'payment_failure' ? 'Matched to a failed-payment event before the terminal paid-access loss.'
      : null;

    // Exhaustive CURRENT state for the ever-paid population — exactly one bucket
    // each, so the four always sum to the ever-paid count. Being entitled wins
    // over any historical churn, so a resubscriber is Active. A scheduled
    // cancellation is still Active: the access it paid for has not run out.
    const paidCustomerState: PaidCustomerState | null = firstPaid == null ? null
      : currentlyEntitled ? 'active'
      : churnKind === 'voluntary' ? 'voluntarily_churned'
      : churnKind === 'payment_failure' ? 'involuntarily_churned'
      : 'other_unknown';

    const scheduledAccessEnd = currentlyEntitled && user.cancelAtPeriodEnd ? time(user.currentPeriodEnd) : null;

    return [{
      id: user.id,
      email: user.email,
      cohort: user.createdAt.slice(0, 7),
      registeredAt: user.createdAt,
      trialStartedAt: trial ? new Date(trial.at).toISOString() : null,
      firstPaidAt: iso(firstPaid),
      paidAfterTrial: trial != null && firstPaid != null,
      directToPaid: trial == null && firstPaid != null,
      cancellationAt: relevantCancel?.createdAt ?? null,
      firstAccessEndedAt: iso(firstAccessEnd),
      lastAccessEndedAt: iso(lastAccessEnd),
      scheduledAccessEndAt: iso(scheduledAccessEnd),
      currentPeriodEnd: user.currentPeriodEnd,
      currentlyEntitled,
      reactivatedAfterInterruption: currentlyEntitled && firstAccessEnd != null,
      currentStatus: user.currentStatus,
      daysToFirstInterruption: firstPaid != null && firstAccessEnd != null
        ? Math.floor((firstAccessEnd - firstPaid) / DAY_MS)
        : null,
      daysPaidBeforePermanentLoss: firstPaid != null && lastAccessEnd != null
        ? Math.floor((lastAccessEnd - firstPaid) / DAY_MS)
        : null,
      churnKind,
      paidCustomerState,
      tier: (lastPaidTier as PaidTier | undefined) ?? user.currentTier,
      plan: user.currentPriceId,
      cadence: user.cadence,
      cadenceSource: user.cadenceSource,
      foundingRate: user.foundingRate,
      acquisitionSource: user.signupUtmSource,
      cancellationReason,
      failedPaymentAttempts: failures.length,
      paymentFailureState,
      classificationExplanation,
      auditEvents: events,
      cycleInvoices,
      paidInvoices,
      retained,
    }];
  });

  const cohortMap = new Map<string, CohortRow>();
  for (const user of users) {
    let row = cohortMap.get(user.cohort);
    if (!row) {
      row = {
        cohort: user.cohort, registered: 0, trialStarted: 0, becamePaid: 0, trialThenPaid: 0, directToPaid: 0,
        retention: Object.fromEntries(RETENTION_DAYS.map((day) => [String(day), { eligible: 0, retained: 0, rate: null }])),
        churn: { voluntary: 0, paymentFailure: 0, other: 0, stillActive: 0 },
        interrupted: Object.fromEntries([7, 30, 60].map((day) => [String(day), { count: 0, rate: null }])),
        permanentlyLost: Object.fromEntries([7, 30, 60].map((day) => [String(day), { count: 0, rate: null }])),
      };
      cohortMap.set(user.cohort, row);
    }
    row.registered++;
    if (user.trialStartedAt) row.trialStarted++;
    if (user.firstPaidAt) {
      row.becamePaid++;
      if (user.paidAfterTrial) row.trialThenPaid++;
      if (user.directToPaid) row.directToPaid++;
      if (user.paidCustomerState === 'voluntarily_churned') row.churn.voluntary++;
      else if (user.paidCustomerState === 'involuntarily_churned') row.churn.paymentFailure++;
      else if (user.paidCustomerState === 'other_unknown') row.churn.other++;
      else if (user.paidCustomerState === 'active') row.churn.stillActive++;
      for (const day of RETENTION_DAYS) {
        const value = user.retained[String(day)];
        if (value != null) {
          row.retention[String(day)].eligible++;
          if (value) row.retention[String(day)].retained++;
        }
      }
      for (const day of [7, 30, 60]) {
        if (user.daysToFirstInterruption != null && user.daysToFirstInterruption <= day) {
          row.interrupted[String(day)].count++;
        }
        if (user.daysPaidBeforePermanentLoss != null && user.daysPaidBeforePermanentLoss <= day) {
          row.permanentlyLost[String(day)].count++;
        }
      }
    }
  }
  const cohorts = [...cohortMap.values()].sort((a, b) => b.cohort.localeCompare(a.cohort));
  for (const row of cohorts) {
    for (const day of RETENTION_DAYS) {
      row.retention[String(day)].rate = rate(row.retention[String(day)].retained, row.retention[String(day)].eligible);
    }
    for (const day of [7, 30, 60]) {
      row.interrupted[String(day)].rate = rate(row.interrupted[String(day)].count, row.becamePaid);
      row.permanentlyLost[String(day)].rate = rate(row.permanentlyLost[String(day)].count, row.becamePaid);
    }
  }
  const summaryRetention = Object.fromEntries(RETENTION_DAYS.map((day) => {
    const eligible = cohorts.reduce((sum, row) => sum + row.retention[String(day)].eligible, 0);
    const retained = cohorts.reduce((sum, row) => sum + row.retention[String(day)].retained, 0);
    return [String(day), { eligible, retained, rate: rate(retained, eligible) }];
  }));

  const registrations = users.length;
  const trialStarts = users.filter((user) => user.trialStartedAt).length;
  const becamePaid = users.filter((user) => user.firstPaidAt).length;
  const trialThenPaid = users.filter((user) => user.paidAfterTrial).length;
  const directToPaid = users.filter((user) => user.directToPaid).length;
  const paidCustomerStates: Record<PaidCustomerState, number> = {
    active: users.filter((user) => user.paidCustomerState === 'active').length,
    voluntarily_churned: users.filter((user) => user.paidCustomerState === 'voluntarily_churned').length,
    involuntarily_churned: users.filter((user) => user.paidCustomerState === 'involuntarily_churned').length,
    other_unknown: users.filter((user) => user.paidCustomerState === 'other_unknown').length,
  };
  const reconciledPaidCustomers = Object.values(paidCustomerStates).reduce((sum, count) => sum + count, 0);
  if (reconciledPaidCustomers !== becamePaid) {
    throw new Error(`Paid-customer state invariant failed: ${reconciledPaidCustomers} states for ${becamePaid} ever-paid users`);
  }
  const paidUsers = users.filter((user) => user.firstPaidAt != null);
  return {
    generatedAt: new Date(now).toISOString(), cohorts, users,
    summary: {
      registrations, trialStarts, becamePaid, trialThenPaid, directToPaid,
      registrationToPaid: rate(becamePaid, registrations),
      // The numerator is trial starters who went on to pay — NOT everyone who
      // ever paid. Mixing direct-to-paid customers in here is what let this
      // figure print "150% of trials".
      trialToPaid: rate(trialThenPaid, trialStarts),
      retention: summaryRetention,
      voluntaryChurn: paidCustomerStates.voluntarily_churned,
      paymentFailureChurn: paidCustomerStates.involuntarily_churned,
      failedPaymentCustomers: paidUsers.filter((user) => user.failedPaymentAttempts > 0).length,
      failedPaymentAttempts: paidUsers.reduce((sum, user) => sum + user.failedPaymentAttempts, 0),
      paymentRecovered: paidUsers.filter((user) => user.paymentFailureState === 'recovered').length,
      paymentRetrying: paidUsers.filter((user) => user.paymentFailureState === 'retrying').length,
      paidCustomerStates,
      neverPaidFailedPaymentCustomers: users.filter((user) => !user.firstPaidAt && user.failedPaymentAttempts > 0).length,
      neverPaidFailedPaymentEvents: users.filter((user) => !user.firstPaidAt).reduce((sum, user) => sum + user.failedPaymentAttempts, 0),
      reactivated: paidUsers.filter((user) => user.reactivatedAfterInterruption).length,
    },
    limitations: [
      'Retention reads the append-only Stripe audit history. Subscription activity from before those audit events existed cannot be reconstructed, so a customer whose whole life predates them can be invisible.',
      'First payment is read from the earliest paid invoice where one exists. The legacy users.first_payment_at column was backfilled from updated_at and reads later than reality for anyone who paid before that migration, so it is only used when no invoice or audit row is available.',
      'Paid access means an entitled tier on the subscription. A scheduled cancellation keeps access until Stripe deletes the subscription, and is never counted as churn before then.',
      'Plan is the current Stripe price when available; historical price changes appear only as tier changes in sync events.',
    ],
  };
}
