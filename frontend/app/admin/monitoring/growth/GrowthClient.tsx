'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { CohortUser } from '@/core/cohortRetention';
import { EXCLUSION_REASON_LABEL } from '@/core/excludedAccounts';
import { buildGrowthStory, windowLabel, type WindowDays } from '@/core/growthStory';
import type { CohortRetentionPayload } from '@/core/cohortRetentionServer';
import {
  CohortConversionTable,
  CohortStateTable,
  METRIC_TITLE,
  PeopleDrilldown,
  cohortLabel,
  matchesMetric,
  pct,
} from './cohortPanels';
import { AtRiskPanel, FirstRenewalCard, RenewalCohortTable, RenewalLadder } from './renewalPanels';
import {
  ArrivalsChart,
  CoverageStrip,
  DailyTable,
  ImportCard,
  ReachChart,
  RelationshipCard,
  TrialEchoChart,
  VolatilityCard,
  WeekdayCard,
  downloadCsv,
  type DailySnapshot,
} from './dailyPanels';
import {
  DROP_COLOR,
  FUNNEL_COLOR,
  GOOGLE_COLOR,
  LOSS_NONPAYMENT,
  LOSS_UNKNOWN,
  LOSS_VOLUNTARY,
  X_COLOR,
} from './palette';
import { ChoiceRow, Disclosure, Panel, ProportionBar, RankBar, Sentence, StatTile } from './ui';

// Admin → Monitoring → Growth. One page, read top to bottom:
//
//   1. How many people pay me, and which way is that moving?
//   2. Of everyone who showed up, how many became customers, and where did the
//      rest fall out?
//   3. Where do the good ones come from, and why do I lose the others?
//   4. …and then, folded away, every table and test that backs the four numbers
//      above.
//
// This replaces two separate tabs (Cohort Retention and Daily Signals) that each
// opened on a wall of simultaneous charts. The charts are all still here; what
// changed is that the page now states an order of importance instead of leaving
// the reader to infer one.
//
// EVERY NUMBER EXCLUDES the operator's admin account, creator partners on a
// comped Pro grant, and comped members — see core/excludedAccounts.ts. The
// "What's held out" disclosure at the bottom names them.

type CohortPayload = CohortRetentionPayload;

type Cadence = 'all' | 'monthly' | 'annual';

type Selection = { metric: string; cohort?: string };

const WINDOW_OPTIONS: Array<{ value: WindowDays; label: string }> = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '12 months' },
  { value: null, label: 'All time' },
];

const CADENCE_OPTIONS: Array<{ value: Cadence; label: string }> = [
  { value: 'all', label: 'All plans' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
];

/** The day-grain series is fetched for the same period the rest of the page shows. */
const DAILY_DAYS: Record<string, number> = { '30': 30, '90': 90, '365': 365, null: 730 };

type PanelProps = {
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
};

export default function GrowthClient({ cardBg, borderColor, axisStroke, mutedText, textColor }: PanelProps) {
  const [windowDays, setWindowDays] = useState<WindowDays>(90);
  const [cadence, setCadence] = useState<Cadence>('all');
  const [report, setReport] = useState<CohortPayload | null>(null);
  const [daily, setDaily] = useState<DailySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [reload, setReload] = useState({ seq: 0, rebuild: false });
  const drilldownRef = useRef<HTMLDivElement | null>(null);

  const dailyDays = DAILY_DAYS[String(windowDays)] ?? 90;

  useEffect(() => {
    let cancelled = false;
    const query = cadence === 'all' ? '' : `?cadence=${cadence}`;
    fetch(`/api/admin/monitoring/cohorts${query}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Admin access required' : `Failed to load cohorts (HTTP ${res.status})`);
        return res.json() as Promise<CohortPayload>;
      })
      .then((body) => { if (!cancelled) { setReport(body); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load cohorts'); });
    return () => { cancelled = true; };
  }, [cadence, reload]);

  useEffect(() => {
    // The day series is its own fetch because it is its own rollup, with its own
    // rebuild. A slow 730-day response must not overwrite the 30-day one the
    // operator switched to while it was in flight.
    let cancelled = false;
    fetch(
      `/api/admin/monitoring/daily?days=${dailyDays}${reload.rebuild ? '&rebuild=1' : ''}`,
      { cache: 'no-store', credentials: 'same-origin' },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load daily metrics (HTTP ${res.status})`);
        return res.json() as Promise<DailySnapshot>;
      })
      .then((body) => { if (!cancelled) setDaily(body); })
      .catch(() => { /* the day charts degrade to empty; the headline does not depend on them */ })
      .finally(() => { if (!cancelled) setRebuilding(false); });
    return () => { cancelled = true; };
  }, [dailyDays, reload]);

  const refresh = useCallback((rebuild: boolean) => setReload((prev) => ({ seq: prev.seq + 1, rebuild })), []);

  // The report's own generatedAt is the clock, not the browser's: every maturity
  // decision inside it (has this payer reached 30 days?) was already made
  // against that instant, and deriving the story from a slightly later "now"
  // would let the two disagree about who is measurable.
  const story = useMemo(
    () => (report ? buildGrowthStory(report, windowDays, report.generatedAt) : null),
    [report, windowDays],
  );

  const open = useCallback((metric: string, cohort?: string) => {
    setSelection({ metric, cohort });
    // The panel renders in a fixed place further down; scrolling to it is what
    // makes a click on a number two screens above feel like it did something.
    window.requestAnimationFrame(() => drilldownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const drilldown = useMemo(() => {
    if (!report || !selection || !story) return null;
    const now = Date.parse(report.generatedAt);
    const since = story.since ? Date.parse(story.since) : null;
    const registeredInWindow = (user: CohortUser) =>
      since == null || Date.parse(user.registeredAt) >= since;
    const users = (() => {
      if (selection.cohort) return report.users.filter((user) => user.cohort === selection.cohort && matchesMetric(user, selection.metric));
      switch (selection.metric) {
        case 'stillActive':
          return report.users.filter((user) => user.paidCustomerState === 'active');
        case 'scheduled':
          return report.users.filter(
            (user) => user.paidCustomerState === 'active' && user.scheduledAccessEndAt != null,
          );
        case 'newPaid':
          return report.users.filter(
            (user) => user.firstPaidAt != null && (since == null || Date.parse(user.firstPaidAt) >= since),
          );
        case 'lostInWindow':
          // `lastAccessEndedAt` is null whenever the customer is entitled now, so
          // a resubscriber never appears in a list of losses.
          return report.users.filter((user) => {
            if (user.firstPaidAt == null || user.lastAccessEndedAt == null) return false;
            const endedAt = Date.parse(user.lastAccessEndedAt);
            return endedAt <= now && (since == null || endedAt >= since);
          });
        default:
          return report.users.filter((user) => registeredInWindow(user) && matchesMetric(user, selection.metric));
      }
    })();
    const scope = selection.cohort ? cohortLabel(selection.cohort) : windowLabel(windowDays);
    return { users, title: `${METRIC_TITLE[selection.metric] ?? selection.metric} · ${scope}` };
  }, [report, selection, story, windowDays]);

  const cohortRows = useMemo(() => {
    if (!report) return [];
    // The cohort tables are month-grained, so they follow the window in months
    // rather than in days: a 30-day window still wants the month it sits in.
    if (windowDays == null) return report.cohorts;
    return report.cohorts.slice(0, Math.max(1, Math.ceil(windowDays / 30)));
  }, [report, windowDays]);

  if (error) return <ErrorMessage message={error} />;
  if (!report || !story) return <LoadingSpinner size="lg" />;

  const where = windowLabel(windowDays);
  const survival30 = story.survival[0];
  const maxSourceRegistrations = story.sources.reduce((max, row) => Math.max(max, row.registered), 0);

  return (
    <div className="space-y-4">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ChoiceRow label="Reporting period" options={WINDOW_OPTIONS} value={windowDays} onChange={setWindowDays} />
        <div className="flex items-center gap-3 flex-wrap">
          <ChoiceRow label="Billing cadence" options={CADENCE_OPTIONS} value={cadence} onChange={setCadence} />
          <button
            type="button"
            onClick={() => { setRebuilding(true); refresh(true); }}
            disabled={rebuilding}
            className="px-2.5 py-1 text-xs font-semibold rounded"
            style={{ color: mutedText, border: `1px solid ${borderColor}`, opacity: rebuilding ? 0.5 : 1 }}
          >
            {rebuilding ? 'Rebuilding…' : 'Rebuild'}
          </button>
        </div>
      </div>

      {/* ── 1. The answer ────────────────────────────────────────────────── */}
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: mutedText }}>
          Customer growth
        </p>
        <h2 className="zg-h2 tabular-nums">{story.headline}</h2>
        <Sentence lead>{story.subhead}</Sentence>
        <p className="mt-2 text-xs" style={{ color: mutedText }}>
          All time: {story.registrationsAllTime.toLocaleString()} registrations ·{' '}
          {story.everPaidAllTime.toLocaleString()} unique customers ever paid ·{' '}
          {story.accessEndedAllTime.toLocaleString()} whose paid access has ended ·{' '}
          {story.scheduledToLeave.toLocaleString()} more with a cancellation scheduled
        </p>
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Trial → paid"
            value={pct(story.trialToPaidRate)}
            hint={`${story.trialStartersWhoPaid.toLocaleString()} of ${story.trialStarters.toLocaleString()} trial starters`
              + (story.directToPaid > 0 ? ` · ${story.directToPaid.toLocaleString()} more paid without one` : '')}
            tone={FUNNEL_COLOR}
            onClick={() => open('paidAfterTrial')}
          />
          <StatTile
            label="Still paying at 30 days"
            value={pct(survival30.rate)}
            hint={survival30.eligible > 0
              ? `all time · ${survival30.retained.toLocaleString()} of the ${survival30.eligible.toLocaleString()} payers old enough to tell`
              : 'nobody has reached 30 days yet'}
          />
          <StatTile
            label={`Lost in ${where}`}
            value={story.lost.toLocaleString()}
            hint={story.lost > 0 ? `${story.losses.nonpayment} to a failed card` : 'no departures'}
            tone={story.lost > 0 ? DROP_COLOR : undefined}
            onClick={() => open('lostInWindow')}
          />
          <StatTile
            label="Cancellation scheduled"
            value={story.scheduledToLeave.toLocaleString()}
            hint={story.scheduledToLeave > 0 ? 'still paying until access ends' : 'none pending'}
            tone={story.scheduledToLeave > 0 ? LOSS_VOLUNTARY : undefined}
            onClick={() => open('scheduled')}
          />
        </div>
      </Panel>

      {/* ── 1b. Does the second payment happen? ──────────────────────────── */}
      {cadence !== 'annual' && <FirstRenewalCard report={report.renewals} />}
      {cadence === 'annual' && (
        <Panel title="First renewal" subtitle="Monthly billing only.">
          <p className="text-sm" style={{ color: mutedText }}>
            A renewal ladder measures the month-to-month decision. An annual subscriber does not make
            one until their year is up, so the monthly rates are not shown here rather than being
            re-labelled as though they applied. {report.cadenceCoverage.annual} annual customer
            {report.cadenceCoverage.annual === 1 ? '' : 's'} on record; their access and retention are
            in the cohort tables below.
          </p>
        </Panel>
      )}

      {report.renewals.atRisk.total > 0 && <AtRiskPanel pool={report.renewals.atRisk} />}

      {/* ── 2. The funnel ────────────────────────────────────────────────── */}
      <Panel
        title="From signup to paying customer"
        subtitle={`Follows the people who registered in ${where}, all the way down. Click any stage for the list.`}
      >
        <Sentence lead>{story.funnelSentence}</Sentence>
        {story.leakSentence && (
          <p className="mt-2 inline-flex items-center gap-2 rounded px-2.5 py-1 text-xs font-semibold"
            style={{ border: `1px solid ${DROP_COLOR}`, color: textColor }}>
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: DROP_COLOR }} />
            {story.leakSentence}
          </p>
        )}
        <ol className="mt-5 space-y-1">
          {story.funnel.map((stage, index) => {
            const top = story.funnel[0].value;
            const bar = (value: number) => (top > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / top) * 100) : 0);
            // A stage with an `eligible` count is measured against a subset, so
            // its bar is drawn twice: a ghost at everyone who could have
            // answered, the solid fill at those who did. Without the ghost the
            // drop from the stage above reads as churn when most of it is just
            // customers who have not been around long enough yet.
            const measurable = stage.eligible ?? stage.value;
            const tooNew = index > 0 && stage.eligible != null
              ? story.funnel[index - 1].value - stage.eligible
              : 0;
            return (
              <li key={stage.key}>
                {index > 0 && tooNew > 0 && (
                  <div className="flex items-center gap-2 py-1 pl-1 text-xs" style={{ color: mutedText }}>
                    <span aria-hidden>·</span>
                    <span>{tooNew.toLocaleString()} too new to tell yet</span>
                  </div>
                )}
                {index > 0 && stage.droppedFromPrevious != null && stage.droppedFromPrevious > 0 && (
                  <div className="flex items-center gap-2 py-1 pl-1 text-xs" style={{ color: mutedText }}>
                    <span aria-hidden style={{ color: DROP_COLOR }}>↳</span>
                    <span>
                      {stage.droppedFromPrevious.toLocaleString()} did not continue
                      {stage.key === 'retained' ? ' past 30 days' : ''}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => open(stage.key === 'retained' ? 'retained30' : stage.key)}
                  title={stage.key === 'paid' ? 'Trial converts plus direct-to-paid customers' : undefined}
                  className="w-full grid grid-cols-[1fr] sm:grid-cols-[11rem_1fr_12rem] items-center gap-x-4 gap-y-1 rounded px-2 py-2 text-left hover:opacity-80"
                >
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <span className="relative h-6 rounded" style={{ backgroundColor: 'var(--color-border)' }}>
                    {stage.eligible != null && (
                      <span
                        className="absolute inset-y-0 left-0 rounded"
                        style={{ width: `${bar(measurable)}%`, backgroundColor: FUNNEL_COLOR, opacity: 0.3 }}
                      />
                    )}
                    <span
                      className="absolute inset-y-0 left-0 rounded"
                      style={{ width: `${bar(stage.value)}%`, backgroundColor: FUNNEL_COLOR }}
                    />
                  </span>
                  <span className="flex items-baseline gap-2 justify-end whitespace-nowrap">
                    <span className="text-lg font-semibold tabular-nums">{stage.value.toLocaleString()}</span>
                    <span className="text-xs tabular-nums" style={{ color: mutedText }}>
                      {stage.ofPrevious == null
                        ? stage.caption
                        : `${pct(stage.ofPrevious)} of ${stage.eligible == null ? story.funnel[index - 1].value.toLocaleString() : stage.eligible.toLocaleString()}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>

      {/* ── The drill-down lands here, wherever it was opened from ───────── */}
      <div ref={drilldownRef}>
        {selection && drilldown && (
          <PeopleDrilldown users={drilldown.users} title={drilldown.title} onClose={() => setSelection(null)} />
        )}
      </div>

      {/* ── 3. Growth in, losses out ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel
          title="Where growth comes from"
          subtitle="Ranked by paying customers, not by traffic. Attribution is the utm_source captured at signup and is never rewritten after the fact — so “Organic / direct / unattributed” means no UTM source was captured, and may include organic search, direct visits, untagged social and referral links, and word of mouth."
        >
          {story.sources.length === 0 ? (
            <p className="text-sm" style={{ color: mutedText }}>Nobody registered in {where}.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: mutedText }}>
                  <th className="text-left font-semibold pb-2">Source</th>
                  <th className="text-right font-semibold pb-2">Registered</th>
                  <th className="text-right font-semibold pb-2">→ trial</th>
                  <th className="text-right font-semibold pb-2">Paid</th>
                  <th className="text-right font-semibold pb-2">→ paid</th>
                  <th className="text-right font-semibold pb-2">Paying now</th>
                </tr>
              </thead>
              <tbody>
                {story.sources.map((row) => (
                  <tr key={row.label} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="py-2.5 pr-3 align-middle" style={{ minWidth: '9rem' }}>
                      <div className="font-semibold">{row.label}</div>
                      <div className="mt-1.5"><RankBar value={row.registered} max={maxSourceRegistrations} color={FUNNEL_COLOR} /></div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums align-middle">{row.registered.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums align-middle" style={{ color: mutedText }}>{pct(row.trialRate)}</td>
                    <td className="py-2.5 text-right tabular-nums align-middle font-semibold">{row.paid.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums align-middle" style={{ color: mutedText }}>{pct(row.paidRate)}</td>
                    <td className="py-2.5 text-right tabular-nums align-middle">{row.payingNow.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="Where we lose people"
          subtitle={`Every paying customer whose access actually ended in ${where}. A scheduled cancellation is not counted until the access it paid for runs out.`}
        >
          {story.lost === 0 ? (
            <p className="text-sm" style={{ color: mutedText }}>Nobody stopped paying in {where}.</p>
          ) : (
            <ProportionBar
              total={story.losses.total}
              parts={[
                { key: 'voluntary', label: 'Chose to leave', value: story.losses.voluntary, color: LOSS_VOLUNTARY },
                { key: 'nonpayment', label: 'Card failed', value: story.losses.nonpayment, color: LOSS_NONPAYMENT },
                { key: 'unknown', label: 'Cause not recorded', value: story.losses.unknown, color: LOSS_UNKNOWN },
              ]}
            />
          )}

          <h4 className="zg-h4 mt-6 mb-1">How fast new customers leave</h4>
          <p className="text-xs mb-3" style={{ color: mutedText }}>
            Of the {story.funnel[3].value.toLocaleString()} people who registered in {where} and went on
            to pay. Solid is customers who are still gone; the paler part is access that stopped and
            then resumed — a billing interruption, not churn. Each row counts everyone by that age, so
            they nest rather than add up.
          </p>
          <ul className="space-y-1.5">
            {story.earlyLoss.map((point) => (
              <li key={point.withinDays} className="flex items-baseline gap-3 text-sm">
                <span className="w-32">Stopped within {point.withinDays}d</span>
                <span className="flex-1 relative h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${story.funnel[3].value > 0 ? (point.interrupted / story.funnel[3].value) * 100 : 0}%`,
                      backgroundColor: DROP_COLOR,
                      opacity: 0.35,
                    }}
                  />
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${story.funnel[3].value > 0 ? (point.lost / story.funnel[3].value) * 100 : 0}%`,
                      backgroundColor: DROP_COLOR,
                    }}
                  />
                </span>
                <span className="tabular-nums font-semibold w-8 text-right">{point.lost}</span>
                <span className="tabular-nums text-xs w-24 text-right" style={{ color: mutedText }}>
                  {pct(point.rate)}
                  {point.recovered > 0 && ` · ${point.recovered} back`}
                </span>
              </li>
            ))}
          </ul>

          <h4 className="zg-h4 mt-6 mb-1">Failed cards, all time</h4>
          <p className="text-xs mb-3" style={{ color: mutedText }}>
            Counts paying customers only. {report.summary.neverPaidFailedPaymentCustomers.toLocaleString()} people
            failed a first charge and never became customers at all — they are in the trial→paid gap
            above, not here. The last three do not add up to the first: an outcome is only shown
            where the audit trail actually records one.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['Affected', story.recovery.affected, undefined],
              ['Recovered', story.recovery.recovered, undefined],
              ['Retrying', story.recovery.retrying, story.recovery.retrying > 0 ? LOSS_VOLUNTARY : undefined],
              ['Lost', story.recovery.lost, story.recovery.lost > 0 ? DROP_COLOR : undefined],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded p-2.5" style={{ border: `1px solid ${borderColor}` }}>
                <div className="text-lg font-semibold tabular-nums" style={{ color: (tone as string) ?? textColor }}>
                  {Number(value).toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: mutedText }}>{String(label)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── 4. Everything that backs the four numbers above ──────────────── */}
      <Disclosure
        title="Day by day"
        summary={daily ? `${daily.rows.length.toLocaleString()} days of arrivals, churn and reach` : 'loading…'}
      >
        {daily ? (
          <>
            <ArrivalsChart rows={daily.rows} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReachChart rows={daily.rows} metric="xImpressions" label="X impressions" color={X_COLOR} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
              <ReachChart rows={daily.rows} metric="googleClicks" label="Google clicks" color={GOOGLE_COLOR} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
            </div>
            <TrialEchoChart rows={daily.rows} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
            <DailyTable rows={daily.rows} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />
            <button
              type="button"
              onClick={() => downloadCsv(daily.rows)}
              className="px-2.5 py-1 text-xs font-semibold rounded"
              style={{ color: mutedText, border: `1px solid ${borderColor}` }}
            >
              Download CSV
            </button>
          </>
        ) : (
          <LoadingSpinner size="md" />
        )}
      </Disclosure>

      <Disclosure
        title="Is the product getting better at keeping people?"
        summary={`Conversion and retention by registration month · ${cohortRows.length} cohort${cohortRows.length === 1 ? '' : 's'}`}
      >
        <p className="text-xs" style={{ color: mutedText }}>
          A retention cell is blank until that cohort has actually reached the milestone; the
          denominator beside each one is how many of its customers were old enough to answer.
        </p>
        <CohortConversionTable rows={cohortRows} select={(cohort, metric) => open(metric, cohort)} />
        <h4 className="zg-h4 pt-2">Where each cohort&rsquo;s customers stand today</h4>
        <p className="text-xs" style={{ color: mutedText }}>
          Every customer who ever paid appears in exactly one state. A resubscriber counts as paying
          now, not as the churn they once were.
        </p>
        <CohortStateTable rows={cohortRows} select={(cohort, metric) => open(metric, cohort)} />
      </Disclosure>

      <Disclosure
        title="Do they keep renewing?"
        summary={report.renewals.observableFrom
          ? `Renewal #1–#3 for ${report.renewals.monthlyCustomers} monthly customers · first renewal by cohort`
          : 'No invoice history imported yet'}
      >
        <RenewalLadder steps={report.renewals.steps} />
        <h4 className="zg-h4 pt-2">First renewal by registration cohort</h4>
        <p className="text-xs" style={{ color: mutedText }}>
          Whether the product is getting better or worse at holding a customer through month two.
          &ldquo;Cancelling first&rdquo; are customers still inside month one who have already scheduled
          a cancellation — they are not in the rate, because their outcome has not happened yet.
        </p>
        <RenewalCohortTable rows={report.renewals.cohorts} />
        <ul className="list-disc pl-5 space-y-1 text-xs" style={{ color: mutedText }}>
          {report.renewals.limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </Disclosure>

      <Disclosure
        title="Does marketing move the needle?"
        summary="Lag correlations, day-of-week effects, and how much of the swing is just noise"
      >
        {daily ? (
          <>
            {daily.externalMetricsEmpty && (
              <p className="text-sm rounded p-3" style={{ border: `1px solid ${borderColor}`, color: mutedText }}>
                No X or Google numbers have been imported yet, so the first three tests below have
                nothing to work with. Import them under &ldquo;Data sources and imports&rdquo;.
              </p>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {daily.relationships.map((relationship) => (
                <RelationshipCard
                  key={relationship.id}
                  test={relationship}
                  cardBg={cardBg}
                  borderColor={borderColor}
                  axisStroke={axisStroke}
                  mutedText={mutedText}
                  textColor={textColor}
                />
              ))}
            </div>
            <WeekdayCard weekday={daily.weekday} cardBg={cardBg} borderColor={borderColor} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
            <VolatilityCard volatility={daily.volatility} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />
          </>
        ) : (
          <LoadingSpinner size="md" />
        )}
      </Disclosure>

      <Disclosure
        title="Data sources and imports"
        summary={daily ? `What each column covers · X and Google CSV import · ${daily.rows.length.toLocaleString()}-day rollup` : 'loading…'}
      >
        {daily ? (
          <>
            <CoverageStrip coverage={daily.coverage} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />
            <ImportCard
              coverage={daily.coverage}
              latestDay={daily.rows[daily.rows.length - 1]?.day ?? null}
              googleSyncConfigured={daily.googleSyncConfigured}
              cardBg={cardBg}
              borderColor={borderColor}
              mutedText={mutedText}
              textColor={textColor}
              onImported={() => refresh(true)}
            />
            <p className="text-xs" style={{ color: mutedText }}>
              Snapshot generated {new Date(daily.generatedAt).toLocaleString()}. Pageviews and unique
              users are kept in raw form for {daily.pageViewRetentionDays} days; this rollup keeps
              their daily totals permanently once captured.
            </p>
          </>
        ) : (
          <LoadingSpinner size="md" />
        )}
      </Disclosure>

      <Disclosure
        title="What is held out, and what this cannot tell you"
        summary={report.excluded && report.excluded.total > 0
          ? `${report.excluded.total} account${report.excluded.total === 1 ? '' : 's'} excluded from every number on this page`
          : 'No accounts are being held out'}
      >
        <p className="text-sm" style={{ color: mutedText }}>
          These accounts hold a paid tier without ever having been a commercial customer, so they are
          removed from the source data before anything above is counted — not netted out afterwards.
          Leaving them in the top of the funnel and out of the bottom would understate conversion by
          exactly their number.
        </p>
        {report.excluded && report.excluded.total > 0 ? (
          <>
            <ul className="space-y-1.5">
              {report.excluded.accounts.map((account) => (
                <li key={account.id} className="flex items-baseline gap-3 text-sm flex-wrap">
                  <span className="font-semibold">{account.email}</span>
                  <span className="text-xs rounded px-1.5 py-0.5" style={{ border: `1px solid ${borderColor}`, color: mutedText }}>
                    {EXCLUSION_REASON_LABEL[account.reason]}
                  </span>
                  <span className="text-xs" style={{ color: mutedText }}>tier {account.tier}</span>
                  {account.everPaid && (
                    <span className="text-xs" style={{ color: LOSS_VOLUNTARY }}>paid before being comped</span>
                  )}
                </li>
              ))}
            </ul>
            {report.excluded.everPaid > 0 && (
              <p className="text-xs" style={{ color: mutedText }}>
                {report.excluded.everPaid} of them paid real money before the comp, so that revenue
                history is held out along with the account.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm" style={{ color: mutedText }}>
            Nothing currently matches the exclusion rules — no admin account, comped partner or comped
            member was found.
          </p>
        )}
        <h4 className="zg-h4 pt-2">Limits of the history</h4>
        <ul className="list-disc pl-5 space-y-1 text-xs" style={{ color: mutedText }}>
          {report.limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </Disclosure>

      <p className="text-xs" style={{ color: mutedText }}>
        Cohort report generated {new Date(report.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
