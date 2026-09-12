'use client';

import type { AtRiskPool, RenewalCohortRow, RenewalReport, RenewalStep } from '@/core/renewalRetention';
import { cohortLabel, pct } from './cohortPanels';
import { DROP_COLOR, FUNNEL_COLOR, LOSS_UNKNOWN, LOSS_VOLUNTARY } from './palette';
import { Panel, ProportionBar, RankBar } from './ui';

// DOES THE SECOND PAYMENT HAPPEN — the renewal ladder, the money currently at
// risk from cancellations already scheduled, and the first-renewal rate by
// cohort.
//
// Everything here separates three populations that a renewal dashboard usually
// blurs together: customers whose period has ended (an outcome exists),
// customers whose period is still running (no outcome yet — but a cancellation
// already scheduled among them is next month's rate, visible now), and
// customers whose renewal fell outside the invoice record (unknown, and never
// silently counted as a loss).

const usd = (value: number) =>
  `$${Math.round(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ border: '1px solid var(--color-border)' }}>
      <div className="text-2xl font-semibold tabular-nums leading-none" style={{ color: tone ?? 'var(--color-text-primary)' }}>
        {value}
      </div>
      <div className="mt-1.5 text-xs font-semibold">{label}</div>
      {hint && <div className="mt-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{hint}</div>}
    </div>
  );
}

/**
 * The single most important retention number: of the monthly customers whose
 * first month has actually ended, how many paid again.
 *
 * Scheduled cancellations sit OUTSIDE the rate on purpose. Their outcome has not
 * happened yet — folding them in would report a loss before the customer has
 * stopped paying, and folding them into the numerator would report a renewal
 * that is already cancelled.
 */
export function FirstRenewalCard({ report }: { report: RenewalReport }) {
  const step = report.steps[0];
  if (!step) return null;
  const noSignal = step.eligible === 0;
  return (
    <Panel
      title="First renewal"
      subtitle={report.observableFrom
        ? `Monthly customers only. A renewal is a subscription_cycle invoice that actually cleared — visible from ${new Date(report.observableFrom).toLocaleDateString()}.`
        : 'No successful-invoice records exist yet, so no renewal can be confirmed. Run make backfill-stripe-invoices to import the real history from Stripe.'}
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Figure
          label="Renewal rate"
          value={noSignal ? '—' : pct(step.rate)}
          hint={noSignal ? 'no month has completed yet' : `${step.renewed} of ${step.eligible}`}
          tone={noSignal ? undefined : FUNNEL_COLOR}
        />
        <Figure label="Eligible" value={step.eligible.toLocaleString()} hint="first month has ended" />
        <Figure label="Renewed" value={step.renewed.toLocaleString()} hint="paid a second time" />
        <Figure
          label="Cancelling before it"
          value={step.approachingScheduledCancel.toLocaleString()}
          hint={`of ${step.approaching.toLocaleString()} still in month one`}
          tone={step.approachingScheduledCancel > 0 ? LOSS_VOLUNTARY : undefined}
        />
        <Figure
          label="Failed payment"
          value={step.notRenewedFailedPayment.toLocaleString()}
          hint="card declined at renewal"
          tone={step.notRenewedFailedPayment > 0 ? DROP_COLOR : undefined}
        />
      </div>
      {step.unobservable > 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {step.unobservable.toLocaleString()} more monthly customer{step.unobservable === 1 ? '' : 's'} had a
          first renewal fall due outside the invoice record, or have no billing period on file. They are excluded
          from the rate rather than counted as a loss — <code>make backfill-stripe-invoices</code> recovers them.
        </p>
      )}
    </Panel>
  );
}

/** Renewals #1–#3, each measured only over customers who cleared the one before. */
export function RenewalLadder({ steps }: { steps: RenewalStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.renewalNumber} className="rounded-lg p-3" style={{ border: '1px solid var(--color-border)' }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold">
              Renewal #{step.renewalNumber} · payment #{step.paymentNumber}
            </span>
            <span className="text-sm tabular-nums">
              <strong>{step.eligible === 0 ? '—' : pct(step.rate)}</strong>
              <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {step.renewed} of {step.eligible} eligible
              </span>
            </span>
          </div>
          {/* The bar is the RATE, not the count: scaling it against the biggest
              step's eligible population drew a 100% renewal shorter than a 60%
              one, which is the opposite of what the row says. */}
          <div className="mt-2"><RankBar value={step.renewed} max={Math.max(1, step.eligible)} color={FUNNEL_COLOR} /></div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span>{step.approaching.toLocaleString()} still in the period</span>
            <span>{step.approachingScheduledCancel.toLocaleString()} of those cancelling</span>
            <span>{step.notRenewedFailedPayment.toLocaleString()} failed payment</span>
            <span>{step.notRenewedVoluntary.toLocaleString()} chose not to</span>
            <span>{step.notRenewedUnknown.toLocaleString()} unattributed</span>
            {step.unobservable > 0 && <span>{step.unobservable.toLocaleString()} outside the invoice record</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * What walks out of the door if nothing changes. Every customer here is STILL
 * PAYING — they are in the active headcount as well, and stay there until the
 * access they bought actually runs out.
 */
export function AtRiskPanel({ pool }: { pool: AtRiskPool }) {
  return (
    <Panel
      title="Currently at risk"
      subtitle="Customers who are still paying but have already scheduled a cancellation. None of them has churned yet; this is the revenue that stops when their access runs out."
    >
      {pool.total === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No cancellations are scheduled.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Figure
              label="MRR at risk"
              value={usd(pool.monthlyMrrAtRisk)}
              hint={`${pool.monthly} monthly subscriber${pool.monthly === 1 ? '' : 's'}`}
              tone={pool.monthlyMrrAtRisk > 0 ? DROP_COLOR : undefined}
            />
            <Figure
              label="Annual contracts at risk"
              value={usd(pool.annualRevenueAtRisk)}
              hint={`${pool.annual} annual subscriber${pool.annual === 1 ? '' : 's'}`}
              tone={pool.annualRevenueAtRisk > 0 ? DROP_COLOR : undefined}
            />
            <Figure label="Customers leaving" value={pool.total.toLocaleString()} hint="access ends on the dates below" />
            <Figure
              label="Gone within 7 days"
              value={pool.endingWithin7Days.toLocaleString()}
              hint={`${pool.endingWithin30Days} within 30 days`}
              tone={pool.endingWithin7Days > 0 ? LOSS_VOLUNTARY : undefined}
            />
          </div>

          <h4 className="zg-h4 mt-6 mb-3">When access ends</h4>
          <ProportionBar
            total={pool.total}
            parts={[
              { key: 'week', label: 'Within 7 days', value: pool.endingWithin7Days, color: DROP_COLOR },
              { key: 'month', label: '8–30 days', value: Math.max(0, pool.endingWithin30Days - pool.endingWithin7Days), color: LOSS_VOLUNTARY },
              { key: 'later', label: 'More than 30 days out', value: pool.endingAfter30Days, color: LOSS_UNKNOWN },
            ]}
          />

          {(pool.cadenceUnknown > 0 || pool.unpriced > 0) && (
            <p className="mt-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {pool.cadenceUnknown > 0 && `${pool.cadenceUnknown} of these could not be placed on a billing cadence. `}
              {pool.unpriced > 0 && `${pool.unpriced} carry a price id that maps to no current SKU and contribute $0 to the figures above rather than a guess.`}
            </p>
          )}

          <h4 className="zg-h4 mt-6 mb-2">Who is leaving</h4>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-xs" style={{ minWidth: 520 }}>
              <thead style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
                <tr>
                  {['Customer', 'Plan', 'Monthly value', 'Access ends', 'Days left'].map((head) => (
                    <th key={head} className="px-3 py-2 text-left font-semibold first:text-left last:text-right">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pool.customers.slice(0, 40).map((customer) => (
                  <tr key={customer.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-3 py-2">{customer.email}</td>
                    <td className="px-3 py-2">{customer.tier}{customer.cadence ? ` · ${customer.cadence}` : ' · cadence unknown'}</td>
                    <td className="px-3 py-2 tabular-nums">{customer.monthlyValue > 0 ? usd(customer.monthlyValue) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {customer.accessEndsAt ? new Date(customer.accessEndsAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{customer.daysRemaining ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pool.customers.length > 40 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Showing the 40 leaving soonest, of {pool.customers.length}.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

/** First-renewal rate by the month the customer registered in. */
export function RenewalCohortTable({ rows }: { rows: RenewalCohortRow[] }) {
  const shown = rows.filter((row) => row.firstTimePayers > 0);
  if (shown.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No monthly customers on record yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm" style={{ minWidth: 820 }}>
        <thead style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
          <tr>
            {['Registration cohort', 'Monthly payers', 'Eligible for renewal', 'Renewed', 'Cancelling first', 'Failed payment', 'Renewal rate'].map((head) => (
              <th key={head} className="px-3 py-2.5 text-right font-semibold first:text-left">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.cohort} style={{ borderTop: '1px solid var(--color-border)' }}>
              <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{cohortLabel(row.cohort)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.firstTimePayers}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.eligible}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{row.renewed}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.approachingScheduledCancel}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.notRenewedFailedPayment}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: row.eligible > 0 ? FUNNEL_COLOR : undefined }}>
                {row.eligible === 0 ? '—' : pct(row.rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
