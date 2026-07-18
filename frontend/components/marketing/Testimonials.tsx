// ── Testimonials ──────────────────────────────────────────────────────────────
// Presentational, theme-agnostic building blocks for showing customer quotes.
// Everything reads from core/testimonials.ts by default, so copy lives in one
// place. Styling uses only design-system tokens (var(--…)) and primitives
// (zg-panel / zg-chip / zg typography), so these render correctly in light,
// dark, and sepia without any isDark branching.
//
// Three entry points, one per surface:
//   • <TestimonialsSection/> — full landing-page section (heading + hero card)
//   • <TestimonialCard/>      — a single quote card (about page, grids)
//   • <TestimonialStrip/>     — compact one-line pull-quote (pricing page)

import { CSSProperties } from 'react';
import Link from 'next/link';
import { Testimonial, TESTIMONIALS, FEATURED_TESTIMONIAL } from '@/core/testimonials';

// ── Avatar monogram ─────────────────────────────────────────────────────────
// No photo, so a tracked-mono monogram in a hairline-ringed disc — reads as an
// avatar without pretending to be a headshot.
function Monogram({ initials, size = 46 }: { initials: string; size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--color-warning-soft)',
        border: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        className="zg-mono"
        style={{ color: 'var(--color-accent-hot)', fontWeight: 700, fontSize: size * 0.32, letterSpacing: '0.02em' }}
      >
        {initials}
      </span>
    </div>
  );
}

// ── Author line ─────────────────────────────────────────────────────────────
function AuthorLine({ t, size = 46 }: { t: Testimonial; size?: number }) {
  const meta = [t.role, t.context].filter(Boolean).join(' · ');
  const nameNode = (
    <span className="zg-h4" style={{ color: 'var(--text-primary)' }}>
      {t.author}
    </span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Monogram initials={t.initials} size={size} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {t.href ? (
            <a href={t.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              {nameNode}
            </a>
          ) : (
            nameNode
          )}
          {t.verified && (
            <span
              className="zg-chip"
              style={{ ['--chip-color' as string]: 'var(--color-positive)' } as CSSProperties}
            >
              ✓ Verified
            </span>
          )}
        </div>
        {meta && (
          <div className="zg-small" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quote glyph ──────────────────────────────────────────────────────────────
// A big typographic open-quote in the display face — the one decorative accent,
// kept to a tint so it frames the quote without shouting.
function QuoteGlyph({ size = 56 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: size,
        lineHeight: 0.9,
        color: 'var(--color-accent-hot)',
        opacity: 0.32,
        display: 'block',
        height: size * 0.55,
        overflow: 'hidden',
      }}
    >
      &ldquo;
    </span>
  );
}

// ── Paragraph body ───────────────────────────────────────────────────────────
function QuoteParagraphs({ quote }: { quote: string }) {
  const paras = quote.split('\n\n');
  return (
    <>
      {paras.map((p, i) => (
        <p
          key={i}
          className="zg-body"
          style={{ color: 'var(--text-secondary)', margin: i === paras.length - 1 ? 0 : '0 0 16px' }}
        >
          {p}
        </p>
      ))}
    </>
  );
}

// ── Single quote card ────────────────────────────────────────────────────────
// The full testimonial: glyph, quote, attribution. Left accent rule echoes the
// founder panel on /about. Reusable on the about page and in multi-quote grids.
export function TestimonialCard({
  testimonial = FEATURED_TESTIMONIAL,
  style,
}: {
  testimonial?: Testimonial;
  style?: CSSProperties;
}) {
  return (
    <figure
      className="zg-panel"
      style={{
        position: 'relative',
        overflow: 'hidden',
        margin: 0,
        padding: 'clamp(28px, 4vw, 44px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        ...style,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: 'var(--color-accent-hot)' }} />
      <QuoteGlyph />
      <blockquote style={{ margin: 0 }}>
        <QuoteParagraphs quote={testimonial.quote} />
      </blockquote>
      <figcaption>
        <AuthorLine t={testimonial} />
      </figcaption>
    </figure>
  );
}

// ── Landing-page section ─────────────────────────────────────────────────────
// Self-contained: eyebrow + heading + hero card, matching the other landing
// sections' rhythm. Renders the featured quote large; any additional quotes
// fall into a responsive grid below.
export function TestimonialsSection({
  testimonials = TESTIMONIALS,
}: {
  testimonials?: Testimonial[];
}) {
  if (testimonials.length === 0) return null;
  const featured = testimonials.find((t) => t.featured) ?? testimonials[0];
  const rest = testimonials.filter((t) => t.id !== featured.id);

  return (
    <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <span
          className="zg-eyebrow"
          style={{ display: 'inline-block', color: 'var(--color-accent-hot)', marginBottom: 16 }}
        >
          What traders say
        </span>
        <h2 className="zg-h1" style={{ margin: 0, color: 'var(--text-primary)' }}>
          Built for traders who go deep on the data.
        </h2>
        <p
          className="zg-lead"
          style={{ marginTop: 14, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' }}
        >
          ZeroGEX powers real decision-support workflows — here&rsquo;s one, in the builder&rsquo;s own words.
        </p>
      </div>

      <TestimonialCard testimonial={featured} style={{ maxWidth: 860, marginLeft: 'auto', marginRight: 'auto' }} />

      {rest.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
            marginTop: 16,
            maxWidth: 860,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {rest.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Compact pull-quote strip ─────────────────────────────────────────────────
// One high-signal line + attribution, sized to sit inline on the pricing page
// near the plans. Optionally links out to fuller social proof.
export function TestimonialStrip({
  testimonial = FEATURED_TESTIMONIAL,
  moreHref,
  style,
}: {
  testimonial?: Testimonial;
  moreHref?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className="zg-panel"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 'clamp(24px, 3vw, 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        ...style,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: 'var(--color-accent-hot)' }} />
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(17px, 2.2vw, 21px)',
          lineHeight: 1.45,
          letterSpacing: '-0.01em',
          color: 'var(--text-primary)',
        }}
      >
        &ldquo;{testimonial.pullQuote}&rdquo;
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <AuthorLine t={testimonial} size={40} />
        {moreHref && (
          <Link href={moreHref} className="zg-btn zg-btn--ghost" style={{ fontSize: 12 }}>
            Read more
          </Link>
        )}
      </div>
    </section>
  );
}
