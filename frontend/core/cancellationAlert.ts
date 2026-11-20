// Pure, dependency-free helpers for the OPERATOR CANCELLATION ALERT — the email
// that lands in the founder's inbox the moment a member churns, carrying the
// "why" they typed into the cancellation survey.
//
// The reason itself has been captured into audit_events since core/cancellationReason.ts
// landed (`cancel_feedback=...` / `cancel_comment="..."` folded onto the churn row),
// but nothing ever PUSHED it anywhere — you had to go looking with `make cancellations`
// or `make churn-breakdown`. That is the gap this closes: the richest retention
// signal the business gets was sitting in a table, unread, while the window to
// save the member (they still have access until period end) quietly expired.
//
// Kept pure (no `server-only`, DB, fs, Resend, or Stripe-SDK imports) so it can be
// unit tested without a database and imported from a standalone
// `node --experimental-strip-types` script — same discipline as
// core/cancellationReason.ts and core/subscriptionFlow.ts. The latch
// format ⇄ parse round-trip is the load-bearing contract and is locked down in
// tests/cancellationAlert.test.ts.

import {
  cancellationFeedbackLabel,
  parseCancellationReasonFromMessage,
  parseEndedOnFailedPayment,
  hasCancellationSignal,
  type EndedOnFailedPayment,
  type ParsedCancellationReason,
} from './cancellationReason.ts';
import type { LedgerRow } from './subscriberBucket.ts';

// The two audit rows that mean "a member is leaving". They are DIFFERENT events
// and both are worth an alert, because they carry different urgency:
//
//   pending — `stripe_cancellation_requested`, written the instant the member
//             clicks Cancel. They STILL HAVE ACCESS until period end. This is the
//             one that matters: it is the only window in which a reply can
//             actually save the subscription.
//             Except when their payment had already failed: then Cancel ends
//             the subscription on the spot and voids its bill
//             (core/pastDueCancel.ts), so access is already gone and there is
//             nothing left to save. The row says so (parseEndedOnFailedPayment)
//             and the alert reads that way.
//   lapsed  — `stripe_subscription_deleted`, written when the subscription
//             actually ends. Access is gone. Useful as a receipt and as the
//             backstop for a cancel that never emitted a pending row (a Stripe
//             admin cancel, or a trial that lapsed straight through).
export const CHURN_EVENT_TYPES = {
  pending: 'stripe_cancellation_requested',
  lapsed: 'stripe_subscription_deleted',
} as const;

export type ChurnEventKind = keyof typeof CHURN_EVENT_TYPES;

export const CHURN_EVENT_TYPE_VALUES: readonly string[] = Object.values(CHURN_EVENT_TYPES);

// The audit row this script writes after a successful send. Its presence IS the
// idempotency latch — deliberately an audit row rather than a state file so the
// "already alerted" set is derived from the same durable table as the churn rows
// themselves. A lost/rotated state file would re-alert the whole history; an
// audit row cannot drift out of sync with what it is latching.
export const ALERT_SENT_EVENT_TYPE = 'cancellation_alert_sent';

export function classifyChurnEvent(type: string): ChurnEventKind | null {
  if (type === CHURN_EVENT_TYPES.pending) return 'pending';
  if (type === CHURN_EVENT_TYPES.lapsed) return 'lapsed';
  return null;
}

// ── Latch round-trip ─────────────────────────────────────────────────────────
// Keyed by the churn row's own audit id (not by user or subscription), so a
// member who cancels, reactivates, and cancels again gets an alert each time,
// while a webhook redelivery that re-writes nothing cannot double-send.

export function buildAlertLatchMessage(churnEventId: string, kind: ChurnEventKind): string {
  return `Sent cancellation alert for ${kind} churn event alert_for=${churnEventId}`;
}

export function parseAlertLatchEventId(message: string): string | null {
  const m = message.match(/\balert_for=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// ── Tenure ───────────────────────────────────────────────────────────────────
// How long they were on the subscription they are leaving. The single most
// diagnostic number on the alert: a churn at day 3 of a 7-day trial is an
// activation failure, a churn at month 5 is a value failure, and they want
// completely different replies. Counted from when the subscription began, not
// from the account: a member who let an earlier trial lapse and came back
// months later, or who signed up a week before starting a trial, would
// otherwise read as months into a subscription that is days old. Returns null
// when either timestamp is unusable rather than guessing.

export function tenureDays(createdAtIso: string | null, churnedAtIso: string): number | null {
  if (!createdAtIso) return null;
  const start = Date.parse(createdAtIso);
  const end = Date.parse(churnedAtIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000);
}

// The subscription a churn row is about. Both writers name it:
// `Cancellation requested for sub sub_…` (pending) and `Subscription sub_… ended`
// (lapsed). The first match is the writer's; a typed comment comes after it.
export function parseChurnSubscriptionId(message: string): string | null {
  const m = message.match(/\b(?:for sub|Subscription) (sub_[A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export function describeTenure(days: number | null): string {
  if (days === null) return 'unknown';
  if (days === 0) return 'same day';
  if (days === 1) return '1 day';
  if (days < 45) return `${days} days`;
  const months = Math.round(days / 30.44);
  return `${days} days (~${months} month${months === 1 ? '' : 's'})`;
}

// ── Paying member or free trial ──────────────────────────────────────────────
// Whether the member who clicked Cancel had paid. A trial cancel forfeits a
// conversion that was never charged; a paying member's cancel is revenue
// already in hand walking out. An alert that read the same for both made every
// trial cancel look like lost revenue.
//
// The answer is the Subscriber Ledger's, not a second rule: the ledger already
// splits every cancel into "Cancellation scheduled: trial" and "Cancellation
// scheduled: paid subscription", and the alert must never disagree with the
// row the operator checks it against.
export type ChurnBilling = 'paying' | 'trial';

// The ledger's cancel row comes from the subscription sync the webhook logs
// moments before the cancel-ack path writes the churn row, in the same handler,
// with a few network calls in between. Ten minutes is far wider than that gap
// and far narrower than the time between two cancel clicks by one member.
export const LEDGER_MATCH_WINDOW_MS = 10 * 60_000;

// The ledger's verdict for one churn row: its cancel row for the same member
// nearest in time, or null when there is none to read (no user id, or a cancel
// the ledger never saw), in which case the alert says nothing rather than guess.
export function billingAtCancel(
  ledgerRows: ReadonlyArray<Pick<LedgerRow, 'userId' | 'kind' | 'at'>>,
  userId: string | null,
  churnedAtIso: string,
): ChurnBilling | null {
  if (!userId) return null;
  const churnedMs = Date.parse(churnedAtIso);
  if (!Number.isFinite(churnedMs)) return null;
  let best: ChurnBilling | null = null;
  let bestGap = Infinity;
  for (const row of ledgerRows) {
    if (row.userId !== userId) continue;
    if (row.kind !== 'cancelScheduledPaid' && row.kind !== 'cancelScheduledTrial') continue;
    const gap = Math.abs(Date.parse(row.at) - churnedMs);
    if (!(gap <= LEDGER_MATCH_WINDOW_MS) || gap >= bestGap) continue;
    best = row.kind === 'cancelScheduledPaid' ? 'paying' : 'trial';
    bestGap = gap;
  }
  return best;
}

export function describeBilling(billing: ChurnBilling | null): string {
  if (billing === 'paying') return 'Paying member';
  if (billing === 'trial') return 'Free trial, never charged';
  return 'unknown';
}

// ── Refunded under the 7-day money-back guarantee ────────────────────────────
// A member can click Cancel and then, still inside the guarantee, take the
// money-back refund from the Account page. The refund ends the subscription on
// the spot and clears the member's row (core/moneyBackServer.ts), so by the
// time the sweep runs, the plan the cancel had scheduled for period end is
// already gone. An alert that still called it savable sent the operator after
// someone who had their money back, with a save link and a win-back discount
// that had nothing left to act on. (Nov 19, 2026: "Paying member canceled —
// still has access", over "Tier at churn: public" and "Access ends: —".)
//
// The refund ledger (money_back_refunds) is keyed by subscription, and every
// churn row names its subscription (parseChurnSubscriptionId), so the match is
// exact: the guarantee request for the very plan this churn row is about, not
// a guess from timing.
//
//   completed — refunded and canceled. Access has ended; nothing to save.
//   pending   — a request still running, or one that stopped part-way (its
//               operator alert said ACTION NEEDED). They asked for their money
//               back, so it is not a save either.
//   failed    — refused before any money moved. The member keeps the plan and
//               the cancel they scheduled still stands, so the alert reads as it
//               would without the request: not a ChurnRefund.
export type ChurnRefundStatus = 'completed' | 'pending';

export type ChurnRefund = {
  status: ChurnRefundStatus;
  // Minor units (cents): what has gone back to the member so far.
  amountRefunded: number;
  currency: string | null;
  // The plan that was refunded, as the ledger recorded it, or null when the
  // request stopped before recording it.
  tier: string | null;
  // completed: when the refund finished. pending: when it was last worked on.
  atIso: string | null;
};

// The money_back_refunds columns the sweep reads, as SQLite returns them.
export type MoneyBackLedgerRow = {
  status: string | null;
  amount_refunded: number | bigint | null;
  currency: string | null;
  tier: string | null;
  completed_at: string | null;
  updated_at: string | null;
};

// How the alert reads the ledger row for the churned subscription: null when
// there is none, or when the request changed nothing (refused before any money
// moved).
export function churnRefundFromLedger(row: MoneyBackLedgerRow | null | undefined): ChurnRefund | null {
  if (!row) return null;
  if (row.status !== 'completed' && row.status !== 'pending') return null;
  const amount = Number(row.amount_refunded ?? 0);
  return {
    status: row.status,
    amountRefunded: Number.isFinite(amount) && amount > 0 ? amount : 0,
    currency: row.currency ?? null,
    tier: row.tier ?? null,
    atIso: row.status === 'completed' ? (row.completed_at ?? row.updated_at) : row.updated_at,
  };
}

// Mirrors formatMinorAmount in core/moneyBackServer.ts, which this module can't
// import: it pulls in Stripe and the database.
export function formatRefundAmount(amount: number, currency: string | null): string {
  const code = (currency ?? 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${code}`;
  }
}

// The Refund line on the alert.
export function describeRefund(refund: ChurnRefund): string {
  const amount = refund.amountRefunded > 0 ? formatRefundAmount(refund.amountRefunded, refund.currency) : null;
  if (refund.status === 'pending') {
    return amount ? `Not finished (${amount} refunded so far)` : 'Requested, not finished';
  }
  const when = formatEt(refund.atIso);
  return when === '—' ? (amount ?? 'In full') : `${amount ?? 'In full'} on ${when}`;
}

// ── Run exit status ──────────────────────────────────────────────────────────
// Whether a finished run should fail its systemd unit.
//
// A PARTIAL failure is the design working, not a fault: an unlatched send is
// retried on the next tick, so a transient 429 or a blip at Resend clears itself
// within fifteen minutes. Failing the unit for that leaves `systemctl --failed`
// red over something already handled and, worse, makes the red meaningless — the
// run where nothing went out looks identical to the one where 24 of 25 did.
//
// Nothing succeeding is the case that does NOT self-heal: wrong credentials, a
// revoked key, no egress. That is the one worth waking someone for.
export function alertRunExitCode(sent: number, failed: number): 0 | 1 {
  return sent === 0 && failed > 0 ? 1 : 0;
}

// ── Which churn events are worth an alert ────────────────────────────────────
// Two filters, applied on different axes, that together reduce the stream to the
// one thing an alert can actually be acted on: a member who left AND said why.
//
// WHICH EVENT (the kind, selected by the caller — see DEFAULT_CHURN_ALERT_KIND).
// A portal or in-app cancel writes BOTH rows for the same departure: `pending`
// when they click Cancel, then `lapsed` weeks later when the period ends. Stripe
// carries `cancellation_details` onto the terminal row too, so the survey answer
// appears on both — and alerting on both meant two emails for one churn, the
// second arriving long after the save window it was reporting on had closed.
// The first one is the one with a decision attached.
//
// WHETHER IT SAID ANYTHING (this function). A churn row that captured neither a
// feedback selection nor a typed comment reports a departure and nothing else,
// which is a fact the dashboard already carries. On real data that class was the
// large majority of the stream — enough noise to get the whole thing filtered to
// a folder, taking the alerts that mattered with it.
//
// Note there is no race to worry about between the two: both the Stripe portal
// and the in-app cancel flow (app/api/billing/cancel-flow) set
// `cancellation_details` in the SAME subscription update that schedules the
// cancel, so the survey is on the `pending` row the moment it is written. A row
// with no reason means none was given, not that one is still coming.
//
// One silent row still alerts: a cancel on a failed payment whose unpaid bill
// was NOT voided. That reports more than a departure: a bill that may still be
// payable after the plan ended, which needs a hand, and nothing else pushes it
// anywhere.
//
// Set includeSilent to restore the unfiltered firehose.
export function shouldAlertOnChurn(auditMessage: string, includeSilent: boolean): boolean {
  if (includeSilent) return true;
  if (parseEndedOnFailedPayment(auditMessage)?.billVoided === false) return true;
  return hasCancellationSignal(parseCancellationReasonFromMessage(auditMessage));
}

// Which churn event the alert sweep looks at unless the operator asks for more.
// `pending` is the moment the member clicked Cancel and answered the survey —
// the only point at which a reply can still save the subscription, and the only
// one of the two rows that isn't a duplicate of the other. `lapsed` stays
// reachable (--kind lapsed|both) as the backstop for a departure that never
// emitted a pending row at all: a Stripe-dashboard admin cancel, or a sub
// deleted straight out of dunning.
export const DEFAULT_CHURN_ALERT_KIND: ChurnEventKind = 'pending';

// ── Per-run batching ─────────────────────────────────────────────────────────
// How many of the pending churn events a single run takes.
//
// The cap exists for exactly one reason: to stop a wide `--since` window mailing
// the entire churn history in one go. It follows that it must NOT apply when the
// run sends nothing. `--mark-only` capped at 25 is actively harmful — you ask it
// to silence a backlog of 355, it silences 25, and the timer then mails you the
// other 330, which is the precise outcome the flag exists to prevent. That is a
// bug this function exists to hold shut.
export function selectBatch<T>(pending: readonly T[], limit: number, markOnly: boolean): T[] {
  // limit <= 0 means unlimited; mark-only is always unlimited.
  if (markOnly || limit <= 0) return [...pending];
  return pending.slice(0, limit);
}

// ── The alert payload ────────────────────────────────────────────────────────

export type ChurnAlertInput = {
  churnEventId: string;
  kind: ChurnEventKind;
  email: string;
  userId: string | null;
  // The raw audit message — the reason tokens are parsed back out of it, so the
  // alert never disagrees with what the churn row actually recorded.
  auditMessage: string;
  churnedAtIso: string;
  accountCreatedAtIso: string | null;
  // When the subscription being left began, or null when unknown. Tenure counts
  // from here, falling back to the account's creation.
  subscriptionStartedAtIso: string | null;
  tier: string | null;
  // Paying member or free trial, per the Subscriber Ledger (billingAtCancel),
  // or null when the ledger has no answer.
  billing: ChurnBilling | null;
  // Period end for a pending cancel: the deadline on the save window. Null for a
  // lapse (already past) or when the DB row has been cleared. Ignored for a
  // cancel that ended the plan on a failed payment: there is no window left.
  currentPeriodEndIso: string | null;
  // The money-back refund on the subscription this churn row is about
  // (churnRefundFromLedger), or null/absent when there is none. A refund means
  // there is nothing to save, whatever the rest of the row says.
  refund?: ChurnRefund | null;
};

export type ChurnAlert = {
  subject: string;
  kind: ChurnEventKind;
  email: string;
  reason: ParsedCancellationReason;
  reasonLabel: string;
  comment: string | null;
  hasSignal: boolean;
  billing: ChurnBilling | null;
  billingLabel: string;
  tenure: string;
  tenureDays: number | null;
  headline: string;
  facts: Array<{ label: string; value: string }>;
  commands: string[];
  saveWindowNote: string | null;
  // Set when the cancel ended the plan on the spot because the payment had
  // failed (read off the churn row), else null. Such a cancel has no save window.
  endedOnFailedPayment: EndedOnFailedPayment | null;
  // Whether that cancel's unpaid bill was voided, in a sentence. Null otherwise.
  billNote: string | null;
  // The money-back refund on this subscription, completed or still pending, or
  // null when there is none. Either way there is nothing to save.
  refund: ChurnRefund | null;
};

// Formats an ISO stamp the way the rest of the operator tooling does: ET, so it
// matches the audit dumps and the admin dashboard rather than forcing a mental
// UTC conversion at the moment you are trying to act quickly.
export function formatEt(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(ms));
}

// Days from now until the member actually loses access. Drives the urgency line
// on a pending cancel — "you have 26 days" reads very differently from "2 days".
export function daysUntil(iso: string | null, nowIso: string): number | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(end) || !Number.isFinite(now)) return null;
  return Math.ceil((end - now) / 86_400_000);
}

export function buildChurnAlert(input: ChurnAlertInput, nowIso: string): ChurnAlert {
  const reason = parseCancellationReasonFromMessage(input.auditMessage);
  const reasonLabel = cancellationFeedbackLabel(reason.feedback);
  const hasSignal = hasCancellationSignal(reason);
  const days =
    tenureDays(input.subscriptionStartedAtIso, input.churnedAtIso) ??
    tenureDays(input.accountCreatedAtIso, input.churnedAtIso);
  const tenure = describeTenure(days);
  // A cancel on a failed payment ended the plan on the spot: nothing to save.
  const endedOnFailedPayment =
    input.kind === 'pending' ? parseEndedOnFailedPayment(input.auditMessage) : null;
  // So did a money-back refund, and one still pending is a member asking for
  // their money back. Either one outranks the rest of the row.
  const refund = input.refund ?? null;
  const refunded = refund?.status === 'completed';

  // The subject line is the whole product for anyone reading on a phone: it has
  // to say who left and why WITHOUT being opened. The free-text comment wins the
  // slot when present (it is the real signal); the enum is the fallback.
  const subjectReason = reason.comment
    ? truncate(reason.comment, 80)
    : hasSignal
      ? reasonLabel
      : 'no reason given';
  // Paying or trial leads the subject, so the one fact that decides whether
  // revenue just walked out is readable from the lock screen. A refund leads
  // instead, and so does a plan that has already ended, with a bill left
  // unvoided.
  const who = refund
    ? refunded
      ? `Canceled and refunded: ${input.email}`
      : `Canceled, refund not finished: ${input.email}`
    : endedOnFailedPayment
      ? endedOnFailedPayment.billVoided
        ? `Canceled, plan ended (payment had failed): ${input.email}`
        : `Canceled, plan ended, bill not voided: ${input.email}`
      : input.billing === 'paying'
        ? `Paying member canceled: ${input.email}`
        : input.billing === 'trial'
          ? `Trial canceled, never charged: ${input.email}`
          : `${input.email} ${input.kind === 'pending' ? 'canceled' : 'lapsed'}`;
  const subject = `[ZeroGEX] ${who} — ${subjectReason}`;
  const billingLabel = describeBilling(input.billing);

  const headline = refund
    ? refunded
      ? 'Refunded — they took the 7-day money-back refund, which ended the plan on the spot instead of at period end. Access is gone and there is no subscription left to save.'
      : 'Refund not finished — they asked for the 7-day money-back refund and it has not completed, so this is not a save. The money-back alert says what is left; make money-back-refund finishes it without refunding twice.'
    : endedOnFailedPayment
      ? 'Plan already ended — their payment had failed, so the cancel ended it on the spot instead of at period end. Access is gone and there is no subscription left to save.'
      : input.kind === 'pending'
        ? 'Cancellation requested — they still have access, so this is savable.'
        : 'Subscription ended — access has been revoked.';

  // The route records why a bill was not voided (billing_cancel_bill_not_voided)
  // and what to run; diagnose-user prints that row.
  const billNote = endedOnFailedPayment
    ? endedOnFailedPayment.billVoided
      ? 'The unpaid bill was voided, so nothing more can be charged.'
      : 'The unpaid bill was not voided and may still be payable. Why, and what to run: the billing_cancel_bill_not_voided row in make diagnose-user.'
    : null;

  const remaining = daysUntil(input.currentPeriodEndIso, nowIso);
  const saveWindowNote =
    input.kind === 'pending' && !endedOnFailedPayment && !refund && input.currentPeriodEndIso
      ? remaining !== null && remaining >= 0
        ? `Access runs until ${formatEt(input.currentPeriodEndIso)} — ${remaining} day${remaining === 1 ? '' : 's'} left to reply.`
        : `Access ran until ${formatEt(input.currentPeriodEndIso)}.`
      : null;

  // Access ended with the refund once money moved: the flow removes it locally
  // right after refunding, even when the Stripe cancel still has to be finished.
  const accessEndedByRefund = refunded || (refund?.amountRefunded ?? 0) > 0;

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Member', value: input.email },
    { label: 'Billing', value: billingLabel },
    { label: 'Reason (survey)', value: reasonLabel },
    { label: 'What they typed', value: reason.comment ?? '(nothing)' },
    // A refund has already set the member's row to 'public'; the ledger kept
    // the plan they were on.
    { label: 'Tier at churn', value: refund?.tier ?? input.tier ?? 'unknown' },
    { label: 'Tenure', value: tenure },
    { label: 'Signed up', value: formatEt(input.accountCreatedAtIso) },
    { label: 'Subscribed', value: formatEt(input.subscriptionStartedAtIso) },
    { label: 'Canceled', value: formatEt(input.churnedAtIso) },
    ...(refund ? [{ label: 'Refund', value: describeRefund(refund) }] : []),
    {
      label: 'Access ends',
      value: accessEndedByRefund
        ? 'Ended with the refund'
        : endedOnFailedPayment
          ? 'Already ended'
          : formatEt(input.currentPeriodEndIso),
    },
    { label: 'User id', value: input.userId ?? 'unknown' },
  ];

  // The commands you actually run next, pre-filled with the address so the
  // alert is copy-paste actionable instead of a prompt to go find the runbook.
  // A plan that has already ended has no subscription for save-url or
  // honor-winback-discount to act on; if its bill was not voided, the dry run
  // lists what is still open, and YES=1 voids it. Neither does a refund: a
  // finished one needs nothing, and an unfinished one is resumed by
  // money-back-refund (a dry run without YES=1; it never refunds twice).
  const commands = refund
    ? [
        `make diagnose-user EMAIL=${input.email}`,
        ...(refunded ? [] : [`make money-back-refund EMAIL=${input.email}`]),
      ]
    : endedOnFailedPayment
      ? [
          `make diagnose-user EMAIL=${input.email}`,
          ...(endedOnFailedPayment.billVoided
            ? []
            : [`make cancel-subscription EMAIL=${input.email} VOID_INVOICE=1 DRY_RUN=1`]),
        ]
      : [
          `make diagnose-user EMAIL=${input.email}`,
          `make save-url EMAIL=${input.email}`,
          `make honor-winback-discount EMAIL=${input.email} DRY_RUN=1`,
        ];

  return {
    subject,
    kind: input.kind,
    email: input.email,
    reason,
    reasonLabel,
    comment: reason.comment,
    hasSignal,
    billing: input.billing,
    billingLabel,
    tenure,
    tenureDays: days,
    headline,
    facts,
    commands,
    saveWindowNote,
    endedOnFailedPayment,
    billNote,
    refund,
  };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
