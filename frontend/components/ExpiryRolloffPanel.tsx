'use client';

/**
 * ExpiryRolloffPanel — how much dealer gamma stops existing at the next expiry.
 *
 * Every other GEX surface on the site shows the book as it is now. This one
 * shows the largest *scheduled* change to it: at the nearest expiration's
 * close, that tranche of gamma is gone whether or not anybody trades. A
 * trader who knows 38% of the book expires tonight reads tomorrow's map
 * differently — and, on a day-over-day comparison, it is the reason the
 * Gamma Shift card above excludes the expired tranche instead of booking it
 * as a shed.
 *
 * Three things the panel is careful about:
 *
 * * **Share is measured on ABSOLUTE gamma.** A tranche that nets to zero
 *   because a call wall offsets a put wall is still a big tranche — all of it
 *   leaves, and the offset does not survive the expiry.
 * * **The net sign is shown separately**, because it decides the
 *   consequence: a net-long tranche leaving means the stabilizing side goes
 *   (looser tape after); a net-short one leaving means the accelerant goes.
 *   Same share, opposite meaning.
 * * **"Is that a lot?" is a percentile, not a dollar figure.** $4.5B means
 *   nothing in isolation. "Heavier than 94% of this symbol's sessions" means
 *   something — and the panel withholds the ranking rather than guessing when
 *   there is not yet enough stored history.
 */

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  buildRolloffConsequence,
  buildRolloffSentence,
  formatGexMagnitude,
  formatPercent,
  formatSignedGex,
  formatStrike,
  type ExpiryRolloffPayload,
} from '@/core/regimeShift';
import ChartCaption from './ChartCaption';
import TooltipWrapper from './TooltipWrapper';

const VERDICT_TONE: Record<string, string> = {
  heavy: 'var(--color-bear)',
  'above average': 'var(--color-warning)',
  typical: 'var(--text-secondary)',
  light: 'var(--color-info)',
  'very light': 'var(--color-info)',
};

function shortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

export default function ExpiryRolloffPanel({
  payload,
  loading,
  error,
  symbol,
}: {
  payload: ExpiryRolloffPayload | null;
  loading: boolean;
  error: string | null;
  symbol: string;
}) {
  const chart = useChartTheme();

  const heading = (
    <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
      <h3 className="zg-h3" style={{ color: 'var(--text-primary)' }}>
        Expiry Roll-off
      </h3>
      <TooltipWrapper text="Dealer gamma grouped by expiration. The nearest tranche disappears at its close whether or not anybody trades — the largest scheduled change to the surface, and the one thing a same-day snapshot can't show you. Share is measured on absolute gamma, because all of a tranche leaves even when it nets to zero.">
        <Info size={14} />
      </TooltipWrapper>
      <span
        className="rounded px-1.5 py-0.5 font-mono text-xs font-semibold"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}
      >
        {symbol}
      </span>
    </div>
  );

  const maxShare = useMemo(
    () => Math.max(0.0001, ...(payload?.tranches ?? []).map((t) => t.share)),
    [payload],
  );
  const maxStrikeAbs = useMemo(
    () => Math.max(1, ...(payload?.next_by_strike ?? []).map((s) => Math.abs(s.net_gex))),
    [payload],
  );

  if (error) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[180px] items-center justify-center px-6 text-center text-sm" style={{ color: 'var(--color-bear)' }}>
          {`Couldn’t load the expiry roll-off: ${error}`}
        </div>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[180px] items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading expirations…
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="zg-panel p-5">
        {heading}
        <div className="flex h-[180px] items-center justify-center px-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          No dated option chain for {symbol} in the latest snapshot.
        </div>
      </div>
    );
  }

  const verdict = payload.context.verdict;
  const verdictColor = verdict ? VERDICT_TONE[verdict] ?? 'var(--text-secondary)' : 'var(--text-muted)';
  const lastIndex = payload.tranches.length - 1;

  return (
    <div className="zg-panel p-5">
      {heading}

      {/* headline */}
      <div className="mt-5 flex flex-wrap items-start gap-5">
        <div
          className="min-w-[150px] rounded-xl px-4 py-3"
          style={{
            background: 'var(--bg-subtle)',
            border: `1px solid ${verdictColor}`,
            color: verdictColor,
          }}
        >
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
            Expiring {payload.next.dte === 0 ? 'today' : `in ${payload.next.dte}d`}
          </span>
          <span className="mt-0.5 block text-[28px] font-bold leading-tight tabular-nums">
            {formatPercent(payload.next.share)}
          </span>
          <span className="mt-1 block font-mono text-[11px] opacity-90">
            {verdict ?? 'no ranking yet'}
          </span>
        </div>

        <div className="min-w-[280px] flex-1">
          <p className="text-lg font-bold leading-snug md:text-xl" style={{ color: 'var(--text-primary)' }}>
            {buildRolloffSentence(payload)}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {buildRolloffConsequence(payload)}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span>
              expiring <strong style={{ color: 'var(--text-secondary)' }}>{formatGexMagnitude(payload.next.abs_gex)}</strong> gross
            </span>
            <span>
              net{' '}
              <strong style={{ color: payload.next.net_gex >= 0 ? chart.bull : chart.bear }}>
                {formatSignedGex(payload.next.net_gex)}
              </strong>
            </span>
            <span>
              chain <strong style={{ color: 'var(--text-secondary)' }}>{formatGexMagnitude(payload.total_abs_gex)}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* term ladder */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
          <p className="mb-2.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>
            Gamma by expiration
          </p>
          <div className="flex flex-col gap-1.5">
            {payload.tranches.map((t, i) => {
              const isNext = i === 0;
              const folded = payload.tranches_folded && i === lastIndex;
              return (
                <div key={`${t.expiration}-${i}`} className="flex items-center gap-2.5">
                  <span
                    className="w-[70px] shrink-0 font-mono text-[11px] tabular-nums"
                    style={{ color: isNext ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isNext ? 700 : 400 }}
                  >
                    {folded ? 'later' : shortDate(t.expiration)}
                  </span>
                  <span className="w-[34px] shrink-0 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {folded ? '' : `${t.dte}d`}
                  </span>
                  <div className="relative h-3.5 flex-1 overflow-hidden rounded" style={{ background: 'var(--bg-card)' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded"
                      style={{
                        width: `${(t.share / maxShare) * 100}%`,
                        // The expiring tranche is the subject of this panel;
                        // everything behind it is context, so it alone gets
                        // the accent and the rest recede.
                        background: isNext ? 'var(--color-warning)' : 'var(--border-strong)',
                        opacity: isNext ? 0.9 : 0.55,
                      }}
                    />
                  </div>
                  <span
                    className="w-[42px] shrink-0 text-right font-mono text-[11px] tabular-nums"
                    style={{ color: isNext ? 'var(--color-warning)' : 'var(--text-muted)', fontWeight: isNext ? 700 : 400 }}
                  >
                    {formatPercent(t.share)}
                  </span>
                </div>
              );
            })}
          </div>
          {payload.tranches_folded && (
            <p className="mt-2 text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
              “later” aggregates every expiration beyond the ones listed, so the shares still total 100%.
            </p>
          )}
        </div>

        {/* by strike */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
          <p className="mb-2.5 flex items-center justify-between gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>
            <span>What leaves, by strike</span>
            <span style={{ textTransform: 'none', letterSpacing: '0.03em' }}>{shortDate(payload.next.expiration)}</span>
          </p>
          {payload.next_by_strike.length === 0 ? (
            <p className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No per-strike detail for this expiration.
            </p>
          ) : (
            <div className="flex flex-col gap-[3px]">
              {payload.next_by_strike.map((row) => {
                const positive = row.net_gex >= 0;
                const width = Math.min(50, (Math.abs(row.net_gex) / maxStrikeAbs) * 50);
                const atSpot =
                  payload.spot != null && Math.abs(row.strike - payload.spot) < 0.5;
                return (
                  <div key={row.strike} className="flex items-center gap-2">
                    <span
                      className="w-[52px] shrink-0 text-right font-mono text-[11px] tabular-nums"
                      style={{
                        color: atSpot ? 'var(--color-warning)' : 'var(--text-secondary)',
                        fontWeight: atSpot ? 700 : 400,
                      }}
                    >
                      {formatStrike(row.strike)}
                    </span>
                    <div className="relative h-3 flex-1">
                      {/* The zero line the diverging bars hang off — without a
                          visible axis a "left of centre" encoding has no centre. */}
                      <div
                        className="absolute -top-[1px] h-[calc(100%+2px)]"
                        style={{ left: '50%', width: 1, background: 'var(--text-muted)', opacity: 0.55 }}
                      />
                      <div
                        className="absolute top-1/2 h-[8px] -translate-y-1/2 rounded-[2px]"
                        style={{
                          background: positive ? chart.bull : chart.bear,
                          ...(positive
                            ? { left: '50%', width: `${width}%` }
                            : { right: '50%', width: `${width}%` }),
                        }}
                      />
                    </div>
                    <span
                      className="w-[64px] shrink-0 text-right font-mono text-[10.5px] tabular-nums"
                      style={{ color: positive ? chart.bull : chart.bear }}
                    >
                      {formatSignedGex(row.net_gex)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2 font-mono text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
            Right of centre = long gamma leaving <span style={{ color: chart.bull }}>▶</span> · left = short gamma leaving{' '}
            <span style={{ color: chart.bear }}>◀</span>
          </p>
        </div>
      </div>

      {payload.context.percentile == null && (
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          Only {payload.context.sessions_in_window} stored{' '}
          {payload.context.sessions_in_window === 1 ? 'session' : 'sessions'} so far, so
          this isn’t ranked against history yet — the share above is still exact.
        </p>
      )}

      <ChartCaption />
    </div>
  );
}
