// Did a member actually use the product during their free trial?
//
// This exists because of a lost chargeback (docs/disputes/du_1U6cn34AOiqteMYY
// YCr2OaKn.md): a member signed up, used ZeroGEX for about half an hour on
// signup day, never came back, was charged when the trial converted a week
// later, and disputed. The account broadcast the risk before the charge ever
// landed — nothing was looking.
//
// A trial converting on a member who never returned is the highest-risk charge
// there is. It tends to end as a chargeback, a refund request, or a first-month
// churn, and of those the chargeback is much the most expensive: the money, two
// fees, and a mark against the account's dispute ratio.
//
// The classification only decides which reminder copy that member receives 48h
// before the charge. It never blocks a conversion or cancels anything.

// Hours from trial start within which activity is just the signup session
// continuing, not a return visit. A member who checks out, reads the dashboard
// for twenty minutes and closes the tab has not yet come back; one who opens it
// the next morning has.
export const RETURN_VISIT_AFTER_HOURS = 24;

export type TrialEngagement =
  // Came back after the signup session. The ordinary reminder is right.
  | 'engaged'
  // No authenticated request since the signup window closed. About to be
  // charged for something they have not used.
  | 'dormant'
  // No usable signal: the account predates users.last_seen_at, or no trial
  // start is known. Absence of data is NOT evidence of dormancy.
  | 'unknown';

export type ClassifyTrialEngagementInput = {
  // Trial start. In practice the account's created_at — checkout follows
  // registration within minutes, and created_at is always populated where
  // Stripe's trial_start may not be mirrored locally.
  trialStartIso: string | null;
  // users.last_seen_at. NULL on any account created before that column shipped.
  lastSeenAtIso: string | null;
};

function parse(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

// Fails toward 'unknown', and callers must treat 'unknown' as 'engaged'.
//
// The asymmetry is deliberate. Sending an engaged member copy that opens "you
// haven't had a chance to use ZeroGEX yet" is wrong, insulting, and lands on
// someone who was about to pay happily. Sending a dormant member the ordinary
// reminder is merely the behaviour that already exists. So every ambiguous
// case takes the second error, never the first.
export function classifyTrialEngagement(input: ClassifyTrialEngagementInput): TrialEngagement {
  const start = parse(input.trialStartIso);
  const lastSeen = parse(input.lastSeenAtIso);

  if (start === null) return 'unknown';
  // NULL last_seen_at is a pre-cutover account, not a member who never showed
  // up. Reading it as dormancy would mail the wrong copy to every legacy
  // trialer at once.
  if (lastSeen === null) return 'unknown';

  const returnVisitCutoff = start + RETURN_VISIT_AFTER_HOURS * 60 * 60 * 1000;
  // Clock skew or a mirror written slightly behind can put last_seen marginally
  // before start; that is still the signup session, so it stays dormant rather
  // than becoming a special case.
  return lastSeen > returnVisitCutoff ? 'engaged' : 'dormant';
}

// The single place that decides whether the dormant-trial copy is used, so the
// send loop, the preview renderer and the scan report cannot disagree about it.
export function shouldSendDormantTrialCopy(engagement: TrialEngagement): boolean {
  return engagement === 'dormant';
}

// Whole days between the trial starting and the member's last authenticated
// request, for the scan report. Null when either end is unknown.
export function daysSinceLastSeen(
  lastSeenAtIso: string | null,
  nowIso: string,
): number | null {
  const lastSeen = parse(lastSeenAtIso);
  const now = parse(nowIso);
  if (lastSeen === null || now === null) return null;
  return Math.floor((now - lastSeen) / (24 * 60 * 60 * 1000));
}
