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
  hasCancellationSignal,
  type ParsedCancellationReason,
} from './cancellationReason.ts';

// The two audit rows that mean "a member is leaving". They are DIFFERENT events
// and both are worth an alert, because they carry different urgency:
//
//   pending — `stripe_cancellation_requested`, written the instant the member
//             clicks Cancel. They STILL HAVE ACCESS until period end. This is the
//             one that matters: it is the only window in which a reply can
//             actually save the subscription.
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
// How long they were a member before leaving. The single most diagnostic number
// on the alert: a churn at day 3 of a 7-day trial is an activation failure, a
// churn at month 5 is a value failure, and they want completely different
// replies. Returns null when either timestamp is unusable rather than guessing.

export function tenureDays(createdAtIso: string | null, churnedAtIso: string): number | null {
  if (!createdAtIso) return null;
  const start = Date.parse(createdAtIso);
  const end = Date.parse(churnedAtIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000);
}

export function describeTenure(days: number | null): string {
  if (days === null) return 'unknown';
  if (days === 0) return 'same day';
  if (days === 1) return '1 day';
  if (days < 45) return `${days} days`;
  const months = Math.round(days / 30.44);
  return `${days} days (~${months} month${months === 1 ? '' : 's'})`;
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
  tier: string | null;
  // Period end for a pending cancel: the deadline on the save window. Null for a
  // lapse (already past) or when the DB row has been cleared.
  currentPeriodEndIso: string | null;
};

export type ChurnAlert = {
  subject: string;
  kind: ChurnEventKind;
  email: string;
  reason: ParsedCancellationReason;
  reasonLabel: string;
  comment: string | null;
  hasSignal: boolean;
  tenure: string;
  tenureDays: number | null;
  headline: string;
  facts: Array<{ label: string; value: string }>;
  commands: string[];
  saveWindowNote: string | null;
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
  const days = tenureDays(input.accountCreatedAtIso, input.churnedAtIso);
  const tenure = describeTenure(days);

  // The subject line is the whole product for anyone reading on a phone: it has
  // to say who left and why WITHOUT being opened. The free-text comment wins the
  // slot when present (it is the real signal); the enum is the fallback.
  const subjectReason = reason.comment
    ? truncate(reason.comment, 80)
    : hasSignal
      ? reasonLabel
      : 'no reason given';
  const verb = input.kind === 'pending' ? 'cancelled' : 'lapsed';
  const subject = `[ZeroGEX] ${input.email} ${verb} — ${subjectReason}`;

  const headline =
    input.kind === 'pending'
      ? 'Cancellation requested — they still have access, so this is savable.'
      : 'Subscription ended — access has been revoked.';

  const remaining = daysUntil(input.currentPeriodEndIso, nowIso);
  const saveWindowNote =
    input.kind === 'pending' && input.currentPeriodEndIso
      ? remaining !== null && remaining >= 0
        ? `Access runs until ${formatEt(input.currentPeriodEndIso)} — ${remaining} day${remaining === 1 ? '' : 's'} left to reply.`
        : `Access ran until ${formatEt(input.currentPeriodEndIso)}.`
      : null;

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Member', value: input.email },
    { label: 'Reason (survey)', value: reasonLabel },
    { label: 'What they typed', value: reason.comment ?? '(nothing)' },
    { label: 'Tier at churn', value: input.tier ?? 'unknown' },
    { label: 'Tenure', value: tenure },
    { label: 'Signed up', value: formatEt(input.accountCreatedAtIso) },
    { label: 'Cancelled', value: formatEt(input.churnedAtIso) },
    { label: 'Access ends', value: formatEt(input.currentPeriodEndIso) },
    { label: 'User id', value: input.userId ?? 'unknown' },
  ];

  // The three commands you actually run next, pre-filled with the address so the
  // alert is copy-paste actionable instead of a prompt to go find the runbook.
  const commands = [
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
    tenure,
    tenureDays: days,
    headline,
    facts,
    commands,
    saveWindowNote,
  };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
