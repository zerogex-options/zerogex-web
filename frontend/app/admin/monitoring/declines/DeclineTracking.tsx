'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import { EXCLUSION_REASON_LABEL, type ExcludedAccountsSummary } from '@/core/excludedAccounts';
import {
  CATEGORY_NEEDS_MEMBER_ACTION,
  DECLINE_CATEGORY_LABEL,
  LOST_REASON_LABEL,
  declineGuidance,
  type DeclineBucket,
  type DeclineCategory,
  type DeclineDetail,
  type DeclineReport,
  type DeclineTotals,
  type LostReason,
} from '@/core/paymentDeclines';
import { makeDayLabelFormatter } from '../monitoringHelpers';
import { ChoiceRow, Disclosure, Panel, ProportionBar, RankBar, Sentence, StatTile } from '../growth/ui';
import { AT_RISK_COLOR, CAUSE_RANK_COLOR, LOST_COLOR, PAID_COLOR, RECOVERED_COLOR } from './palette';

// Admin → Monitoring → Stripe → Payment Declines.
//
// The question this panel exists to answer is not "how many payments failed".
// It is: OF THE MONEY THAT DID NOT ARRIVE, how much is actually gone, how much
// is still coming, which half of the business it came out of, and what the bank
// said. Those are four different numbers and a single "declines" count answers
// none of them.
//
// Read top to bottom:
//
//   1. What is this costing me, and is it getting worse?
//   2. Where does it land — conversions I never made, or customers I am losing?
//   3. Why did the card say no?
//   4. When it comes back, how long does that take and who fixed it?
//   5. Who do I need to do something about right now?
//
// ONE ENCODING throughout: color is what happened to the money (recovered / at
// risk / lost), never the cause and never the charge kind. Cause and kind are
// facets — rows drawn in the same three colors — so "do trial conversions
// recover as well as renewals" is read as a shape comparison down a column
// rather than as a color-matching exercise. See ./palette.ts.
//
// EVERY NUMBER EXCLUDES the operator's own admin account, creator partners on a
// comped grant, and comped members — see core/excludedAccounts.ts. The coverage
// note at the bottom names them.

type DeclinePayload = DeclineReport & {
  excluded: ExcludedAccountsSummary;
  reconciled: { recovered: number; cancelled: number; agedOut: number };
};

type WindowDays = 7 | 30 | 90 | 180 | 365 | null;

const WINDOW_OPTIONS: Array<{ value: WindowDays; label: string }> = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '12 months' },
  { value: null, label: 'All time' },
];

// ---------------------------------------------------------------------------
// Formatting. Money is stored in cents everywhere; nothing below ever divides
// by 100 inline, because that is exactly the mistake that ships a dashboard
// reporting a hundredfold loss.
// ---------------------------------------------------------------------------

function fmtMoney(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      // Cents matter on a $9 plan and are noise on a $4,000 total.
      maximumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmtInt(value: number): string {
  return value.toLocaleString();
}

/** A rate, or an em dash when there was nothing to divide by. Never "0%". */
function fmtPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtHours(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Counted from the REPORT's own clock, not the browser's: every duration on this
 * panel is measured server-side against `generatedAt`, and mixing in a second
 * clock would make the countdown disagree with the age beside it. With no usable
 * clock it degrades to the absolute time rather than showing a wrong countdown.
 */
function fmtCountdown(iso: string | null, nowMs: number): string {
  if (!iso) return '—';
  if (!nowMs) return fmtWhen(iso);
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '—';
  const deltaHours = (at - nowMs) / 3_600_000;
  if (deltaHours < 0) return 'due';
  if (deltaHours < 1) return `in ${Math.max(1, Math.round(deltaHours * 60))} min`;
  if (deltaHours < 48) return `in ${Math.round(deltaHours)} h`;
  return `in ${Math.round(deltaHours / 24)} d`;
}

function memberLabel(detail: { email: string | null; userId: string | null }): string {
  return detail.email ?? (detail.userId ? `user ${detail.userId.slice(0, 12)}` : 'Unattributed');
}

/**
 * The change between two rates, as a signed point difference. Returns null when
 * either side is unmeasurable — a made-up baseline is worse than no trend.
 */
function deltaPoints(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return (current - previous) * 100;
}

function trendHint(label: string, delta: number | null, lowerIsBetter = true): string | undefined {
  if (delta == null) return undefined;
  if (Math.abs(delta) < 0.05) return `flat vs ${label}`;
  const direction = delta > 0 ? 'up' : 'down';
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  return `${direction} ${Math.abs(delta).toFixed(1)} pts vs ${label}${better ? '' : ' ⚠'}`;
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** The outcome split of a set of declined invoices, as one labeled bar. */
function OutcomeBar({ totals, currency }: { totals: DeclineTotals; currency: string }) {
  return (
    <ProportionBar
      total={totals.invoices}
      parts={[
        {
          key: 'recovered',
          label: `Recovered — ${fmtMoney(totals.recoveredAmount, currency)} came back`,
          value: totals.recoveredInvoices,
          color: RECOVERED_COLOR,
        },
        {
          key: 'open',
          label: `Still at risk — ${fmtMoney(totals.openAmount, currency)} in flight`,
          value: totals.openInvoices,
          color: AT_RISK_COLOR,
        },
        {
          key: 'lost',
          label: `Lost — ${fmtMoney(totals.lostAmount, currency)} gone`,
          value: totals.lostInvoices,
          color: LOST_COLOR,
        },
      ]}
    />
  );
}

/**
 * A compact outcome split for a table cell. Segments are separated by a 2px
 * surface gap and the row always carries its numbers in the adjacent columns,
 * so the split is never encoded by color alone.
 */
function OutcomeMiniBar({ totals }: { totals: DeclineTotals }) {
  const parts = [
    { key: 'recovered', value: totals.recoveredInvoices, color: RECOVERED_COLOR },
    { key: 'open', value: totals.openInvoices, color: AT_RISK_COLOR },
    { key: 'lost', value: totals.lostInvoices, color: LOST_COLOR },
  ].filter((part) => part.value > 0);
  const total = totals.invoices || 1;
  return (
    <div
      className="flex h-2 gap-0.5 rounded-full overflow-hidden min-w-[60px]"
      style={{ backgroundColor: 'var(--color-border)' }}
      aria-hidden
    >
      {parts.map((part) => (
        <div
          key={part.key}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${(part.value / total) * 100}%`, backgroundColor: part.color }}
        />
      ))}
    </div>
  );
}

const TH = 'py-1.5 px-2 text-left text-xs uppercase tracking-wide font-semibold';
const TD = 'py-1.5 px-2 align-top';
const NUM = 'py-1.5 px-2 text-right tabular-nums align-top whitespace-nowrap';

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function DeclineTracking({ mutedText, axisStroke }: { mutedText: string; axisStroke: string }) {
  const [windowDays, setWindowDays] = useState<WindowDays>(90);
  const [report, setReport] = useState<DeclinePayload | null>(null);
  const [failure, setFailure] = useState<{ windowDays: WindowDays; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = windowDays == null ? 'all' : String(windowDays);
    fetch(`/api/admin/monitoring/declines?days=${query}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 403 ? 'Admin access required' : `Failed to load declines (HTTP ${res.status})`,
          );
        }
        return res.json() as Promise<DeclinePayload>;
      })
      .then((body) => {
        if (!cancelled) setReport(body);
      })
      .catch((err) => {
        if (cancelled) return;
        setFailure({ windowDays, message: err instanceof Error ? err.message : 'Failed to load declines' });
      });
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  // Loading is DERIVED, not a flag set inside the effect: the payload states
  // which window it was built for, so "still loading" is exactly "what we are
  // holding is not what was asked for". That also makes a slow response for an
  // old window harmless — it can never be shown as the new one.
  const showingRequested = report != null && report.windowDays === windowDays;
  const error = failure?.windowDays === windowDays ? failure.message : null;
  const loading = !showingRequested && error == null;

  const windowLabel = useMemo(
    () => WINDOW_OPTIONS.find((option) => option.value === windowDays)?.label.toLowerCase() ?? 'window',
    [windowDays],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <ChoiceRow label="Window" options={WINDOW_OPTIONS} value={windowDays} onChange={setWindowDays} />
        {showingRequested && report && (
          <span className="text-xs" style={{ color: mutedText }}>
            {fmtInt(report.totals.attemptedInvoices)} invoices charged in the last {windowLabel}
          </span>
        )}
      </div>

      {error && <ErrorMessage message={error} />}
      {loading && <LoadingSpinner size="lg" />}
      {showingRequested && report && (
        <DeclineReportView
          report={report}
          windowLabel={windowLabel}
          mutedText={mutedText}
          axisStroke={axisStroke}
        />
      )}
    </div>
  );
}

function DeclineReportView({
  report,
  windowLabel,
  mutedText,
  axisStroke,
}: {
  report: DeclinePayload;
  windowLabel: string;
  mutedText: string;
  axisStroke: string;
}) {
  const { totals, previous, currency } = report;
  const nowMs = useMemo(() => {
    const parsed = Date.parse(report.generatedAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [report.generatedAt]);
  const priorLabel = 'prior period';

  if (totals.attempts === 0) {
    return (
      <Panel title="No declines on record for this window">
        <Sentence>
          Nothing has been declined in the last {windowLabel} — or nothing has been captured yet. Reasons are
          recorded from the moment a charge fails, so a freshly deployed tracker starts empty; historical
          failures can be reconstructed from the audit log with{' '}
          <code className="text-xs">make backfill-payment-declines</code>, which recovers the counts and the
          outcomes but not the issuer&apos;s reason (nothing ever wrote it down).
        </Sentence>
      </Panel>
    );
  }

  // The one sentence the operator should be able to read and then stop.
  const neverRecovered = totals.invoices - totals.recoveredInvoices;

  return (
    <div className="space-y-4">
      {/* 1 ─ What is this costing me? ------------------------------------ */}
      <Panel
        title="What declines are costing"
        subtitle={`Money Stripe tried to collect and did not, over the last ${windowLabel}. A decline is not a loss until it stops being recoverable, so the three outcomes are never added together.`}
      >
        <Sentence lead>
          <strong>{fmtPct(totals.declineRate)}</strong> of charges were declined
          {' — '}
          {fmtInt(totals.invoices)} invoice{totals.invoices === 1 ? '' : 's'} worth{' '}
          <strong>{fmtMoney(totals.amountAtRisk, currency)}</strong>, across {fmtInt(totals.members)} member
          {totals.members === 1 ? '' : 's'}.{' '}
          {totals.recoveredInvoices > 0 ? (
            <>
              {fmtMoney(totals.recoveredAmount, currency)} came back. {fmtMoney(totals.lostAmount, currency)} is
              gone and {fmtMoney(totals.openAmount, currency)} is still in flight.
            </>
          ) : (
            <>
              None of it has recovered yet: {fmtMoney(totals.lostAmount, currency)} is gone and{' '}
              {fmtMoney(totals.openAmount, currency)} is still in flight.
            </>
          )}
        </Sentence>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <StatTile
            label="Decline rate"
            value={fmtPct(totals.declineRate)}
            hint={
              trendHint(priorLabel, deltaPoints(totals.declineRate, previous?.declineRate ?? null)) ??
              `${fmtInt(totals.invoices)} of ${fmtInt(totals.attemptedInvoices)} invoices`
            }
            tone={AT_RISK_COLOR}
          />
          <StatTile
            label="Revenue lost"
            value={fmtMoney(totals.lostAmount, currency)}
            hint={`${fmtInt(totals.lostInvoices)} invoice${totals.lostInvoices === 1 ? '' : 's'} that will not be paid`}
            tone={LOST_COLOR}
          />
          <StatTile
            label="Still at risk"
            value={fmtMoney(totals.openAmount, currency)}
            hint={`${fmtInt(totals.openInvoices)} unpaid, retries still running`}
            tone={AT_RISK_COLOR}
          />
          <StatTile
            label="Recovery rate"
            value={fmtPct(totals.recoveryRate, 0)}
            hint={
              trendHint(priorLabel, deltaPoints(totals.recoveryRate, previous?.recoveryRate ?? null), false) ??
              'of the declines that resolved'
            }
            tone={RECOVERED_COLOR}
          />
          <StatTile
            label="Net loss rate"
            value={fmtPct(totals.lossRate)}
            hint={`${fmtInt(neverRecovered)} of ${fmtInt(totals.attemptedInvoices)} charges never collected`}
            tone={LOST_COLOR}
          />
        </div>

        <div className="mt-5">
          <OutcomeBar totals={totals} currency={currency} />
        </div>

        {previous && (
          <p className="mt-4 text-xs" style={{ color: mutedText }}>
            Prior period for comparison: {fmtInt(previous.invoices)} declined invoices of{' '}
            {fmtInt(previous.attemptedInvoices)} charged ({fmtPct(previous.declineRate)}),{' '}
            {fmtMoney(previous.lostAmount, currency)} lost, recovery {fmtPct(previous.recoveryRate, 0)}. An
            open decline in the current window has had less time to recover than one in the prior window, so
            read a softer recovery rate as incomplete before reading it as a regression.
          </p>
        )}
      </Panel>

      {/* 2 ─ Conversions or renewals? ------------------------------------ */}
      <Panel
        title="Conversions lost vs. customers lost"
        subtitle="Each kind of charge against its own attempt volume. A declined first charge is a sale that never closed; a declined renewal is a paying customer on the way out. They are different failures, they recover at different rates, and averaging them hides both."
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
                <th className={TH}>Charge kind</th>
                <th className={`${TH} text-right`}>Charged</th>
                <th className={`${TH} text-right`}>Declined</th>
                <th className={`${TH} text-right`}>Decline rate</th>
                <th className={TH}>Outcome</th>
                <th className={`${TH} text-right`}>Recovered</th>
                <th className={`${TH} text-right`}>Lost</th>
                <th className={`${TH} text-right`}>Never collected</th>
              </tr>
            </thead>
            <tbody>
              {report.byKind.map((row) => (
                <tr key={row.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className={TD}>
                    <div className="font-semibold">{row.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: mutedText }}>
                      {row.blurb}
                    </div>
                  </td>
                  <td className={NUM}>{fmtInt(row.attemptedInvoices)}</td>
                  <td className={NUM}>{fmtInt(row.invoices)}</td>
                  <td className={NUM} style={{ color: row.declineRate != null && row.declineRate > 0.1 ? LOST_COLOR : undefined }}>
                    {fmtPct(row.declineRate)}
                  </td>
                  <td className={TD} style={{ minWidth: 90 }}>
                    <OutcomeMiniBar totals={row} />
                  </td>
                  <td className={NUM} style={{ color: RECOVERED_COLOR }}>
                    {fmtInt(row.recoveredInvoices)}
                    <div className="text-xs" style={{ color: mutedText }}>
                      {fmtMoney(row.recoveredAmount, currency)}
                    </div>
                  </td>
                  <td className={NUM} style={{ color: LOST_COLOR }}>
                    {fmtInt(row.lostInvoices)}
                    <div className="text-xs" style={{ color: mutedText }}>
                      {fmtMoney(row.lostAmount, currency)}
                    </div>
                  </td>
                  <td className={NUM}>{fmtPct(row.lossRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: mutedText }}>
          <strong>Charged</strong> counts distinct invoices, so an invoice that declined and then paid is one
          attempt, not two. <strong>Never collected</strong> is the share of that kind&apos;s charges that a
          decline cost outright — the loss rate after the retries have run. Trial conversions are separated
          from renewals by the subscription&apos;s own <code className="text-xs">trial_end</code>, not by the
          billing reason, which is identical for both.
        </p>
      </Panel>

      {/* 3 ─ Why did the card say no? ------------------------------------ */}
      <CausePanel report={report} mutedText={mutedText} />

      {/* 4 ─ Recovery: how long, and who did it ------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecoveryLagPanel report={report} mutedText={mutedText} />
        <RecoveryRoutePanel report={report} mutedText={mutedText} />
      </div>

      {/* 5 ─ Over time --------------------------------------------------- */}
      <DailyPanel report={report} mutedText={mutedText} axisStroke={axisStroke} />

      {/* 6 ─ Who needs doing something about ---------------------------- */}
      <OpenWorklistPanel report={report} nowMs={nowMs} mutedText={mutedText} />

      <Disclosure
        title="Recently lost"
        summary={`${fmtInt(report.recentLosses.length)} invoice${report.recentLosses.length === 1 ? '' : 's'} that stopped being recoverable — ${fmtMoney(totals.lostAmount, currency)} in total`}
      >
        <LostTable rows={report.recentLosses} currency={currency} mutedText={mutedText} />
      </Disclosure>

      <Disclosure
        title="Members declined more than once"
        summary={
          report.repeatMembers.length === 0
            ? 'Nobody in this window has had two declined invoices'
            : `${fmtInt(report.repeatMembers.length)} member${report.repeatMembers.length === 1 ? '' : 's'} — a repeat decline is usually one card, not bad luck`
        }
      >
        <RepeatMembersTable report={report} mutedText={mutedText} />
      </Disclosure>

      <Disclosure
        title="Cards, retries and plans"
        summary="The same declines cut by card brand, by how many attempts they took, and by plan"
      >
        <BucketTable title="By card brand" rows={report.byBrand} currency={currency} mutedText={mutedText} />
        <BucketTable
          title="By attempts before it resolved"
          rows={report.byAttempt}
          currency={currency}
          mutedText={mutedText}
          note="Stripe re-emits a failure for every Smart Retry, so one unpaid invoice can appear four times. This groups invoices by how many times they were declined in total — which is also how many attempts a recovery needed."
        />
        <BucketTable title="By plan" rows={report.byPlan} currency={currency} mutedText={mutedText} />
      </Disclosure>

      <CoverageNote report={report} mutedText={mutedText} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cause
// ---------------------------------------------------------------------------

function CausePanel({ report, mutedText }: { report: DeclinePayload; mutedText: string }) {
  const { byCategory, byCode, currency, coverage } = report;
  const max = byCategory.reduce((m, row) => Math.max(m, row.invoices), 0);
  const unexplained = byCategory.find((row) => row.key === 'unknown')?.invoices ?? 0;

  return (
    <Panel
      title="Why the card said no"
      subtitle="Grouped by what each reason means you should DO about it, not by Stripe's raw code — a bank blocking an unfamiliar recurring charge and an account that was simply short are opposite problems with opposite remedies."
    >
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
              <th className={TH}>Reason</th>
              <th className={`${TH} text-right`}>Invoices</th>
              <th className={TH}>Share</th>
              <th className={`${TH} text-right`}>At risk</th>
              <th className={`${TH} text-right`}>Lost</th>
              <th className={`${TH} text-right`}>Recovery</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((row) => (
              <tr key={row.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{row.label}</span>
                    {CATEGORY_NEEDS_MEMBER_ACTION[row.key as DeclineCategory] && (
                      <span
                        className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ border: '1px solid var(--color-border)', color: mutedText }}
                      >
                        Needs the member
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: mutedText }}>
                    {declineGuidance(row.key as DeclineCategory)}
                  </div>
                </td>
                <td className={NUM}>{fmtInt(row.invoices)}</td>
                <td className={TD} style={{ minWidth: 120 }}>
                  <RankBar value={row.invoices} max={max} color={CAUSE_RANK_COLOR} />
                  <div className="text-xs mt-1" style={{ color: mutedText }}>
                    {fmtPct(row.share, 0)} of declines · {fmtInt(row.members)} member
                    {row.members === 1 ? '' : 's'}
                  </div>
                </td>
                <td className={NUM}>{fmtMoney(row.amountAtRisk, currency)}</td>
                <td className={NUM} style={{ color: LOST_COLOR }}>
                  {fmtMoney(row.lostAmount, currency)}
                </td>
                <td className={NUM} style={{ color: row.recoveryRate != null ? RECOVERED_COLOR : undefined }}>
                  {fmtPct(row.recoveryRate, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unexplained > 0 && (
        <p className="mt-3 text-xs" style={{ color: mutedText }}>
          {fmtInt(unexplained)} decline{unexplained === 1 ? '' : 's'} carry no usable code. That is either a
          payload that shipped without one or a row reconstructed from the audit log, which never recorded a
          reason. Neither is guessed at — an unmapped code stays unmapped rather than being rounded to the
          nearest plausible cause.
        </p>
      )}

      <div className="mt-4">
        <Disclosure
          title="Raw decline codes"
          summary={
            byCode.length === 0
              ? 'No coded declines in this window yet'
              : `${fmtInt(byCode.length)} distinct code${byCode.length === 1 ? '' : 's'}, exactly as the issuer spelled them (${fmtInt(coverage.withCodes)} of ${fmtInt(coverage.withCodes + coverage.withoutCodes)} attempts carry one)`
          }
        >
          {byCode.length === 0 ? (
            <Sentence>
              Nothing to show. Codes are captured from the charge at the moment it fails; rows reconstructed
              from history have none.
            </Sentence>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[780px]">
                <thead>
                  <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
                    <th className={TH}>Code</th>
                    <th className={TH}>Reads as</th>
                    <th className={`${TH} text-right`}>Invoices</th>
                    <th className={`${TH} text-right`}>Attempts</th>
                    <th className={`${TH} text-right`}>At risk</th>
                    <th className={`${TH} text-right`}>Lost</th>
                    <th className={`${TH} text-right`}>Recovery</th>
                  </tr>
                </thead>
                <tbody>
                  {byCode.map((row) => (
                    <tr key={row.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className={TD}>
                        <code className="text-xs">{row.code}</code>
                        {row.sampleMessage && (
                          <div className="text-xs mt-0.5" style={{ color: mutedText }}>
                            &ldquo;{row.sampleMessage}&rdquo;
                          </div>
                        )}
                      </td>
                      <td className={TD} style={{ color: mutedText }}>
                        {DECLINE_CATEGORY_LABEL[row.category]}
                      </td>
                      <td className={NUM}>{fmtInt(row.invoices)}</td>
                      <td className={NUM}>{fmtInt(row.attempts)}</td>
                      <td className={NUM}>{fmtMoney(row.amountAtRisk, currency)}</td>
                      <td className={NUM} style={{ color: LOST_COLOR }}>
                        {fmtMoney(row.lostAmount, currency)}
                      </td>
                      <td className={NUM}>{fmtPct(row.recoveryRate, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Disclosure>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

function RecoveryLagPanel({ report, mutedText }: { report: DeclinePayload; mutedText: string }) {
  const { recoveryLag, currency } = report;
  const max = recoveryLag.buckets.reduce((m, bucket) => Math.max(m, bucket.count), 0);
  return (
    <Panel
      title="How long recovery takes"
      subtitle={
        recoveryLag.sampled === 0
          ? 'Nothing has recovered in this window yet.'
          : `Time from the first decline to the money clearing, over ${fmtInt(recoveryLag.sampled)} recovered invoice${recoveryLag.sampled === 1 ? '' : 's'}. This is what an "at risk" balance is worth waiting for.`
      }
    >
      {recoveryLag.sampled === 0 ? (
        <Sentence>
          A recovery rate needs resolved declines, and none have resolved yet. Give Stripe&apos;s retry
          schedule — roughly three weeks — before reading the rate above as final.
        </Sentence>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatTile label="Median" value={fmtHours(recoveryLag.medianHours)} hint="typical wait" tone={RECOVERED_COLOR} />
            <StatTile label="90th percentile" value={fmtHours(recoveryLag.p90Hours)} hint="the slow tail" />
          </div>
          <ul className="space-y-2">
            {recoveryLag.buckets.map((bucket) => (
              <li key={bucket.key} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="flex-1 min-w-0">{bucket.label}</span>
                  <span className="tabular-nums font-semibold">{fmtInt(bucket.count)}</span>
                  <span className="tabular-nums text-xs w-20 text-right" style={{ color: mutedText }}>
                    {fmtMoney(bucket.amount, currency)}
                  </span>
                </div>
                <div className="mt-1">
                  <RankBar value={bucket.count} max={max} color={RECOVERED_COLOR} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function RecoveryRoutePanel({ report, mutedText }: { report: DeclinePayload; mutedText: string }) {
  const { byRecoveryRoute, currency } = report;
  const total = byRecoveryRoute.reduce((sum, row) => sum + row.invoices, 0);
  return (
    <Panel
      title="Who got the money in"
      subtitle="Whether Stripe's own retry collected it or the member had to act. Only the second half is addressable — it is the cohort a better dunning email actually moves."
    >
      {total === 0 ? (
        <Sentence>No recoveries in this window yet, so there is nothing to attribute.</Sentence>
      ) : (
        <>
          <ProportionBar
            total={total}
            parts={byRecoveryRoute.map((row) => ({
              key: row.key,
              label: `${row.label} — ${fmtMoney(row.recoveredAmount, currency)}`,
              value: row.invoices,
              color:
                row.key === 'auto_retry' ? RECOVERED_COLOR : row.key === 'member_action' ? CAUSE_RANK_COLOR : PAID_COLOR,
            }))}
          />
          <p className="mt-4 text-xs" style={{ color: mutedText }}>
            Inferred, not reported: Stripe publishes no &ldquo;who paid this&rdquo; field, so a payment landing
            before the retry it had scheduled is credited to the member and one landing at or after it to the
            retry, with fifteen minutes of slack for clock skew. An invoice with no scheduled retry to compare
            against is left unattributed rather than assigned.
          </p>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Over time
// ---------------------------------------------------------------------------

function DailyPanel({
  report,
  mutedText,
  axisStroke,
}: {
  report: DeclinePayload;
  mutedText: string;
  axisStroke: string;
}) {
  const { daily, currency } = report;
  const dayLabel = useMemo(() => makeDayLabelFormatter(daily.map((point) => point.day)), [daily]);
  // Days with nothing on either side are dropped from the rate chart: a day with
  // no charges has no decline rate, and plotting it as 0% invents a good day.
  const rateData = useMemo(() => daily.filter((point) => point.declineRate != null), [daily]);
  const hasAnything = daily.some((point) => point.invoices > 0);

  return (
    <Panel
      title="Declines by day"
      subtitle="Each declined invoice sits on the day it FIRST failed, colored by how it ended, so a retry cannot double-count the money. Two charts rather than two axes: counts and a rate do not share a scale."
    >
      {!hasAnything ? (
        <Sentence>No declines on any day in this window.</Sentence>
      ) : (
        <>
          <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap mb-2" style={{ color: mutedText }}>
            <span>
              <span style={{ color: RECOVERED_COLOR }}>●</span> Recovered
            </span>
            <span>
              <span style={{ color: AT_RISK_COLOR }}>●</span> Still at risk
            </span>
            <span>
              <span style={{ color: LOST_COLOR }}>●</span> Lost
            </span>
          </div>
          <MobileScrollableChart>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke={axisStroke}
                  tick={{ fill: axisStroke, fontSize: 10 }}
                  tickLine={false}
                  minTickGap={40}
                  tickFormatter={dayLabel}
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ fill: axisStroke, fontSize: 10 }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.06 }}
                  content={({ active, label, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as (typeof daily)[number];
                    return (
                      <div
                        className="rounded-lg border px-3 py-2 text-xs"
                        style={{
                          backgroundColor: 'var(--color-chart-tooltip-bg)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-chart-tooltip-text)',
                        }}
                      >
                        <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
                        <div>Recovered: {fmtInt(point.recoveredInvoices)}</div>
                        <div>Still at risk: {fmtInt(point.openInvoices)}</div>
                        <div>Lost: {fmtInt(point.lostInvoices)}</div>
                        <div className="mt-1" style={{ color: mutedText }}>
                          {fmtMoney(point.amountAtRisk, currency)} at risk · {fmtInt(point.paidInvoices)} paid
                          that day · {fmtPct(point.declineRate)} declined
                        </div>
                        <div style={{ color: mutedText }}>
                          {fmtInt(point.trialConversion)} conversion · {fmtInt(point.renewal)} renewal ·{' '}
                          {fmtInt(point.firstCharge)} first charge
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  stackId="declines"
                  dataKey="recoveredInvoices"
                  name="Recovered"
                  fill={RECOVERED_COLOR}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
                <Bar
                  stackId="declines"
                  dataKey="openInvoices"
                  name="Still at risk"
                  fill={AT_RISK_COLOR}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
                <Bar
                  stackId="declines"
                  dataKey="lostInvoices"
                  name="Lost"
                  fill={LOST_COLOR}
                  maxBarSize={18}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </MobileScrollableChart>

          {rateData.length > 1 && (
            <div className="mt-6">
              <h4 className="zg-h4 mb-1">Decline rate by day</h4>
              <p className="text-xs mb-2" style={{ color: mutedText }}>
                Declined invoices over every invoice charged that day. On a small base one bad afternoon is a
                spike, not a trend — read the level, not the jitter.
              </p>
              <MobileScrollableChart>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={rateData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke={axisStroke}
                      tick={{ fill: axisStroke, fontSize: 10 }}
                      tickLine={false}
                      minTickGap={40}
                      tickFormatter={dayLabel}
                    />
                    <YAxis
                      stroke={axisStroke}
                      tick={{ fill: axisStroke, fontSize: 10 }}
                      tickLine={false}
                      tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                    />
                    <Tooltip
                      cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                      content={({ active, label, payload }) => {
                        if (!active || !payload?.length) return null;
                        const point = payload[0].payload as (typeof daily)[number];
                        return (
                          <div
                            className="rounded-lg border px-3 py-2 text-xs"
                            style={{
                              backgroundColor: 'var(--color-chart-tooltip-bg)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-chart-tooltip-text)',
                            }}
                          >
                            <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
                            <div>{fmtPct(point.declineRate)} of charges declined</div>
                            <div style={{ color: mutedText }}>
                              {fmtInt(point.invoices)} declined · {fmtInt(point.paidInvoices)} paid
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="declineRate"
                      name="Decline rate"
                      stroke={LOST_COLOR}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </MobileScrollableChart>
            </div>
          )}

          <Disclosure
            title="Day table"
            summary="The same series as numbers, for a day you want to read exactly"
            defaultOpen={false}
          >
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
                    <th className={TH}>Day</th>
                    <th className={`${TH} text-right`}>Charged</th>
                    <th className={`${TH} text-right`}>Declined</th>
                    <th className={`${TH} text-right`}>Rate</th>
                    <th className={`${TH} text-right`}>At risk</th>
                    <th className={`${TH} text-right`}>Recovered</th>
                    <th className={`${TH} text-right`}>Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily]
                    .reverse()
                    .filter((point) => point.invoices > 0 || point.paidInvoices > 0)
                    .map((point) => (
                      <tr key={point.day} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className={TD}>{point.day}</td>
                        <td className={NUM}>{fmtInt(point.paidInvoices + point.invoices)}</td>
                        <td className={NUM}>{fmtInt(point.invoices)}</td>
                        <td className={NUM}>{fmtPct(point.declineRate, 0)}</td>
                        <td className={NUM}>{fmtMoney(point.amountAtRisk, currency)}</td>
                        <td className={NUM} style={{ color: RECOVERED_COLOR }}>
                          {fmtInt(point.recoveredInvoices)}
                        </td>
                        <td className={NUM} style={{ color: LOST_COLOR }}>
                          {fmtInt(point.lostInvoices)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Worklists
// ---------------------------------------------------------------------------

function OpenWorklistPanel({
  report,
  nowMs,
  mutedText,
}: {
  report: DeclinePayload;
  nowMs: number;
  mutedText: string;
}) {
  const { openWorklist, currency, totals } = report;
  const chase = openWorklist.filter((row) => row.needsMemberAction);
  const wait = openWorklist.filter((row) => !row.needsMemberAction);

  return (
    <Panel
      title="Open right now"
      subtitle={`${fmtInt(totals.openInvoices)} unpaid invoice${totals.openInvoices === 1 ? '' : 's'} worth ${fmtMoney(totals.openAmount, currency)}, split by whether the member has to do something or the retry will most likely handle it.`}
    >
      {openWorklist.length === 0 ? (
        <Sentence>Nothing is open. Every decline in this window has resolved one way or the other.</Sentence>
      ) : (
        <div className="space-y-6">
          <WorklistTable
            heading="Needs the member"
            note="The card itself is unusable, the issuer refused it, or a 3DS step-up was not completed. No retry fixes any of these on its own."
            rows={chase}
            currency={currency}
            nowMs={nowMs}
            mutedText={mutedText}
          />
          <WorklistTable
            heading="Leave it to the retry"
            note="A short balance or a transient error. Stripe's own retry collects most of these; pressing someone whose account was empty spends goodwill on a charge that was going to clear anyway."
            rows={wait}
            currency={currency}
            nowMs={nowMs}
            mutedText={mutedText}
          />
        </div>
      )}
    </Panel>
  );
}

function WorklistTable({
  heading,
  note,
  rows,
  currency,
  nowMs,
  mutedText,
}: {
  heading: string;
  note: string;
  rows: DeclineDetail[];
  currency: string;
  nowMs: number;
  mutedText: string;
}) {
  return (
    <div>
      <h4 className="zg-h4">{heading}</h4>
      <p className="text-xs mt-0.5 mb-2" style={{ color: mutedText }}>
        {note}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: mutedText }}>
          Nothing here.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
                <th className={TH}>Member</th>
                <th className={TH}>Charge</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}>Reason</th>
                <th className={`${TH} text-right`}>Tries</th>
                <th className={`${TH} text-right`}>Unpaid for</th>
                <th className={`${TH} text-right`}>Next retry</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.invoiceId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className={TD}>
                    <div className="font-medium break-all">{memberLabel(row)}</div>
                    {row.cardLast4 && (
                      <div className="text-xs" style={{ color: mutedText }}>
                        {row.cardBrand ?? 'card'} ····{row.cardLast4}
                      </div>
                    )}
                  </td>
                  <td className={TD}>
                    <div>{DECLINE_KIND_SHORT[row.kind] ?? row.kind}</div>
                    <div className="text-xs" style={{ color: mutedText }}>
                      {row.tier ?? 'plan unknown'}
                      {row.cadence ? ` · ${row.cadence}` : ''}
                    </div>
                  </td>
                  <td className={NUM}>{fmtMoney(row.amount, currency)}</td>
                  <td className={TD}>
                    <div>{DECLINE_CATEGORY_LABEL[row.category]}</div>
                    {row.code && (
                      <div className="text-xs" style={{ color: mutedText }}>
                        <code>{row.code}</code>
                        {row.message ? ` — ${row.message}` : ''}
                      </div>
                    )}
                  </td>
                  <td className={NUM}>{fmtInt(row.attempts)}</td>
                  <td className={NUM}>{fmtHours(row.ageHours)}</td>
                  <td className={NUM}>
                    {fmtCountdown(row.nextAttemptAt, nowMs)}
                    {row.graceUntil && (
                      <div className="text-xs" style={{ color: AT_RISK_COLOR }}>
                        access until {fmtWhen(row.graceUntil)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Short forms for a narrow table cell; the long forms live in the kind table. */
const DECLINE_KIND_SHORT: Record<string, string> = {
  trial_conversion: 'Trial conversion',
  first_charge: 'First charge',
  renewal: 'Renewal',
  other: 'Proration',
  unknown: 'Unclassified',
};

function LostTable({
  rows,
  currency,
  mutedText,
}: {
  rows: DeclineDetail[];
  currency: string;
  mutedText: string;
}) {
  if (rows.length === 0) {
    return <Sentence>Nothing has been written off in this window.</Sentence>;
  }
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[780px]">
        <thead>
          <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
            <th className={TH}>Member</th>
            <th className={TH}>Charge</th>
            <th className={`${TH} text-right`}>Amount</th>
            <th className={TH}>Reason</th>
            <th className={TH}>How it ended</th>
            <th className={`${TH} text-right`}>Gave up</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.invoiceId} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td className={TD}>
                <div className="font-medium break-all">{memberLabel(row)}</div>
              </td>
              <td className={TD}>{DECLINE_KIND_SHORT[row.kind] ?? row.kind}</td>
              <td className={NUM} style={{ color: LOST_COLOR }}>
                {fmtMoney(row.amount, currency)}
              </td>
              <td className={TD}>
                {DECLINE_CATEGORY_LABEL[row.category]}
                {row.code && (
                  <div className="text-xs" style={{ color: mutedText }}>
                    <code>{row.code}</code>
                  </div>
                )}
              </td>
              <td className={TD}>{LOST_REASON_LABEL[(row.lostReason as LostReason) ?? 'unknown'] ?? 'Unresolved'}</td>
              <td className={NUM}>{fmtWhen(row.resolvedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepeatMembersTable({ report, mutedText }: { report: DeclinePayload; mutedText: string }) {
  const { repeatMembers, currency } = report;
  if (repeatMembers.length === 0) {
    return (
      <Sentence>
        No member in this window has had more than one declined invoice. That is the healthy state: a repeat
        decline on the same account is almost always one card that needs replacing, not luck.
      </Sentence>
    );
  }
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
            <th className={TH}>Member</th>
            <th className={`${TH} text-right`}>Invoices</th>
            <th className={`${TH} text-right`}>Attempts</th>
            <th className={`${TH} text-right`}>Lost</th>
            <th className={`${TH} text-right`}>Still at risk</th>
            <th className={TH}>Reasons seen</th>
            <th className={`${TH} text-right`}>Last decline</th>
          </tr>
        </thead>
        <tbody>
          {repeatMembers.map((row) => (
            <tr key={row.userId ?? row.email ?? row.lastFailedAt} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td className={TD}>
                <div className="font-medium break-all">{memberLabel(row)}</div>
                {row.neverRecovered && (
                  <div className="text-xs" style={{ color: LOST_COLOR }}>
                    never recovered once
                  </div>
                )}
              </td>
              <td className={NUM}>{fmtInt(row.invoices)}</td>
              <td className={NUM}>{fmtInt(row.attempts)}</td>
              <td className={NUM} style={{ color: LOST_COLOR }}>
                {fmtMoney(row.lostAmount, currency)}
              </td>
              <td className={NUM}>{fmtMoney(row.openAmount, currency)}</td>
              <td className={TD} style={{ color: mutedText }}>
                {row.categories.map((category) => DECLINE_CATEGORY_LABEL[category]).join(', ')}
              </td>
              <td className={NUM}>{fmtWhen(row.lastFailedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BucketTable({
  title,
  rows,
  currency,
  mutedText,
  note,
}: {
  title: string;
  rows: DeclineBucket[];
  currency: string;
  mutedText: string;
  note?: string;
}) {
  const max = rows.reduce((m, row) => Math.max(m, row.invoices), 0);
  return (
    <div>
      <h4 className="zg-h4">{title}</h4>
      {note && (
        <p className="text-xs mt-0.5 mb-2" style={{ color: mutedText }}>
          {note}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: mutedText }}>
          Nothing to show.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr style={{ color: mutedText, borderBottom: '1px solid var(--color-border)' }}>
                <th className={TH}>{title.replace(/^By /, '').replace(/^\w/, (c) => c.toUpperCase())}</th>
                <th className={`${TH} text-right`}>Invoices</th>
                <th className={TH}>Share</th>
                <th className={`${TH} text-right`}>At risk</th>
                <th className={`${TH} text-right`}>Lost</th>
                <th className={`${TH} text-right`}>Recovery</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className={TD}>{row.label}</td>
                  <td className={NUM}>{fmtInt(row.invoices)}</td>
                  <td className={TD} style={{ minWidth: 110 }}>
                    <RankBar value={row.invoices} max={max} color={CAUSE_RANK_COLOR} />
                    <div className="text-xs mt-1" style={{ color: mutedText }}>
                      {fmtPct(row.share, 0)}
                    </div>
                  </td>
                  <td className={NUM}>{fmtMoney(row.amountAtRisk, currency)}</td>
                  <td className={NUM} style={{ color: LOST_COLOR }}>
                    {fmtMoney(row.lostAmount, currency)}
                  </td>
                  <td className={NUM}>{fmtPct(row.recoveryRate, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

function CoverageNote({ report, mutedText }: { report: DeclinePayload; mutedText: string }) {
  const { coverage, excluded, reconciled } = report;
  const attempts = coverage.withCodes + coverage.withoutCodes;
  const backfilled = coverage.bySource.find((row) => row.source === 'audit_backfill')?.attempts ?? 0;
  return (
    <Disclosure
      title="What these numbers are made of"
      summary={`${fmtInt(coverage.withCodes)} of ${fmtInt(attempts)} attempts carry an issuer reason · ${fmtInt(excluded.total)} account${excluded.total === 1 ? '' : 's'} held out`}
    >
      <Sentence>
        A decline is recorded the moment a charge fails, with whatever the issuer said, and is stamped again
        when the invoice is later paid, when the subscription is cancelled, or when the invoice is voided or
        written off. Nothing here is inferred from a subscription&apos;s state.
      </Sentence>
      <ul className="text-sm space-y-1.5" style={{ color: mutedText }}>
        <li>
          <strong>Reasons captured:</strong> {fmtInt(coverage.withCodes)} of {fmtInt(attempts)} attempts
          {coverage.firstCodedAt ? `, the first on ${fmtWhen(coverage.firstCodedAt)}` : ''}.
          {backfilled > 0 && (
            <>
              {' '}
              {fmtInt(backfilled)} attempt{backfilled === 1 ? ' was' : 's were'} reconstructed from the audit
              log, which recorded that a charge failed but never why — those count toward every total and sit
              in &ldquo;No usable decline code&rdquo;.
            </>
          )}
        </li>
        <li>
          <strong>History starts:</strong> {fmtWhen(coverage.firstRecordedAt)}. Anything before that is not
          zero declines, it is no records.
        </li>
        <li>
          <strong>Still-open declines closed by this read:</strong> {fmtInt(reconciled.recovered)} found paid,{' '}
          {fmtInt(reconciled.cancelled)} closed by a cancellation, {fmtInt(reconciled.agedOut)} aged out. The
          last of those is marked unresolved rather than lost — never seen to recover is a weaker claim than
          known to be gone, and the report makes the weaker one.
        </li>
        <li>
          <strong>Held out of every number:</strong> {fmtInt(excluded.total)} account
          {excluded.total === 1 ? '' : 's'}
          {excluded.total > 0 && (
            <>
              {' '}
              (
              {Object.entries(excluded.byReason)
                .filter(([, count]) => count > 0)
                .map(([reason, count]) => `${count} ${EXCLUSION_REASON_LABEL[reason as keyof typeof EXCLUSION_REASON_LABEL]}`)
                .join(', ')}
              )
            </>
          )}
          . A card that was never going to be charged commercially cannot lose revenue.
        </li>
      </ul>
    </Disclosure>
  );
}
