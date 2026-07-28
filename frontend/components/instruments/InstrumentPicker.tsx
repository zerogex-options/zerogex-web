'use client';

// Registry-driven instrument picker, grouped by asset class (Indexes & ETFs vs
// Futures). Derives entirely from the centralized registry + runtime
// availability — no duplicated symbol array. Unavailable futures are shown but
// clearly marked "Coming soon" and disabled, so a user never navigates a
// disabled future into a broken page (spec Phase 11).

import {
  EQUITY_SYMBOLS,
  FUTURES_SYMBOLS,
  getAvailability,
  getInstrument,
  type InstrumentSymbol,
} from '@/core/instruments/registry';

interface Props {
  current: InstrumentSymbol;
  onSelect: (symbol: InstrumentSymbol) => void;
  /** Hide (rather than "Coming soon"-disable) unavailable futures. */
  hideUnavailableFutures?: boolean;
}

function Chip({
  symbol,
  active,
  disabled,
  comingSoon,
  reason,
  onClick,
}: {
  symbol: string;
  active: boolean;
  disabled: boolean;
  comingSoon: boolean;
  reason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={comingSoon ? reason || 'Coming soon' : symbol}
      className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: active ? 'var(--color-warning-soft)' : 'transparent',
        border: `1px solid ${active ? 'var(--color-warning)' : 'var(--color-border)'}`,
        color: active ? 'var(--color-warning)' : 'var(--color-text-secondary)',
      }}
    >
      {symbol}
      {comingSoon ? (
        <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.7 }}>SOON</span>
      ) : null}
    </button>
  );
}

export default function InstrumentPicker({
  current,
  onSelect,
  hideUnavailableFutures = false,
}: Props) {
  const futures = FUTURES_SYMBOLS.filter(
    (s) => !hideUnavailableFutures || getAvailability(s).available,
  );

  return (
    <div className="flex flex-col gap-2" aria-label="Instrument">
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>
          Indexes &amp; ETFs
        </span>
        {EQUITY_SYMBOLS.map((s) => (
          <Chip
            key={s}
            symbol={s}
            active={s === current}
            disabled={false}
            comingSoon={false}
            onClick={() => onSelect(s)}
          />
        ))}
      </div>
      {futures.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>Futures</span>
          {futures.map((s) => {
            const avail = getAvailability(s);
            const inst = getInstrument(s)!;
            return (
              <Chip
                key={s}
                symbol={s}
                active={s === current}
                disabled={!avail.available}
                comingSoon={!avail.available}
                reason={
                  avail.reasons[0] ??
                  `${inst.name} — CME futures analytics not yet enabled`
                }
                onClick={() => avail.available && onSelect(s)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
