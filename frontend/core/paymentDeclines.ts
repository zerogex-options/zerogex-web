// WHERE THE MONEY GOES WHEN A CARD SAYS NO.
//
// This is the arithmetic behind Admin → Monitoring → Stripe → Payment Declines.
// Pure: no DB, no Stripe, no `server-only`, no "@/" alias — so every rate below
// is unit-tested (tests/paymentDeclines.test.ts) and the module can be loaded by
// a client component for its types and labels and by a bare-Node backfill
// script for its logic. The side-effecting half (the SQL, the webhook capture)
// lives in core/paymentDeclinesServer.ts, mirroring the
// cohortRetention/cohortRetentionServer split.
//
// WHAT IT IS FOR. A declined charge is the only kind of lost revenue nobody
// chose: the member did not cancel, did not complain, and in most cases does not
// know. It is also the only kind that frequently comes BACK — Stripe's Smart
// Retries recover a large share of insufficient-funds declines within days — so
// a decline is not a loss until it has stopped being recoverable. Every number
// here is built around that distinction:
//
//   at risk    a declined invoice whose fate is still open
//   recovered  the same invoice was later paid, by any route
//   lost       the subscription ended, or the invoice died, still unpaid
//
// Reporting "declines" as one number conflates all three and is worse than not
// measuring at all, because it reads like churn.
//
// THREE DENOMINATORS, deliberately kept apart:
//
//   decline rate   declined invoices ÷ every invoice charged in the window.
//                  How often the card says no.
//   loss rate      never-recovered declined invoices ÷ every invoice charged.
//                  What that actually costs after the retries run.
//   recovery rate  recovered ÷ (recovered + lost). Of the ones that RESOLVED,
//                  how many came back. Open invoices are excluded from this
//                  denominator on purpose: counting an invoice Stripe will retry
//                  tomorrow as "not recovered" reports every fresh decline as a
//                  failure and makes the rate sag whenever volume rises.
//
// COUNTING UNIT. Stripe re-emits invoice.payment_failed for each Smart Retry, so
// one unpaid invoice can produce four declines. Attempts and invoices are
// therefore counted separately everywhere, and MONEY IS ALWAYS COUNTED PER
// INVOICE — summing amount_due over attempts would report a $49 renewal that
// retried three times as $147 at risk.
//
// ATTRIBUTION. An invoice with attempts that failed for different reasons (short
// on Monday, blocked by the issuer on Thursday) is attributed to its LAST
// attempt: that is the reason it currently stands at, or the reason it died of.
// Attempt-level counts sit beside it, which is why attempts exceed invoices.

import {
  declineGuidance,
  transientClaimExpired,
  type DeclineCategory,
  type DeclineContext,
} from './declineReason.ts';

// Re-exported so a consumer of this module — including the client component,
// which cannot import the server-side one — gets the category vocabulary and
// the advice that goes with it from one place.
export type { DeclineCategory, DeclineContext };
export { declineGuidance, transientClaimExpired };

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * WHICH payment failed — the distinction the whole money view turns on.
 *
 *   trial_conversion  the FIRST charge at the end of a free trial. A conversion
 *                     that did not happen: this member has never paid, and
 *                     nothing about the product's value is in question — a bank
 *                     said no at the one moment the funnel had already worked.
 *   first_charge      the first charge of a subscription that had NO trial
 *                     (checkout straight to paid).
 *
 * The last two are the SAME LOSS — a conversion that did not close, by a member
 * who has never paid — and the report rolls them up as one figure. They are
 * stored apart for one reason worth keeping: the card behind a trial conversion
 * has been sitting on file since the trial started, while a no-trial first
 * charge runs on a card that cleared Checkout minutes ago. Card-on-file age is a
 * real decline driver, so if both paths are ever live at once, comparing their
 * rates says something the combined number cannot. On a product where every
 * signup takes a trial, `first_charge` is simply empty and never renders.
 *   renewal           an established paying customer's recurring charge. This is
 *                     involuntary churn in progress.
 *   other             prorations, plan-change invoices, manual invoices. Real
 *                     money, but neither a conversion nor a renewal, so it is
 *                     kept out of both rates rather than quietly padding one.
 *   unknown           no billing reason and no subscription history to infer
 *                     from. Never guessed into a real bucket.
 */
export type DeclineKind = 'trial_conversion' | 'first_charge' | 'renewal' | 'other' | 'unknown';

export const DECLINE_KIND_ORDER: readonly DeclineKind[] = [
  'trial_conversion',
  'first_charge',
  'renewal',
  'other',
  'unknown',
];

export const DECLINE_KIND_LABEL: Record<DeclineKind, string> = {
  trial_conversion: 'Trial conversion',
  first_charge: 'First charge (no trial)',
  renewal: 'Renewal',
  other: 'Proration / other',
  unknown: 'Unclassified',
};

export const DECLINE_KIND_BLURB: Record<DeclineKind, string> = {
  trial_conversion: 'Free trial ended and the first charge was declined. They have never paid.',
  first_charge: 'Signed up straight to paid, with no trial, and the very first charge was declined. Same loss as a trial conversion — the card is just newer.',
  renewal: 'An established paying member’s recurring charge was declined — involuntary churn in progress.',
  other: 'A plan-change proration or manual invoice. Counted, but excluded from the conversion and renewal rates.',
  unknown: 'Not enough history to say which kind of charge this was.',
};

/** How a declined invoice ended up. `open` is not yet an outcome. */
export type DeclineOutcome = 'open' | 'recovered' | 'lost';

/**
 * How the row reached the table — which decides what may be read off it.
 * `audit_backfill` rows are reconstructed from `stripe_payment_failed` audit
 * history and carry NO decline codes, so they are honest about the gap instead
 * of being reported as a wall of unexplained declines.
 */
export type DeclineSource = 'webhook' | 'audit_backfill' | 'stripe_backfill';

export const DECLINE_CATEGORY_ORDER: readonly DeclineCategory[] = [
  'insufficient_funds',
  'issuer_block',
  'card_problem',
  'authentication_required',
  'try_again',
  'blocked_by_risk',
  'unknown',
];

export const DECLINE_CATEGORY_LABEL: Record<DeclineCategory, string> = {
  insufficient_funds: 'Insufficient funds',
  issuer_block: 'Issuer blocked the card',
  card_problem: 'Card unusable (expired / wrong)',
  authentication_required: '3DS not completed',
  try_again: 'Transient — retry likely to clear',
  blocked_by_risk: 'We blocked it (Stripe Radar)',
  unknown: 'No usable decline code',
};

/**
 * Whether a category is one the MEMBER has to act on. Used to split the open
 * worklist into "chase this" and "leave it alone": pestering someone whose bank
 * balance was short — the single most common decline — burns goodwill on a
 * charge that Stripe's own retry usually collects.
 */
export const CATEGORY_NEEDS_MEMBER_ACTION: Record<DeclineCategory, boolean> = {
  insufficient_funds: false,
  issuer_block: true,
  card_problem: true,
  authentication_required: true,
  try_again: false,
  // Nothing the member can do — the decision is ours to review.
  blocked_by_risk: false,
  unknown: false,
};

/**
 * Whether THIS invoice needs somebody to contact the member — the table above,
 * corrected by what actually happened to it.
 *
 * The table answers per category, and for one category that is not enough.
 * `try_again` is marked false on the promise that Stripe's next retry will fix
 * it; when the retries have run and failed, the promise is broken and the row
 * needs a human. Leaving it false produced a worklist row that said "recovery
 * exhausted, needs action" in one column and "no action needed yet" in the next,
 * and the reassuring half is the one a person reads. Six invoices and $164 sat
 * in that contradiction.
 *
 * Deliberately scoped to `try_again`. It is the only category whose flag rests
 * on a PREDICTION about the future rather than on a standing fact about the
 * card, so it is the only one an attempt count can overturn. Whether an
 * exhausted `insufficient_funds` should also escalate is a real question and a
 * separate one.
 */
export function needsMemberAction(category: DeclineCategory, context?: DeclineContext): boolean {
  if (CATEGORY_NEEDS_MEMBER_ACTION[category]) return true;
  return category === 'try_again' && transientClaimExpired(context);
}

/**
 * WHO got the money in — inferred in core/paymentDeclinesServer.ts from when the
 * payment landed relative to the retry Stripe had queued. The split matters
 * because only one half is addressable: `auto_retry` recoveries happen whatever
 * you do, `member_action` recoveries are the ones a better dunning email, a
 * clearer card-update link or a phone call actually moves.
 */
export type RecoveryRoute = 'auto_retry' | 'member_action' | 'unknown';

export const RECOVERY_ROUTE_ORDER: readonly RecoveryRoute[] = ['auto_retry', 'member_action', 'unknown'];

export const RECOVERY_ROUTE_LABEL: Record<RecoveryRoute, string> = {
  auto_retry: 'Stripe retry collected it',
  member_action: 'Member fixed it themselves',
  unknown: 'Route unknown',
};

/**
 * WHERE AN UNPAID INVOICE ACTUALLY STANDS — asked of Stripe's own state, never
 * inferred from the invoice merely still being unpaid.
 *
 * The distinction this exists to enforce: "nobody has paid this" and "Stripe is
 * going to try again" are different claims, and only the second is a reason to
 * wait. Reporting every open decline as in-flight quietly converts revenue that
 * needs a human into revenue that looks handled.
 *
 *   retry_scheduled          Stripe has a next attempt queued. The only state in
 *                            which doing nothing is a plan.
 *   authentication_required  3DS was not completed. No retry clears it.
 *   payment_method_required  the card itself is unusable. Needs a new one.
 *   hard_decline             the network said do not retry.
 *   recovery_exhausted       Stripe has stopped: no attempt queued, or the
 *                            invoice is void or written off.
 *   manual_collection        the invoice is not on automatic collection, so
 *                            Stripe will never charge it at all.
 *   unknown                  we do not hold the invoice state needed to say.
 *                            Notably every row reconstructed from the audit log
 *                            before its invoice was re-read.
 */
export type RetryState =
  | 'retry_scheduled'
  | 'authentication_required'
  | 'payment_method_required'
  | 'hard_decline'
  | 'recovery_exhausted'
  | 'manual_collection'
  | 'unknown';

export const RETRY_STATE_LABEL: Record<RetryState, string> = {
  retry_scheduled: 'Retry scheduled',
  authentication_required: 'Needs 3DS',
  payment_method_required: 'Needs a new card',
  hard_decline: 'Hard decline — no retry',
  recovery_exhausted: 'Stripe has stopped trying',
  manual_collection: 'Not on automatic collection',
  unknown: 'Retry state unknown',
};

/** Whether this state means somebody has to do something. */
export const RETRY_STATE_NEEDS_ACTION: Record<RetryState, boolean> = {
  retry_scheduled: false,
  authentication_required: true,
  payment_method_required: true,
  hard_decline: true,
  recovery_exhausted: true,
  manual_collection: true,
  // Not actionable, but not safe to ignore either: it means we have not asked.
  unknown: false,
};

/**
 * Decide the retry state from Stripe's own fields, in descending order of
 * authority. Every branch is a fact we hold; the fall-through is 'unknown'
 * rather than an optimistic guess.
 */
export function deriveRetryState(input: {
  collectionMethod: string | null;
  invoiceStatus: string | null;
  nextAttemptAt: string | null;
  category: DeclineCategory;
  declineCode: string | null;
  nowMs: number;
}): RetryState {
  // Stripe is not collecting this at all.
  if (input.collectionMethod === 'send_invoice') return 'manual_collection';
  if (input.invoiceStatus === 'void' || input.invoiceStatus === 'uncollectible') return 'recovery_exhausted';

  // A queued attempt is the one positive signal, and it has to be in the future
  // to mean anything — a next_payment_attempt in the past is an attempt that has
  // already come and gone.
  if (input.nextAttemptAt) {
    const at = Date.parse(input.nextAttemptAt);
    if (Number.isFinite(at) && at >= input.nowMs) return 'retry_scheduled';
  }

  if (input.category === 'authentication_required') return 'authentication_required';
  if (input.category === 'card_problem') return 'payment_method_required';
  if (input.declineCode?.toLowerCase() === 'previously_declined_do_not_retry') return 'hard_decline';

  // We have the invoice's own state and it carries no queued attempt, so Stripe
  // is done. Without that state we have not asked, and say so.
  if (input.collectionMethod !== null || input.invoiceStatus !== null) return 'recovery_exhausted';
  return 'unknown';
}

export type LostReason = 'canceled' | 'uncollectible' | 'voided' | 'grace_expired' | 'unknown';

export const LOST_REASON_LABEL: Record<LostReason, string> = {
  canceled: 'Subscription canceled',
  uncollectible: 'Invoice written off',
  voided: 'Invoice voided',
  grace_expired: 'Recovery window expired',
  unknown: 'Unresolved',
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** One declined attempt, as the `payment_declines` table spells it. */
export type DeclineRecord = {
  id: string;
  invoiceId: string;
  /** Stripe's invoice.attempt_count at the moment of this failure (1-based). */
  attemptCount: number;
  chargeId: string | null;
  userId: string | null;
  email: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  tier: string | null;
  cadence: string | null;
  kind: DeclineKind;
  /**
   * Which acquisition channel first brought this member in
   * (users.signup_utm_source), resolved by joining the member at READ time
   * rather than stored on the row. First-touch attribution never changes once
   * set, so the join is as stable as a copy would be, and it works on the whole
   * history instead of only on rows written after a migration.
   *
   * Never a bare null in a loaded report: the loader resolves an unattributable
   * invoice to SIGNUP_SOURCE_UNATTRIBUTED and a member with no campaign to
   * SIGNUP_SOURCE_DIRECT or SIGNUP_SOURCE_UNTRACKED, because "we don't know who
   * this was" and "we know exactly who this was, and they came in organically"
   * are opposite facts that a shared null would merge. Null only on a record
   * built without attribution (a webhook write, a fixture), and read as
   * unattributed.
   */
  signupSource: string | null;
  billingReason: string | null;
  /** Cents Stripe tried to collect. The money at risk on this invoice. */
  amountDue: number;
  currency: string | null;
  failureCode: string | null;
  declineCode: string | null;
  networkDeclineCode: string | null;
  failureMessage: string | null;
  sellerMessage: string | null;
  category: DeclineCategory;
  /** card | link | cashapp | … — the strongest single predictor of a failure. */
  methodType: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardFunding: string | null;
  cardCountry: string | null;
  /** Stripe's next automatic retry, ISO, when it published one. */
  nextAttemptAt: string | null;
  /** End of the payment-recovery grace window, ISO, when one was open. */
  graceUntil: string | null;
  /** Stripe's `collection_method` — 'send_invoice' means it never auto-charges. */
  collectionMethod: string | null;
  /** Stripe's invoice `status` — void/uncollectible mean recovery is over. */
  invoiceStatus: string | null;
  failedAt: string;
  outcome: DeclineOutcome;
  resolvedAt: string | null;
  recoveredAmount: number | null;
  recoveryRoute: string | null;
  lostReason: string | null;
  source: DeclineSource;
};

/**
 * One SUCCESSFUL subscription invoice — the denominator. Without it a decline
 * count is a number with no scale: ten declines is a crisis at 40 charges a
 * month and a rounding error at 4,000.
 */
export type PaidInvoice = {
  invoiceId: string;
  subscriptionId: string | null;
  billingReason: string | null;
  /** Cents actually collected. Zero marks the trial-opening invoice. */
  amountPaid: number;
  paidAt: string;
  /**
   * The paying member's acquisition channel, same resolution as on a decline.
   * This side is what makes a per-source DECLINE RATE possible at all: the
   * instrument cuts have no paid-side denominator because a successful charge
   * leaves no row behind, but a successful charge does leave a member, and a
   * member carries a source.
   */
  signupSource?: string | null;
};

// ---------------------------------------------------------------------------
// Kind classification
// ---------------------------------------------------------------------------

/**
 * Billing reasons that are neither a conversion nor a renewal. A plan-change
 * proration is real money, but counting it as a renewal would make a member who
 * upgraded look like they renewed early, and counting its decline against the
 * conversion rate would be worse.
 */
const NON_PERIOD_BILLING_REASONS = new Set(['subscription_update', 'subscription_threshold', 'manual', 'upcoming']);

/**
 * Which kind of charge an attempt was.
 *
 * `trialConversion` is the authoritative answer when the caller has one — the
 * Stripe webhook derives it order-independently from the subscription's
 * `trial_end` (core/trialDunning.isTrialConversionFailure), which is the only
 * source that cannot be fooled by event ordering. Everything else is inferred
 * from the subscription's own invoice history:
 *
 *   • money already collected on this subscription  → renewal
 *   • a $0 `subscription_create` invoice seen first → the subscription had a
 *     trial, so its first real charge is the conversion
 *   • `subscription_create` with a real amount      → no trial; first charge
 *   • `subscription_cycle` with nothing paid before → the first cycle invoice of
 *     a subscription that has never paid, which is what a trial conversion IS.
 *     Inferred rather than asserted: it is also what the first observable
 *     invoice of a subscription whose earlier history predates our records looks
 *     like. `hadTrialOpener` is preferred wherever it is available.
 */
export function classifyAttemptKind(input: {
  billingReason: string | null;
  hadPriorPaidCharge: boolean;
  hadTrialOpener: boolean;
  trialConversion?: boolean | null;
}): DeclineKind {
  const reason = input.billingReason?.toLowerCase() ?? null;
  if (reason && NON_PERIOD_BILLING_REASONS.has(reason)) return 'other';
  if (input.trialConversion === true) return 'trial_conversion';
  if (input.hadPriorPaidCharge) return 'renewal';
  if (input.hadTrialOpener) return 'trial_conversion';
  if (reason === 'subscription_create') return 'first_charge';
  if (reason === 'subscription_cycle') return input.trialConversion === false ? 'renewal' : 'trial_conversion';
  return 'unknown';
}

/** A paid invoice of $0 on a brand-new subscription is the trial opener. */
function isTrialOpeningInvoice(invoice: Pick<PaidInvoice, 'billingReason' | 'amountPaid'>): boolean {
  return invoice.amountPaid === 0 && invoice.billingReason?.toLowerCase() === 'subscription_create';
}

export type ClassifiedPaidInvoice = PaidInvoice & { kind: DeclineKind };

/**
 * Walk a subscription's invoices oldest-first and label each one. Returns only
 * the invoices that MOVED MONEY: the $0 trial opener is remembered (it is what
 * proves the subscription had a trial) but never counted as a charge, exactly as
 * core/subscriptionPayments.ts refuses to let it count as a first payment.
 *
 * A proration deliberately does NOT consume the "first money on this
 * subscription" slot — otherwise a member who upgraded during their trial would
 * have their real conversion charge reported as a renewal.
 */
export function classifyPaidInvoices(paid: readonly PaidInvoice[]): ClassifiedPaidInvoice[] {
  const ordered = [...paid].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const trialOpener = new Set<string>();
  const paidCharge = new Set<string>();
  const out: ClassifiedPaidInvoice[] = [];
  for (const invoice of ordered) {
    const subKey = invoice.subscriptionId ?? `invoice:${invoice.invoiceId}`;
    if (isTrialOpeningInvoice(invoice)) {
      trialOpener.add(subKey);
      continue;
    }
    if (invoice.amountPaid <= 0) continue;
    const kind = classifyAttemptKind({
      billingReason: invoice.billingReason,
      hadPriorPaidCharge: paidCharge.has(subKey),
      hadTrialOpener: trialOpener.has(subKey),
    });
    if (kind !== 'other') paidCharge.add(subKey);
    out.push({ ...invoice, kind });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Day bucketing
// ---------------------------------------------------------------------------

const ET_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The America/New_York calendar day an instant falls on, as 'YYYY-MM-DD'.
 * Same key every other chart on the admin page buckets by, written out here
 * rather than imported so this module stays free of `server-only`
 * (core/dailyMetricsMath.ts does the same, for the same reason).
 */
function etDayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return ET_DAY_FORMATTER.format(date);
}

function dayRange(startMs: number, endMs: number): string[] {
  const days: string[] = [];
  const DAY_MS = 86_400_000;
  // Step by whole days from the start instant; the formatter collapses any DST
  // duplicate, and the Set guards the 23/25-hour days at the boundaries.
  const seen = new Set<string>();
  for (let t = startMs; t <= endMs + DAY_MS; t += DAY_MS) {
    const key = ET_DAY_FORMATTER.format(new Date(Math.min(t, endMs)));
    if (!seen.has(key)) {
      seen.add(key);
      days.push(key);
    }
    if (t >= endMs) break;
  }
  return days;
}

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export type DeclineTotals = {
  /** Declined ATTEMPTS — one per invoice.payment_failed, retries included. */
  attempts: number;
  /** Distinct declined INVOICES. The unit every money figure below uses. */
  invoices: number;
  /** Distinct members who had at least one declined invoice. */
  members: number;
  /** Cents on declined invoices, counted once per invoice. */
  amountAtRisk: number;
  recoveredInvoices: number;
  recoveredAmount: number;
  lostInvoices: number;
  lostAmount: number;
  openInvoices: number;
  openAmount: number;
  /** recovered ÷ (recovered + lost). Null until something has resolved. */
  recoveryRate: number | null;
};

export type DeclineBucket = DeclineTotals & {
  key: string;
  label: string;
  /** This bucket's share of all declined invoices in the window. */
  share: number | null;
};

export type DeclineHeadline = DeclineTotals & {
  /** Distinct invoices charged in the window: paid ∪ declined. */
  attemptedInvoices: number;
  /** Distinct invoices that were paid in the window. */
  paidInvoices: number;
  /** Cents collected in the window. */
  paidAmount: number;
  /** declined ÷ attempted. How often the card says no. */
  declineRate: number | null;
  /** never-recovered declined ÷ attempted. What it actually costs. */
  lossRate: number | null;
};

/**
 * A charge kind with its OWN denominator — the row that answers "what share of
 * my trial conversions is a bank costing me".
 *
 * A plain bucket cannot answer it: 40 declined conversions is a catastrophe
 * against 100 attempts and a footnote against 4,000, and the total attempt count
 * is the wrong scale for both (renewals usually outnumber conversions many times
 * over). So each kind carries the invoices actually CHARGED under that kind,
 * and its rates are computed against that.
 */
export type DeclineKindRow = DeclineHeadline & {
  key: DeclineKind;
  label: string;
  blurb: string;
  /** This kind's share of all declined invoices in the window. */
  share: number | null;
};

/**
 * A breakdown by a property of the PAYMENT INSTRUMENT — what the member paid
 * with, rather than what kind of charge it was. Its own type because the key is
 * an open set (card brands, ISO country codes, payment-method types) rather than
 * the closed DeclineKind union, and because it carries no paid-side denominator:
 * a successful charge leaves no row in this table, so the instrument behind it
 * is not here to count. Shares, not rates — see byInstrument.
 */
export type DeclineInstrumentRow = DeclineTotals & {
  key: string;
  label: string;
  /** This instrument's share of all declined invoices in the window. */
  share: number | null;
};

// ---------------------------------------------------------------------------
// Acquisition source
// ---------------------------------------------------------------------------

/**
 * The three buckets that are NOT a marketing channel, kept apart from each
 * other because collapsing them is how a source report starts lying.
 *
 *   DIRECT       a member we know, who arrived with no campaign on them. A real
 *                acquisition channel — organic search, word of mouth, a link
 *                somebody pasted — and usually the largest one.
 *   UNTRACKED    a member we know, who signed up before first-touch attribution
 *                existed. Their channel is not unknown-for-now; it was never
 *                recorded and never will be. Counting them as direct would
 *                inflate organic by the entire pre-tracking back catalogue.
 *   UNATTRIBUTED an invoice that could not be tied to a local account at all —
 *                a deleted member, a Stripe customer created outside signup.
 *                A data-quality bucket, not a channel.
 *
 * The parenthesized spelling is deliberate and load-bearing: sanitizeUtmSource
 * strips everything outside [a-z0-9._-], so no real utm_source can ever collide
 * with one of these keys.
 */
export const SIGNUP_SOURCE_DIRECT = '(direct / none)';
export const SIGNUP_SOURCE_UNTRACKED = '(before tracking)';
export const SIGNUP_SOURCE_UNATTRIBUTED = '(no local account)';

/** Keys that describe our records rather than a channel. */
export const SIGNUP_SOURCE_NON_CHANNEL: ReadonlySet<string> = new Set([
  SIGNUP_SOURCE_UNTRACKED,
  SIGNUP_SOURCE_UNATTRIBUTED,
]);

const SIGNUP_SOURCE_LABEL: Record<string, string> = {
  [SIGNUP_SOURCE_DIRECT]: 'Direct / organic',
  [SIGNUP_SOURCE_UNTRACKED]: 'Signed up before tracking',
  [SIGNUP_SOURCE_UNATTRIBUTED]: 'No local account',
};

export const SIGNUP_SOURCE_BLURB: Record<string, string> = {
  [SIGNUP_SOURCE_DIRECT]: 'Arrived with no campaign tag — organic search, word of mouth, a pasted link.',
  [SIGNUP_SOURCE_UNTRACKED]:
    'Joined before first-touch attribution shipped. Their channel was never recorded, so this row is a hole in the data rather than a finding about a channel.',
  [SIGNUP_SOURCE_UNATTRIBUTED]:
    'The invoice could not be matched to an account here — a deleted member, or a Stripe customer created outside signup. Shown so the rows still add up to the totals.',
};

/** Networks worth spelling properly; everything else is just capitalized. */
const SIGNUP_SOURCE_DISPLAY: Record<string, string> = {
  x: 'X',
  reddit: 'Reddit',
  youtube: 'YouTube',
  discord: 'Discord',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  substack: 'Substack',
  stocktwits: 'StockTwits',
  google: 'Google',
  bing: 'Bing',
  newsletter: 'Newsletter',
  email: 'Email',
};

export function signupSourceLabel(key: string): string {
  const preset = SIGNUP_SOURCE_LABEL[key];
  if (preset) return preset;
  const known = SIGNUP_SOURCE_DISPLAY[key];
  if (known) return known;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * 95% Wilson score interval for a proportion.
 *
 * The reason every source row carries one: this report's whole job is to answer
 * "does this channel decline more than that one", and at the volumes a single
 * campaign produces, a point estimate cannot answer it. Nine declines out of
 * twenty is 45% and also anywhere from 26% to 66% — which overlaps almost
 * every other row on the page. Wilson rather than the normal approximation
 * because it stays inside [0, 1] and does not collapse at 0 or 100%, which is
 * exactly where the small campaigns sit.
 */
export function wilsonInterval(successes: number, trials: number): { low: number; high: number } | null {
  if (!Number.isFinite(successes) || !Number.isFinite(trials) || trials <= 0) return null;
  const z = 1.959964;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/**
 * Charges below this in a source row cannot support a rate. Chosen from the
 * arithmetic, not taste: against a ~40% base rate the 95% interval is still
 * wider than ±18 points at n = 30, so anything thinner than this is a hint to
 * go and look, never a finding to act on.
 */
export const THIN_SOURCE_VOLUME = 25;

/**
 * One acquisition channel WITH a real denominator — the cut that separates "this
 * campaign sends people whose cards decline" from "this campaign sends more
 * people".
 *
 * Unlike the instrument rows (see byInstrument), this one can carry a true rate.
 * A successful charge leaves no row in payment_declines, so the card behind it
 * is unrecoverable; but it does leave a member, and the member carries a
 * first-touch source. So both sides of the ratio exist, and the row reports
 * declined ÷ charged rather than a share of the failures.
 */
export type DeclineSignupSourceRow = DeclineHeadline & {
  key: string;
  label: string;
  /** This source's share of all declined invoices in the window. */
  share: number | null;
  /** False for the untracked and unattributed buckets — records, not channels. */
  channel: boolean;
  /** Too few charges for the rate to mean anything. See THIN_SOURCE_VOLUME. */
  thin: boolean;
  /** 95% Wilson interval around declineRate. Null when nothing was charged. */
  declineRateInterval: { low: number; high: number } | null;
};

/**
 * Whether the per-source rates above can be compared to each other at all.
 *
 * The failure mode this exists to catch: if declines attribute to a member 98%
 * of the time and successful charges only 60% of the time, every named source
 * is missing two fifths of its denominator and every decline rate on the page is
 * inflated — uniformly enough to look like a real signal. Publishing the two
 * coverage figures next to the table is the only thing that makes that visible.
 */
export type SignupSourceAttribution = {
  declinedAttributed: number;
  declinedTotal: number;
  paidAttributed: number;
  paidTotal: number;
  /** Declined invoices tied to a member ÷ all declined invoices. */
  declineCoverage: number | null;
  /** Paid invoices tied to a member ÷ all paid invoices. */
  paidCoverage: number | null;
  /** Charges belonging to members who joined before attribution was captured. */
  untrackedInvoices: number;
  /** Charges on members who arrived with no campaign on them. */
  directInvoices: number;
  /**
   * The earliest signup that carries a campaign — the point before which
   * attribution was demonstrably not being captured. A DB fact, so it is passed
   * into the builder rather than derived here. Null when nothing is tagged at
   * all, which means every row below is a hole rather than a channel.
   */
  trackingSince: string | null;
  /** Distinct channels with at least one charge, excluding the two record buckets. */
  channels: number;
  /**
   * False when either side is under-attributed or the two sides differ enough
   * that the rates are not comparable. The UI must say so rather than let a
   * reader treat the ranking as real.
   */
  comparable: boolean;
};

export type DeclineCodeRow = {
  /** The most specific code the payload carried, as the issuer spelled it. */
  code: string;
  category: DeclineCategory;
  /** Stripe's own sentence, when one came with it. */
  sampleMessage: string | null;
  attempts: number;
  invoices: number;
  members: number;
  amountAtRisk: number;
  recoveredInvoices: number;
  lostInvoices: number;
  openInvoices: number;
  lostAmount: number;
  recoveryRate: number | null;
};

export type DeclineDayPoint = {
  day: string;
  attempts: number;
  invoices: number;
  members: number;
  amountAtRisk: number;
  recoveredInvoices: number;
  recoveredAmount: number;
  lostInvoices: number;
  lostAmount: number;
  openInvoices: number;
  /** Invoices PAID that day — the denominator behind `declineRate`. */
  paidInvoices: number;
  declineRate: number | null;
  trialConversion: number;
  firstCharge: number;
  renewal: number;
  other: number;
};

export type RecoveryLagBucket = { key: string; label: string; count: number; amount: number };

export type RecoveryLag = {
  /** Hours from a declined invoice's FIRST failure to the payment clearing. */
  medianHours: number | null;
  p90Hours: number | null;
  buckets: RecoveryLagBucket[];
  sampled: number;
};

export type DeclineDetail = {
  invoiceId: string;
  userId: string | null;
  email: string | null;
  subscriptionId: string | null;
  kind: DeclineKind;
  category: DeclineCategory;
  code: string | null;
  message: string | null;
  guidance: string;
  needsMemberAction: boolean;
  amount: number;
  currency: string | null;
  tier: string | null;
  cadence: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  attempts: number;
  firstFailedAt: string;
  lastFailedAt: string;
  nextAttemptAt: string | null;
  graceUntil: string | null;
  /** Where this invoice actually stands with Stripe. Never inferred from age. */
  retryState: RetryState;
  retryNeedsAction: boolean;
  outcome: DeclineOutcome;
  resolvedAt: string | null;
  lostReason: string | null;
  /** Hours the invoice has been unpaid, at report time. */
  ageHours: number;
};

export type RepeatMember = {
  userId: string | null;
  email: string | null;
  invoices: number;
  attempts: number;
  amountAtRisk: number;
  lostAmount: number;
  recoveredAmount: number;
  openAmount: number;
  categories: DeclineCategory[];
  kinds: DeclineKind[];
  lastFailedAt: string;
  /** True when this member has never had a declined invoice recover. */
  neverRecovered: boolean;
};

export type DeclineCoverage = {
  /** Attempts whose issuer reason we actually captured. */
  withCodes: number;
  /** Attempts with no code — backfilled history, or a payload that carried none. */
  withoutCodes: number;
  bySource: Array<{ source: DeclineSource; attempts: number }>;
  /** Oldest decline on record, ISO — "reasons tracked since". */
  firstCodedAt: string | null;
  firstRecordedAt: string | null;
};

/**
 * The two never-paid-before kinds added together — the number to read first,
 * because a conversion that did not close is one loss however the member got to
 * the charge. Null when neither kind is present at all.
 */
export type FirstPaymentRollup = DeclineHeadline & { kinds: DeclineKind[] };

export type DeclineReport = {
  windowDays: number | null;
  since: string | null;
  generatedAt: string;
  /** The currency every cent figure is in; mixed data falls back to the mode. */
  currency: string;
  totals: DeclineHeadline;
  /** The immediately preceding window of equal length, or null for all-time. */
  previous: DeclineHeadline | null;
  byKind: DeclineKindRow[];
  /** trial_conversion + first_charge, as one figure. */
  firstPayment: FirstPaymentRollup | null;
  byCategory: DeclineBucket[];
  byCode: DeclineCodeRow[];
  byBrand: DeclineBucket[];
  /**
   * The three cuts a live audit found actually separate a failed conversion from
   * a successful one. Each carries its own attempt volume, because "debit cards
   * are 40% of my declines" and "debit cards decline twice as often as credit"
   * are different claims and only the second is a reason to do anything.
   */
  byMethodType: DeclineInstrumentRow[];
  byFunding: DeclineInstrumentRow[];
  byCountry: DeclineInstrumentRow[];
  /**
   * Decline rate by the channel the member was acquired through — the one cut
   * that asks whether a share of the losses was ever a billing problem at all.
   * A campaign that sends people who start a trial and then decline at twice
   * everyone else's rate is an acquisition-quality finding, and no amount of
   * dunning, retry tuning or card-update prompting will fix it.
   */
  bySignupSource: DeclineSignupSourceRow[];
  /**
   * The same cut over FIRST payments only. This is the one to read: a renewal
   * decline says something about a card two years after the click that won it,
   * while a trial conversion that will not close is the campaign's own result.
   * Null when the window holds no first payments at all.
   */
  bySignupSourceFirstPayment: DeclineSignupSourceRow[] | null;
  /** Whether the two lists above can be compared across rows. Read it first. */
  signupSourceAttribution: SignupSourceAttribution;
  byAttempt: DeclineBucket[];
  byPlan: DeclineBucket[];
  /** How the recovered invoices came back. Computed over recoveries only. */
  byRecoveryRoute: DeclineBucket[];
  daily: DeclineDayPoint[];
  recoveryLag: RecoveryLag;
  openWorklist: DeclineDetail[];
  /** The still-open invoices grouped by where they stand with Stripe. */
  openByRetryState: Array<{ key: RetryState; label: string; invoices: number; amount: number; needsAction: boolean }>;
  recentLosses: DeclineDetail[];
  repeatMembers: RepeatMember[];
  coverage: DeclineCoverage;
};

// ---------------------------------------------------------------------------
// Invoice rollup
// ---------------------------------------------------------------------------

/**
 * One declined invoice, folded from its attempts. Exported because the tests
 * assert on it directly and because the "which reason does this invoice count
 * as" rule is the one most likely to be misread later.
 */
export type DeclinedInvoice = {
  invoiceId: string;
  attempts: DeclineRecord[];
  /** The attempt that decides the invoice's reason: the most recent one. */
  last: DeclineRecord;
  first: DeclineRecord;
  amount: number;
  outcome: DeclineOutcome;
  resolvedAt: string | null;
  recoveredAmount: number;
  /**
   * From the attempt that recorded the loss, NOT from the last attempt. An
   * invoice can be closed by an event that lands against one of its attempts
   * while a later retry is still marked open, and reading `last` there reports
   * a lost invoice with no reason at all.
   */
  lostReason: string | null;
};

export function foldDeclinesToInvoices(records: readonly DeclineRecord[]): DeclinedInvoice[] {
  const byInvoice = new Map<string, DeclineRecord[]>();
  for (const record of records) {
    const list = byInvoice.get(record.invoiceId);
    if (list) list.push(record);
    else byInvoice.set(record.invoiceId, [record]);
  }
  const out: DeclinedInvoice[] = [];
  for (const [invoiceId, list] of byInvoice) {
    const attempts = [...list].sort(
      (a, b) => a.failedAt.localeCompare(b.failedAt) || a.attemptCount - b.attemptCount,
    );
    const first = attempts[0];
    const last = attempts[attempts.length - 1];
    // Money once per invoice, at the largest amount any attempt carried: the
    // retries are the same invoice, and a $0 on one malformed payload must not
    // erase the amount a good one recorded.
    const amount = attempts.reduce((max, a) => Math.max(max, a.amountDue), 0);
    // An invoice is recovered if ANY attempt recorded the recovery (the resolver
    // stamps them all), lost only if none did and one says lost.
    const recovered = attempts.find((a) => a.outcome === 'recovered');
    const lost = attempts.find((a) => a.outcome === 'lost');
    const outcome: DeclineOutcome = recovered ? 'recovered' : lost ? 'lost' : 'open';
    const resolved = recovered ?? lost ?? null;
    out.push({
      invoiceId,
      attempts,
      first,
      last,
      amount,
      outcome,
      resolvedAt: resolved?.resolvedAt ?? null,
      recoveredAmount: recovered ? (recovered.recoveredAmount ?? amount) : 0,
      lostReason: recovered ? null : (lost?.lostReason ?? null),
    });
  }
  return out.sort((a, b) => a.first.failedAt.localeCompare(b.first.failedAt));
}

function emptyTotals(): DeclineTotals {
  return {
    attempts: 0,
    invoices: 0,
    members: 0,
    amountAtRisk: 0,
    recoveredInvoices: 0,
    recoveredAmount: 0,
    lostInvoices: 0,
    lostAmount: 0,
    openInvoices: 0,
    openAmount: 0,
    recoveryRate: null,
  };
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function totalsFor(invoices: readonly DeclinedInvoice[]): DeclineTotals {
  const totals = emptyTotals();
  const members = new Set<string>();
  for (const invoice of invoices) {
    totals.attempts += invoice.attempts.length;
    totals.invoices += 1;
    totals.amountAtRisk += invoice.amount;
    const memberKey = invoice.last.userId ?? invoice.last.email ?? `invoice:${invoice.invoiceId}`;
    members.add(memberKey);
    if (invoice.outcome === 'recovered') {
      totals.recoveredInvoices += 1;
      totals.recoveredAmount += invoice.recoveredAmount;
    } else if (invoice.outcome === 'lost') {
      totals.lostInvoices += 1;
      totals.lostAmount += invoice.amount;
    } else {
      totals.openInvoices += 1;
      totals.openAmount += invoice.amount;
    }
  }
  totals.members = members.size;
  totals.recoveryRate = rate(totals.recoveredInvoices, totals.recoveredInvoices + totals.lostInvoices);
  return totals;
}

function bucketize<T extends string>(
  invoices: readonly DeclinedInvoice[],
  keyOf: (invoice: DeclinedInvoice) => T,
  order: readonly T[] | null,
  labelOf: (key: T) => string,
): DeclineBucket[] {
  const groups = new Map<T, DeclinedInvoice[]>();
  for (const invoice of invoices) {
    const key = keyOf(invoice);
    const list = groups.get(key);
    if (list) list.push(invoice);
    else groups.set(key, [invoice]);
  }
  const keys = order ? order.filter((k) => groups.has(k)) : [...groups.keys()];
  const buckets = keys.map((key) => ({
    key,
    label: labelOf(key),
    ...totalsFor(groups.get(key) ?? []),
    share: rate((groups.get(key) ?? []).length, invoices.length),
  }));
  // A caller-supplied order is an editorial order and is kept; anything else
  // sorts by money at risk, which is what the operator is scanning for.
  return order ? buckets : buckets.sort((a, b) => b.amountAtRisk - a.amountAtRisk || b.invoices - a.invoices);
}

/** The most specific code an attempt carried, for the raw-code table. */
function declineCodeOf(record: DeclineRecord): string | null {
  if (record.declineCode) return record.declineCode;
  if (record.networkDeclineCode) return `network ${record.networkDeclineCode}`;
  if (record.failureCode) return record.failureCode;
  return null;
}

function buildCodeRows(invoices: readonly DeclinedInvoice[]): DeclineCodeRow[] {
  type Acc = {
    code: string;
    category: DeclineCategory;
    sampleMessage: string | null;
    attempts: number;
    invoices: Set<string>;
    members: Set<string>;
    amountAtRisk: number;
    recoveredInvoices: number;
    lostInvoices: number;
    openInvoices: number;
    lostAmount: number;
  };
  const acc = new Map<string, Acc>();
  for (const invoice of invoices) {
    const code = declineCodeOf(invoice.last);
    if (!code) continue;
    let row = acc.get(code);
    if (!row) {
      row = {
        code,
        category: invoice.last.category,
        sampleMessage: invoice.last.sellerMessage ?? invoice.last.failureMessage,
        attempts: 0,
        invoices: new Set(),
        members: new Set(),
        amountAtRisk: 0,
        recoveredInvoices: 0,
        lostInvoices: 0,
        openInvoices: 0,
        lostAmount: 0,
      };
      acc.set(code, row);
    }
    row.sampleMessage ??= invoice.last.sellerMessage ?? invoice.last.failureMessage;
    row.attempts += invoice.attempts.filter((a) => declineCodeOf(a) === code).length;
    row.invoices.add(invoice.invoiceId);
    row.members.add(invoice.last.userId ?? invoice.last.email ?? `invoice:${invoice.invoiceId}`);
    row.amountAtRisk += invoice.amount;
    if (invoice.outcome === 'recovered') row.recoveredInvoices += 1;
    else if (invoice.outcome === 'lost') {
      row.lostInvoices += 1;
      row.lostAmount += invoice.amount;
    } else row.openInvoices += 1;
  }
  return [...acc.values()]
    .map((row) => ({
      code: row.code,
      category: row.category,
      sampleMessage: row.sampleMessage,
      attempts: row.attempts,
      invoices: row.invoices.size,
      members: row.members.size,
      amountAtRisk: row.amountAtRisk,
      recoveredInvoices: row.recoveredInvoices,
      lostInvoices: row.lostInvoices,
      openInvoices: row.openInvoices,
      lostAmount: row.lostAmount,
      recoveryRate: rate(row.recoveredInvoices, row.recoveredInvoices + row.lostInvoices),
    }))
    .sort((a, b) => b.invoices - a.invoices || b.amountAtRisk - a.amountAtRisk);
}

const LAG_BUCKETS: Array<{ key: string; label: string; maxHours: number }> = [
  { key: 'lt1h', label: 'Under 1 hour', maxHours: 1 },
  { key: 'lt24h', label: '1–24 hours', maxHours: 24 },
  { key: 'lt3d', label: '1–3 days', maxHours: 72 },
  { key: 'lt7d', label: '3–7 days', maxHours: 168 },
  { key: 'gte7d', label: 'Over 7 days', maxHours: Number.POSITIVE_INFINITY },
];

function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function buildRecoveryLag(invoices: readonly DeclinedInvoice[]): RecoveryLag {
  const hours: number[] = [];
  const counts = new Map<string, { count: number; amount: number }>();
  for (const bucket of LAG_BUCKETS) counts.set(bucket.key, { count: 0, amount: 0 });
  for (const invoice of invoices) {
    if (invoice.outcome !== 'recovered' || !invoice.resolvedAt) continue;
    const start = Date.parse(invoice.first.failedAt);
    const end = Date.parse(invoice.resolvedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const lag = (end - start) / 3_600_000;
    hours.push(lag);
    const bucket = LAG_BUCKETS.find((b) => lag < b.maxHours) ?? LAG_BUCKETS[LAG_BUCKETS.length - 1];
    const cell = counts.get(bucket.key)!;
    cell.count += 1;
    cell.amount += invoice.recoveredAmount;
  }
  hours.sort((a, b) => a - b);
  return {
    medianHours: quantile(hours, 0.5),
    p90Hours: quantile(hours, 0.9),
    sampled: hours.length,
    buckets: LAG_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      count: counts.get(b.key)?.count ?? 0,
      amount: counts.get(b.key)?.amount ?? 0,
    })),
  };
}

function detailOf(invoice: DeclinedInvoice, nowMs: number): DeclineDetail {
  const last = invoice.last;
  const retryState = deriveRetryState({
    collectionMethod: last.collectionMethod,
    invoiceStatus: last.invoiceStatus,
    nextAttemptAt: last.nextAttemptAt,
    category: last.category,
    declineCode: last.declineCode,
    nowMs,
  });
  // What the row already knows about its own retries, handed to the two fields
  // that used to ignore it. `retryNeedsAction` is the authoritative read; the
  // attempt count covers backfilled rows whose retry state is 'unknown' because
  // the Stripe columns did not exist when they were written.
  const context: DeclineContext = {
    attempts: invoice.attempts.length,
    retriesExhausted: RETRY_STATE_NEEDS_ACTION[retryState],
  };
  const endMs = invoice.resolvedAt ? Date.parse(invoice.resolvedAt) : nowMs;
  const startMs = Date.parse(invoice.first.failedAt);
  const ageHours =
    Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, (endMs - startMs) / 3_600_000) : 0;
  return {
    invoiceId: invoice.invoiceId,
    userId: last.userId,
    email: last.email,
    subscriptionId: last.subscriptionId,
    kind: last.kind,
    category: last.category,
    code: declineCodeOf(last),
    message: last.sellerMessage ?? last.failureMessage,
    guidance: declineGuidance(last.category, context),
    needsMemberAction: needsMemberAction(last.category, context),
    amount: invoice.amount,
    currency: last.currency,
    tier: last.tier,
    cadence: last.cadence,
    cardBrand: last.cardBrand,
    cardLast4: last.cardLast4,
    attempts: invoice.attempts.length,
    firstFailedAt: invoice.first.failedAt,
    lastFailedAt: last.failedAt,
    nextAttemptAt: last.nextAttemptAt,
    graceUntil: last.graceUntil,
    retryState,
    retryNeedsAction: RETRY_STATE_NEEDS_ACTION[retryState],
    outcome: invoice.outcome,
    resolvedAt: invoice.resolvedAt,
    lostReason: invoice.lostReason,
    ageHours,
  };
}

const RETRY_STATE_ORDER: readonly RetryState[] = [
  'retry_scheduled',
  'authentication_required',
  'payment_method_required',
  'hard_decline',
  'recovery_exhausted',
  'manual_collection',
  'unknown',
];

function summarizeRetryStates(details: readonly DeclineDetail[]) {
  return RETRY_STATE_ORDER.map((key) => {
    const mine = details.filter((d) => d.retryState === key);
    return {
      key,
      label: RETRY_STATE_LABEL[key],
      invoices: mine.length,
      amount: mine.reduce((sum, d) => sum + d.amount, 0),
      needsAction: RETRY_STATE_NEEDS_ACTION[key],
    };
  }).filter((row) => row.invoices > 0);
}

function buildRepeatMembers(invoices: readonly DeclinedInvoice[]): RepeatMember[] {
  type Acc = Omit<RepeatMember, 'categories' | 'kinds'> & {
    categories: Set<DeclineCategory>;
    kinds: Set<DeclineKind>;
    recoveredInvoices: number;
  };
  const acc = new Map<string, Acc>();
  for (const invoice of invoices) {
    const last = invoice.last;
    const key = last.userId ?? last.email ?? `invoice:${invoice.invoiceId}`;
    let row = acc.get(key);
    if (!row) {
      row = {
        userId: last.userId,
        email: last.email,
        invoices: 0,
        attempts: 0,
        amountAtRisk: 0,
        lostAmount: 0,
        recoveredAmount: 0,
        openAmount: 0,
        lastFailedAt: last.failedAt,
        neverRecovered: true,
        categories: new Set(),
        kinds: new Set(),
        recoveredInvoices: 0,
      };
      acc.set(key, row);
    }
    row.invoices += 1;
    row.attempts += invoice.attempts.length;
    row.amountAtRisk += invoice.amount;
    row.categories.add(last.category);
    row.kinds.add(last.kind);
    if (last.failedAt > row.lastFailedAt) row.lastFailedAt = last.failedAt;
    if (invoice.outcome === 'recovered') {
      row.recoveredAmount += invoice.recoveredAmount;
      row.recoveredInvoices += 1;
    } else if (invoice.outcome === 'lost') row.lostAmount += invoice.amount;
    else row.openAmount += invoice.amount;
  }
  return [...acc.values()]
    .filter((row) => row.invoices > 1)
    .map((row) => ({
      userId: row.userId,
      email: row.email,
      invoices: row.invoices,
      attempts: row.attempts,
      amountAtRisk: row.amountAtRisk,
      lostAmount: row.lostAmount,
      recoveredAmount: row.recoveredAmount,
      openAmount: row.openAmount,
      categories: DECLINE_CATEGORY_ORDER.filter((c) => row.categories.has(c)),
      kinds: DECLINE_KIND_ORDER.filter((k) => row.kinds.has(k)),
      lastFailedAt: row.lastFailedAt,
      neverRecovered: row.recoveredInvoices === 0,
    }))
    .sort(
      (a, b) =>
        b.lostAmount + b.openAmount - (a.lostAmount + a.openAmount) ||
        b.invoices - a.invoices ||
        b.lastFailedAt.localeCompare(a.lastFailedAt),
    );
}

/**
 * The route recorded on the attempt that actually recovered. Falls back to the
 * last attempt's, and to 'unknown' when nothing recorded one.
 */
function recoveryRouteOf(invoice: DeclinedInvoice): RecoveryRoute {
  const recovered = invoice.attempts.find((a) => a.outcome === 'recovered') ?? invoice.last;
  const route = recovered.recoveryRoute;
  return route === 'auto_retry' || route === 'member_action' ? route : 'unknown';
}

const METHOD_TYPE_LABEL: Record<string, string> = {
  card: 'Card entered at checkout',
  link: 'Link',
  cashapp: 'Cash App Pay',
  us_bank_account: 'Bank account',
};

const FUNDING_LABEL: Record<string, string> = {
  credit: 'Credit',
  debit: 'Debit',
  prepaid: 'Prepaid',
};

/**
 * A breakdown by a property of the PAYMENT INSTRUMENT, each row against its own
 * attempt volume.
 *
 * These are SHARES OF THE FAILURES, never rates, and the type says so by
 * carrying no paid-side denominator at all. A successful charge leaves no row in
 * this table, so the instrument behind it is not here to divide by, and inventing
 * one would turn "debit is 40% of my declines" into the very different — and
 * unsupported — claim that debit declines 40% of the time. The true per-
 * instrument rate needs Stripe, which is what `make audit-trial-conversions`
 * computes.
 */
function byInstrument(
  invoices: readonly DeclinedInvoice[],
  keyOf: (invoice: DeclinedInvoice) => string | null,
  labels: Record<string, string> | null,
): DeclineInstrumentRow[] {
  const keys = new Set<string>();
  for (const invoice of invoices) keys.add(keyOf(invoice) ?? 'unknown');
  return [...keys]
    .map((key) => {
      const mine = invoices.filter((i) => (keyOf(i) ?? 'unknown') === key);
      return {
        key,
        label: key === 'unknown' ? 'Not recorded' : (labels?.[key] ?? key.toUpperCase()),
        share: rate(mine.length, invoices.length),
        ...totalsFor(mine),
      };
    })
    .sort((a, b) => b.invoices - a.invoices);
}

/** The bucket an invoice belongs to, with null read as "we could not tell". */
function sourceKeyOf(value: string | null | undefined): string {
  return value ?? SIGNUP_SOURCE_UNATTRIBUTED;
}

/**
 * Decline rate per acquisition channel, each against its own charge volume.
 *
 * Every invoice lands in exactly one bucket, including the two that describe our
 * records rather than a channel, so the rows still sum to the window's totals —
 * dropping the unattributable ones would quietly shrink the denominator and lift
 * every rate on the page.
 *
 * Ordering puts the real channels first by volume and pins the two record
 * buckets to the bottom: "signed up before tracking" is usually large and is
 * never the answer to anything.
 */
/**
 * An invoice that DECLINED and was later paid appears in both populations, and
 * each side resolves its member independently — the decline row from its own
 * user_id, the paid row from whatever the Stripe import or the audit trail
 * recorded. When those disagree the same invoice lands in two source rows at
 * once, the rows stop summing to the window's charges, and both rates move.
 *
 * The decline side wins, for the same reason it wins on kind: it is the record
 * made about this specific charge, written at the moment it failed.
 *
 * This is the identical seam reconcilePaidKinds closes for charge kind. It is
 * worth closing twice because it is invisible in aggregate — the totals stay
 * plausible and only the row sum gives it away.
 */
function reconcilePaidSources(
  invoices: readonly DeclinedInvoice[],
  paid: readonly ClassifiedPaidInvoice[],
): ClassifiedPaidInvoice[] {
  if (invoices.length === 0) return [...paid];
  const declinedSource = new Map(invoices.map((i) => [i.invoiceId, sourceKeyOf(i.last.signupSource)]));
  return paid.map((invoice) => {
    const source = declinedSource.get(invoice.invoiceId);
    return source && source !== sourceKeyOf(invoice.signupSource)
      ? { ...invoice, signupSource: source }
      : invoice;
  });
}

function buildSignupSourceRows(
  invoices: readonly DeclinedInvoice[],
  rawPaid: readonly ClassifiedPaidInvoice[],
): DeclineSignupSourceRow[] {
  const paid = reconcilePaidSources(invoices, rawPaid);
  const keys = new Set<string>();
  for (const invoice of invoices) keys.add(sourceKeyOf(invoice.last.signupSource));
  for (const invoice of paid) keys.add(sourceKeyOf(invoice.signupSource));

  return [...keys]
    .map((key) => {
      const mine = invoices.filter((i) => sourceKeyOf(i.last.signupSource) === key);
      const minePaid = paid.filter((p) => sourceKeyOf(p.signupSource) === key);
      const headline = headlineFor(mine, minePaid);
      return {
        key,
        label: signupSourceLabel(key),
        share: rate(mine.length, invoices.length),
        channel: !SIGNUP_SOURCE_NON_CHANNEL.has(key),
        thin: headline.attemptedInvoices < THIN_SOURCE_VOLUME,
        declineRateInterval: wilsonInterval(headline.invoices, headline.attemptedInvoices),
        ...headline,
      };
    })
    .filter((row) => row.attemptedInvoices > 0)
    .sort(
      (a, b) =>
        Number(b.channel) - Number(a.channel) ||
        b.attemptedInvoices - a.attemptedInvoices ||
        b.invoices - a.invoices ||
        a.key.localeCompare(b.key),
    );
}

const MIN_SOURCE_COVERAGE = 0.8;
const MAX_SOURCE_COVERAGE_GAP = 0.1;

function attributionOf(
  invoices: readonly DeclinedInvoice[],
  rawPaid: readonly ClassifiedPaidInvoice[],
  trackingSince: string | null,
): SignupSourceAttribution {
  const paid = reconcilePaidSources(invoices, rawPaid);
  const declinedKeys = invoices.map((i) => sourceKeyOf(i.last.signupSource));
  const paidKeys = paid.map((p) => sourceKeyOf(p.signupSource));

  // Per DISTINCT INVOICE, not per row on each side. An invoice that declined and
  // was then paid is present in both lists, and the figures below are published
  // as charge counts — "30 charges from members who joined before tracking" has
  // to mean thirty invoices, not thirty rows.
  const byInvoice = new Map<string, string>();
  for (const invoice of paid) byInvoice.set(invoice.invoiceId, sourceKeyOf(invoice.signupSource));
  for (const invoice of invoices) byInvoice.set(invoice.invoiceId, sourceKeyOf(invoice.last.signupSource));
  const all = [...byInvoice.values()];

  const attributed = (keys: readonly string[]) =>
    keys.filter((key) => key !== SIGNUP_SOURCE_UNATTRIBUTED).length;
  const declinedAttributed = attributed(declinedKeys);
  const paidAttributed = attributed(paidKeys);
  const declineCoverage = rate(declinedAttributed, declinedKeys.length);
  const paidCoverage = rate(paidAttributed, paidKeys.length);

  // Both sides have to be well attributed AND attributed to a similar degree.
  // One of those alone is not enough: 95% and 55% are both "mostly attributed"
  // and put a 40-point systematic bias between the numerator and the
  // denominator of every named channel.
  const comparable =
    declineCoverage != null
    && paidCoverage != null
    && declineCoverage >= MIN_SOURCE_COVERAGE
    && paidCoverage >= MIN_SOURCE_COVERAGE
    && Math.abs(declineCoverage - paidCoverage) <= MAX_SOURCE_COVERAGE_GAP;

  return {
    declinedAttributed,
    declinedTotal: declinedKeys.length,
    paidAttributed,
    paidTotal: paidKeys.length,
    declineCoverage,
    paidCoverage,
    trackingSince,
    untrackedInvoices: all.filter((key) => key === SIGNUP_SOURCE_UNTRACKED).length,
    directInvoices: all.filter((key) => key === SIGNUP_SOURCE_DIRECT).length,
    channels: new Set(all.filter((key) => !SIGNUP_SOURCE_NON_CHANNEL.has(key))).size,
    comparable,
  };
}

/**
 * Whether the "these rates are not comparable" warning has anything to say.
 *
 * `comparable` is false in two completely different situations: the two sides
 * really do diverge, and there is nothing to measure at all. A window with no
 * charges in it would otherwise render "— of declined invoices and — of paid
 * invoices could be tied to an account", which reads as a data problem where
 * there is only an empty window. The warning is about the RATIO, so it needs
 * both sides to exist before it means anything.
 */
export function sourceRatesAreSkewed(attribution: SignupSourceAttribution): boolean {
  return !attribution.comparable && attribution.declinedTotal > 0 && attribution.paidTotal > 0;
}

function attemptBucketKey(invoice: DeclinedInvoice): string {
  const n = invoice.attempts.length;
  if (n <= 1) return '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  return '4+';
}

const ATTEMPT_BUCKET_ORDER = ['1', '2', '3', '4+'] as const;

const ATTEMPT_BUCKET_LABEL: Record<string, string> = {
  '1': 'Failed once',
  '2': 'Failed twice',
  '3': 'Failed three times',
  '4+': 'Failed four or more times',
};

function planKey(record: DeclineRecord): string {
  const tier = record.tier ?? 'unknown';
  const cadence = record.cadence ?? 'unknown';
  return `${tier}:${cadence}`;
}

function planLabel(key: string): string {
  const [tier, cadence] = key.split(':');
  const tierLabel = tier === 'unknown' ? 'Plan unknown' : tier.charAt(0).toUpperCase() + tier.slice(1);
  const cadenceLabel = cadence === 'unknown' ? '' : ` · ${cadence.charAt(0).toUpperCase() + cadence.slice(1)}`;
  return `${tierLabel}${cadenceLabel}`;
}

function headlineFor(
  invoices: readonly DeclinedInvoice[],
  paid: readonly ClassifiedPaidInvoice[],
): DeclineHeadline {
  const totals = totalsFor(invoices);
  const declinedIds = new Set(invoices.map((i) => i.invoiceId));
  const paidIds = new Set(paid.map((p) => p.invoiceId));
  // Distinct invoices charged: an invoice that declined and then paid is ONE
  // attempt at collecting money, and counting it twice would understate both
  // rates by inflating their shared denominator.
  const attemptedInvoices = new Set([...paidIds, ...declinedIds]).size;
  const neverRecovered = invoices.filter((i) => i.outcome !== 'recovered').length;
  return {
    ...totals,
    attemptedInvoices,
    paidInvoices: paidIds.size,
    paidAmount: paid.reduce((sum, p) => sum + p.amountPaid, 0),
    declineRate: rate(declinedIds.size, attemptedInvoices),
    lossRate: rate(neverRecovered, attemptedInvoices),
  };
}

/**
 * One row per charge kind, each against its own attempt volume. Kinds with
 * neither a decline nor a successful charge in the window are dropped: an empty
 * "Proration / other" row on every screen is noise, and a zero there says
 * nothing.
 */
function buildKindRows(
  invoices: readonly DeclinedInvoice[],
  paid: readonly ClassifiedPaidInvoice[],
): DeclineKindRow[] {
  const reconciledPaid = reconcilePaidKinds(invoices, paid);
  return DECLINE_KIND_ORDER.map((kind) => {
    const kindInvoices = invoices.filter((i) => i.last.kind === kind);
    const kindPaid = reconciledPaid.filter((p) => p.kind === kind);
    return {
      key: kind,
      label: DECLINE_KIND_LABEL[kind],
      blurb: DECLINE_KIND_BLURB[kind],
      share: rate(kindInvoices.length, invoices.length),
      ...headlineFor(kindInvoices, kindPaid),
    };
  }).filter((row) => row.invoices > 0 || row.paidInvoices > 0);
}

/**
 * An invoice that DECLINED and was later paid appears in both lists, and each
 * side classifies it independently: the decline row carries the kind decided at
 * capture (or by the Stripe re-read), while the paid invoice is classified from
 * payment history. When those disagree the invoice lands in two kinds at once
 * and the per-kind totals sum to MORE than the invoices actually charged — the
 * same double-count the invoice-level fold prevents everywhere else, arriving
 * through the seam between the two populations.
 *
 * The decline side wins. It is the record made about this specific charge, and
 * for a first payment it can carry the subscription's own trial_end, which the
 * paid-side inference cannot see.
 */
function reconcilePaidKinds(
  invoices: readonly DeclinedInvoice[],
  paid: readonly ClassifiedPaidInvoice[],
): ClassifiedPaidInvoice[] {
  if (invoices.length === 0) return [...paid];
  const declinedKind = new Map(invoices.map((i) => [i.invoiceId, i.last.kind]));
  return paid.map((invoice) => {
    const kind = declinedKind.get(invoice.invoiceId);
    return kind && kind !== invoice.kind ? { ...invoice, kind } : invoice;
  });
}

/** The never-paid-before cohort, whichever door they came in through. */
const FIRST_PAYMENT_KINDS: readonly DeclineKind[] = ['trial_conversion', 'first_charge'];

function buildFirstPaymentRollup(
  invoices: readonly DeclinedInvoice[],
  paid: readonly ClassifiedPaidInvoice[],
): FirstPaymentRollup | null {
  const kinds = FIRST_PAYMENT_KINDS.filter(
    (kind) => invoices.some((i) => i.last.kind === kind) || paid.some((p) => p.kind === kind),
  );
  if (kinds.length === 0) return null;
  const mine = invoices.filter((i) => FIRST_PAYMENT_KINDS.includes(i.last.kind));
  const minePaid = reconcilePaidKinds(invoices, paid).filter((p) => FIRST_PAYMENT_KINDS.includes(p.kind));
  return { kinds, ...headlineFor(mine, minePaid) };
}

/**
 * The by-source cut narrowed to charges that would have been a member's FIRST
 * payment, which is the only version of it that reports on the campaign rather
 * than on a card. Null when the window holds no first payment either way, so
 * the UI can drop the panel instead of rendering an empty one.
 */
function buildFirstPaymentSourceRows(
  invoices: readonly DeclinedInvoice[],
  paid: readonly ClassifiedPaidInvoice[],
): DeclineSignupSourceRow[] | null {
  const mine = invoices.filter((i) => FIRST_PAYMENT_KINDS.includes(i.last.kind));
  const minePaid = reconcilePaidKinds(invoices, paid).filter((p) => FIRST_PAYMENT_KINDS.includes(p.kind));
  if (mine.length === 0 && minePaid.length === 0) return null;
  return buildSignupSourceRows(mine, minePaid);
}

function modeCurrency(records: readonly DeclineRecord[]): string {
  const counts = new Map<string, number>();
  for (const record of records) {
    const currency = record.currency?.toUpperCase();
    if (!currency) continue;
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  }
  let best = 'USD';
  let bestCount = 0;
  for (const [currency, count] of counts) {
    if (count > bestCount) {
      best = currency;
      bestCount = count;
    }
  }
  return best;
}

function coverageOf(records: readonly DeclineRecord[]): DeclineCoverage {
  let withCodes = 0;
  const bySource = new Map<DeclineSource, number>();
  let firstCodedAt: string | null = null;
  let firstRecordedAt: string | null = null;
  for (const record of records) {
    const coded = declineCodeOf(record) !== null;
    if (coded) {
      withCodes += 1;
      if (!firstCodedAt || record.failedAt < firstCodedAt) firstCodedAt = record.failedAt;
    }
    if (!firstRecordedAt || record.failedAt < firstRecordedAt) firstRecordedAt = record.failedAt;
    bySource.set(record.source, (bySource.get(record.source) ?? 0) + 1);
  }
  return {
    withCodes,
    withoutCodes: records.length - withCodes,
    bySource: [...bySource.entries()]
      .map(([source, attempts]) => ({ source, attempts }))
      .sort((a, b) => b.attempts - a.attempts),
    firstCodedAt,
    firstRecordedAt,
  };
}

function buildDaily(
  invoices: readonly DeclinedInvoice[],
  paid: readonly ClassifiedPaidInvoice[],
  startMs: number,
  endMs: number,
): DeclineDayPoint[] {
  const points = new Map<string, DeclineDayPoint>();
  for (const day of dayRange(startMs, endMs)) {
    points.set(day, {
      day,
      attempts: 0,
      invoices: 0,
      members: 0,
      amountAtRisk: 0,
      recoveredInvoices: 0,
      recoveredAmount: 0,
      lostInvoices: 0,
      lostAmount: 0,
      openInvoices: 0,
      paidInvoices: 0,
      declineRate: null,
      trialConversion: 0,
      firstCharge: 0,
      renewal: 0,
      other: 0,
    });
  }
  const membersByDay = new Map<string, Set<string>>();
  const ensure = (day: string): DeclineDayPoint | null => points.get(day) ?? null;

  // Attempts land on the day they FAILED; the invoice (and its money) lands on
  // the day of its first failure, so a retry cannot double-count the amount.
  for (const invoice of invoices) {
    for (const attempt of invoice.attempts) {
      const day = etDayKey(attempt.failedAt);
      const point = day ? ensure(day) : null;
      if (point) point.attempts += 1;
    }
    const day = etDayKey(invoice.first.failedAt);
    const point = day ? ensure(day) : null;
    if (!point || !day) continue;
    point.invoices += 1;
    point.amountAtRisk += invoice.amount;
    if (invoice.outcome === 'recovered') {
      point.recoveredInvoices += 1;
      point.recoveredAmount += invoice.recoveredAmount;
    } else if (invoice.outcome === 'lost') {
      point.lostInvoices += 1;
      point.lostAmount += invoice.amount;
    } else {
      point.openInvoices += 1;
    }
    const kind = invoice.last.kind;
    if (kind === 'trial_conversion') point.trialConversion += 1;
    else if (kind === 'first_charge') point.firstCharge += 1;
    else if (kind === 'renewal') point.renewal += 1;
    else point.other += 1;
    let members = membersByDay.get(day);
    if (!members) {
      members = new Set();
      membersByDay.set(day, members);
    }
    members.add(invoice.last.userId ?? invoice.last.email ?? `invoice:${invoice.invoiceId}`);
  }

  for (const invoice of paid) {
    const day = etDayKey(invoice.paidAt);
    const point = day ? ensure(day) : null;
    if (point) point.paidInvoices += 1;
  }

  for (const [day, members] of membersByDay) {
    const point = points.get(day);
    if (point) point.members = members.size;
  }
  for (const point of points.values()) {
    const attempted = point.paidInvoices + point.invoices;
    point.declineRate = rate(point.invoices, attempted);
  }
  return [...points.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export type DeclineReportInput = {
  /**
   * Every decline row in the window PLUS the preceding window of equal length
   * (so the trend can be computed) — the builder slices them itself.
   */
  declines: readonly DeclineRecord[];
  /** Successful invoices over the same span, for the denominators. */
  paid: readonly PaidInvoice[];
  /** Window length in days, or null for all time. */
  windowDays: number | null;
  /** Injected clock, so the report is deterministic under test. */
  nowMs: number;
  /** How many rows the worklists carry. */
  worklistLimit?: number;
  /**
   * The earliest signup carrying a campaign, from the attribution index. Passed
   * in because it is a fact about the members table, not about these invoices —
   * a window can easily contain no tagged signup at all and still sit years
   * after attribution started working.
   */
  attributionTrackingSince?: string | null;
};

const DEFAULT_WORKLIST_LIMIT = 50;

export function buildDeclineReport(input: DeclineReportInput): DeclineReport {
  const { declines, windowDays, nowMs } = input;
  const limit = input.worklistLimit ?? DEFAULT_WORKLIST_LIMIT;
  const windowMs = windowDays != null ? windowDays * 86_400_000 : null;
  const sinceMs = windowMs != null ? nowMs - windowMs : null;
  const since = sinceMs != null ? new Date(sinceMs).toISOString() : null;
  const previousSince = sinceMs != null && windowMs != null ? new Date(sinceMs - windowMs).toISOString() : null;

  const inWindow = (iso: string) => (since == null ? true : iso >= since);
  const inPrevious = (iso: string) =>
    since != null && previousSince != null ? iso >= previousSince && iso < since : false;

  const windowDeclines = declines.filter((d) => inWindow(d.failedAt));
  const previousDeclines = declines.filter((d) => inPrevious(d.failedAt));

  // Classification needs the FULL paid history, not just the window: whether a
  // charge is a renewal depends on money that moved before the window opened.
  const classifiedPaid = classifyPaidInvoices(input.paid);
  const windowPaid = classifiedPaid.filter((p) => inWindow(p.paidAt));
  const previousPaid = classifiedPaid.filter((p) => inPrevious(p.paidAt));

  const invoices = foldDeclinesToInvoices(windowDeclines);
  const previousInvoices = foldDeclinesToInvoices(previousDeclines);

  const startMs = sinceMs ?? (invoices.length > 0 ? Date.parse(invoices[0].first.failedAt) : nowMs);

  const openInvoices = invoices
    .filter((i) => i.outcome === 'open')
    .sort((a, b) => b.last.failedAt.localeCompare(a.last.failedAt));
  const lostInvoices = invoices
    .filter((i) => i.outcome === 'lost')
    .sort((a, b) => (b.resolvedAt ?? b.last.failedAt).localeCompare(a.resolvedAt ?? a.last.failedAt));

  return {
    windowDays,
    since,
    generatedAt: new Date(nowMs).toISOString(),
    currency: modeCurrency(windowDeclines.length > 0 ? windowDeclines : declines),
    totals: headlineFor(invoices, windowPaid),
    previous: windowDays == null ? null : headlineFor(previousInvoices, previousPaid),
    byKind: buildKindRows(invoices, windowPaid),
    firstPayment: buildFirstPaymentRollup(invoices, windowPaid),
    byCategory: bucketize(
      invoices,
      (i) => i.last.category,
      DECLINE_CATEGORY_ORDER,
      (c) => DECLINE_CATEGORY_LABEL[c],
    ),
    byCode: buildCodeRows(invoices),
    byBrand: bucketize(
      invoices,
      (i) => i.last.cardBrand ?? 'Unknown card',
      null,
      (b) => b,
    ),
    byMethodType: byInstrument(invoices, (i) => i.last.methodType, METHOD_TYPE_LABEL),
    byFunding: byInstrument(invoices, (i) => i.last.cardFunding, FUNDING_LABEL),
    byCountry: byInstrument(invoices, (i) => i.last.cardCountry, null),
    bySignupSource: buildSignupSourceRows(invoices, windowPaid),
    bySignupSourceFirstPayment: buildFirstPaymentSourceRows(invoices, windowPaid),
    signupSourceAttribution: attributionOf(invoices, windowPaid, input.attributionTrackingSince ?? null),
    byAttempt: bucketize(invoices, attemptBucketKey, ATTEMPT_BUCKET_ORDER, (k) => ATTEMPT_BUCKET_LABEL[k] ?? k),
    byPlan: bucketize(invoices, (i) => planKey(i.last), null, planLabel),
    byRecoveryRoute: bucketize(
      invoices.filter((i) => i.outcome === 'recovered'),
      (i) => recoveryRouteOf(i),
      RECOVERY_ROUTE_ORDER,
      (r) => RECOVERY_ROUTE_LABEL[r],
    ),
    daily: buildDaily(invoices, windowPaid, startMs, nowMs),
    recoveryLag: buildRecoveryLag(invoices),
    openWorklist: openInvoices.slice(0, limit).map((i) => detailOf(i, nowMs)),
    openByRetryState: summarizeRetryStates(openInvoices.map((i) => detailOf(i, nowMs))),
    recentLosses: lostInvoices.slice(0, limit).map((i) => detailOf(i, nowMs)),
    repeatMembers: buildRepeatMembers(invoices).slice(0, 20),
    coverage: coverageOf(windowDeclines),
  };
}
