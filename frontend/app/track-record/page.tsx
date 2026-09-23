import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

import { serverApiGet } from '@/core/api/serverFetch';
import { SYMBOLS } from '@/core/symbols';
import {
  summarizeForecastHistory,
  FORECAST_HISTORY_LIMIT,
  historyHeadline,
  clusteringNote,
  coverageVerdict,
  coverageVerdictText,
  brierVerdict,
  brierVerdictText,
  volVerdict,
  volVerdictText,
  fmtRate,
  fmtCi,
  articleForPercent,
  MIN_SCORED_FOR_RATES,
  type ForecastDateEntry,
  type HistorySummary,
  type RollingStats,
} from '@/core/trackRecord';

// THE RECORD. One URL that is the whole graded history, in public, with the
// misses named and dated.
//
// WHY THIS PAGE EXISTS. The numbers were already being computed — rolling
// coverage, Wilson intervals, baselines, Brier — and rendered on every dated
// receipt under /forecast. But a receipt is one day. Nothing on the site said
// what the record IS, so the only people who knew were the ones who clicked
// through thirty permalinks. This was a burial problem, not a measurement one.
//
// WHY THE FULL HISTORY AND NOT THE ROLLING WINDOW. The rolling endpoint
// reported SPX coverage of 29 for 29 on 2026-09-22. The full archive holds 48
// of 55. Both are true: if every session in the window held and every miss is
// on or before Aug 4, the window must begin after Aug 4 — about a week past
// the two worst sessions in the record. Leading with 100% would put this page
// one archive lookup away from looking like it buried them, and we publish
// that archive ourselves. So the headline is the whole record and the rolling
// window appears below it, labelled as recent form.
//
// THE RULE THIS PAGE OBEYS: nothing here may say something a dated receipt
// would contradict. Every claim routes through core/trackRecord.ts, which is
// pure and unit-tested, rather than being phrased inline.

export const revalidate = 1800;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

// Deep enough to hold every graded session the writer has ever committed —
// the archive stood at 55 when this shipped. A cap rather than "all" so one
// pathological response cannot stall the render.

// The symbol the headline speaks for. SPX has the deepest archive and is what
// the range-width analysis was run against.
const PRIMARY = 'SPX';

type DateList = { symbol: string; count: number; dates: ForecastDateEntry[] };

type SymbolRecord = {
  symbol: string;
  history: HistorySummary;
  stats: RollingStats | null;
};

async function loadSymbol(symbol: string): Promise<SymbolRecord> {
  const [list, stats] = await Promise.all([
    serverApiGet<DateList>(`/api/forecast/available-dates?symbol=${symbol}&limit=${FORECAST_HISTORY_LIMIT}`, revalidate),
    serverApiGet<RollingStats>(`/api/forecast/stats/rolling?symbol=${symbol}&window=30`, revalidate),
  ]);
  return { symbol, history: summarizeForecastHistory(list?.dates, symbol), stats };
}

export const metadata: Metadata = {
  title: 'Track Record — ZeroGEX',
  description:
    'Every gamma forecast we have published, graded. Coverage rates with confidence intervals, the dates we missed, and what the numbers do not say.',
  alternates: { canonical: `${SITE_URL}/track-record` },
  openGraph: {
    title: 'ZeroGEX Track Record',
    description:
      'Every forecast, graded and dated — including the misses. Published because a forecast nobody grades is not a forecast.',
    url: `${SITE_URL}/track-record`,
    type: 'website',
  },
};

function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function Verdict({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--color-bull)' }} aria-hidden />
  ) : (
    <XCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--color-bear)' }} aria-hidden />
  );
}

export default async function TrackRecordPage() {
  const records = await Promise.all(SYMBOLS.map((s) => loadSymbol(s)));
  const bySymbol = new Map(records.map((r) => [r.symbol, r]));
  const primary = bySymbol.get(PRIMARY) ?? records[0];

  const target = primary?.stats?.range_baseline ?? null;
  const headline = primary ? historyHeadline(primary.history, target) : null;
  const clustering = primary ? clusteringNote(primary.history) : null;
  const withHistory = records.filter((r) => r.history.range.graded >= MIN_SCORED_FOR_RATES);
  // A rolling payload with something actually scored in it. Without this a
  // symbol the backend has no stats for renders a tile of em dashes.
  const calibrated = records.filter(
    (r) => r.stats != null && (r.stats.levels_n_scored > 0 || r.stats.vol_n_scored > 0),
  );
  const totalSessions = records.reduce((n, r) => n + r.history.sessions, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          ZeroGEX · Track Record
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Every forecast, graded</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Before every open we commit each symbol to a projected range, an expected-volatility call
          and touch odds on each gamma level. After the close we grade it against what actually
          happened. Both halves are timestamped and published — the commitment before the market can
          settle it, the receipt after.{' '}
          <strong className="text-[var(--color-text-primary)]">
            We never forecast direction.
          </strong>{' '}
          This page is the whole record, misses included.
        </p>
      </header>

      {headline ? (
        <section className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-lg font-semibold leading-relaxed">{headline}</p>
          {clustering ? (
            <p className="mt-3 flex gap-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--color-warning)' }} aria-hidden />
              <span>{clustering}</span>
            </p>
          ) : null}
        </section>
      ) : (
        <section className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Too few graded sessions to publish a rate yet. Every receipt committed so far is still
            readable under <Link href="/forecast" className="underline">the forecast archive</Link> —
            we would rather show you nothing than a percentage built on a handful of days.
          </p>
        </section>
      )}

      {/* ── The record, per symbol ─────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold tracking-tight">Range coverage, all graded sessions</h2>
        <p className="mb-3 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          The projected range is the one claim with a published target, so it is the one that can be
          scored against something other than itself. The target is a coverage rate, not an accuracy
          score: a band advertised to contain the day {target != null ? fmtRate(target) : '80%'} of
          the time should contain it about that often —{' '}
          <strong className="text-[var(--color-text-primary)]">no more</strong>. Sitting well above
          target means the band is wider than advertised and is carrying less information, which is
          why it is reported as a fault below rather than a win.
        </p>

        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[var(--color-surface)] text-left text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Symbol</th>
                <th className="px-3 py-2 font-semibold">Graded</th>
                <th className="px-3 py-2 font-semibold">Held</th>
                <th className="px-3 py-2 font-semibold">Coverage</th>
                <th className="px-3 py-2 font-semibold">95% interval</th>
                <th className="px-3 py-2 font-semibold">Against target</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const h = r.history.range;
                const t = r.stats?.range_baseline ?? null;
                const thin = h.graded < MIN_SCORED_FOR_RATES;
                const v = thin ? 'unknown' : coverageVerdict(h.rate, t);
                return (
                  <tr key={r.symbol} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-mono font-semibold">{r.symbol}</td>
                    <td className="px-3 py-2 tabular-nums">{h.graded}</td>
                    <td className="px-3 py-2 tabular-nums">{thin ? '—' : h.held}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold">
                      {thin ? '—' : fmtRate(h.rate)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--color-text-secondary)]">
                      {thin ? '—' : fmtCi(h.ci)}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {thin
                        ? `fewer than ${MIN_SCORED_FOR_RATES} graded sessions — no rate published`
                        : t == null
                          ? 'no target published'
                          : `${fmtRate(t)} — ${coverageVerdictText(v)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {totalSessions > 0
            ? `Intervals are 95% Wilson across ${totalSessions} graded sessions in total. They are wide because the samples are small, and a point estimate would hide that.`
            : 'Intervals are 95% Wilson.'}{' '}
          A rate is only published once a symbol has {MIN_SCORED_FOR_RATES} graded sessions; below
          that a rate can only read 0% or 100% and means nothing.
        </p>
      </section>

      {/* ── The misses, by name ────────────────────────────────────────── */}
      {withHistory.length > 0 ? (
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold tracking-tight">The days we missed</h2>
        <p className="mb-3 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Every session where the day traded outside the band we published that morning. They are
          listed because a track record without its failures is advertising, and because each one
          links to the original commitment and its receipt — you can check that we are not
          describing them charitably.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {withHistory.map((r) => (
            <div
              key={r.symbol}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono font-semibold">{r.symbol}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {r.history.range.misses.length} of {r.history.range.graded} sessions
                </span>
              </div>
              {r.history.range.misses.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  No miss on record yet. With {r.history.range.graded} graded sessions that is not
                  evidence of a perfect band — it is evidence of a band wide enough not to have been
                  tested.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {r.history.range.misses.map((d) => (
                    <li key={d}>
                      <Link
                        href={`/forecast/${r.symbol}/${d}`}
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 font-mono text-xs hover:border-[var(--color-accent)]"
                      >
                        <Verdict ok={false} />
                        {humanDate(d)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {r.history.clusters.length > 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {r.history.clustered} of these arrived in{' '}
                  {r.history.clusters.length === 1 ? 'one run' : `${r.history.clusters.length} runs`}{' '}
                  of back-to-back sessions — the band fails on consecutive days, not at random.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {/* ── Calibration, the claims the archive cannot score ───────────── */}
      {calibrated.length > 0 ? (
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold tracking-tight">Calibration of the other two claims</h2>
        <p className="mb-3 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
          The range is scored above, over the whole record. These two cannot be: the touch-odds Brier
          score and the volatility call are computed over a rolling 30-session window, which is the
          only place they exist. Deliberately no range number here —{' '}
          <strong className="text-[var(--color-text-primary)]">
            every claim is reported once, from the deepest sample that can score it
          </strong>
          , and a rolling window flatters a record whose misses are all older than the window.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {calibrated.map((r) => {
            const s = r.stats;
            const bv = brierVerdict(s?.levels_brier_avg);
            const vv = volVerdict(s?.vol_state_correct_rate, s?.vol_baseline);
            return (
              <div
                key={r.symbol}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="font-mono font-semibold">{r.symbol}</div>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-text-secondary)]">
                      Touch-odds Brier
                      <span className="ml-1 text-xs">({s?.levels_n_scored ?? 0})</span>
                    </dt>
                    <dd className="tabular-nums font-medium">
                      {s?.levels_brier_avg != null ? s.levels_brier_avg.toFixed(3) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-text-secondary)]">Vol call</dt>
                    <dd className="tabular-nums font-medium">
                      {s?.vol_state_correct_rate != null ? fmtRate(s.vol_state_correct_rate) : '—'}
                      {s?.vol_baseline != null ? (
                        <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
                          vs {fmtRate(s.vol_baseline)}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
                {s?.levels_brier_avg != null && (s?.levels_n_scored ?? 0) >= MIN_SCORED_FOR_RATES ? (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    Brier {brierVerdictText(bv)} — 0.25 is what you score by guessing the base rate
                    every time, and lower is better.
                  </p>
                ) : null}
                {vv !== 'unknown' && (s?.vol_n_scored ?? 0) >= MIN_SCORED_FOR_RATES ? (
                  <p
                    className="mt-1 text-xs leading-relaxed"
                    style={{
                      color:
                        vv === 'below-baseline'
                          ? 'var(--color-bear)'
                          : 'var(--color-text-secondary)',
                    }}
                  >
                    Vol call {volVerdictText(vv, s?.vol_baseline_label)}.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      ) : null}

      {/* ── What the numbers do not say ────────────────────────────────── */}
      <section className="mb-8 rounded-lg border border-[var(--color-border)] p-5">
        <h2 className="mb-2 text-lg font-bold tracking-tight">What this record does not claim</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <li>
            <strong className="text-[var(--color-text-primary)]">It is not a direction call.</strong>{' '}
            Nothing here predicts whether price goes up or down, and no coverage rate should be read
            as though it did. The range says how far, never which way.
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">
              High coverage is not high accuracy.
            </strong>{' '}
            A band containing the day more often than{' '}
            {target != null ? `${articleForPercent(target)} ${fmtRate(target)}` : 'its'} target is a
            band that is too wide. On the current record ours is — by roughly 20% on the live range
            model, measured by asking how far each day&rsquo;s band could have been narrowed and still
            contained it.
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">
              The intervals are optimistic.
            </strong>{' '}
            Wilson intervals assume independent trials. Our misses cluster on consecutive sessions,
            so the effective sample is smaller than the session count and the true intervals are
            wider than the ones above.
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">
              The sample is short and the model has changed.
            </strong>{' '}
            The range model has been revised twice over this history. Sessions graded under a retired
            version are still counted here — removing them would be grading ourselves only on the
            version that is working.
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">Past grading is not a promise.</strong>{' '}
            Nothing on this page is a prediction about future sessions, and none of it is investment
            advice.
          </li>
        </ul>
      </section>

      <section className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/forecast" className="underline hover:text-[var(--color-accent)]">
          Browse every dated forecast and receipt
        </Link>
        <span className="text-[var(--color-text-secondary)]">·</span>
        <Link href="/methodology" className="underline hover:text-[var(--color-accent)]">
          How the numbers are built
        </Link>
        <span className="text-[var(--color-text-secondary)]">·</span>
        <Link href="/scorecard/today" className="underline hover:text-[var(--color-accent)]">
          Today&rsquo;s scorecard
        </Link>
      </section>

      <p className="text-xs text-[var(--color-text-secondary)]">
        {primary?.history.first && primary?.history.last
          ? `${PRIMARY} record covers ${humanDate(primary.history.first)} through ${humanDate(primary.history.last)}. `
          : ''}
        Rebuilt every 30 minutes from the same graded receipts published under /forecast.
      </p>
    </main>
  );
}
