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
 *
 * Layout: a three-column body (verdict / term ladder / by-strike) rather than
 * the first cut's stacked headline over a half-width grid, which left the
 * right third of the panel empty on any real monitor.
 */

import { useMemo } from 'react';
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
import {
  HeroStat,
  Note,
  PanelHeader,
  PanelMessage,
  Zone,
  type Tone,
} from './RegimeShiftUI';

const VERDICT_TONE: Record<string, Tone> = {
  heavy: 'bear',
  'above average': 'warning',
  typical: 'muted',
  light: 'info',
  'very light': 'info',
};

const HEADER_TOOLTIP =
  "Dealer gamma grouped by expiration. The nearest tranche disappears at its close whether or not anybody trades — the largest scheduled change to the surface, and the one thing a same-day snapshot can't show you. Share is measured on absolute gamma, because all of a tranche leaves even when it nets to zero.";

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
      <div className="zg-panel">
        <PanelHeader title="Expiry Roll-off" tooltip={HEADER_TOOLTIP} />
        <PanelMessage tone="bear" height={160}>
          {`Couldn’t load the expiry roll-off: ${error}`}
        </PanelMessage>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Expiry Roll-off" tooltip={HEADER_TOOLTIP} />
        <PanelMessage height={160}>Loading expirations…</PanelMessage>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="zg-panel">
        <PanelHeader title="Expiry Roll-off" tooltip={HEADER_TOOLTIP} />
        <PanelMessage height={160}>
          No dated option chain for {symbol} in the latest snapshot.
        </PanelMessage>
      </div>
    );
  }

  const verdict = payload.context.verdict;
  const tone: Tone = verdict ? VERDICT_TONE[verdict] ?? 'muted' : 'muted';
  const lastIndex = payload.tranches.length - 1;

  return (
    <div className="zg-panel">
      <PanelHeader
        title="Expiry Roll-off"
        tooltip={HEADER_TOOLTIP}
        right={
          <span className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
            next {shortDate(payload.next.expiration)} · chain{' '}
            {formatGexMagnitude(payload.total_abs_gex)}
          </span>
        }
      />

      <Zone flush>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,1fr)_minmax(260px,1fr)_minmax(280px,1fr)]">
          {/* ── the verdict ─────────────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap items-start gap-4">
              <HeroStat
                eyebrow={`Expiring ${payload.next.dte === 0 ? 'today' : `in ${payload.next.dte}d`}`}
                value={formatPercent(payload.next.share)}
                caption={verdict ?? 'no ranking yet'}
                tone={tone}
              />
            </div>
            <p
              className="mt-3 text-[15px] font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {buildRolloffSentence(payload)}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {buildRolloffConsequence(payload)}
            </p>
            <div
              className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>
                gross{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>
                  {formatGexMagnitude(payload.next.abs_gex)}
                </strong>
              </span>
              <span>
                net{' '}
                <strong style={{ color: payload.next.net_gex >= 0 ? chart.bull : chart.bear }}>
                  {formatSignedGex(payload.next.net_gex)}
                </strong>
              </span>
            </div>
            {payload.context.percentile == null && (
              <div className="mt-3">
                <Note tone="warning">
                  Only {payload.context.sessions_in_window} stored{' '}
                  {payload.context.sessions_in_window === 1 ? 'session' : 'sessions'} so far, so
                  this isn’t ranked against history yet — the share above is still exact.
                </Note>
              </div>
            )}
          </div>

          {/* ── the term ladder ─────────────────────────────────────────── */}
          <div>
            <div className="zg-label mb-3">Gamma by expiration</div>
            <div className="flex flex-col gap-2">
              {payload.tranches.map((t, i) => {
                const isNext = i === 0;
                const folded = payload.tranches_folded && i === lastIndex;
                return (
                  <div key={`${t.expiration}-${i}`} className="flex items-center gap-2.5">
                    <span
                      className="w-[62px] shrink-0 font-mono text-[13px] tabular-nums"
                      style={{
                        color: isNext ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: isNext ? 700 : 400,
                      }}
                    >
                      {folded ? 'later' : shortDate(t.expiration)}
                    </span>
                    <span
                      className="w-[32px] shrink-0 font-mono text-[12px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {folded ? '' : `${t.dte}d`}
                    </span>
                    <div
                      className="relative h-4 flex-1 overflow-hidden rounded"
                      style={{ background: 'var(--bg-subtle)' }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded"
                        style={{
                          width: `${(t.share / maxShare) * 100}%`,
                          // The expiring tranche is the subject of this panel;
                          // everything behind it is context, so it alone gets
                          // the accent and the rest recede.
                          background: isNext ? 'var(--color-warning)' : 'var(--border-strong)',
                          opacity: isNext ? 0.9 : 0.6,
                        }}
                      />
                    </div>
                    <span
                      className="w-[44px] shrink-0 text-right font-mono text-[13px] tabular-nums"
                      style={{
                        color: isNext ? 'var(--color-warning)' : 'var(--text-secondary)',
                        fontWeight: isNext ? 700 : 400,
                      }}
                    >
                      {formatPercent(t.share)}
                    </span>
                  </div>
                );
              })}
            </div>
            {payload.tranches_folded && (
              <div className="mt-2.5">
                <Note>
                  “later” aggregates every expiration beyond the ones listed, so the shares
                  still total 100%.
                </Note>
              </div>
            )}
          </div>

          {/* ── what leaves, by strike ──────────────────────────────────── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="zg-label">What leaves, by strike</span>
              <span className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {shortDate(payload.next.expiration)}
              </span>
            </div>
            {payload.next_by_strike.length === 0 ? (
              <PanelMessage height={120}>No per-strike detail for this expiration.</PanelMessage>
            ) : (
              <div className="flex flex-col gap-1">
                {payload.next_by_strike.map((row) => {
                  const positive = row.net_gex >= 0;
                  const width = Math.min(50, (Math.abs(row.net_gex) / maxStrikeAbs) * 50);
                  const atSpot =
                    payload.spot != null && Math.abs(row.strike - payload.spot) < 0.5;
                  return (
                    <div key={row.strike} className="flex items-center gap-2">
                      <span
                        className="w-[48px] shrink-0 text-right font-mono text-[13px] tabular-nums"
                        style={{
                          color: atSpot ? 'var(--color-warning)' : 'var(--text-secondary)',
                          fontWeight: atSpot ? 700 : 400,
                        }}
                      >
                        {formatStrike(row.strike)}
                      </span>
                      <div className="relative h-3.5 flex-1">
                        {/* The zero line the diverging bars hang off — without a
                            visible axis a "left of centre" encoding has no centre. */}
                        <div
                          className="absolute -top-px h-[calc(100%+2px)]"
                          style={{ left: '50%', width: 1, background: 'var(--text-muted)', opacity: 0.5 }}
                        />
                        <div
                          className="absolute top-1/2 h-[9px] -translate-y-1/2 rounded-[2px]"
                          style={{
                            background: positive ? chart.bull : chart.bear,
                            ...(positive
                              ? { left: '50%', width: `${width}%` }
                              : { right: '50%', width: `${width}%` }),
                          }}
                        />
                      </div>
                      <span
                        className="w-[62px] shrink-0 text-right font-mono text-[12px] tabular-nums"
                        style={{ color: positive ? chart.bull : chart.bear }}
                      >
                        {formatSignedGex(row.net_gex)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-2.5">
              <Note>
                <span style={{ color: chart.bull }}>▶</span> right of centre = long gamma
                leaving · <span style={{ color: chart.bear }}>◀</span> left = short gamma
                leaving
              </Note>
            </div>
          </div>
        </div>
      </Zone>
    </div>
  );
}
