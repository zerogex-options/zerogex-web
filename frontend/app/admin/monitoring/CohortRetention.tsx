'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BadgeDollarSign, CreditCard, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { CohortReport, CohortRow, CohortUser } from '@/core/cohortRetention';

const pct = (value: number | null) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const date = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—';
const cohortLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortCohort = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
const COLORS = { blue: '#5b8ff9', cyan: '#5ad8a6', green: '#38b27c', amber: '#e5a84b', red: '#d95d71', muted: '#7b8499' };

function retentionColor(rate: number | null) {
  if (rate == null) return 'transparent';
  if (rate >= 0.7) return 'color-mix(in srgb, #38b27c 20%, transparent)';
  if (rate >= 0.45) return 'color-mix(in srgb, #e5a84b 18%, transparent)';
  return 'color-mix(in srgb, #d95d71 18%, transparent)';
}

function Metric({ count, rate, eligible, mature = true, onClick }: { count: number; rate: number | null; eligible?: number; mature?: boolean; onClick?: () => void }) {
  if (!mature) return <span className="text-[var(--color-text-secondary)]">—</span>;
  return <button type="button" className="tabular-nums text-right hover:underline" onClick={onClick}>
    <span className="block font-semibold">{count}</span><span className="block text-xs text-[var(--color-text-secondary)]">{pct(rate)}{eligible != null ? ` (${count}/${eligible} eligible)` : ''}</span>
  </button>;
}

export default function CohortRetention() {
  const [report, setReport] = useState<CohortReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'12' | 'all'>('12');
  const [cadence, setCadence] = useState<'all' | 'monthly' | 'annual'>('all');
  const [selection, setSelection] = useState<{ cohort: string; metric: string } | null>(null);
  useEffect(() => {
    const query = cadence === 'all' ? '' : `?cadence=${cadence}`;
    fetch(`/api/admin/monitoring/cohorts${query}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => { if (!res.ok) throw new Error(res.status === 403 ? 'Admin access required' : `Failed to load cohorts (HTTP ${res.status})`); return res.json(); })
      .then((body) => setReport(body as CohortReport)).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cohorts'));
  }, [cadence]);
  const cohorts = useMemo(() => range === '12' ? report?.cohorts.slice(0, 12) ?? [] : report?.cohorts ?? [], [range, report]);
  const drilldown = useMemo(() => {
    if (!report || !selection) return [];
    return report.users.filter((user) => user.cohort === selection.cohort && matchesMetric(user, selection.metric));
  }, [report, selection]);
  const chartData = useMemo(() => [...cohorts].reverse().map((row) => ({
    cohort: shortCohort(row.cohort),
    day30: row.retention['30'].rate == null ? null : row.retention['30'].rate * 100,
    day60: row.retention['60'].rate == null ? null : row.retention['60'].rate * 100,
    day90: row.retention['90'].rate == null ? null : row.retention['90'].rate * 100,
  })), [cohorts]);
  if (error) return <ErrorMessage message={error} />;
  if (!report) return <LoadingSpinner size="lg" />;
  const summary = report.summary;
  const churnData = [
    { name: 'Still active', value: report.users.filter((user) => user.firstPaidAt && !user.churnKind).length, color: COLORS.green },
    { name: 'Voluntary', value: summary.voluntaryChurn, color: COLORS.amber },
    { name: 'Payment failure', value: summary.paymentFailureChurn, color: COLORS.red },
    { name: 'Other', value: report.users.filter((user) => user.churnKind === 'other').length, color: COLORS.muted },
  ].filter((item) => item.value > 0);
  return <div className="space-y-6">
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] p-6 md:p-8" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 88%, #5b8ff9), var(--color-surface) 55%, color-mix(in srgb, var(--color-surface) 90%, #38b27c))' }}>
      <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#5b8ff9]/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-2xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#5b8ff9]/30 bg-[#5b8ff9]/10 px-3 py-1 text-xs font-semibold text-[#6f9cff]"><Activity size={14}/> Customer journey health</div><h2 className="text-2xl font-semibold tracking-tight md:text-3xl">From signup to lasting subscriber</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">See where each registration cohort converts, where it falls away, and how much paid access survives its first 90 days.</p></div>
        <div className="flex gap-2"><select value={cadence} onChange={(e) => setCadence(e.target.value as typeof cadence)} className="rounded border bg-[var(--color-surface)] px-3 py-2 text-sm"><option value="all">All billing cadences</option><option value="monthly">Monthly subscriptions</option><option value="annual">Annual subscriptions</option></select><select value={range} onChange={(e) => setRange(e.target.value as '12' | 'all')} className="rounded border bg-[var(--color-surface)] px-3 py-2 text-sm"><option value="12">Latest 12 months</option><option value="all">All cohorts</option></select></div>
      </div>
      <JourneyFunnel registrations={summary.registrations} trials={summary.trialStarts} paid={summary.becamePaid} retained={summary.retention['30'].retained} />
    </div>

    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <ChartCard title="Paid retention by cohort" subtitle="See whether customer durability is strengthening or weakening over time."><ResponsiveContainer width="100%" height={250}><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18 }}><defs><linearGradient id="cohort30" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.green} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="cohort" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }} formatter={(value) => [`${Number(value).toFixed(1)}%`]}/><Area type="monotone" dataKey="day30" name="30 day" stroke={COLORS.green} fill="url(#cohort30)" strokeWidth={3} connectNulls/><Area type="monotone" dataKey="day60" name="60 day" stroke={COLORS.blue} fill="transparent" strokeWidth={2} connectNulls/><Area type="monotone" dataKey="day90" name="90 day" stroke={COLORS.amber} fill="transparent" strokeWidth={2} connectNulls/></AreaChart></ResponsiveContainer><div className="flex justify-center gap-5 text-xs text-[var(--color-text-secondary)]"><LegendDot color={COLORS.green} label="30 day"/><LegendDot color={COLORS.blue} label="60 day"/><LegendDot color={COLORS.amber} label="90 day"/></div></ChartCard>
      <ChartCard title="Paid customer status" subtitle="What happened after the first successful payment."><div className="relative h-[200px]">{churnData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={churnData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={3} stroke="none">{churnData.map((item) => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}/></PieChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-[var(--color-text-secondary)]">No paid customers yet</div>}<div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><div className="text-2xl font-bold">{summary.becamePaid}</div><div className="text-[10px] uppercase text-[var(--color-text-secondary)]">ever paid</div></div></div></div><div className="grid grid-cols-2 gap-2 text-xs">{churnData.map((item) => <div key={item.name} className="flex justify-between"><LegendDot color={item.color} label={item.name}/><strong>{item.value}</strong></div>)}</div></ChartCard>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <InsightCard icon={<Users size={18}/>} label="Signup → trial" value={pct(summary.registrations ? summary.trialStarts / summary.registrations : null)} detail={`${summary.trialStarts} of ${summary.registrations} registrations`} color={COLORS.blue}/>
      <InsightCard icon={<BadgeDollarSign size={18}/>} label="Signup → paid" value={pct(summary.registrationToPaid)} detail={`${summary.becamePaid} customers converted`} color={COLORS.cyan}/>
      <InsightCard icon={<Activity size={18}/>} label="Trial → paid" value={pct(summary.trialToPaid)} detail="Conversion from trial starters" color={COLORS.green}/>
      <InsightCard icon={<CreditCard size={18}/>} label="Involuntary losses" value={String(summary.paymentFailureChurn)} detail={`${summary.voluntaryChurn} voluntary cancellations`} color={summary.paymentFailureChurn ? COLORS.red : COLORS.green}/>
    </div>
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"><h3 className="font-semibold">Payment-failure audit</h3><p className="mt-1 text-xs text-[var(--color-text-secondary)]">Attempts are reported separately from people, so Smart Retry activity cannot inflate customer churn.</p><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">{[['Unique customers', summary.failedPaymentCustomers], ['Failed attempts', summary.failedPaymentAttempts], ['Recovered', summary.paymentRecovered], ['Retrying / grace', summary.paymentRetrying], ['Lost to nonpayment', summary.paymentFailureChurn]].map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--color-border)] p-3"><div className="text-xl font-bold tabular-nums">{value}</div><div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div></div>)}</div></section>
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[var(--color-surface)]"><tr>{['Cohort','Registered','Trial Started','Became Paid','Paid @ 30d','Paid @ 60d','Paid @ 90d'].map((h) => <th key={h} className="px-3 py-3 text-left last:text-right">{h}</th>)}</tr></thead><tbody>{cohorts.map((row) => <CohortTableRow key={row.cohort} row={row} select={(metric) => setSelection({ cohort: row.cohort, metric })} />)}</tbody></table></div>
    {cadence === 'monthly' && <section><h3 className="mb-1 text-lg font-semibold">Monthly renewal payments</h3><p className="mb-3 text-xs text-[var(--color-text-secondary)]">Counts successful invoices—not access. Eligibility comes from the preceding paid invoice’s actual period end; unavailable history stays out of the denominator.</p><div className="overflow-x-auto rounded-xl border border-[var(--color-border)]"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[var(--color-surface)]"><tr>{['Cohort','Payment 1','Payment 2','Payment 3','Payment 4','P2 / eligible P1','P3 / eligible P2','P4 / eligible P3'].map((label) => <th key={label} className="px-3 py-3 text-right first:text-left">{label}</th>)}</tr></thead><tbody>{cohorts.map((row) => <tr key={row.cohort} className="border-t border-[var(--color-border)]"><td className="px-3 py-3 font-semibold">{cohortLabel(row.cohort)}</td>{['1','2','3','4'].map((number) => <td key={number} className="px-3 py-3 text-right font-semibold">{row.payments[number].successful}</td>)}{['2','3','4'].map((number) => <td key={number} className="px-3 py-3 text-right">{pct(row.payments[number].rate)} <span className="text-xs text-[var(--color-text-secondary)]">({row.payments[number].successful}/{row.payments[number].eligible} eligible)</span></td>)}</tr>)}</tbody></table></div></section>}
    <section><h3 className="mb-2 text-lg font-semibold">Paid customer losses</h3><div className="overflow-x-auto rounded-lg border border-[var(--color-border)]"><table className="w-full min-w-[820px] text-sm"><thead className="bg-[var(--color-surface)]"><tr>{['Cohort','Paid Customers','Voluntary Churn','Payment Failure','Other','Still Active','Lost ≤ 7d','Lost ≤ 30d','Lost ≤ 60d'].map((h) => <th key={h} className="px-3 py-3 text-right first:text-left">{h}</th>)}</tr></thead><tbody>{cohorts.map((row) => <tr key={row.cohort} className="border-t border-[var(--color-border)]"><td className="px-3 py-3 font-semibold">{cohortLabel(row.cohort)}</td><td className="px-3 py-3 text-right">{row.becamePaid}</td>{(['voluntary','paymentFailure','other','stillActive'] as const).map((key) => <td key={key} className="px-3 py-3 text-right"><button className="hover:underline" onClick={() => setSelection({cohort: row.cohort, metric: key})}>{row.churn[key]}</button></td>)}{['7','30','60'].map((day) => <td key={day} className="px-3 py-3 text-right tabular-nums">{row.earlyChurn[day].lost}<span className="block text-xs text-[var(--color-text-secondary)]">{pct(row.earlyChurn[day].rate)}</span></td>)}</tr>)}</tbody></table></div></section>
    {selection && <Drilldown users={drilldown} title={`${cohortLabel(selection.cohort)} · ${selection.metric}`} close={() => setSelection(null)} />}
    <div className="rounded-lg border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text-primary)]">Historical-data notes</strong><ul className="mt-2 list-disc space-y-1 pl-5">{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
  </div>;
}

function CohortTableRow({ row, select }: { row: CohortRow; select: (metric: string) => void }) {
  return <tr className="border-t border-[var(--color-border)] transition-colors hover:bg-black/[0.025]"><td className="px-3 py-3 font-semibold">{cohortLabel(row.cohort)}</td><td className="px-3 py-3"><Metric count={row.registered} rate={null} onClick={() => select('registered')} /></td><td className="px-3 py-3"><Metric count={row.trialStarted} rate={row.registered ? row.trialStarted / row.registered : null} onClick={() => select('trial')} /></td><td className="px-3 py-3"><Metric count={row.becamePaid} rate={row.registered ? row.becamePaid / row.registered : null} onClick={() => select('paid')} /><span className="text-[10px] text-[var(--color-text-secondary)]">{pct(row.trialStarted ? row.becamePaid / row.trialStarted : null)} of trials</span></td>{['30','60','90'].map((day) => <td key={day} className="border-l border-[var(--color-border)] px-3 py-3 text-right" style={{ background: retentionColor(row.retention[day].rate) }}><Metric count={row.retention[day].retained} rate={row.retention[day].rate} eligible={row.retention[day].eligible} mature={row.retention[day].eligible > 0} onClick={() => select(`retained${day}`)} /></td>)}</tr>;
}

function JourneyFunnel({ registrations, trials, paid, retained }: { registrations: number; trials: number; paid: number; retained: number }) {
  const steps = [{ label: 'Registered', value: registrations, color: COLORS.blue }, { label: 'Started trial', value: trials, color: COLORS.cyan }, { label: 'Became paid', value: paid, color: COLORS.green }, { label: 'Paid at 30d', value: retained, color: COLORS.amber }];
  return <div className="relative mt-7 grid grid-cols-2 gap-2 md:grid-cols-4">{steps.map((step, index) => <div key={step.label} className="relative rounded-xl border border-white/10 bg-black/[0.08] p-4 backdrop-blur-sm"><div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full" style={{ width: `${registrations ? Math.max(5, step.value / registrations * 100) : 0}%`, background: step.color }}/></div><div className="text-2xl font-bold tabular-nums">{step.value}</div><div className="text-xs text-[var(--color-text-secondary)]">{step.label}</div>{index < steps.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-[var(--color-text-secondary)] md:block" size={18}/>}</div>)}</div>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"><h3 className="font-semibold">{title}</h3><p className="mb-4 mt-1 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>{children}</section>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color }}/>{label}</span>;
}

function InsightCard({ icon, label, value, detail, color }: { icon: React.ReactNode; label: string; value: string; detail: string; color: string }) {
  return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]"><span className="rounded-lg p-2" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>{icon}</span>{label}</div><div className="text-2xl font-bold tabular-nums">{value}</div><div className="mt-1 text-xs text-[var(--color-text-secondary)]">{detail}</div></div>;
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
  return <section className="rounded-lg border border-[var(--color-border)] p-4"><div className="mb-3 flex justify-between"><h3 className="text-lg font-semibold">Users: {title} ({users.length})</h3><button onClick={close} className="text-sm hover:underline">Close</button></div><div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-xs"><thead><tr>{['Email','Registered','Trial start','First paid','Cancellation','Access end','Current status','Days paid','Loss type','Why classified','Failed attempts','Tier / plan','Acquisition','Cancellation reason'].map((h) => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-t border-[var(--color-border)]"><td className="px-2 py-2">{user.email}</td><td>{date(user.registeredAt)}</td><td>{date(user.trialStartedAt)}</td><td>{date(user.firstPaidAt)}</td><td>{date(user.cancellationAt)}</td><td>{date(user.accessEndedAt)}</td><td>{user.currentStatus ?? '—'}</td><td>{user.daysPaidBeforeChurn ?? '—'}</td><td>{user.churnKind ?? '—'}</td><td className="max-w-[260px]">{user.classificationExplanation ?? '—'}</td><td>{user.failedPaymentAttempts}</td><td>{user.tier}{user.plan ? ` / ${user.plan}` : ''}</td><td>{user.acquisitionSource ?? 'Organic / unknown'}</td><td>{user.cancellationReason ?? '—'}</td></tr>)}</tbody></table></div><h4 className="mb-2 mt-5 font-semibold">Underlying audit events</h4><div className="max-h-64 overflow-auto rounded border border-[var(--color-border)]">{users.flatMap((user) => user.auditEvents.map((event) => <div key={`${user.id}-${event.createdAt}-${event.type}`} className="grid grid-cols-[150px_220px_1fr] gap-3 border-b border-[var(--color-border)] px-3 py-2 text-xs"><span>{date(event.createdAt)}</span><span className="font-medium">{user.email} · {event.type}</span><span className="text-[var(--color-text-secondary)]">{event.message}</span></div>))}</div></section>;
}
