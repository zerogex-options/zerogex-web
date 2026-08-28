'use client';

/**
 * The Signals Engine's Trade Bias, compressed to a board widget.
 *
 * This is the SAME read the /trade-bias page shows — one signed directional
 * call from the engine, for a chosen horizon — not the browser-computed
 * composite in components/TradeBiasSection. The two are different calculations
 * and are allowed to disagree, which is exactly why a same-day trader could not
 * previously put the bias they actually trade on their board: the only Trade
 * Bias widget was the other one, and it has no horizon at all.
 *
 * The horizon comes from the shared store (hooks/useBiasTenor), so switching it
 * here switches it on the page too, and two copies of this widget on one board
 * can never show two different answers for the same symbol.
 *
 * Deliberately a summary, not a second Trade Bias page: the bias, how strongly,
 * how confident, and the regime it came from. The playbook, checklist, tactical
 * pillars and history chart stay on the page, one click away via the widget's
 * header link.
 */

import { AlertTriangle, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { humanize, trendColor } from '@/core/signalHelpers';
import { BIAS_TENOR_OPTIONS } from '@/core/tradeBiasTenor';
import { useBiasTenor } from '@/hooks/useBiasTenor';
import { useTimeframe } from '@/core/TimeframeContext';
import BiasTape from './BiasTape';
import { useTradeBiasData } from './useTradeBiasData';

function HorizonToggle() {
  const { tenor, setTenor } = useBiasTenor();
  return (
    <div
      className="inline-flex rounded-md border overflow-hidden"
      style={{ borderColor: 'var(--color-border)' }}
      role="group"
      aria-label="Bias horizon"
    >
      {BIAS_TENOR_OPTIONS.map((option) => {
        const active = tenor === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTenor(option.value)}
            aria-pressed={active}
            className="px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={{
              background: active ? 'var(--color-info-soft)' : 'transparent',
              color: active ? 'var(--color-info)' : 'var(--color-text-secondary)',
            }}
          >
            {/* The full "Swing · Multi-day" labels don't fit a small widget;
                the horizon itself is the part that has to be unambiguous. */}
            {option.value === 'intraday' ? '0DTE' : 'Swing'}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] shrink-0">
        {label}
      </span>
      <span className="text-xs font-semibold truncate" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

export default function BiasHorizonCard() {
  const { symbol } = useTimeframe();
  const { tenor } = useBiasTenor();
  // withHistory=false: this card renders only the current payload, and the
  // history request is 2000 rows across 8 days on every mount and toggle.
  const { payload, connection, loading, noData } = useTradeBiasData(symbol, tenor, false);

  const isIntraday = tenor === 'intraday';
  const trend = payload?.direction ?? 'neutral';
  const color = trendColor(trend);
  const BiasIcon = trend === 'bullish' ? TrendingUp : trend === 'bearish' ? TrendingDown : AlertTriangle;
  const confidence = payload?.confidence ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <HorizonToggle />
        {connection === 'disconnected' && (
          // Said plainly rather than hidden: a stale directional call that
          // looks live is worse than an obviously stale one.
          <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-warning)' }}>
            Reconnecting
          </span>
        )}
      </div>

      {loading && payload == null && !noData ? (
        <div className="animate-pulse h-28 rounded-lg" style={{ background: 'var(--color-surface-subtle)' }} />
      ) : noData ? (
        <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-xs font-semibold">
            No {isIntraday ? 'same-day (0DTE)' : 'multi-day'} bias for {symbol} yet
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            The engine has no rows for this horizon. Check back during market hours.
          </div>
        </div>
      ) : payload ? (
        <div
          className="flex flex-col gap-3"
          style={{ opacity: connection === 'disconnected' ? 0.6 : 1, transition: 'opacity 200ms' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={{ borderColor: color, color }}
            >
              <BiasIcon size={13} />
              {payload.biasLabel}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-2xl font-black leading-none"
                style={{ color, fontVariantNumeric: 'tabular-nums' }}
              >
                {payload.biasScore == null
                  ? '—'
                  : `${payload.biasScore >= 0 ? '+' : ''}${payload.biasScore.toFixed(1)}`}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                / 100
              </span>
            </div>
          </div>

          <BiasTape biasScore={payload.biasScore} />

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              Conf
            </span>
            <span className="text-xs font-semibold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {confidence == null ? '—' : Math.round(confidence)}
            </span>
            <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${confidence ?? 0}%`, background: color }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Stat label="Dir" value={humanize(payload.directionRaw) || 'Neutral'} color={color} />
            <Stat label="Gamma" value={payload.gammaRegime ?? '—'} />
            <Stat label="Vol" value={payload.volatilityRegime ?? '—'} />
          </div>

          {payload.overrideActive && (
            <div
              className="rounded-md border-l-4 px-3 py-2"
              style={{ borderLeftColor: 'var(--color-info)', background: 'var(--color-info-soft)' }}
            >
              <div
                className="text-[11px] font-semibold flex items-center gap-1.5"
                style={{ color: 'var(--color-info)' }}
              >
                <Zap size={12} /> Override active
              </div>
              <p className="text-[11px] text-[var(--color-text-primary)] mt-0.5">
                {payload.overrideReason ?? 'The live read overruled the structural posture.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        // Reachable: one failed poll clears `loading` while `connection` only
        // flips to disconnected after two. Without this the card would render a
        // bare horizon toggle over empty space and say nothing about why.
        <div className="rounded-lg border p-4 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-xs font-semibold">Bias unavailable</div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            Couldn’t reach the signals engine. Retrying automatically.
          </div>
        </div>
      )}
    </div>
  );
}
