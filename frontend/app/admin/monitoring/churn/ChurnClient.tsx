'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import { churnImplications, type ChurnDay, type ChurnReport } from '@/core/churnSeries';
import { makeDayLabelFormatter } from '../monitoringHelpers';
import { LOSS_VOLUNTARY } from '../growth/palette';
import { ChoiceRow, Disclosure, Panel, Sentence, StatTile } from '../growth/ui';

// Admin → Monitoring → Churn. Answers one question: are paying members leaving
// faster than they used to, or are there just more of them? Paid cancels per
// day, the paying headcount they come out of, and the monthly rate that divides
// one by the other. The numbers come from core/churnSeries.ts, which documents
// what each one counts.

/** Paying members leaving: the Growth tab's "member who chose to leave" hue. */
const CANCEL_COLOR = LOSS_VOLUNTARY;
/** The Full Subscriber line's color on the Total Subscribers chart. */
const PAYING_COLOR = '#ff8531';

const RANGE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '12 months' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDay(day: string): string {
  return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
}

const pct = (n: number) => `${Math.round(n)}%`;
const pct1 = (n: number) => `${n.toFixed(1)}%`;

type Props = {
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
};

type Payload = ChurnReport & { ok: true };

export default function ChurnClient({ axisStroke, mutedText, textColor }: Props) {
  const [windowDays, setWindowDays] = useState(90);
  const [report, setReport] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The previous range stays on screen, dimmed, until the new one arrives.
  const loading = !error && report !== null && report.windowDays !== windowDays;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/monitoring/churn?days=${windowDays}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Admin access required' : `Failed to load churn (HTTP ${res.status})`);
        return res.json() as Promise<Payload>;
      })
      .then((body) => { if (!cancelled) { setReport(body); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load churn'); });
    return () => { cancelled = true; };
  }, [windowDays]);

  const dayLabel = useMemo(() => makeDayLabelFormatter(report?.days.map((d) => d.day) ?? []), [report]);
  const churnTicks = useMemo(() => {
    const top = Math.max(0, ...(report?.days.map((d) => d.monthlyChurn ?? 0) ?? [0]));
    const step = top > 50 ? 20 : 10;
    const max = Math.max(step, Math.ceil(top / step) * step);
    return Array.from({ length: max / step + 1 }, (_, i) => i * step);
  }, [report]);

  if (error && !report) return <ErrorMessage message={error} />;
  if (!report) return <LoadingSpinner size="lg" />;

  const s = report.summary;
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === report.windowDays)?.label ?? `${report.windowDays} days`;
  const range = s.monthlyChurnRange;
  const implied = churnImplications(range?.average ?? null, s.payingNow);

  const axis = {
    stroke: axisStroke,
    tick: { fill: axisStroke, fontSize: 10 },
    tickLine: false,
  } as const;
  // A band scale on all three, so a day sits at the same x on the line charts as
  // its bar does on the bar chart.
  const xAxis = <XAxis dataKey="day" scale="band" {...axis} minTickGap={40} tickFormatter={dayLabel} />;
  const grid = <CartesianGrid strokeOpacity={0.1} vertical={false} />;
  // On a bar chart the cursor is a column behind the bar, so it takes a faint
  // fill; on a line chart it is a hairline.
  const tip = (line: (d: ChurnDay) => ReactNode, bars = false) => (
    <Tooltip
      cursor={bars ? { fill: 'var(--color-text-primary)', fillOpacity: 0.08 } : { stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload as ChurnDay;
        return (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
          >
            <div className="mb-0.5" style={{ color: mutedText }}>{fmtDay(d.day)}</div>
            <div>{line(d)}</div>
          </div>
        );
      }}
    />
  );

  return (
    <div className="space-y-6" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
      <ChoiceRow label="Range" options={RANGE_OPTIONS} value={windowDays} onChange={setWindowDays} />
      {error && <ErrorMessage message={error} />}

      <div className="space-y-2 max-w-3xl">
        {s.monthlyChurnNow !== null ? (
          <Sentence lead>
            {s.paidCancels30d.toLocaleString()} paying {s.paidCancels30d === 1 ? 'member' : 'members'} canceled in the last
            30 days, {pct(s.monthlyChurnNow)} of the paying members you had.
            {range && range.lowDay !== range.highDay && (
              <> Over the last {rangeLabel}, monthly churn has run between {pct(range.low)} and {pct(range.high)}.</>
            )}
          </Sentence>
        ) : (
          <Sentence lead>
            {s.paidCancels30d.toLocaleString()} paid cancels in the last 30 days. Monthly churn needs 30 days of the
            Total Subscribers chart&apos;s history, which this range doesn&apos;t reach yet.
          </Sentence>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Paying members"
          value={s.payingNow === null ? '—' : s.payingNow.toLocaleString()}
          hint={s.payingAtStart === null ? 'no count at the start of this range' : `from ${s.payingAtStart.toLocaleString()} on ${fmtDay(s.startDay)}`}
        />
        <StatTile
          label="Paid cancels, last 30 days"
          value={s.paidCancels30d.toLocaleString()}
          hint={`about ${(s.paidCancels30d / 30).toFixed(1)} a day`}
        />
        <StatTile
          label="Monthly churn"
          value={s.monthlyChurnNow === null ? '—' : pct(s.monthlyChurnNow)}
          hint={range ? `${pct(range.low)}–${pct(range.high)} over the last ${rangeLabel}` : 'needs 30 days of history'}
        />
        <StatTile
          label="Paid cancels, last 7 days"
          value={s.paidCancels7d.toLocaleString()}
          hint={
            s.previousHigh7d === null
              ? undefined
              : s.paidCancels7d > s.previousHigh7d
                ? `most in this range; the previous high was ${s.previousHigh7d}`
                : `the most in any 7 days here is ${s.previousHigh7d}`
          }
        />
      </div>

      <Panel
        title="Paid churn by day"
        subtitle="Hover any chart to read that day on all three."
      >
        <div className="space-y-6">
          <div>
            <h4 className="zg-h4" style={{ color: textColor }}>Paid cancels per day</h4>
            <p className="text-xs mb-2" style={{ color: mutedText }}>
              Paying members who clicked Cancel: the Subscriber Ledger&apos;s &ldquo;Cancellation scheduled: paid
              subscription&rdquo; rows. Trial cancels are left out.
            </p>
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={report.days} syncId="churn-tab" margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  {grid}
                  {xAxis}
                  <YAxis {...axis} width={40} allowDecimals={false} />
                  {tip((d) => <><b>{d.paidCancels}</b> paid {d.paidCancels === 1 ? 'cancel' : 'cancels'}</>, true)}
                  <Bar dataKey="paidCancels" name="Paid cancels" fill={CANCEL_COLOR} maxBarSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </MobileScrollableChart>
          </div>

          <div>
            <h4 className="zg-h4" style={{ color: textColor }}>Paying members</h4>
            <p className="text-xs mb-2" style={{ color: mutedText }}>
              The Full Subscriber line from the Total Subscribers chart.
            </p>
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={report.days} syncId="churn-tab" margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  {grid}
                  {xAxis}
                  <YAxis {...axis} width={40} allowDecimals={false} />
                  {tip((d) => (d.paying === null ? 'no count that day' : <><b>{d.paying.toLocaleString()}</b> paying members</>))}
                  <Area type="monotone" dataKey="paying" name="Paying members" stroke={PAYING_COLOR} strokeWidth={2} fill={PAYING_COLOR} fillOpacity={0.12} connectNulls={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </MobileScrollableChart>
          </div>

          <div>
            <h4 className="zg-h4" style={{ color: textColor }}>Monthly churn, 30-day rolling</h4>
            <p className="text-xs mb-2" style={{ color: mutedText }}>
              Each day&apos;s paid cancels as a share of that day&apos;s paying members, added up over the 30 days
              ending that day.
            </p>
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={report.days} syncId="churn-tab" margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  {grid}
                  {xAxis}
                  <YAxis {...axis} width={40} domain={[0, churnTicks[churnTicks.length - 1]]} ticks={churnTicks} tickFormatter={(v: number) => `${v}%`} />
                  {tip((d) => (d.monthlyChurn === null ? 'needs 30 days of history' : <><b>{pct1(d.monthlyChurn)}</b> monthly churn</>))}
                  <Line type="monotone" dataKey="monthlyChurn" name="Monthly churn" stroke={CANCEL_COLOR} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </MobileScrollableChart>
          </div>
        </div>
      </Panel>

      {(implied || s.previousHigh7d !== null || range) && (
        <Panel title="What it means">
          <div className="space-y-3 max-w-3xl">
            {implied && range && (
              <Sentence>
                At this range&apos;s average of {pct(range.average)} a month, a paying member stays about{' '}
                {Math.max(1, Math.round(implied.staysMonths))} {Math.round(implied.staysMonths) <= 1 ? 'month' : 'months'}
                {implied.lossesPerMonth !== null && s.payingNow !== null && (
                  <>
                    , and about {Math.round(implied.lossesPerMonth)} of your {s.payingNow.toLocaleString()} paying members
                    cancel in a typical month. That is how many new paying members it takes each month just to hold steady
                  </>
                )}
                .
              </Sentence>
            )}
            {s.previousHigh7d !== null && (
              <Sentence>
                {s.paidCancels7d > s.previousHigh7d ? (
                  <>
                    The last 7 days had {s.paidCancels7d} paid cancels, more than any earlier 7 days in this range (the
                    previous high was {s.previousHigh7d}). One week isn&apos;t a trend; the monthly line is what to watch.
                  </>
                ) : (
                  <>
                    The last 7 days had {s.paidCancels7d} paid {s.paidCancels7d === 1 ? 'cancel' : 'cancels'}; the most in
                    any 7 days in this range was {s.previousHigh7d}.
                  </>
                )}
              </Sentence>
            )}
            {range && range.lowDay !== range.highDay && (
              <Sentence>
                If monthly churn climbs above {pct(range.high)}, this range&apos;s high on {fmtDay(range.highDay)}, and
                stays there, something has changed.
              </Sentence>
            )}
          </div>
        </Panel>
      )}

      <Disclosure title="Every day" summary={`${report.days.length} days, newest first, with a CSV download`}>
        <button
          type="button"
          onClick={() => downloadChurnCsv(report.days)}
          className="px-2.5 py-1 text-xs font-semibold rounded"
          style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        >
          Download CSV
        </button>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: textColor }}>
            <thead>
              <tr className="text-xs" style={{ color: mutedText }}>
                <th className="py-1.5 pr-3 text-left font-semibold">Day</th>
                <th className="py-1.5 px-3 text-right font-semibold">Paid cancels</th>
                <th className="py-1.5 px-3 text-right font-semibold">Paying members</th>
                <th className="py-1.5 px-3 text-right font-semibold">% of paying</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Monthly churn</th>
              </tr>
            </thead>
            <tbody>
              {[...report.days].reverse().map((d) => (
                <tr key={d.day} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDay(d.day)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{d.paidCancels}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{d.paying === null ? '—' : d.paying.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{d.shareOfPaying === null ? '—' : `${d.shareOfPaying.toFixed(2)}%`}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{d.monthlyChurn === null ? '—' : pct1(d.monthlyChurn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>

      <div className="space-y-1.5 text-xs max-w-3xl" style={{ color: mutedText }}>
        <p>
          A member who canceled and then took the save offer still counts as a paid cancel, and so does a money-back
          refund, so the real loss is a little lower than shown.
        </p>
        <p>
          Monthly churn adds up each day&apos;s share rather than dividing a month&apos;s cancels by the headcount 30
          days earlier. That older method misses everyone who joined during the month, so it reads high while
          membership grows fast: in August 2026, when membership doubled, it showed 50% where this showed 27%.
        </p>
      </div>
    </div>
  );
}

function downloadChurnCsv(days: ChurnDay[]): void {
  const header = 'day,paid_cancels,paying_members,pct_of_paying,monthly_churn_pct,paid_cancels_last_30d';
  const lines = days.map((d) =>
    [
      d.day,
      d.paidCancels,
      d.paying ?? '',
      d.shareOfPaying === null ? '' : d.shareOfPaying.toFixed(2),
      d.monthlyChurn === null ? '' : d.monthlyChurn.toFixed(2),
      d.paidCancels30d,
    ].join(','),
  );
  const blob = new Blob([[header, ...lines].join('\n') + '\n'], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paid-churn-${days[days.length - 1]?.day ?? 'export'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
