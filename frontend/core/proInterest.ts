// The Pro interest email (scripts/send-pro-interest-email.mts, make
// pro-interest-email): a founder note to Basic members who tried to open a Pro
// page, saying what Pro adds and exactly what switching would mean for them
// today. Sent by hand, at most once per member (users.pro_interest_email_sent_at).
//
// Who: a Basic member whose visits include the locked Pro screen (/unauthorized
// in page_view_events) inside the lookback window. Who not, each with the
// reason the dry run prints:
//
//   excluded      named on the command line (EXCLUDE=)
//   already_sent  this email went to them before
//   not_basic     no longer on Basic (upgraded, or lapsed) since the visit
//   opted_out     unsubscribed from marketing email, which this is
//   past_due      a payment problem: an upgrade pitch is the wrong email
//   canceling     scheduled to cancel: they have decided to leave
//   paused        collection is paused
//   no_plan       no live subscription (a comped or legacy account)
//
// What switching means is core/proWall.ts's call, the same terms the locked
// screen shows, so the email and the screen can never disagree.
//
// Pure: tests/proInterest.test.ts.

import { formatEtDateTime, type ProWallTerms } from './proWall.ts';

export const PRO_INTEREST_DEFAULT_DAYS = 14;

export type ProInterestSkipReason =
  | 'excluded'
  | 'already_sent'
  | 'not_basic'
  | 'opted_out'
  | 'past_due'
  | 'canceling'
  | 'paused'
  | 'no_plan';

export type ProInterestCandidate = {
  email: string;
  tier: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  paused: boolean;
  marketingUnsubscribed: boolean;
  sentAt: string | null;
};

// Why this member is left out, or null to send. Checked in this order, so the
// dry run names the most useful reason.
export function proInterestSkipReason(
  candidate: ProInterestCandidate,
  excludedEmails: ReadonlySet<string>,
): ProInterestSkipReason | null {
  if (excludedEmails.has(candidate.email.trim().toLowerCase())) return 'excluded';
  if (candidate.sentAt) return 'already_sent';
  if (candidate.tier !== 'basic') return 'not_basic';
  if (candidate.marketingUnsubscribed) return 'opted_out';
  if (candidate.subscriptionStatus === 'past_due' || candidate.subscriptionStatus === 'unpaid') return 'past_due';
  if (!candidate.stripeSubscriptionId) return 'no_plan';
  if (candidate.subscriptionStatus !== 'trialing' && candidate.subscriptionStatus !== 'active') return 'no_plan';
  if (candidate.cancelAtPeriodEnd) return 'canceling';
  if (candidate.paused) return 'paused';
  return null;
}

// "a@x.com, B@y.com" → a set of lowercased addresses.
export function parseExcludedEmails(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

// One line per member for the dry run and the audit trail: which version of
// the email they get.
export function describeProInterestTerms(terms: ProWallTerms): string {
  switch (terms.kind) {
    case 'keep_trial':
      return `trial, last two days (ends ${formatEtDateTime(terms.trialEndIso)}): switch and keep the free days`;
    case 'trial_early':
      return `trial (ends ${formatEtDateTime(terms.trialEndIso)}): switching starts Pro today; free-days switch opens ${formatEtDateTime(terms.opensAtIso)}`;
    case 'trial_other':
      return 'trial on another plan: switching starts Pro today';
    case 'paid':
      return 'paying Basic: switch through the billing portal';
    case 'past_due':
      return 'past due';
    case 'none':
      return 'no plan';
  }
}
