'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, type LucideIcon } from 'lucide-react';
import SignalSparkline from './SignalSparkline';
import {
  asObject,
  getNumber,
  parseScoreHistory,
  scoreTrend,
  trendColor,
  type SignalTrend,
} from '@/core/signalHelpers';

export interface AdvancedSignalContextRow {
  label: string;
  value: string;
  hint?: string;
  tone?: SignalTrend;
}

interface AdvancedSignalCardProps {
  title: string;
  href: string;
  icon: LucideIcon;
  snapshot: unknown;
  triggerThreshold?: number;
  signalLabel?: string;
  inactiveLabel?: string | null;
  contextRows: AdvancedSignalContextRow[];
  description?: string;
  loading?: boolean;
  error?: string | null;
}

export default function AdvancedSignalCard({
  title,
  href,
  icon: Icon,
  snapshot,
  triggerThreshold = 25,
  signalLabel,
  inactiveLabel,
  contextRows,
  description,
  loading,
  error,
}: AdvancedSignalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const payload = useMemo(() => asObject(snapshot) ?? {}, [snapshot]);
  const score = getNumber(payload.score);
  const directionRaw = String(payload.direction ?? 'neutral').toLowerCase();
  const signalStr = String(payload.signal ?? signalLabel ?? '—');
  const triggered = payload.triggered === true || (score != null && Math.abs(score) >= triggerThreshold);
  const trend: SignalTrend = score != null && Math.abs(score) >= triggerThreshold
    ? scoreTrend(score, triggerThreshold)
    : (directionRaw === 'bullish' ? 'bullish' : directionRaw === 'bearish' ? 'bearish' : 'neutral');

  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const color = trendColor(trend);
  const showSignalPill = signalStr && signalStr !== '—' && signalStr !== 'none';
  const effectiveTriggered = inactiveLabel ? false : triggered;

  const cardBg = effectiveTriggered
    ? trend === 'bullish'
      ? 'var(--color-bull-soft)'
      : trend === 'bearish'
        ? 'var(--color-bear-soft)'
        : 'var(--color-surface-subtle)'
    : 'var(--color-surface-subtle)';

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3 transition-colors"
      style={{
        borderColor: effectiveTriggered ? color : 'var(--color-border)',
        background: cardBg,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <Icon size={15} />
          </span>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            {inactiveLabel ? (
              <div className="text-[11px] text-[var(--color-text-secondary)]">{inactiveLabel}</div>
            ) : showSignalPill ? (
              <div
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mt-0.5"
                style={{ background: `${color}1f`, color }}
              >
                {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                {signalStr.replace(/_/g, ' ')}
              </div>
            ) : null}
          </div>
        </div>
        <Link
          href={href}
          className="text-[11px] inline-flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Open <ExternalLink size={12} />
        </Link>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-4xl font-black leading-none" style={{ color }}>
            {loading && !payload.score ? '…' : score != null ? score.toFixed(1) : '—'}
          </div>
          <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
            Score −100 to +100
          </div>
        </div>
        <div className="flex-1 max-w-[55%]">
          <SignalSparkline points={history} strokeColor={color} fillColor={`${color}1a`} />
        </div>
      </div>

      {description && (
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
      )}

      {error && (
        <div className="text-[11px] text-[var(--color-bear)]">Failed to load: {error}</div>
      )}

      {contextRows.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-auto inline-flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <span>Context values</span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {expanded && (
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {contextRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-[var(--color-border)]/40 pb-1"
                >
                  <span className="text-[var(--color-text-secondary)]" title={row.hint}>{row.label}</span>
                  <span
                    className="font-mono"
                    style={{ color: row.tone ? trendColor(row.tone) : 'var(--color-text-primary)' }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
