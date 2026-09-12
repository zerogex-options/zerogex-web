// WHO IS NOT A CUSTOMER — the one definition of the accounts that must never
// appear in a growth number.
//
// Three kinds of account hold a paid tier without ever having been a commercial
// customer, and every one of them inflates a funnel it appears in:
//
//   admin          The operator's own account. It registered, it holds a paid
//                  tier, it will never convert or churn.
//   partner_grant  A creator partner given Pro for free (scripts/grant-partner-pro
//                  .mts stamps partner_tier='creator' and
//                  partner_pro_grant_expires_at). The grant is the deal; they are
//                  not a prospect and cannot convert.
//   comped         A member handed a paid tier for free, permanently
//                  (scripts/comp-member.mts writes a `billing_member_comped`
//                  audit row). Same story: no money will ever move.
//
// These accounts are dropped from the funnel ENTIRELY — registrations, trials,
// paid starts, retention, daily counts — rather than merely being excluded from
// the paid stages. Leaving them in the top of the funnel and out of the bottom
// would understate conversion by exactly the number of them, which is the more
// misleading of the two errors on a base this small.
//
// Pure by design: no DB, no `server-only`, no "@/" alias. The query that finds
// them lives in ./excludedAccountsServer.ts, mirroring the
// cohortRetention/cohortRetentionServer split next door, so this file can be
// imported from a client component for its types alone and from a bare-Node
// script for its logic.

export type ExclusionReason = 'admin' | 'partner_grant' | 'comped';

export const EXCLUSION_REASON_LABEL: Record<ExclusionReason, string> = {
  admin: 'Admin account',
  partner_grant: 'Partner — comped Pro',
  comped: 'Comped member',
};

export type ExcludedAccount = {
  id: string;
  email: string;
  reason: ExclusionReason;
  /** Tier the account currently holds, for the audit list. */
  tier: string;
  registeredAt: string | null;
  /**
   * True when the account DID pay at some point before it was comped. Surfaced
   * rather than silently swallowed: it is the one case where holding the
   * account out also removes real revenue history, and the operator should be
   * able to see that it happened.
   */
  everPaid: boolean;
};

/** The columns the classifier needs, named as the `users` row spells them. */
export type ExclusionCandidate = {
  tier: string | null;
  partner_tier: string | null;
  partner_pro_grant_expires_at: string | null;
  /** Truthy when a `billing_member_comped` audit row exists for the user. */
  comped: unknown;
};

/**
 * Which rule holds this account out, or null when none does.
 *
 * Deliberately NOT routed through isCreatorPartner(): that helper returns false
 * whenever the CREATOR_PARTNER_PROGRAM_ENABLED kill switch is off, and flipping
 * a feature flag must not silently readmit a comped account into the revenue
 * funnel. A granted account is not a customer regardless of whether the program
 * is currently accepting new ones.
 *
 * Order is precedence, not preference: an admin who also carries a partner
 * grant is reported once, as the admin.
 */
export function classifyExclusion(row: ExclusionCandidate): ExclusionReason | null {
  if (row.tier === 'admin') return 'admin';
  if (row.partner_tier === 'creator' || row.partner_pro_grant_expires_at != null) return 'partner_grant';
  if (row.comped) return 'comped';
  return null;
}

export type ExcludedAccountsSummary = {
  total: number;
  byReason: Record<ExclusionReason, number>;
  /** How many of the held-out accounts had paid real money at some point. */
  everPaid: number;
  accounts: ExcludedAccount[];
};

export const EMPTY_EXCLUSION_SUMMARY: ExcludedAccountsSummary = {
  total: 0,
  byReason: { admin: 0, partner_grant: 0, comped: 0 },
  everPaid: 0,
  accounts: [],
};

export function summarizeExcluded(accounts: ReadonlyArray<ExcludedAccount>): ExcludedAccountsSummary {
  const byReason: Record<ExclusionReason, number> = { admin: 0, partner_grant: 0, comped: 0 };
  for (const account of accounts) byReason[account.reason] += 1;
  return {
    total: accounts.length,
    byReason,
    everPaid: accounts.filter((account) => account.everPaid).length,
    accounts: [...accounts],
  };
}
