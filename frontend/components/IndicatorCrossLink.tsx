import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// The "the other one might suit you better" block each indicator landing shows
// for its sibling. The two integrations answer different questions — free and
// manual (TradingView) vs. Pro and self-updating (NinjaTrader) — so every
// visitor who lands on the wrong one should find the right one without
// backtracking to the gamma-levels page.
export default function IndicatorCrossLink({
  eyebrow,
  accent,
  title,
  body,
  href,
  cta,
}: {
  eyebrow: string;
  /** CSS custom property driving the eyebrow pill + link colour. */
  accent: '--color-brand-primary' | '--color-brand-accent';
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '28px',
        marginBottom: 48,
        background: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: `var(${accent})`,
          border: `1px solid var(${accent})44`,
          background: `var(${accent})14`,
          borderRadius: 999,
          padding: '5px 14px',
          marginBottom: 16,
        }}
      >
        {eyebrow}
      </div>

      <h2 style={{ margin: '0 0 12px 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px' }}>{title}</h2>
      <p
        style={{
          margin: '0 0 20px 0',
          fontSize: 15,
          lineHeight: 1.65,
          color: 'var(--color-text-secondary)',
          maxWidth: 720,
        }}
      >
        {body}
      </p>

      <Link
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 20px',
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 800,
          textDecoration: 'none',
          border: '1px solid var(--border-default)',
          color: 'var(--color-text-primary)',
        }}
      >
        {cta} <ArrowRight size={16} />
      </Link>
    </section>
  );
}
