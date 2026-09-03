// Has a paying member used the product during the period they are about to be
// re-billed for?
//
// core/trialEngagement.ts asks this question once, at the trial boundary, and
// stops there. Nothing asks it again at renewal N. A member who paid for three
// months and quietly stopped logging in is re-billed with no dormancy-aware
// touch at all — the only cron that reaches an active subscriber before a
// billing event is send-card-expiry-reminders, and it only cares whether the
// card is about to die.
//
// The risk that produced docs/disputes/du_1U6cn34AOiqteMYYYCr2OaKn.md — a
// charge landing on someone who has not used the product — does not stop at
// the trial boundary, so the mitigation should not either.
//
// Kept PURE (no imports) so it is unit-tested without Stripe or a DB, the same
// discipline as core/cardExpiry.ts and core/paymentGrace.ts. Callers supply the
// persisted row and inject the clock. Locked down in
// tests/renewalEngagement.test.ts. Scope and rationale:
// docs/renewal-dormancy-reminder-scope.md.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Idle days after which a paying member counts as dormant. 30 reads as "has
// not shown up this cycle" on a monthly plan; on an annual plan it trips well
// before the renewal, which is the point — a year of silence is not a warning.
export const DEFAULT_DORMANCY_DAYS = 30;
export const MIN_DORMANCY_DAYS = 7;
export const MAX_DORMANCY_DAYS = 90;

// How far ahead of the renewal the notice goes out. Longer than the trial
// reminder's 48h on purpose: there is no unconditional-refund promise behind a
// renewal, so the member needs real room to act on it.
export const DEFAULT_LEAD_HOURS = 72;
export const MIN_LEAD_HOURS = 24;
export const MAX_LEAD_HOURS = 168;

export type RenewalEngagement =
  // Authenticated request inside the dormancy window. Renewing on a member who
  // is actually using the product — nothing to warn about.
  | 'engaged'
  // No authenticated request for dormancyDays. About to be re-billed for a
  // period they did not touch.
  | 'dormant'
  // No usable signal: the account predates users.last_seen_at. Absence of data
  // is NOT evidence of dormancy.
  | 'unknown';

export type ClassifyRenewalEngagementInput = {
  // users.last_seen_at — rewritten on authenticated requests, throttled to
  // AUTH_LAST_SEEN_THROTTLE_SECONDS (15m) in core/serverAuth.ts. Far finer
  // than a day-level threshold needs. NULL on any account created before that
  // column shipped.
  lastSeenAtIso: string | null;
  nowIso: string;
  dormancyDays?: number;
};

export type RenewalSkipReason =
  // cancel_at_period_end — no renewal is coming, so a renewal notice is wrong.
  | 'canceling'
  // No first_payment_cleared: a comped member or a partner grant. Telling them
  // a price renews would be a lie.
  | 'never-paid'
  // No current_period_end to renew against.
  | 'no-period-end'
  // Renewal is further out than leadHours, or already past.
  | 'outside-window'
  // Already warned about this exact period.
  | 'already-notified'
  // Using the product. This is the healthy majority.
  | 'engaged'
  // Pre-cutover account — see the asymmetry note on decideRenewalReminder.
  | 'unknown-engagement';

export type RenewalReminderInput = {
  // Caller filters subscription_status = 'active' and deleted_at IS NULL in
  // SQL, the way send-card-expiry-reminders.mts does. 'active' is also what
  // keeps this cohort disjoint from send-trial-reminders.mts, which selects
  // status = 'trialing': a converting trial is never active, and an active sub
  // is always past its trial, so the two crons cannot both mail one member.
  cancelAtPeriodEnd: boolean;
  firstPaymentClearedAtIso: string | null;
  currentPeriodEndIso: string | null;
  lastSeenAtIso: string | null;
  // users.renewal_dormancy_notified_period — the current_period_end ISO we last
  // warned about. Latching on the period being renewed re-arms once per cycle
  // for free, monthly and annual alike (same trick as card_expiry_notified_ym).
  alreadyNotifiedPeriod: string | null;
  nowIso: string;
  leadHours?: number;
  dormancyDays?: number;
};

export type RenewalReminderDecision = {
  shouldSend: boolean;
  engagement: RenewalEngagement;
  // 'eligible' when shouldSend, else the first gate that failed. Carried so the
  // scan and the dry-run can explain every skip instead of silently dropping
  // rows — the trial cron's opacity about this is what made the original
  // dispute cohort invisible.
  reason: RenewalSkipReason | 'eligible';
  // Value to stamp into renewal_dormancy_notified_period on send.
  notifyPeriod: string | null;
  hoursToRenewal: number | null;
};

function parse(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampDormancyDays(days: number | undefined): number {
  if (days === undefined) return DEFAULT_DORMANCY_DAYS;
  return clamp(days, MIN_DORMANCY_DAYS, MAX_DORMANCY_DAYS, DEFAULT_DORMANCY_DAYS);
}

export function clampLeadHours(hours: number | undefined): number {
  if (hours === undefined) return DEFAULT_LEAD_HOURS;
  return clamp(hours, MIN_LEAD_HOURS, MAX_LEAD_HOURS, DEFAULT_LEAD_HOURS);
}

export function classifyRenewalEngagement(
  input: ClassifyRenewalEngagementInput,
): RenewalEngagement {
  const lastSeen = parse(input.lastSeenAtIso);
  const now = parse(input.nowIso);

  if (now === null) return 'unknown';
  // NULL last_seen_at is a pre-cutover account, not a member who never showed
  // up. Reading it as dormancy would mail the entire legacy book on the first
  // run — the same trap core/trialEngagement.ts calls out.
  if (lastSeen === null) return 'unknown';

  const idleMs = now - lastSeen;
  // A last_seen marginally in the future (clock skew, a mirror written ahead)
  // is activity, not dormancy.
  if (idleMs <= 0) return 'engaged';

  return idleMs > clampDormancyDays(input.dormancyDays) * DAY_MS ? 'dormant' : 'engaged';
}

// Fails toward NOT sending.
//
// The asymmetry is inherited from core/trialEngagement.ts but the reason is
// different, and worth stating so nobody "fixes" it later. There, both cohorts
// get an email and only the copy differs, so a misread sends the wrong words.
// Here, only the dormant cohort is mailed at all, so a misread either mails
// someone who did not need it (harmless — the copy is value-forward, see the
// scope doc) or skips someone who did (a missed notice). Skipping looks like
// the worse error, and for one member it is.
//
// It still fails toward skipping, because the failure mode is not one member:
// 'unknown' means NULL last_seen_at, which is a property of every account
// created before that column shipped. Treat NULL as dormant and the first
// cron run does not miss a notice, it mails the whole legacy book at once.
export function decideRenewalReminder(input: RenewalReminderInput): RenewalReminderDecision {
  const engagement = classifyRenewalEngagement({
    lastSeenAtIso: input.lastSeenAtIso,
    nowIso: input.nowIso,
    dormancyDays: input.dormancyDays,
  });

  const now = parse(input.nowIso);
  const periodEnd = parse(input.currentPeriodEndIso);
  const hoursToRenewal =
    now === null || periodEnd === null ? null : (periodEnd - now) / HOUR_MS;

  const skip = (reason: RenewalSkipReason): RenewalReminderDecision => ({
    shouldSend: false,
    engagement,
    reason,
    notifyPeriod: null,
    hoursToRenewal,
  });

  if (input.cancelAtPeriodEnd) return skip('canceling');
  if (!input.firstPaymentClearedAtIso) return skip('never-paid');
  if (periodEnd === null || now === null) return skip('no-period-end');
  if (hoursToRenewal === null || hoursToRenewal <= 0) return skip('outside-window');
  if (hoursToRenewal > clampLeadHours(input.leadHours)) return skip('outside-window');
  // Compared as the raw stored string: the latch stamps exactly what was read
  // out of current_period_end, so a byte comparison is the honest one.
  if (
    input.alreadyNotifiedPeriod !== null &&
    input.alreadyNotifiedPeriod === input.currentPeriodEndIso
  ) {
    return skip('already-notified');
  }
  if (engagement === 'unknown') return skip('unknown-engagement');
  if (engagement === 'engaged') return skip('engaged');

  return {
    shouldSend: true,
    engagement,
    reason: 'eligible',
    notifyPeriod: input.currentPeriodEndIso,
    hoursToRenewal,
  };
}

// Whole days between a member's last authenticated request and now, for the
// scan report. Null when either end is unknown.
export function idleDays(lastSeenAtIso: string | null, nowIso: string): number | null {
  const lastSeen = parse(lastSeenAtIso);
  const now = parse(nowIso);
  if (lastSeen === null || now === null) return null;
  return Math.floor((now - lastSeen) / DAY_MS);
}
