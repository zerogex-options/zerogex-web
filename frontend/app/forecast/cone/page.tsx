'use client';

/**
 * /forecast/cone — the intraday re-anchored cone and its track record.
 *
 * Deliberately one page with two halves, in this order: the claim, then the
 * receipt. The cone is the part that looks impressive and the reliability
 * table is the part that makes it worth anything, and putting the table below
 * the chart rather than on a separate page means nobody can read the
 * percentage without the scoreboard being one scroll away.
 *
 * Sits alongside /forecast, which is the once-a-day version of the same
 * discipline: commit in public, grade in public, publish the row we fail.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';

import ConeReliabilityPanel from '@/components/ConeReliabilityPanel';
import IntradayConeChart from '@/components/IntradayConeChart';
import { useConeFires } from '@/hooks/useIntradayCone';
import { CONE_SYMBOLS, type ConeSymbol } from '@/core/coneChart';

/** Today in ET, which is the session the cone writer is firing against. */
function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const WINDOWS = [5, 10, 30] as const;

// The page's own chrome is server-rendered, so it takes its colors from the
// CSS variables rather than useChartTheme(): that hook is '' on the server and
// the resolved value on the client's first render, a hydration mismatch React
// leaves unpatched — the active symbol and window chips lost their highlight.
// These are the same variables the hook reads, so the colors are unchanged.
const theme = {
  text: 'var(--text-primary)',
  textDim: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  accent: 'var(--color-accent)',
  accentSoft: 'var(--color-accent-soft)',
  border: 'var(--border-default)',
} as const;

export default function ConePage() {
  const [symbol, setSymbol] = useState<ConeSymbol>('SPY');
  const [window, setWindow] = useState<number>(30);
  const sessionDate = useMemo(() => todayET(), []);

  const { data, loading, error } = useConeFires(symbol, sessionDate);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-wide" style={{ color: theme.textMuted }}>
          Exposure forecast · intraday
        </div>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight" style={{ color: theme.text }}>
          The re-anchored cone
        </h1>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed" style={{ color: theme.textDim }}>
          Every fifteen minutes we re-anchor on the current bar, re-read the
          dealer surface, and commit a band and a probability for each horizon
          that can still finish before the bell. Then we grade every one of
          them and publish what came back&nbsp;- including the horizons we get
          wrong. The daily version of the same commitment lives on{' '}
          <Link
            href="/forecast"
            className="underline underline-offset-2"
            style={{ color: theme.accent }}
          >
            /forecast
          </Link>
          .
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {CONE_SYMBOLS.map((s) => {
            const active = s === symbol;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                className="rounded-sm px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:py-1"
                style={{
                  background: active ? theme.accentSoft : 'transparent',
                  color: active ? theme.accent : theme.textDim,
                  border: `1px solid ${active ? theme.accent : theme.border}`,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <section className="mb-6">
        {loading && !data ? (
          <div
            className="zg-panel p-5 text-[13px]"
            style={{ color: theme.textMuted }}
          >
            Loading today&apos;s cones…
          </div>
        ) : error ? (
          <div className="zg-panel p-5 text-[13px]" style={{ color: theme.textMuted }}>
            Today&apos;s cones are unavailable right now.
          </div>
        ) : (
          <IntradayConeChart payload={data ?? null} />
        )}
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Its own line on a phone, so the three chips share one row rather
            than wrapping two-and-one beside the label. */}
        <span className="text-[10px] uppercase tracking-wide max-sm:basis-full" style={{ color: theme.textMuted }}>
          Track record window
        </span>
        {WINDOWS.map((w) => {
          const active = w === window;
          return (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className="rounded-sm px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:py-1"
              style={{
                background: active ? theme.accentSoft : 'transparent',
                color: active ? theme.accent : theme.textDim,
                border: `1px solid ${active ? theme.accent : theme.border}`,
              }}
            >
              {w} sessions
            </button>
          );
        })}
      </div>

      <section>
        <ConeReliabilityPanel symbol={symbol} window={window} />
      </section>

      <p className="mt-6 max-w-[72ch] text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
        Not a buy or sell signal. The cone makes no directional call&nbsp;- it is a
        claim about containment, and it is graded on magnitude only.
      </p>
    </main>
  );
}
