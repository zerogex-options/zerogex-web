'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getMarketSession } from '@/core/utils';

export type CompositeSymbol = 'SPY' | 'QQQ' | 'IWM';
export const COMPOSITE_SYMBOLS: CompositeSymbol[] = ['SPY', 'QQQ', 'IWM'];

export type ConnectionState = 'idle' | 'live' | 'stale' | 'disconnected';

interface Props {
  symbol: CompositeSymbol;
  onSymbolChange: (s: CompositeSymbol) => void;
  connection: ConnectionState;
  lastUpdatedAt: number | null;
  intervalMs: number;
}

const SESSION_LABEL: Record<string, string> = {
  open: 'Market Open',
  'pre-market': 'Pre-market',
  'after-hours': 'After-hours',
  closed: 'Closed',
  'closed-weekend': 'Closed',
  'closed-holiday': 'Closed',
  halted: 'Halted',
};

export default function CompositeHeaderBar({ symbol, onSymbolChange, connection, lastUpdatedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setSession(getMarketSession());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const ageSec = lastUpdatedAt != null ? Math.max(0, Math.floor((now - lastUpdatedAt) / 1000)) : null;

  let dotColor = '#6B7280';
  let statusText = 'Connecting…';
  let statusGlyph: '●' | '◐' | '○' = '○';
  if (connection === 'disconnected') {
    dotColor = '#DC2626';
    statusText = 'Disconnected — retrying';
    statusGlyph = '○';
  } else if (connection === 'stale') {
    dotColor = '#D97706';
    statusText = ageSec != null ? `Stale • ${ageSec}s ago` : 'Stale';
    statusGlyph = '◐';
  } else if (connection === 'live') {
    dotColor = '#16A34A';
    statusText = ageSec != null ? `LIVE • updated ${ageSec}s ago` : 'LIVE';
    statusGlyph = '●';
  }

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        <span className="uppercase tracking-[0.18em]">Underlying</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="relative inline-flex items-center">
          <span className="sr-only">Underlying symbol</span>
          <select
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value as CompositeSymbol)}
            className="appearance-none rounded-md border bg-transparent pr-8 pl-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            aria-label="Select underlying symbol"
          >
            {COMPOSITE_SYMBOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
        </label>

        <div className="flex items-center gap-2 text-xs">
          <span aria-hidden style={{ color: dotColor, fontSize: 14 }}>{statusGlyph}</span>
          <span
            className="font-mono"
            style={{ color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}
            aria-label={statusText}
          >
            {statusText}
          </span>
          <span className="hidden md:inline text-[var(--color-text-secondary)] opacity-60">·</span>
          <span className="hidden md:inline text-xs text-[var(--color-text-secondary)]">
            {SESSION_LABEL[session] ?? 'Market'}
          </span>
        </div>
      </div>
    </header>
  );
}
