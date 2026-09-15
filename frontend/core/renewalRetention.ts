import type { AmountTable, BillableTier } from './pricing.ts';
import type { CohortUser, PaidInvoice } from './cohortRetention.ts';

// DOES THE SECOND PAYMENT HAPPEN? — the metric the business actually turns on,
// and the one a retention dashboard is most likely to fake.
//
// A renewal is money moving a second time. It is evidenced by a
// `subscription_cycle` invoice and by nothing else. It is NOT inferred from
// access having lasted about a month: a customer on a 7-day trial who cancels on
// day 25 still had ~30 days of access and never renewed anything, and a
// customer who upgraded mid-period generates a `subscription_update` invoice
// that is real money and is not a renewal either.
//
// THREE STATES, and keeping them apart is the whole job:
//
//   APPROACHING   The period is still running. There is no outcome yet, so
//                 these customers are not in any denominator. A cancellation
//                 already scheduled inside this group is the early-warning
//                 number — it is what the renewal rate will look like next
//                 month, reported now.
//   ELIGIBLE      The period ended, so an outcome exists. Renewed, or not —
//                 and if not, for a reason worth separating.
//   UNOBSERVABLE  The period ended before the invoice trail began, or no
//                 billing period is on record at all. We cannot tell, so they
//                 are counted and reported as unknown rather than quietly
//                 dropped into "did not renew". See `observableFrom`.
//
// The unobservable bucket is not a rounding error today: `stripe_invoice_paid`
// audit rows only start when that event type shipped, so every renewal due
// before then is invisible unless scripts/backfill-stripe-invoices.mts has
// imported the real invoice history from Stripe.

const DAY_MS = 86_400_000;

/** How far a decline can sit from the due date and still explain a non-renewal. */
const FAILURE_WINDOW_BEFORE_MS = 3 * DAY_MS;
const FAILURE_WINDOW_AFTER_MS = 35 * DAY_MS;

/** Renewals reported in the ladder: payment #2, #3 and #4. */
export const RENEWAL_STEPS = [1, 2, 3] as const;

export type RenewalOutcome =
  | 'renewed'
  | 'not_renewed_voluntary'
  | 'not_renewed_failed_payment'
  | 'not_renewed_unknown';

export type RenewalStep = {
  /** 1 = first renewal, which is payment #2. */
  renewalNumber: number;
  paymentNumber: number;
  /** Customers whose outcome is known: the period ended and we could see it. */
  eligible: number;
  renewed: number;
  notRenewedVoluntary: number;
  notRenewedFailedPayment: number;
  notRenewedUnknown: number;
  /** renewed / eligible. */
  rate: number | null;
  /** Period still running — no outcome yet, so outside `eligible`. */
  approaching: number;
  /** Of those approaching, how many have already scheduled a cancellation. */
  approachingScheduledCancel: number;
  /** Period ended, but before the invoice trail could record the answer. */
  unobservable: number;
};

export type RenewalCohortRow = {
  cohort: string;
  firstTimePayers: number;
  eligible: number;
  renewed: number;
  approachingScheduledCancel: number;
  notRenewedFailedPayment: number;
  rate: number | null;
};

export type AtRiskCustomer = {
  id: string;
  email: string;
  cadence: 'monthly' | 'annual' | null;
  tier: string;
  /** Monthly-normalized USD, priced exactly as the MRR snapshot prices it. */
  monthlyValue: number;
  accessEndsAt: string | null;
  daysRemaining: number | null;
};

export type AtRiskPool = {
  customers: AtRiskCustomer[];
  total: number;
  monthly: number;
  annual: number;
  cadenceUnknown: number;
  /** MRR that stops when the scheduled monthly cancellations take effect. */
  monthlyMrrAtRisk: number;
  /** Annual contract value leaving with the scheduled annual cancellations. */
  annualRevenueAtRisk: number;
  /** Every scheduled cancellation, expressed as monthly-normalized revenue. */
  totalMonthlyValueAtRisk: number;
  endingWithin7Days: number;
  endingWithin30Days: number;
  endingAfter30Days: number;
  /** Scheduled cancellations whose price id could not be mapped to a SKU. */
  unpriced: number;
};

export type RenewalReport = {
  /** Earliest invoice we can see. Null when no invoice history exists at all. */
  observableFrom: string | null;
  /** Monthly subscribers only — a renewal ladder is meaningless across cadences. */
  steps: RenewalStep[];
  cohorts: RenewalCohortRow[];
  /** Ever-paid monthly customers the ladder could say nothing about. */
  monthlyCustomers: number;
  atRisk: AtRiskPool;
  limitations: string[];
};

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The earliest paid invoice anywhere in the dataset. Everything before it is
 * unobservable: the absence of a renewal invoice back there is the absence of a
 * record, not evidence that the customer failed to renew.
 */
export function invoiceObservabilityStart(users: ReadonlyArray<CohortUser>): string | null {
  let earliest: number | null = null;
  for (const user of users) {
    for (const invoice of user.paidInvoices) {
      const at = time(invoice.paidAt);
      if (at != null && (earliest == null || at < earliest)) earliest = at;
    }
  }
  return earliest == null ? null : new Date(earliest).toISOString();
}

type StepState =
  | { kind: 'approaching'; scheduledCancel: boolean }
  | { kind: 'eligible'; outcome: RenewalOutcome }
  | { kind: 'unobservable' };

/**
 * The invoices belonging to the subscription that took the first payment.
 *
 * A customer who churned and came back months later has a SECOND
 * `subscription_create` invoice, and reading the invoice list straight through
 * would count that as the first subscription renewing — turning a customer who
 * cancelled in month two into a successful renewal. Renewal is a question about
 * one subscription continuing, so the ladder follows one subscription. The
 * comeback is real and is reported, as a reactivation, in the cohort tables.
 */
function subscriptionRun(user: CohortUser): PaidInvoice[] {
  const invoices = user.cycleInvoices;
  const firstSub = invoices[0]?.subId;
  // A message too old to carry a subscription id leaves nothing to split on;
  // the billing-reason check below still keeps a second `create` out.
  if (firstSub == null) return invoices;
  return invoices.filter((invoice) => invoice.subId == null || invoice.subId === firstSub);
}

/**
 * When is payment #(renewalNumber + 1) due for this customer, and can we see the
 * answer?
 *
 * The due date is the end of the period the PREVIOUS payment bought. That comes
 * from the invoice itself where we have it; for a customer still inside their
 * first period it can also come from the live `current_period_end` on the users
 * row, which is the same value Stripe last told us.
 */
function dueAtFor(run: ReadonlyArray<PaidInvoice>, user: CohortUser, renewalNumber: number): number | null {
  const fromInvoice = time(run[renewalNumber - 1]?.periodEnd);
  if (fromInvoice != null) return fromInvoice;
  // Only the period in flight can borrow the live `current_period_end` off the
  // users row, and only when the payments on record are exactly the ones that
  // put the customer inside it.
  const paymentsSoFar = Math.max(run.length, user.firstPaidAt ? 1 : 0);
  if (paymentsSoFar === renewalNumber) return time(user.currentPeriodEnd);
  return null;
}

function classifyStep(
  user: CohortUser,
  renewalNumber: number,
  now: number,
  observableFrom: number | null,
): StepState {
  const run = subscriptionRun(user);
  const dueAt = dueAtFor(run, user, renewalNumber);
  if (dueAt == null) return { kind: 'unobservable' };

  if (dueAt > now) {
    // The period has not ended on the calendar — but if paid access is already
    // gone for good, the outcome is settled and the answer is no. Leaving these
    // customers in "approaching" would park every fast churner outside the
    // denominator, the same survivorship trap the retention milestones had.
    const lostFor = time(user.lastAccessEndedAt);
    if (lostFor != null && lostFor <= now) {
      if (observableFrom == null) return { kind: 'unobservable' };
      return {
        kind: 'eligible',
        outcome: user.churnKind === 'payment_failure' ? 'not_renewed_failed_payment'
          : user.churnKind === 'voluntary' ? 'not_renewed_voluntary'
          : 'not_renewed_unknown',
      };
    }
    // Still running. The only thing worth saying is whether they have already
    // told us they are going.
    const scheduledEnd = time(user.scheduledAccessEndAt);
    return { kind: 'approaching', scheduledCancel: scheduledEnd != null && scheduledEnd <= dueAt + DAY_MS };
  }

  // The period ended. Could we have seen a renewal invoice if one existed?
  if (observableFrom == null || dueAt < observableFrom) return { kind: 'unobservable' };

  // Only a cycle invoice renews. A `subscription_create` this far down the list
  // is a new subscription, not a continuation of this one.
  const renewalInvoice = run[renewalNumber];
  if (renewalInvoice && renewalInvoice.billingReason !== 'subscription_create') {
    return { kind: 'eligible', outcome: 'renewed' };
  }

  // No renewal invoice. Why not?
  const failedNearDue = user.auditEvents.some((event) => {
    if (event.type !== 'stripe_payment_failed') return false;
    const at = time(event.createdAt);
    return at != null && at >= dueAt - FAILURE_WINDOW_BEFORE_MS && at <= dueAt + FAILURE_WINDOW_AFTER_MS;
  });
  if (failedNearDue) return { kind: 'eligible', outcome: 'not_renewed_failed_payment' };

  const cancelledBeforeDue = user.auditEvents.some((event) => {
    if (event.type !== 'stripe_cancellation_requested') return false;
    const at = time(event.createdAt);
    return at != null && at <= dueAt;
  });
  if (cancelledBeforeDue) return { kind: 'eligible', outcome: 'not_renewed_voluntary' };

  return { kind: 'eligible', outcome: 'not_renewed_unknown' };
}

function emptyStep(renewalNumber: number): RenewalStep {
  return {
    renewalNumber,
    paymentNumber: renewalNumber + 1,
    eligible: 0,
    renewed: 0,
    notRenewedVoluntary: 0,
    notRenewedFailedPayment: 0,
    notRenewedUnknown: 0,
    rate: null,
    approaching: 0,
    approachingScheduledCancel: 0,
    unobservable: 0,
  };
}

function applyStep(step: RenewalStep, state: StepState): void {
  if (state.kind === 'unobservable') {
    step.unobservable++;
    return;
  }
  if (state.kind === 'approaching') {
    step.approaching++;
    if (state.scheduledCancel) step.approachingScheduledCancel++;
    return;
  }
  step.eligible++;
  if (state.outcome === 'renewed') step.renewed++;
  else if (state.outcome === 'not_renewed_voluntary') step.notRenewedVoluntary++;
  else if (state.outcome === 'not_renewed_failed_payment') step.notRenewedFailedPayment++;
  else step.notRenewedUnknown++;
}

/**
 * Price one scheduled cancellation exactly the way the MRR snapshot prices a
 * subscriber: map the SKU, take the founding rate where it applies, and let an
 * unmappable price contribute $0 rather than a guess.
 */
function monthlyValueOf(user: CohortUser, amounts: AmountTable): number {
  const tier = user.tier as BillableTier;
  if (tier !== 'basic' && tier !== 'pro') return 0;
  if (user.cadence == null) return 0;
  return amounts[tier][user.cadence][user.foundingRate ? 'founding' : 'list'];
}

function buildAtRiskPool(
  users: ReadonlyArray<CohortUser>,
  amounts: AmountTable,
  now: number,
): AtRiskPool {
  // A scheduled cancellation is a customer who is STILL PAYING. They belong in
  // the active headcount and in this pool at the same time; counting them as
  // churned here would double-count them the day their access actually ends.
  const scheduled = users.filter((user) => user.paidCustomerState === 'active' && user.scheduledAccessEndAt != null);
  const customers: AtRiskCustomer[] = scheduled.map((user) => {
    const endsAt = time(user.scheduledAccessEndAt);
    return {
      id: user.id,
      email: user.email,
      cadence: user.cadence,
      tier: user.tier,
      monthlyValue: monthlyValueOf(user, amounts),
      accessEndsAt: user.scheduledAccessEndAt,
      daysRemaining: endsAt == null ? null : Math.max(0, Math.ceil((endsAt - now) / DAY_MS)),
    };
  }).sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity));

  const monthly = customers.filter((customer) => customer.cadence === 'monthly');
  const annual = customers.filter((customer) => customer.cadence === 'annual');
  const within = (days: number) => customers.filter((c) => c.daysRemaining != null && c.daysRemaining <= days).length;

  return {
    customers,
    total: customers.length,
    monthly: monthly.length,
    annual: annual.length,
    cadenceUnknown: customers.filter((customer) => customer.cadence == null).length,
    monthlyMrrAtRisk: monthly.reduce((sum, customer) => sum + customer.monthlyValue, 0),
    // AmountTable is monthly-normalized, so an annual subscriber's contract is
    // twelve of those — the cash that does not come back next renewal.
    annualRevenueAtRisk: annual.reduce((sum, customer) => sum + customer.monthlyValue * 12, 0),
    totalMonthlyValueAtRisk: customers.reduce((sum, customer) => sum + customer.monthlyValue, 0),
    endingWithin7Days: within(7),
    endingWithin30Days: within(30),
    endingAfter30Days: customers.filter((c) => c.daysRemaining != null && c.daysRemaining > 30).length,
    unpriced: customers.filter((customer) => customer.monthlyValue === 0).length,
  };
}

export function buildRenewalReport(
  users: ReadonlyArray<CohortUser>,
  amounts: AmountTable,
  nowIso = new Date().toISOString(),
): RenewalReport {
  const now = time(nowIso) ?? Date.now();
  const observableFromIso = invoiceObservabilityStart(users);
  const observableFrom = time(observableFromIso);

  // Monthly only. An annual subscriber's first renewal is a year out, so folding
  // them in would mix a 30-day question with a 365-day one and report the
  // average of two different businesses.
  const monthlyPayers = users.filter((user) => user.firstPaidAt != null && user.cadence === 'monthly');

  const steps = RENEWAL_STEPS.map((renewalNumber) => {
    const step = emptyStep(renewalNumber);
    for (const user of monthlyPayers) {
      // A customer cannot be up for renewal #2 before renewal #1 resolved.
      if (renewalNumber > 1) {
        const previous = classifyStep(user, renewalNumber - 1, now, observableFrom);
        if (previous.kind !== 'eligible' || previous.outcome !== 'renewed') continue;
      }
      applyStep(step, classifyStep(user, renewalNumber, now, observableFrom));
    }
    step.rate = rate(step.renewed, step.eligible);
    return step;
  });

  // First renewal, by the month the customer registered in — the view that says
  // whether the product is getting better or worse at holding a new customer.
  const cohortMap = new Map<string, RenewalCohortRow>();
  for (const user of monthlyPayers) {
    let row = cohortMap.get(user.cohort);
    if (!row) {
      row = { cohort: user.cohort, firstTimePayers: 0, eligible: 0, renewed: 0, approachingScheduledCancel: 0, notRenewedFailedPayment: 0, rate: null };
      cohortMap.set(user.cohort, row);
    }
    row.firstTimePayers++;
    const state = classifyStep(user, 1, now, observableFrom);
    if (state.kind === 'approaching') {
      if (state.scheduledCancel) row.approachingScheduledCancel++;
    } else if (state.kind === 'eligible') {
      row.eligible++;
      if (state.outcome === 'renewed') row.renewed++;
      else if (state.outcome === 'not_renewed_failed_payment') row.notRenewedFailedPayment++;
    }
  }
  const cohorts = [...cohortMap.values()]
    .map((row) => ({ ...row, rate: rate(row.renewed, row.eligible) }))
    .sort((a, b) => b.cohort.localeCompare(a.cohort));

  const limitations: string[] = [];
  if (observableFromIso == null) {
    limitations.push('No successful-invoice records exist yet, so no renewal can be confirmed. Run scripts/backfill-stripe-invoices.mts to import the real invoice history from Stripe.');
  } else {
    limitations.push(`Renewal outcomes are only visible from ${observableFromIso.slice(0, 10)}, the earliest invoice on record. A renewal that fell due before that is reported as unobservable, never as a failure.`);
  }
  const unobservable = steps[0]?.unobservable ?? 0;
  if (unobservable > 0) {
    limitations.push(`${unobservable} monthly customer${unobservable === 1 ? '' : 's'} had a first renewal fall due outside the invoice record, or have no billing period on file. They are excluded from the rate rather than counted as a loss.`);
  }
  limitations.push('A renewal means a subscription_cycle invoice actually cleared. Mid-period proration invoices from a plan change are excluded, and access lasting roughly a month is never treated as evidence of one.');

  return {
    observableFrom: observableFromIso,
    steps,
    cohorts,
    monthlyCustomers: monthlyPayers.length,
    atRisk: buildAtRiskPool(users, amounts, now),
    limitations,
  };
}
