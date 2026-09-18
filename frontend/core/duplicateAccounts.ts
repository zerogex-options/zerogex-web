// Finding the PERSON behind more than one account.
//
// This exists because of a member who wrote in insisting we had charged him,
// while every record on the address he wrote from said we had never collected a
// cent. Both were true. He had hit a full-price, no-trial checkout on his
// original account, abandoned it, and created a second account under a second
// email three and a half hours later — which took a seven-day trial, a 50%
// campaign code, and has been paying since. Nothing connected the two: different
// email, different Stripe customer, and a payment method (Link) that carries no
// card fingerprint, so even a card-level sweep across all of Stripe could not
// have joined them.
//
// One thing did join them, and we already had it: both accounts were operated
// from the same IP, stamped on every checkout, login and logout in audit_events.
//
// WHAT THIS IS NOT. A shared address is not an identity. Households, offices,
// phone carriers behind CGNAT and every VPN exit in the world put unrelated
// people on one address, and an address with a crowd behind it is a network
// rather than a person. So the output is a list of things to LOOK AT, ranked by
// how much they would cost if real, and the module is deliberately built to
// throw away the cheap-looking matches rather than inflate the count.

// Above this many distinct accounts, an address is infrastructure, not a person.
// Deliberately low: the interesting clusters in practice are twos and threes,
// and a big one is nearly always a carrier or an office.
export const DEFAULT_MAX_ACCOUNTS_PER_IP = 20;

export type ClusterAccount = {
  userId: string;
  email: string;
  createdAt: string;
  tier: string;
  // Whether money has ever cleared on this account (core/paidHistory.ts rules).
  everPaid: boolean;
  lifetimeCollectedMinor: number;
  // Whether this account was ever granted a free trial, read off its own
  // billing_checkout_started audit rows.
  tookTrial: boolean;
  // Non-null when the member asked us to delete the account.
  deletedAt: string | null;
};

/**
 * The trial a checkout actually granted, parsed off the audit message
 * app/api/billing/checkout/route.ts writes.
 *
 * The message ends `... trial=7d session=cs_live_...`, where the value is a day
 * count, `founding_july1`, or `0` for no trial. Returns null when the field is
 * absent (an older row, a different event) so "we cannot tell" stays distinct
 * from "no trial was granted" — the difference between a quiet gap in the log
 * and evidence that the gate held.
 */
export function parseTrialGrant(message: string): string | null {
  const match = /(?:^|\s)trial=([^\s]+)/.exec(message);
  return match ? match[1] : null;
}

/** Whether a parsed trial grant represents a free trial actually given. */
export function grantedATrial(trialValue: string | null): boolean {
  return trialValue !== null && trialValue !== '0' && trialValue !== 'none';
}

export type ClusterShape =
  // Two or more accounts we are taking money from. The expensive one: it may be
  // one person billed twice over, and it is the only shape where doing nothing
  // keeps costing somebody money.
  | 'multiple_paying'
  // Two or more accounts were granted a free trial. The once-per-account gate
  // is per ACCOUNT, and a second email defeats it completely; this is what that
  // looks like from the outside.
  | 'trial_recycled'
  // One account pays, the others are dormant. Usually the honest version of the
  // story above: they could not get back in on the old address and started
  // over. Worth tidying, not worth chasing.
  | 'paid_and_dormant'
  // Nobody ever paid us anything. Mostly noise — one person who signed up twice.
  | 'all_free';

export type ClusterVerdict = {
  shape: ClusterShape;
  why: string;
  // Money we are currently collecting across the cluster, per month-equivalent
  // of whatever has actually cleared. Used only for ranking.
  collectedMinor: number;
};

/**
 * Classify a cluster of accounts that share an address.
 *
 * Order matters and runs from expensive to cheap, so a cluster that is both
 * double-billed and trial-recycled reports as the former — that is the one
 * costing somebody money right now.
 */
export function classifyCluster(accounts: ClusterAccount[]): ClusterVerdict {
  const live = accounts.filter((a) => a.deletedAt == null);
  const paying = live.filter((a) => a.everPaid);
  const trialed = live.filter((a) => a.tookTrial);
  const collectedMinor = live.reduce((sum, a) => sum + a.lifetimeCollectedMinor, 0);
  // Money collected from accounts that have since been deleted. It does not
  // change the shape — a deleted account cannot be double-billed and cannot
  // take another trial — but it must not be reported as though it never
  // happened. "No money on any account here" is false when we took $19.00 from
  // one of them.
  const deletedPaidMinor = accounts
    .filter((a) => a.deletedAt != null)
    .reduce((sum, a) => sum + a.lifetimeCollectedMinor, 0);
  const deletedNote =
    deletedPaidMinor > 0
      ? ` (plus $${(deletedPaidMinor / 100).toFixed(2)} from a since-deleted account)`
      : '';

  if (paying.length >= 2) {
    return {
      shape: 'multiple_paying',
      why: `${paying.length} accounts here have paid us — check for one person billed twice${deletedNote}`,
      collectedMinor,
    };
  }
  if (trialed.length >= 2) {
    return {
      shape: 'trial_recycled',
      why: `${trialed.length} accounts here were granted a free trial — the once-per-account gate was bypassed${deletedNote}`,
      collectedMinor,
    };
  }
  if (paying.length === 1) {
    return {
      shape: 'paid_and_dormant',
      why: `one account pays, the rest are dormant — likely a restart the member could not do on the old address${deletedNote}`,
      collectedMinor,
    };
  }
  return {
    shape: 'all_free',
    why: deletedNote
      ? `no money on any live account here${deletedNote}`
      : 'no money on any account here',
    collectedMinor,
  };
}

// Ranking: what an operator should read first. Shape dominates, then money, then
// cluster size — a big free cluster is still less interesting than two paying
// accounts that might be one person.
const SHAPE_RANK: Record<ClusterShape, number> = {
  multiple_paying: 0,
  trial_recycled: 1,
  paid_and_dormant: 2,
  all_free: 3,
};

export function compareClusters(
  a: { verdict: ClusterVerdict; accounts: ClusterAccount[] },
  b: { verdict: ClusterVerdict; accounts: ClusterAccount[] },
): number {
  const byShape = SHAPE_RANK[a.verdict.shape] - SHAPE_RANK[b.verdict.shape];
  if (byShape !== 0) return byShape;
  const byMoney = b.verdict.collectedMinor - a.verdict.collectedMinor;
  if (byMoney !== 0) return byMoney;
  return b.accounts.length - a.accounts.length;
}

/**
 * The shortest gap between any two account creations in a cluster, in hours.
 *
 * A second account opened hours after the first is a different event from two
 * opened years apart, and the gap is usually the fastest way for a human to
 * tell "one person, twice" from "two flatmates". Null for a single account.
 */
export function closestSignupGapHours(accounts: ClusterAccount[]): number | null {
  const times = accounts
    .map((a) => Date.parse(a.createdAt))
    .filter((t) => Number.isFinite(t))
    .sort((x, y) => x - y);
  if (times.length < 2) return null;
  let smallest = Infinity;
  for (let i = 1; i < times.length; i += 1) {
    smallest = Math.min(smallest, times[i] - times[i - 1]);
  }
  return Math.floor(smallest / 3_600_000);
}

/**
 * The HANDOFF: the shortest time between the last thing one account did and the
 * moment a sibling account was created.
 *
 * This is the number that actually tells the story, and signup dates do not.
 * In the case this module was written for, the two accounts were created
 * twenty-five days apart — 616 hours, which reads like nothing. What happened
 * was that the member hit a full-price checkout on the old account at 19:36,
 * gave up, and created the new one at 23:04 the same evening. Three hours. The
 * gap between "stopped trying here" and "started over there" is the signature
 * of one person going around a wall; the gap between signups is just how long
 * they had been a customer.
 *
 * Returns null when no sibling was active before another was created — two
 * accounts that never overlapped in that way are much weaker evidence.
 */
export function handoffGapHours(
  accounts: ClusterAccount[],
  // Event timestamps (ms) per account, in any order.
  eventTimesByUser: Map<string, number[]>,
): { hours: number; fromEmail: string; toEmail: string } | null {
  let best: { hours: number; fromEmail: string; toEmail: string } | null = null;

  for (const to of accounts) {
    const createdAt = Date.parse(to.createdAt);
    if (!Number.isFinite(createdAt)) continue;
    for (const from of accounts) {
      if (from.userId === to.userId) continue;
      const times = eventTimesByUser.get(from.userId) ?? [];
      let lastBefore = -Infinity;
      for (const time of times) {
        if (time < createdAt && time > lastBefore) lastBefore = time;
      }
      if (!Number.isFinite(lastBefore)) continue;
      const hours = Math.floor((createdAt - lastBefore) / 3_600_000);
      if (best == null || hours < best.hours) {
        best = { hours, fromEmail: from.email, toEmail: to.email };
      }
    }
  }
  return best;
}
