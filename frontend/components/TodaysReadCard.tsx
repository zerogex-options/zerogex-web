import Link from 'next/link';
import { AlertCircle, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReportModel, RegimeKey } from '@/app/live-bulletin/bulletinHelpers';

type Props = {
  model: ReportModel;
  /** Optional Tailwind className appended to the outer card wrapper. */
  className?: string;
  /**
   * When true, the entire card becomes a link to /live-bulletin (the paid full-bulletin
   * surface). Off by default; turn it on for in-app uses where the visitor is already
   * authenticated (the dashboard).
   */
  bulletinLink?: boolean;
};

const REGIME_TONE: Record<RegimeKey, {
  color: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}> = {
  positive: {
    color: 'var(--color-positive)',
    icon: TrendingUp,
    label: 'Long-gamma regime',
  },
  negative: {
    color: 'var(--color-negative)',
    icon: TrendingDown,
    label: 'Short-gamma regime',
  },
  neutral: {
    color: 'var(--color-warning)',
    icon: Minus,
    label: 'At the gamma flip',
  },
  unresolved: {
    color: 'var(--color-text-secondary)',
    icon: AlertCircle,
    label: 'Regime unresolved',
  },
};

export default function TodaysReadCard({ model, className, bulletinLink = false }: Props) {
  const tone = REGIME_TONE[model.regime];
  const Icon = tone.icon;

  const baseClass = `relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--bg-card)] p-5 shadow-[0_12px_40px_var(--color-info-soft)] md:p-7 ${className ?? ''}`;
  const linkedClass = `${baseClass} block cursor-pointer transition-colors hover:border-[var(--color-brand-primary)]`;

  const inner = (
    <>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: 'linear-gradient(180deg, var(--color-brand-primary) 0%, var(--heat-mid) 100%)' }}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-warning)]"
          >
            Today&apos;s Read · {model.symbol}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor: `${tone.color}55`,
              background: `${tone.color}14`,
              color: tone.color,
            }}
          >
            <Icon size={11} />
            {tone.label}
          </span>
        </div>
        {bulletinLink && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
            Full bulletin →
          </span>
        )}
      </div>

      <h2 className="mb-3 text-xl font-bold leading-tight text-[var(--color-text-primary)] md:text-2xl">
        {model.headline}
      </h2>

      <p className="text-[14px] leading-7 text-[var(--color-text-secondary)] md:text-[15px]">
        {model.lead}
      </p>
    </>
  );

  if (bulletinLink) {
    return (
      <Link href="/live-bulletin" className={linkedClass} style={{ color: 'inherit', textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }

  return <section className={baseClass}>{inner}</section>;
}
