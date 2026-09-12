// The query behind core/excludedAccounts.ts: which user rows the growth numbers
// hold out, and why.
//
// Not marked `server-only`, for the same reason core/dailyMetrics.ts isn't —
// that module imports this one and is itself loaded by
// scripts/backfill-daily-metrics.mts under bare Node, where the guard throws and
// the "@/" alias doesn't resolve. It is still server code: it opens the SQLite
// DB through ./db.ts.
import { getDb } from './db.ts';
import {
  classifyExclusion,
  type ExcludedAccount,
  type ExclusionCandidate,
} from './excludedAccounts.ts';

// Every column the classifier reads, plus what the audit list shows. The
// `comped` subquery is the only non-trivial part: comping is recorded as an
// append-only audit row (scripts/comp-member.mts) rather than as a column,
// because the tier it writes is indistinguishable from a paid one.
const CANDIDATE_SQL = `
  SELECT u.id                            AS id,
         u.email                         AS email,
         u.tier                          AS tier,
         u.created_at                    AS created_at,
         u.first_payment_at              AS first_payment_at,
         u.partner_tier                  AS partner_tier,
         u.partner_pro_grant_expires_at  AS partner_pro_grant_expires_at,
         EXISTS (SELECT 1 FROM audit_events a
                  WHERE a.user_id = u.id AND a.type = 'billing_member_comped') AS comped
    FROM users u
   WHERE u.tier = 'admin'
      OR u.partner_tier = 'creator'
      OR u.partner_pro_grant_expires_at IS NOT NULL
      OR EXISTS (SELECT 1 FROM audit_events a
                  WHERE a.user_id = u.id AND a.type = 'billing_member_comped')
   ORDER BY u.created_at ASC
`;

type CandidateRow = ExclusionCandidate & {
  id: string;
  email: string;
  created_at: string | null;
  first_payment_at: string | null;
};

/** Every account held out of the growth funnel, with the rule that held it. */
export function loadExcludedAccounts(): ExcludedAccount[] {
  const rows = getDb().prepare(CANDIDATE_SQL).all() as CandidateRow[];
  return rows.flatMap((row) => {
    const reason = classifyExclusion(row);
    // The WHERE clause and the classifier are the same rule stated twice, so
    // this can only fire if they drift. Dropping the row rather than guessing
    // keeps "held out" and "why" from disagreeing.
    if (!reason) return [];
    return [{
      id: String(row.id),
      email: String(row.email),
      reason,
      tier: String(row.tier ?? 'public'),
      registeredAt: row.created_at == null ? null : String(row.created_at),
      everPaid: row.first_payment_at != null,
    }];
  });
}

/** Just the ids, for filtering a row stream. */
export function excludedAccountIds(): Set<string> {
  return new Set(loadExcludedAccounts().map((account) => account.id));
}
