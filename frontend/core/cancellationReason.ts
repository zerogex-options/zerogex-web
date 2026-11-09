// Pure, dependency-free helpers for CANCELLATION REASONS — the "why" behind a
// churn event. Stripe attaches a `cancellation_details` object to a subscription
// when the customer cancels through the billing portal's cancellation flow (a
// fixed-enum `feedback` plus an optional free-text `comment`). The webhook used
// to drop that on the floor; these helpers let it be folded into the audit
// message in a compact, stable, re-parseable form so the churn-breakdown script
// and the admin dashboard can read it back out.
//
// Kept pure (no `server-only`, DB, fs, or Stripe-SDK imports) so it can be unit
// tested without a database — same discipline as core/subscriptionFlow.ts. The
// format ⇄ parse round-trip is the load-bearing contract and is locked down in
// tests/cancellationReason.test.ts.

// The shape we read off a Stripe.Subscription — declared locally so this module
// doesn't depend on the Stripe types (which aren't needed for the string work).
// All three fields are optional/nullable exactly as Stripe delivers them.
export type CancellationDetails = {
  // Stripe's machine reason (e.g. 'cancellation_requested', 'payment_failed').
  // Describes HOW the cancel happened, not why — recorded but not the signal.
  reason?: string | null;
  // The customer-selected enum from the portal's cancellation survey, or null
  // when collection is off / they skipped it. This is the primary "why" signal.
  feedback?: string | null;
  // Optional free-text the customer typed. The richest signal when present.
  comment?: string | null;
} | null | undefined;

// Human-readable labels for Stripe's fixed `feedback` enum. Anything outside the
// known set falls through to a title-cased version of the raw token, so a new
// Stripe enum value still renders sensibly instead of vanishing.
export const CANCELLATION_FEEDBACK_LABELS: Record<string, string> = {
  too_expensive: 'Too expensive',
  missing_features: 'Missing features',
  switched_service: 'Switched service',
  unused: "Wasn't using it",
  customer_service: 'Customer service',
  too_complex: 'Too complex / hard to use',
  low_quality: 'Low quality',
  other: 'Other',
};

// A stable, non-enum sentinel for "no feedback captured" so tallies have a
// bucket to file blank cancels under (collection off, or the customer skipped).
export const NO_FEEDBACK = 'none';

// The valid Stripe `cancellation_details.feedback` enum values — exactly the keys
// of the label map above. This is the vocabulary the in-app cancellation reason
// picker offers, and the ONLY set of tokens Stripe accepts when we set
// cancellation_details on a subscription; sending anything else 400s the update.
export const CANCELLATION_FEEDBACK_VALUES: readonly string[] =
  Object.keys(CANCELLATION_FEEDBACK_LABELS);

// STRICT validation of an inbound feedback token (from the in-app reason picker)
// against Stripe's fixed enum. Returns the token when it's one of the known
// values, else null — so a malformed/absent reason is simply dropped (the cancel
// still proceeds) instead of being forwarded to Stripe as an invalid enum. This
// differs from the lenient internal normalizeFeedback() below, which accepts any
// [a-z_]+ token when PARSING a value Stripe already stored.
export function validateCancelFeedback(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return CANCELLATION_FEEDBACK_VALUES.includes(value) ? value : null;
}

export function cancellationFeedbackLabel(feedback: string | null | undefined): string {
  if (!feedback || feedback === NO_FEEDBACK) return 'No reason given';
  const known = CANCELLATION_FEEDBACK_LABELS[feedback];
  if (known) return known;
  // Unknown token: title-case it (too_new_to_map -> "Too new to map").
  return feedback
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Collapse a free-text comment to a single, quote-safe, bounded line so it can
// live inside a `cancel_comment="..."` token on one audit-log row without
// breaking the parser or the log format. Newlines/tabs become spaces, runs of
// whitespace collapse, double-quotes become single quotes and backslashes are
// dropped (so the closing `"` is unambiguous), and the result is capped. Returns
// null when nothing meaningful remains.
//
// The cap is also the `maxLength` of the comment box in CancelRetentionModal and
// MoneyBackGuaranteePanel. Keep it one constant: when the box allowed 500 and
// this kept 200, members' notes were cut mid-word with no warning.
export const CANCELLATION_COMMENT_MAX_LEN = 500;
export function sanitizeCancellationComment(comment: string | null | undefined): string | null {
  if (comment == null) return null;
  const cleaned = String(comment)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > CANCELLATION_COMMENT_MAX_LEN ? cleaned.slice(0, CANCELLATION_COMMENT_MAX_LEN) : cleaned;
}

// Normalize Stripe's feedback token to the `[a-z_]+` shape the parser expects,
// or null if it's absent/malformed. Never throws.
function normalizeFeedback(feedback: string | null | undefined): string | null {
  if (feedback == null) return null;
  const m = String(feedback).toLowerCase().match(/^[a-z_]+$/);
  return m ? m[0] : null;
}

// Build the suffix appended to a churn audit message. Empty string when there's
// nothing to record, so a clean cancel keeps its clean message and "no suffix"
// unambiguously means "no signal captured". Shape (either token may be absent):
//   " | cancel_feedback=too_expensive cancel_comment=\"can't justify it\""
export function formatCancellationReasonSuffix(details: CancellationDetails): string {
  if (!details) return '';
  const feedback = normalizeFeedback(details.feedback);
  const comment = sanitizeCancellationComment(details.comment);
  const parts: string[] = [];
  if (feedback) parts.push(`cancel_feedback=${feedback}`);
  if (comment) parts.push(`cancel_comment="${comment}"`);
  if (parts.length === 0) return '';
  return ` | ${parts.join(' ')}`;
}

export type ParsedCancellationReason = {
  feedback: string | null;
  comment: string | null;
};

// Read the reason tokens back out of an audit message written with the suffix
// above. Absent tokens come back null. Tolerant of extra surrounding text (the
// message always leads with the human sentence + sub id).
export function parseCancellationReasonFromMessage(message: string): ParsedCancellationReason {
  const feedbackMatch = message.match(/\bcancel_feedback=([a-z_]+)/);
  const commentMatch = message.match(/\bcancel_comment="([^"]*)"/);
  const comment = commentMatch ? commentMatch[1].trim() : null;
  return {
    feedback: feedbackMatch ? feedbackMatch[1] : null,
    comment: comment && comment.length > 0 ? comment : null,
  };
}

// True when a parsed reason carries any real signal (a selected feedback enum
// or a non-empty comment). Used to split "captured a why" from "silent cancel".
export function hasCancellationSignal(parsed: ParsedCancellationReason): boolean {
  return parsed.feedback !== null || parsed.comment !== null;
}

// ── The cancel row's message ─────────────────────────────────────────────────
// Every stripe_cancellation_requested row is written with this (core/cancelAck.ts),
// so its sentence, subscription id and reason suffix keep one shape:
//   Cancellation requested for sub sub_X | cancel_feedback=… cancel_comment="…"
//
// A cancel on a failed payment (past_due/unpaid) does not wait for period end:
// it ends the subscription on the spot and voids its open bill
// (core/pastDueCancel.ts). Its row says so between the id and the suffix:
//   Cancellation requested for sub sub_X (ended now, payment had failed, bill voided) | …
// or "bill not voided" when the bill was not voided (billWasVoided was false).
// The operator alert reads it back (parseEndedOnFailedPayment), so it no longer
// calls a plan that is already gone "savable".
//
// The other readers of the row are unaffected. They take the subscription id
// with /sub_[A-Za-z0-9]+/ or /\bsub_\S+/ (the id is still followed by a space),
// the reason with the cancel_feedback= / cancel_comment= tokens (the marker has
// neither), or read only the row's type and time.
export type EndedOnFailedPayment = {
  // The unpaid bill was voided and nothing was left open (billWasVoided in
  // core/pastDueCancel.ts), so nothing more can be charged.
  billVoided: boolean;
};

export function formatCancellationRequestedMessage(
  subscriptionId: string,
  details: CancellationDetails,
  endedOnFailedPayment: EndedOnFailedPayment | null = null,
): string {
  const ended = endedOnFailedPayment
    ? ` (ended now, payment had failed, bill ${endedOnFailedPayment.billVoided ? 'voided' : 'not voided'})`
    : '';
  return `Cancellation requested for sub ${subscriptionId}${ended}${formatCancellationReasonSuffix(details)}`;
}

// Anchored to the start of the row, right after the subscription id. A typed
// comment only ever comes after " | ", so no member can write text that makes a
// scheduled cancel read as ended, or the other way round.
const ENDED_ON_FAILED_PAYMENT =
  /^Cancellation requested for sub sub_\S+ \(ended now, payment had failed, bill (voided|not voided)\)(?: \||$)/;

// Null for every cancel scheduled for period end, and for any other row.
export function parseEndedOnFailedPayment(message: string): EndedOnFailedPayment | null {
  const m = message.match(ENDED_ON_FAILED_PAYMENT);
  return m ? { billVoided: m[1] === 'voided' } : null;
}
