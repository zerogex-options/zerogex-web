'use client';

import { Info } from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import { ComponentEntry, GammaAnchorContext, getComponentLabel } from './data';

interface Props {
  entry: ComponentEntry;
}

const POSITIVE = '#16A34A';
const NEGATIVE = '#DC2626';
const NEUTRAL = '#6B7280';

function colorFor(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return NEUTRAL;
  if (Math.abs(score) < 0.05) return NEUTRAL;
  return score >= 0 ? POSITIVE : NEGATIVE;
}

function ScoreBar({ score }: { score: number | null }) {
  const safe = score != null && Number.isFinite(score) ? Math.max(-1, Math.min(1, score)) : null;
  const color = colorFor(score);
  const width = safe != null ? (Math.abs(safe) * 50) : 0;
  const left = safe != null && safe < 0 ? 50 - width : 50;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--color-border)' }}>
      <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: 'var(--color-text-primary)', opacity: 0.4 }} aria-hidden />
      {safe != null && (
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: color,
            transition: 'left 250ms ease-out, width 250ms ease-out',
          }}
        />
      )}
    </div>
  );
}

export default function ComponentCard({ entry }: Props) {
  const label = getComponentLabel(entry.key);
  const isGammaAnchor = entry.key === 'gamma_anchor';
  const score = entry.score;
  const contribution = entry.contribution ?? 0;
  const color = colorFor(score);
  const weightPct = entry.maxPoints > 0
    ? Math.min(100, Math.round((Math.abs(contribution) / entry.maxPoints) * 100))
    : 0;
  const glyph = score == null || !Number.isFinite(score)
    ? '●'
    : Math.abs(score) < 0.05
      ? '●'
      : score > 0 ? '▲' : '▼';

  const minHeight = isGammaAnchor ? 460 : 220;

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface-elevated)',
        minHeight,
      }}
      aria-label={`${label.title}. Score ${score?.toFixed(3) ?? 'unavailable'}, contribution ${contribution >= 0 ? '+' : ''}${contribution.toFixed(2)} of ${entry.maxPoints}.`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
            {label.title}
            <TooltipWrapper
              text={`+: ${label.positive}\n−: ${label.negative}`}
              placement="bottom"
            >
              <Info size={12} className="text-[var(--color-text-secondary)] cursor-help" />
            </TooltipWrapper>
          </h3>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">{label.description}</p>
        </div>
        <span
          aria-hidden
          className="font-bold text-base"
          style={{ color }}
        >
          {glyph}
        </span>
      </div>

      <ScoreBar score={score} />

      <div className="flex items-baseline justify-between gap-3 text-xs font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">score</div>
          <div className="text-base font-semibold" style={{ color }}>
            {score != null ? score.toFixed(3) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">contrib</div>
          <div className="text-base font-semibold" style={{ color }}>
            {entry.contribution != null ? `${contribution >= 0 ? '+' : ''}${contribution.toFixed(2)}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">max pts</div>
          <div className="text-base font-semibold">{entry.maxPoints}</div>
        </div>
      </div>

      <div
        className="self-start text-[11px] font-mono px-2 py-0.5 rounded-full border"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-surface-subtle)',
          fontVariantNumeric: 'tabular-nums',
        }}
        title={`Used ${weightPct}% of available ${entry.maxPoints} weight pts`}
      >
        {weightPct}% of weight
      </div>

      {isGammaAnchor && (
        <GammaAnchorBreakdown context={entry.context ?? null} />
      )}
    </div>
  );
}

function GammaAnchorBreakdown({ context }: { context: GammaAnchorContext | null }) {
  if (!context) {
    return (
      <div
        className="mt-auto rounded-md border px-3 py-2 text-[12px] text-[var(--color-text-secondary)]"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
      >
        Sub-signal detail unavailable for this tick.
      </div>
    );
  }
  const rows: Array<{ label: string; value: number | null; weight: number }> = [
    { label: 'Flip distance', value: context.flipDistance, weight: context.weights.flipDistance },
    { label: 'Local gamma density', value: context.localGamma, weight: context.weights.localGamma },
    { label: 'Price vs max-gamma', value: context.priceVsMaxGamma, weight: context.weights.priceVsMaxGamma },
  ];
  return (
    <div className="mt-auto pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
          Sub-signal breakdown
        </div>
        <TooltipWrapper
          text="Three internal sub-signals are blended into the gamma_anchor score using the weights shown."
          placement="bottom"
        >
          <Info size={11} className="text-[var(--color-text-secondary)] cursor-help" />
        </TooltipWrapper>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[110px_minmax(0,1fr)_72px] items-center gap-3 text-[12px]">
            <div className="text-[var(--color-text-secondary)] truncate">{r.label}</div>
            <ScoreBar score={r.value} />
            <div className="font-mono text-right" style={{ fontVariantNumeric: 'tabular-nums', color: colorFor(r.value) }}>
              {r.value != null ? r.value.toFixed(3) : '—'} <span className="text-[var(--color-text-secondary)]">×{r.weight.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
