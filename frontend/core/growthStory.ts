// THE STORY — one pass over the cohort report that answers, in order, the four
// questions an operator actually opens this page with:
//
//   1. How many people pay me right now, and is that going up or down?
//   2. Of the people who showed up, how many became customers?
//   3. Where is the biggest leak?
//   4. When I lose someone, why?
//
// Pure and DB-free so the arithmetic behind every headline number is unit
// tested (tests/growthStory.test.ts) rather than living inside a chart.
//
// TWO CLOCKS, deliberately kept apart, because conflating them is how a growth
// dashboard starts lying:
//
//   * The FUNNEL is cohort-timed. It follows the people who REGISTERED inside
//     the window, all the way down. Its conversion rates are honest but its
//     bottom stages are necessarily immature — someone who registered
//     yesterday has not had time to pay.
//   * The LEDGER is event-timed. It counts first payments and access endings
//     that HAPPENED inside the window, whenever those people registered. That
//     is the number that reconciles with a bank statement.
//
// A single "conversions this month" figure is one or the other, never both, and
// the two disagree by design.

import type { CohortReport, CohortUser, PaidCustomerState } from './cohortRetention.ts';

const DAY_MS = 86_400_000;

/** Windows the page offers. `null` means all of recorded history. */
export type WindowDays = 30 | 90 | 180 | 365 | null;

export type FunnelStage = {
  key: 'registered' | 'trial' | 'paid' | 'retained';
  label: string;
  /** What the number counts, in the operator's words. */
  caption: string;
  value: number;
  /** Share of the PREVIOUS stage — the conversion rate that stage owns. */
  ofPrevious: number | null;
  /** Share of the top of the funnel, for the bar length. */
  ofTop: number | null;
  /** People who reached the previous stage and not this one. */
  droppedFromPrevious: number | null;
  /**
   * Stages whose outcome is not yet knowable for everyone above them carry the
   * denominator that IS knowable. Null where every member of the previous
   * stage has had time to arrive.
   */
  eligible: number | null;
};

export type LossBreakdown = {
  voluntary: number;
  nonpayment: number;
  unknown: number;
  total: number;
};

export type SurvivalPoint = {
  days: number;
  eligible: number;
  retained: number;
  rate: number | null;
};

export type EarlyLossPoint = {
  withinDays: number;
  lost: number;
  rate: number | null;
};

export type SourceRow = {
  source: string;
  label: string;
  registered: number;
  trials: number;
  paid: number;
  payingNow: number;
  trialRate: number | null;
  paidRate: number | null;
};

export type GrowthStory = {
  windowDays: number | null;
  /** Inclusive ISO instant the window opens at; null for all time. */
  since: string | null;
  /** ── Right now ─────────────────────────────────────────────── */
  payingNow: number;
  /** Active subscribers who have already asked to leave at period end. */
  scheduledToLeave: number;
  /** ── Ledger (event-timed, inside the window) ───────────────── */
  newPaid: number;
  lost: number;
  net: number;
  /** ── Funnel (cohort-timed, registered inside the window) ───── */
  funnel: FunnelStage[];
  /** The stage that loses the most people, for the callout. */
  biggestLeak: FunnelStage | null;
  /** ── Retention of everyone old enough to measure ───────────── */
  survival: SurvivalPoint[];
  /** ── Why we lose them ──────────────────────────────────────── */
  losses: LossBreakdown;
  earlyLoss: EarlyLossPoint[];
  recovery: { affected: number; recovered: number; retrying: number; lost: number };
  /** ── Where they come from ──────────────────────────────────── */
  sources: SourceRow[];
  /** ── The sentences the page leads with ─────────────────────── */
  headline: string;
  subhead: string;
  funnelSentence: string;
  leakSentence: string | null;
};

const ORGANIC = 'Organic / direct';

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function pct(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(value * 100 < 10 ? 1 : 0)}%`;
}

export function windowLabel(windowDays: number | null): string {
  if (windowDays == null) return 'all time';
  if (windowDays === 365) return 'the last 12 months';
  return `the last ${windowDays} days`;
}

/**
 * Source labels are free text from `?utm_source=`, so they arrive in whatever
 * case the link was written in. Fold them, and give the empty case a name
 * rather than a blank row.
 */
function sourceLabel(source: string | null): string {
  const trimmed = (source ?? '').trim();
  if (!trimmed) return ORGANIC;
  const lower = trimmed.toLowerCase();
  if (lower === 'x' || lower === 'twitter') return 'X / Twitter';
  if (lower === 'google') return 'Google';
  return trimmed;
}

export function buildGrowthStory(
  report: CohortReport,
  windowDays: number | null,
  nowIso = new Date().toISOString(),
): GrowthStory {
  const now = time(nowIso) ?? Date.now();
  const since = windowDays == null ? null : now - windowDays * DAY_MS;
  const sinceIso = since == null ? null : new Date(since).toISOString();
  const inWindow = (value: string | null): boolean => {
    if (since == null) return true;
    const at = time(value);
    return at != null && at >= since && at <= now;
  };

  const users = report.users;

  // ── Right now ────────────────────────────────────────────────────────────
  // Current state is a property of the account, not of the window: "how many
  // people pay me" has no date range, and scoping it to one would make a
  // 30-day view claim the business shrank to whoever signed up this month.
  const state = (value: PaidCustomerState) => users.filter((user) => user.paidCustomerState === value).length;
  const payingNow = state('active');
  const scheduledToLeave = users.filter(
    (user) => user.paidCustomerState === 'active' && (time(user.accessEndedAt) ?? 0) > now,
  ).length;

  // ── Ledger: money that started and stopped inside the window ─────────────
  // `accessEndedAt` is also written forward for a scheduled cancellation, so a
  // future date is an intention, not a loss. Only endings that have actually
  // happened count.
  const newPaid = users.filter((user) => inWindow(user.firstPaidAt)).length;
  const endedUsers = users.filter(
    (user) => user.firstPaidAt != null
      && user.accessEndedAt != null
      && (time(user.accessEndedAt) ?? Infinity) <= now
      && inWindow(user.accessEndedAt),
  );
  const lost = endedUsers.length;

  // ── Funnel: the people who registered inside the window ──────────────────
  const cohort = users.filter((user) => inWindow(user.registeredAt));
  const registered = cohort.length;
  const trials = cohort.filter((user) => user.trialStartedAt != null).length;
  const paid = cohort.filter((user) => user.firstPaidAt != null).length;
  // Only payers old enough for the 30-day milestone can answer it, so the last
  // stage reports against them rather than against everyone who paid.
  const retentionEligible = cohort.filter((user) => user.retained['30'] != null).length;
  const retained = cohort.filter((user) => user.retained['30'] === true).length;

  const funnel: FunnelStage[] = [
    {
      key: 'registered',
      label: 'Registered',
      caption: 'created an account',
      value: registered,
      ofPrevious: null,
      ofTop: registered > 0 ? 1 : null,
      droppedFromPrevious: null,
      eligible: null,
    },
    {
      key: 'trial',
      label: 'Started a trial',
      caption: 'entered billing',
      value: trials,
      ofPrevious: rate(trials, registered),
      ofTop: rate(trials, registered),
      droppedFromPrevious: registered - trials,
      eligible: null,
    },
    {
      key: 'paid',
      label: 'Paid',
      caption: 'money actually moved',
      value: paid,
      ofPrevious: rate(paid, trials),
      ofTop: rate(paid, registered),
      droppedFromPrevious: Math.max(0, trials - paid),
      eligible: null,
    },
    {
      key: 'retained',
      label: 'Still paying at 30d',
      caption: 'of those old enough to tell',
      value: retained,
      ofPrevious: rate(retained, retentionEligible),
      ofTop: rate(retained, registered),
      droppedFromPrevious: retentionEligible - retained,
      eligible: retentionEligible,
    },
  ];

  // The leak worth naming is the biggest ABSOLUTE loss among the stages whose
  // drop-off is a real decision rather than an artifact of immaturity — the
  // retention stage already reports against its own eligible denominator, so a
  // young cohort cannot win this by simply not having aged yet.
  const leakCandidates = funnel.filter(
    (stage) => stage.droppedFromPrevious != null && stage.droppedFromPrevious > 0,
  );
  const biggestLeak = leakCandidates.length === 0
    ? null
    : leakCandidates.reduce((worst, stage) =>
      (stage.droppedFromPrevious ?? 0) > (worst.droppedFromPrevious ?? 0) ? stage : worst);

  // ── Retention, over everyone old enough to have reached each milestone ────
  const survival: SurvivalPoint[] = ['30', '60', '90'].map((day) => {
    const summary = report.summary.retention[day];
    return {
      days: Number(day),
      eligible: summary?.eligible ?? 0,
      retained: summary?.retained ?? 0,
      rate: summary?.rate ?? null,
    };
  });

  // ── Why we lose them ─────────────────────────────────────────────────────
  // Scoped to the window's actual departures so a bad month is visible, rather
  // than being averaged into every churn the product has ever had.
  const lossesIn = (predicate: (user: CohortUser) => boolean) => endedUsers.filter(predicate).length;
  const losses: LossBreakdown = {
    voluntary: lossesIn((user) => user.churnKind === 'voluntary'),
    nonpayment: lossesIn((user) => user.churnKind === 'payment_failure'),
    unknown: lossesIn((user) => user.churnKind === 'other' || user.churnKind == null),
    total: lost,
  };

  // Early loss is a property of the paying cohort, not of the calendar: it asks
  // how fast a new customer leaves, so its denominator is everyone in the
  // window's cohort who paid at all.
  const paidCohort = cohort.filter((user) => user.firstPaidAt != null);
  const earlyLoss: EarlyLossPoint[] = [7, 30, 60].map((withinDays) => {
    const lostBy = paidCohort.filter(
      (user) => user.daysPaidBeforeChurn != null && user.daysPaidBeforeChurn <= withinDays,
    ).length;
    return { withinDays, lost: lostBy, rate: rate(lostBy, paidCohort.length) };
  });

  const recovery = {
    affected: report.summary.failedPaymentCustomers,
    recovered: report.summary.paymentRecovered,
    retrying: report.summary.paymentRetrying,
    lost: report.summary.paymentFailureChurn,
  };

  // ── Where they come from ─────────────────────────────────────────────────
  const bySource = new Map<string, SourceRow>();
  for (const user of cohort) {
    const label = sourceLabel(user.acquisitionSource);
    let row = bySource.get(label);
    if (!row) {
      row = { source: user.acquisitionSource ?? '', label, registered: 0, trials: 0, paid: 0, payingNow: 0, trialRate: null, paidRate: null };
      bySource.set(label, row);
    }
    row.registered += 1;
    if (user.trialStartedAt) row.trials += 1;
    if (user.firstPaidAt) row.paid += 1;
    if (user.paidCustomerState === 'active') row.payingNow += 1;
  }
  const sources = [...bySource.values()]
    .map((row) => ({ ...row, trialRate: rate(row.trials, row.registered), paidRate: rate(row.paid, row.registered) }))
    // Paying customers first: the question this table answers is "which channel
    // is worth more effort", and the channel with the most registrations is
    // routinely not it.
    .sort((a, b) => b.paid - a.paid || b.registered - a.registered || a.label.localeCompare(b.label));

  // ── Sentences ────────────────────────────────────────────────────────────
  const net = newPaid - lost;
  const where = windowLabel(windowDays);
  const netPhrase = net === 0
    ? 'flat'
    : `${net > 0 ? '+' : '−'}${Math.abs(net).toLocaleString()}`;
  const subhead = [
    `${netPhrase} over ${where}`,
    `${plural(newPaid, 'new payer')} in, ${lost.toLocaleString()} lost`,
    scheduledToLeave > 0 ? `${plural(scheduledToLeave, 'cancellation')} already scheduled` : null,
  ].filter(Boolean).join(' · ');

  const funnelSentence = registered === 0
    ? `Nobody registered in ${where}.`
    : `Of the ${plural(registered, 'person', 'people')} who registered in ${where}, `
      + `${trials.toLocaleString()} started a trial (${pct(rate(trials, registered))}) `
      + `and ${paid.toLocaleString()} have paid (${pct(rate(paid, trials))} of trials).`;

  const leakSentence = biggestLeak == null || biggestLeak.droppedFromPrevious == null
    ? null
    : biggestLeak.key === 'trial'
      ? `Biggest drop-off: ${plural(biggestLeak.droppedFromPrevious, 'registration')} never started a trial.`
      : biggestLeak.key === 'paid'
        ? `Biggest drop-off: ${plural(biggestLeak.droppedFromPrevious, 'trial')} ended without a payment.`
        : `Biggest drop-off: ${plural(biggestLeak.droppedFromPrevious, 'paying customer')} was lost inside 30 days.`;

  return {
    windowDays,
    since: sinceIso,
    payingNow,
    scheduledToLeave,
    newPaid,
    lost,
    net,
    funnel,
    biggestLeak,
    survival,
    losses,
    earlyLoss,
    recovery,
    sources,
    headline: `${payingNow.toLocaleString()} paying ${payingNow === 1 ? 'subscriber' : 'subscribers'}`,
    subhead,
    funnelSentence,
    leakSentence,
  };
}
