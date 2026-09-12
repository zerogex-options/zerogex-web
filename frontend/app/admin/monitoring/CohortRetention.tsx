'use client';

import { useEffect, useMemo, useState } from 'react';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { CohortReport, CohortRow, CohortUser } from '@/core/cohortRetention';

const pct = (value: number | null) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const date = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—';
const cohortLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });

function Metric({ count, rate, mature = true, onClick }: { count: number; rate: number | null; mature?: boolean; onClick?: () => void }) {
  if (!mature) return <span className="text-[var(--color-text-secondary)]">—</span>;
  return <button type="button" className="tabular-nums text-right hover:underline" onClick={onClick}>
    <span className="block font-semibold">{count}</span><span className="block text-xs text-[var(--color-text-secondary)]">{pct(rate)}</span>
  </button>;
}

export default function CohortRetention() {
  const [report, setReport] = useState<CohortReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'12' | 'all'>('12');
  const [selection, setSelection] = useState<{ cohort: string; metric: string } | null>(null);
  useEffect(() => {
    fetch('/api/admin/monitoring/cohorts', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => { if (!res.ok) throw new Error(res.status === 403 ? 'Admin access required' : `Failed to load cohorts (HTTP ${res.status})`); return res.json(); })
      .then((body) => setReport(body as CohortReport)).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cohorts'));
  }, []);
  const cohorts = useMemo(() => range === '12' ? report?.cohorts.slice(0, 12) ?? [] : report?.cohorts ?? [], [range, report]);
  const drilldown = useMemo(() => {
    if (!report || !selection) return [];
    return report.users.filter((user) => user.cohort === selection.cohort && matchesMetric(user, selection.metric));
  }, [report, selection]);
  if (error) return <ErrorMessage message={error} />;
  if (!report) return <LoadingSpinner size="lg" />;
  const summary = report.summary;
  return <div className="space-y-6">
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h2 className="text-xl font-semibold">Customer cohort retention</h2><p className="text-sm text-[var(--color-text-secondary)]">Registration-month cohorts; retention is measured from each customer’s first cleared subscription payment.</p></div>
        <select value={range} onChange={(e) => setRange(e.target.value as '12' | 'all')} className="rounded border bg-[var(--color-surface)] px-3 py-2 text-sm"><option value="12">Latest 12 months</option><option value="all">All cohorts</option></select>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
      {[
        ['Registrations', summary.registrations], ['Trial starts', summary.trialStarts], ['Ever paid', summary.becamePaid],
        ['Registration → paid', pct(summary.registrationToPaid)], ['Trial → paid', pct(summary.trialToPaid)],
        ['Paid @ 30d', pct(summary.retention['30'].rate)], ['Paid @ 60d', pct(summary.retention['60'].rate)], ['Paid @ 90d', pct(summary.retention['90'].rate)],
        ['Voluntary churn', summary.voluntaryChurn], ['Payment-failure churn', summary.paymentFailureChurn],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><div className="text-xs text-[var(--color-text-secondary)]">{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value}</div></div>)}
    </div>
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[var(--color-surface)]"><tr>{['Cohort','Registered','Trial Started','Became Paid','Paid @ 30d','Paid @ 60d','Paid @ 90d'].map((h) => <th key={h} className="px-3 py-3 text-left last:text-right">{h}</th>)}</tr></thead><tbody>{cohorts.map((row) => <CohortTableRow key={row.cohort} row={row} select={(metric) => setSelection({ cohort: row.cohort, metric })} />)}</tbody></table></div>
    <section><h3 className="mb-2 text-lg font-semibold">Paid customer losses</h3><div className="overflow-x-auto rounded-lg border border-[var(--color-border)]"><table className="w-full min-w-[820px] text-sm"><thead className="bg-[var(--color-surface)]"><tr>{['Cohort','Paid Customers','Voluntary Churn','Payment Failure','Other','Still Active','Lost ≤ 7d','Lost ≤ 30d','Lost ≤ 60d'].map((h) => <th key={h} className="px-3 py-3 text-right first:text-left">{h}</th>)}</tr></thead><tbody>{cohorts.map((row) => <tr key={row.cohort} className="border-t border-[var(--color-border)]"><td className="px-3 py-3 font-semibold">{cohortLabel(row.cohort)}</td><td className="px-3 py-3 text-right">{row.becamePaid}</td>{(['voluntary','paymentFailure','other','stillActive'] as const).map((key) => <td key={key} className="px-3 py-3 text-right"><button className="hover:underline" onClick={() => setSelection({cohort: row.cohort, metric: key})}>{row.churn[key]}</button></td>)}{['7','30','60'].map((day) => <td key={day} className="px-3 py-3 text-right tabular-nums">{row.earlyChurn[day].lost}<span className="block text-xs text-[var(--color-text-secondary)]">{pct(row.earlyChurn[day].rate)}</span></td>)}</tr>)}</tbody></table></div></section>
    {selection && <Drilldown users={drilldown} title={`${cohortLabel(selection.cohort)} · ${selection.metric}`} close={() => setSelection(null)} />}
    <div className="rounded-lg border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text-primary)]">Historical-data notes</strong><ul className="mt-2 list-disc space-y-1 pl-5">{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
  </div>;
}

function CohortTableRow({ row, select }: { row: CohortRow; select: (metric: string) => void }) {
  return <tr className="border-t border-[var(--color-border)]"><td className="px-3 py-3 font-semibold">{cohortLabel(row.cohort)}</td><td className="px-3 py-3"><Metric count={row.registered} rate={null} onClick={() => select('registered')} /></td><td className="px-3 py-3"><Metric count={row.trialStarted} rate={row.registered ? row.trialStarted / row.registered : null} onClick={() => select('trial')} /></td><td className="px-3 py-3"><Metric count={row.becamePaid} rate={row.registered ? row.becamePaid / row.registered : null} onClick={() => select('paid')} /><span className="text-[10px] text-[var(--color-text-secondary)]">{pct(row.trialStarted ? row.becamePaid / row.trialStarted : null)} of trials</span></td>{['30','60','90'].map((day) => <td key={day} className="px-3 py-3 text-right"><Metric count={row.retention[day].retained} rate={row.retention[day].rate} mature={row.retention[day].eligible > 0} onClick={() => select(`retained${day}`)} /></td>)}</tr>;
}

function matchesMetric(user: CohortUser, metric: string) {
  if (metric === 'registered') return true;
  if (metric === 'trial') return Boolean(user.trialStartedAt);
  if (metric === 'paid') return Boolean(user.firstPaidAt);
  if (metric.startsWith('retained')) return user.retained[metric.replace('retained', '')] === true;
  if (metric === 'voluntary') return user.churnKind === 'voluntary';
  if (metric === 'paymentFailure') return user.churnKind === 'payment_failure';
  if (metric === 'other') return user.churnKind === 'other';
  if (metric === 'stillActive') return Boolean(user.firstPaidAt) && user.churnKind == null;
  return false;
}

function Drilldown({ users, title, close }: { users: CohortUser[]; title: string; close: () => void }) {
  return <section className="rounded-lg border border-[var(--color-border)] p-4"><div className="mb-3 flex justify-between"><h3 className="text-lg font-semibold">Users: {title} ({users.length})</h3><button onClick={close} className="text-sm hover:underline">Close</button></div><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-xs"><thead><tr>{['Email','Registered','Trial start','First paid','Cancellation','Access end','Current status','Days paid','Loss type','Tier / plan','Acquisition','Cancellation reason'].map((h) => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-t border-[var(--color-border)]"><td className="px-2 py-2">{user.email}</td><td>{date(user.registeredAt)}</td><td>{date(user.trialStartedAt)}</td><td>{date(user.firstPaidAt)}</td><td>{date(user.cancellationAt)}</td><td>{date(user.accessEndedAt)}</td><td>{user.currentStatus ?? '—'}</td><td>{user.daysPaidBeforeChurn ?? '—'}</td><td>{user.churnKind ?? '—'}</td><td>{user.tier}{user.plan ? ` / ${user.plan}` : ''}</td><td>{user.acquisitionSource ?? 'Organic / unknown'}</td><td>{user.cancellationReason ?? '—'}</td></tr>)}</tbody></table></div></section>;
}
