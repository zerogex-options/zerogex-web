import { cancellationFeedbackLabel, parseCancellationReasonFromMessage } from './cancellationReason.ts';
import { parseSyncTierStrict, type PaidTier } from './subscriptionFlow.ts';

const DAY_MS = 86_400_000;
export const RETENTION_DAYS = [30, 60, 90] as const;

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
  cadence: 'monthly' | 'annual' | null;
};

export type CohortAuditInput = {
  userId: string;
  type: string;
  message: string;
  createdAt: string;
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
  cancellationAt: string | null;
  accessEndedAt: string | null;
  currentStatus: string | null;
  daysPaidBeforeChurn: number | null;
  churnKind: ChurnKind | null;
  paidCustomerState: PaidCustomerState | null;
  tier: string;
  plan: string | null;
  cadence: 'monthly' | 'annual' | null;
  acquisitionSource: string | null;
  cancellationReason: string | null;
  failedPaymentAttempts: number;
  paymentFailureState: 'recovered' | 'retrying' | 'lost' | null;
  classificationExplanation: string | null;
  auditEvents: CohortAuditInput[];
  successfulPayments: number;
  eligiblePaymentNumber: number;
  retained: Record<string, boolean | null>;
};

export type CohortRow = {
  cohort: string;
  registered: number;
  trialStarted: number;
  becamePaid: number;
  retention: Record<string, { eligible: number; retained: number; rate: number | null }>;
  churn: { voluntary: number; paymentFailure: number; other: number; stillActive: number };
  earlyChurn: Record<string, { lost: number; rate: number | null }>;
  payments: Record<string, { successful: number; eligible: number; rate: number | null }>;
};

export type CohortReport = {
  generatedAt: string;
  cohorts: CohortRow[];
  users: CohortUser[];
  summary: {
    registrations: number;
    trialStarts: number;
    becamePaid: number;
    registrationToPaid: number | null;
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
  };
  limitations: string[];
};

type Interval = { start: number; end: number | null };
type ParsedSync = { at: number; subId: string; status: string | null; tier: string | null; cancelAtPeriodEnd: boolean };

function time(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function subId(message: string): string | null {
  return message.match(/\bsub_[A-Za-z0-9]+\b/)?.[0] ?? null;
}

function syncStatus(message: string): string | null {
  return message.match(/\bstatus=([a-z_]+)/)?.[1] ?? null;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function inIntervals(at: number, intervals: Interval[]): boolean {
  return intervals.some((interval) => interval.start <= at && (interval.end == null || at < interval.end));
}

function buildIntervals(firstPaid: number, syncs: ParsedSync[], deletions: CohortAuditInput[], cancellations: CohortAuditInput[]): Interval[] {
  const events: Array<{ at: number; entitled: boolean }> = [];
  for (const sync of syncs) {
    if (sync.at < firstPaid || sync.tier == null) continue;
    events.push({ at: sync.at, entitled: (sync.tier === 'basic' || sync.tier === 'pro') && !sync.cancelAtPeriodEnd });
  }
  for (const deletion of deletions) {
    const at = time(deletion.createdAt);
    if (at != null && at >= firstPaid) events.push({ at, entitled: false });
  }
  // Economic retention ends when the customer elects not to renew, even though
  // billing-period entitlement can continue until Stripe deletes the sub.
  for (const cancellation of cancellations) {
    const at = time(cancellation.createdAt);
    if (at != null && at >= firstPaid) events.push({ at, entitled: false });
  }
  events.sort((a, b) => a.at - b.at || Number(b.entitled) - Number(a.entitled));

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

export function buildCohortReport(
  sourceUsers: CohortUserInput[],
  sourceEvents: CohortAuditInput[],
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
          : [{ at, subId: subscription, status: syncStatus(event.message), tier: parseSyncTierStrict(event.message), cancelAtPeriodEnd: /\bcancelAtPeriodEnd=true\b/.test(event.message) }];
      });
    const trial = syncs.find((event) => event.status === 'trialing');
    const paidAudit = events.find((event) => event.type === 'stripe_first_payment');
    const firstPaid = time(user.firstPaymentAt) ?? time(paidAudit?.createdAt ?? null);
    const deletions = events.filter((event) => event.type === 'stripe_subscription_deleted');
    const cancelRequests = events.filter((event) => event.type === 'stripe_cancellation_requested');
    const intervals = firstPaid == null ? [] : buildIntervals(firstPaid, syncs, deletions, cancelRequests);
    // A paid -> public sync with Stripe still `active` is the product's pause
    // state, not churn. It closes entitlement for point-in-time retention, but
    // only a non-active downgrade or terminal deletion is a paid loss.
    const lossTimes = [
      ...syncs.filter((event) => event.at >= (firstPaid ?? Infinity) && event.tier === 'public' && event.status !== 'active').map((event) => event.at),
      ...deletions.flatMap((event) => time(event.createdAt) == null ? [] : [time(event.createdAt) as number]),
    ].sort((a, b) => a - b);
    const firstEnd = lossTimes[0] ?? null;
    const firstSub = paidAudit ? subId(paidAudit.message) : null;
    const relevantEnd = firstEnd == null
      ? null
      : deletions.find((event) => time(event.createdAt) === firstEnd) ?? null;
    const relevantCancel = [...cancelRequests].reverse().find((event) => {
      const at = time(event.createdAt);
      return at != null && firstPaid != null && at >= firstPaid && (firstEnd == null || at <= firstEnd)
        && (firstSub == null || subId(event.message) === firstSub);
    }) ?? null;
    const failures = events.filter((event) => event.type === 'stripe_payment_failed');
    const failureBeforeEnd = firstEnd == null ? null : [...failures].reverse().find((event) => {
      const at = time(event.createdAt);
      return at != null && at <= firstEnd && at >= firstEnd - 35 * DAY_MS;
    }) ?? null;
    let churnKind: ChurnKind | null = null;
    if (firstEnd != null) {
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
      const milestone = firstPaid == null ? null : firstPaid + day * DAY_MS;
      retained[String(day)] = milestone == null || now < milestone ? null : inIntervals(milestone, intervals);
    }
    const lastPaidTier = [...syncs].reverse().find((event) => event.tier === 'basic' || event.tier === 'pro')?.tier;
    const paidInvoices = events.filter((event) => event.type === 'stripe_invoice_paid' && !/\bamount=0\b/.test(event.message));
    const successfulPayments = Math.max(firstPaid == null ? 0 : 1, paidInvoices.length);
    let eligiblePaymentNumber = firstPaid == null ? 0 : 1;
    for (let index = 0; index < Math.min(paidInvoices.length, 3); index++) {
      const periodEnd = Number(paidInvoices[index].message.match(/\bperiod_end=(\d+)/)?.[1]);
      if (Number.isFinite(periodEnd) && periodEnd * 1000 <= now) eligiblePaymentNumber = Math.max(eligiblePaymentNumber, index + 2);
    }
    const lastFailureAt = time(failures.at(-1)?.createdAt ?? null);
    const recoveredAfterFailure = lastFailureAt != null && events.some((event) =>
      time(event.createdAt) != null && (time(event.createdAt) as number) > lastFailureAt
      && (event.type === 'stripe_invoice_paid' || event.type === 'payment_recovered_email_sent'));
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
    // Exhaustive CURRENT economic state for the ever-paid population. Current
    // paid state wins over historical churn so a resubscriber returns to Active.
    // Scheduled cancellation affects economic retention above but remains a
    // current Active subscription until its prepaid access actually ends.
    // Everyone else falls into exactly one terminal/unknown bucket; never-paid
    // users intentionally receive null.
    const paidCustomerState: PaidCustomerState | null = firstPaid == null ? null
      // Current subscriber status follows the same paid-tier mirror used by the
      // admin subscriber headcount. A scheduled cancellation remains Active
      // until prepaid access actually ends; cancel intent still ends the
      // separate economic-retention interval above.
      : ['basic', 'pro', 'starter', 'elite'].includes(user.currentTier)
          && ['active', 'trialing', 'past_due'].includes(user.currentStatus ?? '') ? 'active'
      : churnKind === 'voluntary' ? 'voluntarily_churned'
      : churnKind === 'payment_failure' ? 'involuntarily_churned'
      : 'other_unknown';
    return [{
      id: user.id,
      email: user.email,
      cohort: user.createdAt.slice(0, 7),
      registeredAt: user.createdAt,
      trialStartedAt: trial ? new Date(trial.at).toISOString() : null,
      firstPaidAt: firstPaid == null ? null : new Date(firstPaid).toISOString(),
      cancellationAt: relevantCancel?.createdAt ?? null,
      accessEndedAt: firstEnd == null
        ? (user.cancelAtPeriodEnd ? user.currentPeriodEnd : null)
        : new Date(firstEnd).toISOString(),
      currentStatus: user.currentStatus,
      daysPaidBeforeChurn: firstPaid != null && firstEnd != null ? Math.floor((firstEnd - firstPaid) / DAY_MS) : null,
      churnKind,
      paidCustomerState,
      tier: (lastPaidTier as PaidTier | undefined) ?? user.currentTier,
      plan: user.currentPriceId,
      cadence: user.cadence,
      acquisitionSource: user.signupUtmSource,
      cancellationReason,
      failedPaymentAttempts: failures.length,
      paymentFailureState,
      classificationExplanation,
      auditEvents: events,
      successfulPayments,
      eligiblePaymentNumber,
      retained,
    }];
  });

  const cohortMap = new Map<string, CohortRow>();
  for (const user of users) {
    let row = cohortMap.get(user.cohort);
    if (!row) {
      row = {
        cohort: user.cohort, registered: 0, trialStarted: 0, becamePaid: 0,
        retention: Object.fromEntries(RETENTION_DAYS.map((day) => [String(day), { eligible: 0, retained: 0, rate: null }])),
        churn: { voluntary: 0, paymentFailure: 0, other: 0, stillActive: 0 },
        earlyChurn: Object.fromEntries([7, 30, 60].map((day) => [String(day), { lost: 0, rate: null }])),
        payments: Object.fromEntries([1, 2, 3, 4].map((number) => [String(number), { successful: 0, eligible: 0, rate: null }])),
      };
      cohortMap.set(user.cohort, row);
    }
    row.registered++;
    if (user.trialStartedAt) row.trialStarted++;
    if (user.firstPaidAt) {
      row.becamePaid++;
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
        if (user.daysPaidBeforeChurn != null && user.daysPaidBeforeChurn <= day) row.earlyChurn[String(day)].lost++;
      }
      for (const number of [1, 2, 3, 4]) {
        if (user.successfulPayments >= number) row.payments[String(number)].successful++;
        if (user.eligiblePaymentNumber >= number) row.payments[String(number)].eligible++;
      }
    }
  }
  const cohorts = [...cohortMap.values()].sort((a, b) => b.cohort.localeCompare(a.cohort));
  for (const row of cohorts) {
    for (const day of RETENTION_DAYS) row.retention[String(day)].rate = rate(row.retention[String(day)].retained, row.retention[String(day)].eligible);
    for (const day of [7, 30, 60]) row.earlyChurn[String(day)].rate = rate(row.earlyChurn[String(day)].lost, row.becamePaid);
    for (const number of [1, 2, 3, 4]) row.payments[String(number)].rate = rate(row.payments[String(number)].successful, row.payments[String(number)].eligible);
  }
  const summaryRetention = Object.fromEntries(RETENTION_DAYS.map((day) => {
    const eligible = cohorts.reduce((sum, row) => sum + row.retention[String(day)].eligible, 0);
    const retained = cohorts.reduce((sum, row) => sum + row.retention[String(day)].retained, 0);
    return [String(day), { eligible, retained, rate: rate(retained, eligible) }];
  }));
  const registrations = users.length;
  const trialStarts = users.filter((user) => user.trialStartedAt).length;
  const becamePaid = users.filter((user) => user.firstPaidAt).length;
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
      registrations, trialStarts, becamePaid,
      registrationToPaid: rate(becamePaid, registrations),
      trialToPaid: rate(becamePaid, trialStarts),
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
    },
    limitations: [
      'Exact retention depends on the append-only Stripe audit history. Subscription activity before those audit events existed cannot be reconstructed perfectly.',
      'Legacy first_payment_at values were backfilled from users.updated_at and may not be the exact first-payment instant.',
      'Plan is the current Stripe price when available; historical price changes are represented only as tier changes in sync events.',
    ],
  };
}
