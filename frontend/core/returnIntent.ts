// Pure decision logic for the RETURN-INTENT sweep — the one touch that answers a
// churned member walking back onto the site of their own accord.
//
// THE GAP THIS FILLS. Every other churn touch fires on a CALENDAR. The
// cancellation acknowledgment goes out the moment they click Cancel; the
// win-back goes out ~30 days after access actually ends
// (scripts/send-winback.mts). Both are guesses about when someone might be
// receptive. Neither knows anything about the member.
//
// Meanwhile a churned member who logs in is not a guess. They are standing in
// the doorway of a product they no longer have access to, which is the single
// highest-intent signal the system produces — and nothing reads it. Their
// win-back fired months ago, when they were cold. The return is unanswered.
//
// WHY A COOLDOWN, NOT A LATCH. Every existing nudge is latched once per account
// and never cleared: verified_never_paid_email_sent_at, reactivation_email_sent_at,
// checkout_recovery_email_sent_at, verify_reminder_email_sent_at. That design is
// right for a one-time milestone and fatal for a recurring signal — it spends the
// whole cohort on a single send and leaves nothing for the next two years of
// churn. This one throttles instead: at most one email per member per
// COOLDOWN_DAYS, re-arming afterwards, and only ever in response to a NEW visit.
// So it works on today's churned book and on every future churn, indefinitely.
//
// Kept PURE (no imports at all) so the whole eligibility matrix is unit-tested
// without a DB, a clock or Resend — the same discipline as
// core/graceExpiryWarning.ts and core/cancelRetention.ts. Locked down in
// tests/returnIntent.test.ts.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** At most one return-intent email per member per this many days. */
export const DEFAULT_COOLDOWN_DAYS = 90;
/**
 * How long after a visit we wait before mailing. Two reasons, both load-bearing:
 * a member still in the session may well resubscribe on their own — mailing them
 * mid-visit is at best redundant and at worst insulting — and a same-minute
 * "we saw you" reads like surveillance rather than service.
 */
export const DEFAULT_QUIET_HOURS = 24;
/**
 * Oldest visit worth answering. Past this the note is no longer a reply to
 * anything; it is just unsolicited mail, and the win-back already owns that job.
 */
export const DEFAULT_MAX_LOGIN_AGE_DAYS = 14;

export type ReturnIntentInput = {
  /** users.subscription_lapsed = 1 — the subscription actually ended. */
  subscriptionLapsed: boolean;
  /** users.stripe_subscription_id — belt-and-suspenders for "really churned". */
  hasSubscriptionOnFile: boolean;
  /** users.email_verified_at — proved ownership, so the send won't bounce. */
  emailVerified: boolean;
  /** users.deleted_at — a self-deleted account is excluded from all outbound mail. */
  deleted: boolean;
  /** users.marketing_unsubscribed_at — this is marketing, so it must be honored. */
  marketingUnsubscribed: boolean;
  /** users.tier — an operator account is never mailed a win-back. */
  tier: string;
  /**
   * Most recent `stripe_subscription_deleted` audit event. Most-recent, not
   * first: a member who churned, returned and churned again is measured from
   * their latest exit, matching how send-winback.mts anchors its window.
   */
  churnedAt: string | null;
  /**
   * Most recent `login_success` audit event. Null when they have never logged in
   * explicitly, which for this purpose means they have not come back.
   */
  lastLoginAt: string | null;
  /** users.return_intent_email_sent_at — the cooldown anchor. Null = never sent. */
  lastSentAt: string | null;
  nowMs: number;
  cooldownDays?: number;
  quietHours?: number;
  maxLoginAgeDays?: number;
};

/**
 * Why a member was skipped. Reported per-member by --dry-run so a run explains
 * itself, in the same spirit as send-grace-expiry-warnings.mts's skip tally.
 */
export type SkipReason =
  | 'not-churned'
  | 'subscription-on-file'
  | 'unverified'
  | 'deleted'
  | 'unsubscribed'
  | 'operator'
  | 'no-churn-date'
  | 'never-returned'
  | 'login-predates-churn'
  | 'visit-too-recent'
  | 'visit-too-old'
  | 'within-cooldown'
  | 'already-answered';

export type ReturnIntentDecision =
  | { send: true; loginAt: string; churnedAt: string }
  | { send: false; reason: SkipReason };

function parseMs(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Should this member get a return-intent email right now?
 *
 * Ordered so the reason a member is skipped is the most informative one
 * available: hard disqualifiers (not churned, opted out, deleted) before
 * timing ones, so a dry-run tally reads as a funnel rather than a jumble.
 */
export function decideReturnIntent(input: ReturnIntentInput): ReturnIntentDecision {
  const cooldownMs = (input.cooldownDays ?? DEFAULT_COOLDOWN_DAYS) * DAY_MS;
  const quietMs = (input.quietHours ?? DEFAULT_QUIET_HOURS) * HOUR_MS;
  const maxAgeMs = (input.maxLoginAgeDays ?? DEFAULT_MAX_LOGIN_AGE_DAYS) * DAY_MS;

  if (!input.subscriptionLapsed) return { send: false, reason: 'not-churned' };
  if (input.hasSubscriptionOnFile) return { send: false, reason: 'subscription-on-file' };
  if (input.deleted) return { send: false, reason: 'deleted' };
  if (input.marketingUnsubscribed) return { send: false, reason: 'unsubscribed' };
  if (!input.emailVerified) return { send: false, reason: 'unverified' };
  if (input.tier === 'admin') return { send: false, reason: 'operator' };

  const churnedMs = parseMs(input.churnedAt);
  // No dated departure means no way to tell a return from ordinary account
  // activity, and no honest way to say what shipped "since you left". Skip
  // rather than guess — the win-back sweep has the same requirement.
  if (churnedMs == null) return { send: false, reason: 'no-churn-date' };

  const loginMs = parseMs(input.lastLoginAt);
  if (loginMs == null) return { send: false, reason: 'never-returned' };
  // A login from BEFORE they churned is not a return — it is the tail of the
  // subscription they were still paying for. Without this the whole churned
  // book would qualify on day one off their final logged-in session.
  if (loginMs <= churnedMs) return { send: false, reason: 'login-predates-churn' };

  const age = input.nowMs - loginMs;
  if (age < quietMs) return { send: false, reason: 'visit-too-recent' };
  if (age > maxAgeMs) return { send: false, reason: 'visit-too-old' };

  const sentMs = parseMs(input.lastSentAt);
  if (sentMs != null) {
    // Two independent guards, and both are needed.
    //
    // The cooldown throttles frequency. On its own it would let the SAME old
    // visit re-fire the moment the window lapsed, mailing someone who hasn't
    // been back in three months — so the visit must also be newer than the last
    // send. That second check is what makes this a reply to a new event rather
    // than a recurring newsletter with extra steps.
    if (input.nowMs - sentMs < cooldownMs) return { send: false, reason: 'within-cooldown' };
    if (loginMs <= sentMs) return { send: false, reason: 'already-answered' };
  }

  return { send: true, loginAt: input.lastLoginAt as string, churnedAt: input.churnedAt as string };
}

/**
 * The angle the email should take, from the cancellation survey the member left
 * behind (core/cancellationReason.ts parses it out of the churn audit row).
 *
 * The point is not to be clever — it is that an email which names the actual
 * objection is a DIFFERENT email, not a third copy of the same one. That is the
 * whole reason this cohort can be mailed again at all without being spammed.
 *
 * Unknown and absent feedback both fall to 'neutral' rather than being guessed
 * at: addressing an objection the member never raised is worse than addressing
 * none, because it tells them the mail is automated and wrong.
 */
export type ReturnAngle = 'price' | 'features' | 'complexity' | 'unused' | 'switched' | 'neutral';

export function returnIntentAngle(feedback: string | null | undefined): ReturnAngle {
  switch (feedback) {
    case 'too_expensive':
      return 'price';
    case 'missing_features':
      return 'features';
    case 'too_complex':
      return 'complexity';
    case 'unused':
      return 'unused';
    case 'switched_service':
      return 'switched';
    default:
      return 'neutral';
  }
}
