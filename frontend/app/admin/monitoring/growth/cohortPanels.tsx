'use client';

import { useMemo } from 'react';
import type { CohortRow, CohortUser } from '@/core/cohortRetention';

// The cohort-grain half of Admin → Monitoring → Growth: the same customers as
// the headline, grouped by the month they registered in.
//
// These are DETAIL tables, deliberately kept below the fold. A cohort grid is
// the right instrument for "is the product getting better at keeping people?"
// and the wrong one for "how am I doing?" — it answers the first question well
// and the second not at all, which is why it used to be the first thing on the
// page and is now the fourth.
//
// Every count excludes the operator's admin account, comped partners and comped
// members — see core/excludedAccounts.ts.

export const pct = (value: number | null) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`);

const shortDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—';

export const cohortLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * A retention cell's tint. Three steps rather than a continuous ramp: on
 * denominators this small a smooth gradient implies a precision the numbers do
 * not have, and the eye only needs "good / watch / bad" to know where to look.
 */
function retentionTint(rate: number | null) {
  if (rate == null) return 'transparent';
  if (rate >= 0.7) return 'color-mix(in srgb, #4CAF93 22%, transparent)';
  if (rate >= 0.45) return 'color-mix(in srgb, #FFA600 20%, transparent)';
  return 'color-mix(in srgb, #FF6361 20%, transparent)';
}

const TH = 'px-3 py-2.5 text-right font-semibold first:text-left';
const TD = 'px-3 py-2.5 text-right tabular-nums';

function Table({ minWidth, head, children }: { minWidth: number; head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
          <tr>{head.map((label) => <th key={label} className={TH}>{label}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** A count that opens the list of people behind it. */
function Drill({ count, onClick, sub }: { count: number; onClick: () => void; sub?: string }) {
  return (
    <button type="button" onClick={onClick} className="text-right hover:underline tabular-nums">
      <span className="block font-semibold">{count.toLocaleString()}</span>
      {sub && <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>{sub}</span>}
    </button>
  );
}

export type SelectMetric = (cohort: string, metric: string) => void;

// ---------------------------------------------------------------------------

export function CohortConversionTable({ rows, select }: { rows: CohortRow[]; select: SelectMetric }) {
  return (
    <Table
      minWidth={960}
      head={['Registration cohort', 'Registered', 'Started trial', 'Trial → paid', 'Direct to paid', 'Paid in all', 'Kept 30d', 'Kept 60d', 'Kept 90d']}
    >
      {rows.map((row) => (
        <tr key={row.cohort} style={{ borderTop: '1px solid var(--color-border)' }}>
          <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{cohortLabel(row.cohort)}</td>
          <td className={TD}><Drill count={row.registered} onClick={() => select(row.cohort, 'registered')} /></td>
          <td className={TD}>
            <Drill
              count={row.trialStarted}
              sub={pct(row.registered ? row.trialStarted / row.registered : null)}
              onClick={() => select(row.cohort, 'trial')}
            />
          </td>
          <td className={TD}>
            {/* Trial starters who LATER PAID over trial starters. Dividing all
                payers by trial starters — which this column used to do — prints
                rates above 100% in any month where customers skipped the trial. */}
            <Drill
              count={row.trialThenPaid}
              sub={pct(row.trialStarted ? row.trialThenPaid / row.trialStarted : null)}
              onClick={() => select(row.cohort, 'trialThenPaid')}
            />
          </td>
          <td className={TD}>
            <Drill count={row.directToPaid} sub="no trial" onClick={() => select(row.cohort, 'directToPaid')} />
          </td>
          <td className={TD}>
            <Drill
              count={row.becamePaid}
              sub={pct(row.registered ? row.becamePaid / row.registered : null)}
              onClick={() => select(row.cohort, 'paid')}
            />
          </td>
          {['30', '60', '90'].map((day) => {
            const cell = row.retention[day];
            return (
              <td
                key={day}
                className={TD}
                style={{ background: retentionTint(cell.rate), borderLeft: '1px solid var(--color-border)' }}
              >
                {cell.eligible === 0 ? (
                  // Nobody in this cohort has reached the milestone yet. A 0%
                  // here would read as total churn rather than as "ask later".
                  <span style={{ color: 'var(--color-text-secondary)' }} title="No one has reached this milestone yet">—</span>
                ) : (
                  <Drill
                    count={cell.retained}
                    sub={`${pct(cell.rate)} of ${cell.eligible}`}
                    onClick={() => select(row.cohort, `retained${day}`)}
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </Table>
  );
}

export function CohortStateTable({ rows, select }: { rows: CohortRow[]; select: SelectMetric }) {
  return (
    <Table
      minWidth={980}
      head={[
        'Registration cohort', 'Ever paid', 'Paying now', 'Chose to leave', 'Card failed', 'Unattributed',
        // "Lost" and "interrupted" are different populations: a customer who
        // lapsed for a week and came back is an interruption and is NOT lost.
        // The old columns said "Lost" and counted both.
        'Interrupted ≤7d', 'Interrupted ≤30d', 'Still gone ≤30d', 'Still gone ≤60d',
      ]}
    >
      {rows.map((row) => (
        <tr key={row.cohort} style={{ borderTop: '1px solid var(--color-border)' }}>
          <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{cohortLabel(row.cohort)}</td>
          <td className={`${TD} font-semibold`}>{row.becamePaid.toLocaleString()}</td>
          {(['stillActive', 'voluntary', 'paymentFailure', 'other'] as const).map((key) => (
            <td key={key} className={TD}>
              <Drill count={row.churn[key]} onClick={() => select(row.cohort, key)} />
            </td>
          ))}
          {(['7', '30'] as const).map((day) => (
            <td key={`i${day}`} className={TD} style={{ borderLeft: day === '7' ? '1px solid var(--color-border)' : undefined }}>
              {row.interrupted[day].count.toLocaleString()}
              <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>{pct(row.interrupted[day].rate)}</span>
            </td>
          ))}
          {(['30', '60'] as const).map((day) => (
            <td key={`p${day}`} className={TD} style={{ borderLeft: day === '30' ? '1px solid var(--color-border)' : undefined }}>
              {row.permanentlyLost[day].count.toLocaleString()}
              <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>{pct(row.permanentlyLost[day].rate)}</span>
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Person-level drill-down
// ---------------------------------------------------------------------------

/** Every count on this page maps to one of these predicates. */
export function matchesMetric(user: CohortUser, metric: string): boolean {
  switch (metric) {
    case 'registered': return true;
    case 'trial': return Boolean(user.trialStartedAt);
    case 'paid': return Boolean(user.firstPaidAt);
    case 'paidAfterTrial':
    case 'trialThenPaid': return user.paidAfterTrial;
    case 'directToPaid': return user.directToPaid;
    case 'interrupted': return user.reactivatedAfterInterruption;
    case 'voluntary': return user.paidCustomerState === 'voluntarily_churned';
    case 'paymentFailure': return user.paidCustomerState === 'involuntarily_churned';
    case 'other': return user.paidCustomerState === 'other_unknown';
    case 'stillActive': return user.paidCustomerState === 'active';
    default:
      return metric.startsWith('retained')
        ? user.retained[metric.replace('retained', '')] === true
        : false;
  }
}

export const METRIC_TITLE: Record<string, string> = {
  registered: 'Registered',
  trial: 'Started a trial',
  paid: 'Paid at least once',
  paidAfterTrial: 'Started a trial, then paid',
  trialThenPaid: 'Started a trial, then paid',
  directToPaid: 'Paid without a trial',
  interrupted: 'Lost access and came back',
  retained30: 'Still paying at 30 days',
  retained60: 'Still paying at 60 days',
  retained90: 'Still paying at 90 days',
  voluntary: 'Chose to leave',
  paymentFailure: 'Lost to a failed card',
  other: 'Left for an unattributed reason',
  stillActive: 'Paying now',
  scheduled: 'Cancellation already scheduled',
  lostInWindow: 'Lost in this window',
  newPaid: 'First payment in this window',
};

const STATE_LABEL: Record<string, string> = {
  active: 'Paying',
  voluntarily_churned: 'Chose to leave',
  involuntarily_churned: 'Card failed',
  other_unknown: 'Unattributed',
};

export function PeopleDrilldown({
  users,
  title,
  onClose,
}: {
  users: CohortUser[];
  title: string;
  onClose: () => void;
}) {
  // Newest first: a drill-down is opened to look at what just happened.
  const ordered = useMemo(
    () => [...users].sort((a, b) => (a.registeredAt < b.registeredAt ? 1 : -1)),
    [users],
  );
  return (
    <section
      className="rounded-lg"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-warning)' }}
    >
      <div className="flex items-baseline justify-between gap-3 px-4 md:px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h3 className="zg-h4">{title} · {ordered.length.toLocaleString()}</h3>
        <button type="button" onClick={onClose} className="text-xs font-semibold hover:underline">Close</button>
      </div>
      {ordered.length === 0 ? (
        <p className="px-5 py-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Nobody matches.</p>
      ) : (
        <div className="overflow-x-auto max-h-[28rem]">
          <table className="w-full text-xs" style={{ minWidth: 1020 }}>
            <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
              <tr>
                {['Email', 'Registered', 'Trial', 'First paid', 'Payments', 'Access ended', 'Days paid', 'Status', 'Plan', 'Failed charges', 'Why they left'].map((head) => (
                  <th key={head} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((user) => (
                <tr key={user.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-3 py-2 whitespace-nowrap">{user.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{shortDate(user.registeredAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{shortDate(user.trialStartedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{shortDate(user.firstPaidAt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" title="Successful billing-period invoices on record">
                    {user.cycleInvoices.length || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {user.lastAccessEndedAt
                      ? shortDate(user.lastAccessEndedAt)
                      : user.scheduledAccessEndAt
                        ? `${shortDate(user.scheduledAccessEndAt)} (scheduled)`
                        : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {user.daysPaidBeforePermanentLoss ?? user.daysToFirstInterruption ?? '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {user.paidCustomerState ? STATE_LABEL[user.paidCustomerState] : 'Never paid'}
                    {user.reactivatedAfterInterruption && ' · returned'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {user.cadence ?? 'cadence unknown'}
                    {user.cadenceSource !== 'current_price' && user.cadence != null && ' *'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{user.failedPaymentAttempts || '—'}</td>
                  <td className="px-3 py-2" title={user.classificationExplanation ?? undefined}>
                    {user.cancellationReason ?? (user.churnKind === 'other' ? 'Not recorded' : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
