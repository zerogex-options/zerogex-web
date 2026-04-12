'use client';

type RegimeTone = 'bullish' | 'bearish' | 'neutral';

interface RegimeSummaryBannerProps {
  title: string;
  badge: string;
  summary: string;
  tone: RegimeTone;
}

const toneStyles: Record<RegimeTone, { text: string; bg: string; border: string }> = {
  bullish: {
    text: 'var(--color-bull)',
    bg: 'var(--color-bull-soft)',
    border: 'var(--color-bull)',
  },
  bearish: {
    text: 'var(--color-bear)',
    bg: 'var(--color-bear-soft)',
    border: 'var(--color-bear)',
  },
  neutral: {
    text: 'var(--color-warning)',
    bg: 'var(--color-warning-soft)',
    border: 'var(--color-warning)',
  },
};

export default function RegimeSummaryBanner({ title, badge, summary, tone }: RegimeSummaryBannerProps) {
  const style = toneStyles[tone];

  return (
    <section className="mb-8 rounded-2xl p-5" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span
          className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full border"
          style={{ color: style.text, backgroundColor: style.bg, borderColor: style.border }}
        >
          {badge}
        </span>
      </div>
      <p className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
        {summary}
      </p>
    </section>
  );
}
