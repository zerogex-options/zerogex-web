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
  key: 'registered' | 'trial' | 'paidAfterTrial' | 'paid' | 'retained';
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
  /** Paid access stopped inside N days AND has not resumed. */
  lost: number;
  /** Paid access stopped inside N days, whether or not they came back. */
  interrupted: number;
  /** Interrupted inside N days and paying again now. */
  recovered: number;
  rate: number | null;
  interruptedRate: number | null;
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
  /** ── All-time ledger, stated in the words each number actually means ── */
  registrationsAllTime: number;
  everPaidAllTime: number;
  accessEndedAllTime: number;
  /** ── Right now ─────────────────────────────────────────────── */
  payingNow: number;
  /** Active subscribers who have already asked to leave at period end. */
  scheduledToLeave: number;
  /** ── Ledger (event-timed, inside the window) ───────────────── */
  newPaid: number;
  lost: number;
  net: number;
  /** ── Trial conversion, stated the only way it is meaningful ── */
  trialStarters: number;
  /** Trial starters who LATER PAID. Never includes direct-to-paid customers. */
  trialStartersWhoPaid: number;
  directToPaid: number;
  /** trialStartersWhoPaid / trialStarters. Cannot exceed 100%. */
  trialToPaidRate: number | null;
  /** ── Funnel (cohort-timed, registered inside the window) ───── */
  funnel: FunnelStage[];
  /** The stage that loses the most people, for the callout. */
  biggestLeak: FunnelStage | null;
  /** ── Retention of everyone old enough to measure ───────────── */
  survival: SurvivalPoint[];
  /** Ever-paid customers in the window whose access stopped and then resumed. */
  interrupted: number;
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

// NOT "organic": it is the absence of a utm_source, which also covers direct
// visits, untagged social and referral links, and word of mouth. Naming it
// "organic" quietly credits one channel with everything we failed to tag.
const UNATTRIBUTED = 'Organic / direct / unattributed';

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
  if (!trimmed) return UNATTRIBUTED;
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
  // A date that does not exist is not "inside the window" — it is an event that
  // never happened. The previous version returned true for null on the all-time
  // window, which made `newPaid` count every account that had never paid: the
  // headline read "1,166 new payers in" when 1,166 was the registration count.
  const inWindow = (value: string | null): boolean => {
    const at = time(value);
    if (at == null) return false;
    return at <= now && (since == null || at >= since);
  };

  const users = report.users;

  // ── Right now ────────────────────────────────────────────────────────────
  // Current state is a property of the account, not of the window: "how many
  // people pay me" has no date range, and scoping it to one would make a
  // 30-day view claim the business shrank to whoever signed up this month.
  const state = (value: PaidCustomerState) => users.filter((user) => user.paidCustomerState === value).length;
  const payingNow = state('active');
  const scheduledToLeave = users.filter(
    (user) => user.paidCustomerState === 'active' && user.scheduledAccessEndAt != null,
  ).length;

  // ── Ledger: money that started and stopped inside the window ─────────────
  // `accessEndedAt` is also written forward for a scheduled cancellation, so a
  // future date is an intention, not a loss. Only endings that have actually
  // happened count.
  const newPaid = users.filter((user) => inWindow(user.firstPaidAt)).length;
  // A LOSS is a customer who is not entitled now and whose access ended inside
  // the window. `lastAccessEndedAt` is null whenever they are entitled, so a
  // customer who lapsed and came back is not counted here — their interruption
  // shows in the interruption columns instead.
  const endedUsers = users.filter(
    (user) => user.firstPaidAt != null && user.lastAccessEndedAt != null && inWindow(user.lastAccessEndedAt),
  );
  const lost = endedUsers.length;
  const interruptedUsers = users.filter(
    (user) => user.firstPaidAt != null
      && user.reactivatedAfterInterruption
      && inWindow(user.firstAccessEndedAt),
  );

  // ── Funnel: the people who registered inside the window ──────────────────
  const cohort = users.filter((user) => inWindow(user.registeredAt));
  const registered = cohort.length;
  const trials = cohort.filter((user) => user.trialStartedAt != null).length;
  const paid = cohort.filter((user) => user.firstPaidAt != null).length;
  // The intersection, not the union. Counting every payer against the trial
  // denominator is what let this rate print "150% of trials" for a month where
  // most customers skipped the trial entirely.
  const trialThenPaid = cohort.filter((user) => user.paidAfterTrial).length;
  const directToPaid = cohort.filter((user) => user.directToPaid).length;
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
      key: 'paidAfterTrial',
      label: 'Paid after a trial',
      caption: 'the trial converted',
      value: trialThenPaid,
      ofPrevious: rate(trialThenPaid, trials),
      ofTop: rate(trialThenPaid, registered),
      droppedFromPrevious: Math.max(0, trials - trialThenPaid),
      eligible: null,
    },
    {
      // Not a conversion step — a total. Direct-to-paid customers enter the
      // funnel here without passing through a trial, so this row is the sum of
      // two paths and its "of previous" would be meaningless.
      key: 'paid',
      label: 'Paying customers',
      caption: directToPaid > 0
        ? `incl. ${directToPaid.toLocaleString()} who never trialled`
        : 'money actually moved',
      value: paid,
      ofPrevious: null,
      ofTop: rate(paid, registered),
      droppedFromPrevious: null,
      eligible: null,
    },
    {
      key: 'retained',
      label: 'Still paying at 30d',
      caption: 'of the payers old enough to tell',
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
  // Two different questions, kept apart: how many had paid access STOP inside
  // N days (interruptions, reactivations included), and how many of those are
  // still gone. Reporting only the first under the word "lost" turns every
  // customer who ever had a billing hiccup into permanent churn.
  const earlyLoss: EarlyLossPoint[] = [7, 30, 60].map((withinDays) => {
    const interrupted = paidCohort.filter(
      (user) => user.daysToFirstInterruption != null && user.daysToFirstInterruption <= withinDays,
    ).length;
    const stillGone = paidCohort.filter(
      (user) => user.daysPaidBeforePermanentLoss != null && user.daysPaidBeforePermanentLoss <= withinDays,
    ).length;
    return {
      withinDays,
      lost: stillGone,
      interrupted,
      recovered: Math.max(0, interrupted - stillGone),
      rate: rate(stillGone, paidCohort.length),
      interruptedRate: rate(interrupted, paidCohort.length),
    };
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
    `${plural(newPaid, 'first payment')} in, ${plural(lost, 'customer')} lost`,
    scheduledToLeave > 0 ? `${plural(scheduledToLeave, 'cancellation')} already scheduled` : null,
  ].filter(Boolean).join(' · ');

  const funnelSentence = registered === 0
    ? `Nobody registered in ${where}.`
    : `Of the ${plural(registered, 'person', 'people')} who registered in ${where}, `
      + `${trials.toLocaleString()} started a trial (${pct(rate(trials, registered))}) `
      + `and ${trialThenPaid.toLocaleString()} of those went on to pay (${pct(rate(trialThenPaid, trials))})`
      + (directToPaid > 0
        ? `, plus ${plural(directToPaid, 'customer')} who paid without trialling — ${plural(paid, 'paying customer')} in all.`
        : '.');

  const leakSentence = biggestLeak == null || biggestLeak.droppedFromPrevious == null
    ? null
    : biggestLeak.key === 'trial'
      ? `Biggest drop-off: ${plural(biggestLeak.droppedFromPrevious, 'registration')} never started a trial.`
      : biggestLeak.key === 'paidAfterTrial'
        ? `Biggest drop-off: ${plural(biggestLeak.droppedFromPrevious, 'trial')} ended without a payment.`
        : `Biggest drop-off: ${plural(biggestLeak.droppedFromPrevious, 'paying customer')} lost paid access inside 30 days.`;

  return {
    windowDays,
    since: sinceIso,
    registrationsAllTime: users.length,
    everPaidAllTime: users.filter((user) => user.firstPaidAt != null).length,
    accessEndedAllTime: users.filter((user) => user.lastAccessEndedAt != null).length,
    payingNow,
    scheduledToLeave,
    newPaid,
    lost,
    net,
    trialStarters: trials,
    trialStartersWhoPaid: trialThenPaid,
    directToPaid,
    trialToPaidRate: rate(trialThenPaid, trials),
    funnel,
    biggestLeak,
    survival,
    interrupted: interruptedUsers.length,
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
