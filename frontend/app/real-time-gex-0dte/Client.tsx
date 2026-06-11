'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import {
  ArrowRight,
  Activity,
  BarChart2,
  CheckCircle2,
  Clock,
  Layers,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Zap,
} from 'lucide-react';

const C = {
  bg: 'var(--color-bg)',
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  accent: 'var(--color-brand-accent)',
  border: 'var(--border-default)',
};

const TRIAL_DAYS = 7;

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: C.amber,
        border: `1px solid ${C.amber}55`,
        borderRadius: 999,
        background: `${C.amber}12`,
        padding: '5px 14px',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${C.amber}18`,
          border: `1px solid ${C.amber}44`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.amber,
        }}
      >
        <Icon size={22} color={C.amber} />
      </div>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.light, letterSpacing: '-0.2px' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: C.muted }}>{body}</p>
    </div>
  );
}

function PainPoint({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: C.light }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: C.muted }}>{body}</p>
    </div>
  );
}

function TierCard({
  title,
  price,
  cadence,
  highlight,
  features,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  price: string;
  cadence: string;
  highlight?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <article
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${highlight ? `${C.amber}88` : C.border}`,
        borderRadius: 18,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: highlight ? `0 18px 48px ${C.amber}25` : `0 8px 24px var(--color-info-soft)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.light, letterSpacing: '-0.3px' }}>{title}</h3>
        {highlight && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              border: `1px solid ${C.amber}66`,
              color: C.amber,
              borderRadius: 999,
              padding: '4px 10px',
              whiteSpace: 'nowrap',
            }}
          >
            {highlight}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 }}>
        <span style={{ fontSize: 34, fontWeight: 900, color: C.light, letterSpacing: '-1px' }}>{price}</span>
        <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{cadence}</span>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
        Includes a {TRIAL_DAYS}-day free trial.
      </p>

      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10, flex: 1 }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, lineHeight: 1.55, fontSize: 14 }}>
            <CheckCircle2 size={18} color={C.amber} style={{ marginTop: 2, flexShrink: 0 }} />
            {feature}
          </li>
        ))}
      </ul>

      <Link href={ctaHref} style={{ textDecoration: 'none', marginTop: 22 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '12px 18px',
            borderRadius: 12,
            background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
            color: 'var(--text-inverse)',
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          {ctaLabel} <ArrowRight size={16} />
        </span>
      </Link>
    </article>
  );
}

export default function RealTimeGexLandingClient() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{ background: 'transparent', color: C.light, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: `${C.bg}ee`,
          borderBottom: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/" className="h-full flex items-center overflow-hidden flex-shrink-0" style={{ textDecoration: 'none', lineHeight: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/title.svg" alt="ZeroGEX" className="h-[130%] sm:h-[150%] w-auto block" style={{ maxHeight: 'none', objectFit: 'contain' }} />
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-[10px]"
            style={{
              background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
              color: C.muted,
            }}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Link href="/pricing" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: C.light,
                cursor: 'pointer',
              }}
            >
              Pricing
            </button>
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: `linear-gradient(135deg, ${C.amber}, var(--heat-mid))`,
                border: 'none',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text-inverse)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: `0 4px 16px ${C.amber}50`,
              }}
            >
              Free Dashboard <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', padding: '120px 24px 84px', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(var(--border-subtle) 1px, transparent 1px),
              linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
            `,
            backgroundSize: '62px 62px',
            pointerEvents: 'none',
            opacity: 0.6,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <Pill>
            <Activity size={14} /> Real-Time GEX for 0DTE Traders
          </Pill>

          <h1
            style={{
              margin: '20px 0 16px',
              fontSize: 'clamp(36px, 5.5vw, 68px)',
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              color: C.light,
              fontWeight: 900,
            }}
          >
            Read the dealer book before the move,{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${C.amber}, var(--heat-mid))`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              not after it.
            </span>
          </h1>

          <p style={{ margin: '0 auto 14px', maxWidth: 760, color: C.light, fontSize: 19, lineHeight: 1.65, fontWeight: 500 }}>
            ZeroGEX is real-time gamma exposure built for the way SPX and 0DTE actually trade today — live gamma flip, call and put walls, dealer positioning, and composite signals you can read.
          </p>
          <p style={{ margin: '0 auto 32px', maxWidth: 720, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
            No 15-minute-delayed feeds. No black-box scores. Open the dashboard and see what dealers have to hedge, right now.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                  border: 'none',
                  borderRadius: 14,
                  padding: '15px 28px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--text-inverse)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: `0 12px 36px ${C.amber}45`,
                }}
              >
                Launch the free dashboard <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '15px 28px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: C.light,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                Start {TRIAL_DAYS}-day free trial <ArrowRight size={16} />
              </button>
            </Link>
          </div>

          <div style={{ marginTop: 30, display: 'inline-flex', gap: 18, color: C.muted, fontSize: 13, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color={C.amber} /> No card to read the free dashboard
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color={C.amber} /> Cancel anytime, no email required
            </span>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section style={{ padding: '60px 24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Pill>
              <Target size={14} /> Why 0DTE breaks delayed GEX
            </Pill>
            <h2
              style={{
                margin: '18px 0 12px',
                fontSize: 'clamp(28px, 4vw, 44px)',
                lineHeight: 1.15,
                letterSpacing: '-0.8px',
                color: C.light,
                fontWeight: 800,
              }}
            >
              The chain moves under you between morning coffee and lunch.
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 740, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              Same-day expiries now dominate SPX flow. That changes what dealer positioning means, how fast the regime can flip, and what a stale read costs.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <PainPoint
              title="Delayed feeds miss the flip"
              body="A 15-minute-delayed GEX read is structurally wrong when the gamma flip is migrating intraday. The regime can change during the delay window, and the trade decisions that follow are out of sync with the actual dealer book."
            />
            <PainPoint
              title="Static screenshots miss the migration"
              body="Walls, the flip, and the gamma magnet all migrate intraday. A call wall that's chasing price is a very different read than one that's holding — and a screenshot can't show you which one you're looking at."
            />
            <PainPoint
              title="Per-strike GEX misses sign consistency"
              body="The retail shortcut of summing gamma × OI by strike can produce a positive headline number while the underlying curve says spot is below the flip. The headline and the regime line cannot contradict — but in some tools they do."
            />
            <PainPoint
              title="Aggregate gamma misses the 0DTE bucket"
              body="When most of today's gamma sits in same-day options, an all-expiries average is the wrong read for the intraday tape. The 0DTE bucket is where the hedging actually happens."
            />
          </div>
        </div>
      </section>

      {/* Solution */}
      <section style={{ padding: '70px 24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Pill>
              <Zap size={14} /> How ZeroGEX is built
            </Pill>
            <h2
              style={{
                margin: '18px 0 12px',
                fontSize: 'clamp(28px, 4vw, 44px)',
                lineHeight: 1.15,
                letterSpacing: '-0.8px',
                color: C.light,
                fontWeight: 800,
              }}
            >
              Real-time, methodology-first, 0DTE-aware.
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 740, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              Built specifically for the structural reads that matter intraday — and structurally honest about what the data can and can&apos;t say.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            <FeatureCard
              icon={Activity}
              title="Real-time dealer gamma"
              body="Live spot-shift dealer gamma profile, recalculated continuously. The headline Net GEX and the gamma flip read off one curve — they cannot contradict each other."
            />
            <FeatureCard
              icon={Target}
              title="Hardened gamma flip"
              body="Interior, structural, and actionable-distance gates against grid-edge artifacts and noise-floor crossings. Reports NULL on degraded chains instead of silently freezing on a stale value."
            />
            <FeatureCard
              icon={Layers}
              title="Per-DTE bucketing"
              body="Strike-by-DTE GEX heatmap so the 0DTE concentration that dominates the intraday tape is visible directly, not buried inside an all-expiries average."
            />
            <FeatureCard
              icon={BarChart2}
              title="Composite signal layer"
              body="Squeeze Setup, Positioning Trap, Trap Detection, EOD Pressure — each with published methodology in the Education section, not black-box alerts."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Methodology you can read"
              body="Every signal and structural read has a write-up explaining how it's built and when it fails. No magic numbers, no hidden multipliers."
            />
            <FeatureCard
              icon={Sparkles}
              title="Free read on the structural stack"
              body="Net GEX, gamma flip, call wall, put wall, max pain, and the full dealer gamma profile — open to anyone, no signup required."
            />
          </div>
        </div>
      </section>

      {/* Proof / free dashboard */}
      <section style={{ padding: '70px 24px', borderTop: `1px solid ${C.border}` }}>
        <div
          style={{
            maxWidth: 980,
            margin: '0 auto',
            background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
            border: `1px solid ${C.amber}55`,
            borderRadius: 22,
            padding: '36px 28px',
            boxShadow: `0 18px 60px ${C.amber}20`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center' }}>
            <Pill>
              <BarChart2 size={14} /> Free Public Dashboard
            </Pill>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(26px, 4vw, 38px)',
                lineHeight: 1.2,
                letterSpacing: '-0.6px',
                color: C.light,
                fontWeight: 800,
                maxWidth: 720,
              }}
            >
              See today&apos;s dealer book without paying for it.
            </h2>
            <p style={{ margin: 0, maxWidth: 680, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              The ZeroGEX dashboard surfaces the structural reads in real time — Net GEX, gamma flip with live distance from spot, call and put walls, max pain, and the dealer gamma profile across strikes. Anonymous access, no signup, no card.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, width: '100%', marginTop: 8 }}>
              {[
                'Net GEX (sign-consistent)',
                'Gamma Flip + distance',
                'Call Wall + distance',
                'Put Wall + distance',
                'Max Pain',
                'Dealer gamma profile chart',
              ].map((label) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: 'var(--bg-hover)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.light,
                    justifyContent: 'flex-start',
                  }}
                >
                  <CheckCircle2 size={16} color={C.amber} />
                  {label}
                </div>
              ))}
            </div>

            <Link href="/dashboard" style={{ textDecoration: 'none', marginTop: 8 }}>
              <button
                style={{
                  background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                  border: 'none',
                  borderRadius: 14,
                  padding: '15px 28px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--text-inverse)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: `0 12px 36px ${C.amber}45`,
                }}
              >
                Open the free dashboard <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section style={{ padding: '70px 24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Pill>
              <Sparkles size={14} /> Upgrade when you&apos;re ready
            </Pill>
            <h2
              style={{
                margin: '18px 0 12px',
                fontSize: 'clamp(28px, 4vw, 44px)',
                lineHeight: 1.15,
                letterSpacing: '-0.8px',
                color: C.light,
                fontWeight: 800,
              }}
            >
              Pricing built for the way 0DTE traders actually work.
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 720, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              Free dashboard for the structural reads. Paid plans add the signal layer, the Advanced Signals, and direct API access. Every plan starts with a {TRIAL_DAYS}-day free trial — cancel anytime.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <TierCard
              title="Basic"
              price="$39"
              cadence="/month"
              features={[
                'Real-time metrics and full strategy tools',
                'Access to Basic Signals',
                'Per-signal context fields and intraday timelines',
                'Designed for disciplined daily execution',
              ]}
              ctaLabel={`Start ${TRIAL_DAYS}-day free trial`}
              ctaHref="/pricing"
            />
            <TierCard
              title="Pro"
              price="$59"
              cadence="/month"
              highlight="Most popular"
              features={[
                'Everything in Basic',
                'Access to Advanced Signals (EOD Pressure, Trap Detection, Squeeze Setup, more)',
                'Direct access to ZeroGEX APIs',
                'Real-time scoring + historical score charts',
              ]}
              ctaLabel={`Start ${TRIAL_DAYS}-day free trial`}
              ctaHref="/pricing"
            />
          </div>

          <p style={{ textAlign: 'center', marginTop: 22, color: C.muted, fontSize: 13 }}>
            Annual billing also available — see{' '}
            <Link href="/pricing" style={{ color: C.amber }}>
              the pricing page
            </Link>{' '}
            for current promo pricing and annual savings.
          </p>
        </div>
      </section>

      {/* Education depth */}
      <section style={{ padding: '70px 24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <Pill>
              <Layers size={14} /> Read the methodology
            </Pill>
            <h2
              style={{
                margin: '18px 0 12px',
                fontSize: 'clamp(26px, 4vw, 38px)',
                lineHeight: 1.2,
                letterSpacing: '-0.6px',
                color: C.light,
                fontWeight: 800,
              }}
            >
              Every read has a write-up.
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 720, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              The structural reads, the signal layer, and the methodology — all documented. Pick a starting point.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { href: '/education/gamma-exposure-explained', title: 'Gamma Exposure (GEX) Explained', body: 'The complete guide — pillar piece.' },
              { href: '/education/how-to-read-a-gamma-flip', title: 'How to Read a Gamma Flip', body: 'Practical intraday workflow.' },
              { href: '/education/gamma-walls-explained', title: 'Gamma Walls Explained', body: 'Call wall, put wall, and how price reacts.' },
              { href: '/education/0dte-dealer-positioning-explained', title: '0DTE Dealer Positioning', body: 'Why same-day expiries dominate the read.' },
              { href: '/education/max-pain-explained', title: 'Max Pain — Does It Work?', body: 'Evidence-honest read.' },
              { href: '/education/vanna-and-charm-explained', title: 'Vanna and Charm Explained', body: 'Second-order Greeks and dealer hedging.' },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
                    border: `1px solid ${C.border}`,
                    borderRadius: 14,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'pointer',
                    transition: 'border-color 0.18s ease',
                  }}
                >
                  <span style={{ color: C.light, fontWeight: 700, fontSize: 15 }}>{item.title}</span>
                  <span style={{ color: C.muted, fontSize: 13, lineHeight: 1.55 }}>{item.body}</span>
                  <span style={{ color: C.amber, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    Read <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '90px 24px', borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <h2
            style={{
              margin: '0 0 16px',
              fontSize: 'clamp(30px, 4.5vw, 50px)',
              lineHeight: 1.1,
              letterSpacing: '-1px',
              color: C.light,
              fontWeight: 900,
            }}
          >
            Open the dashboard. See the dealer book.{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${C.amber}, var(--heat-mid))`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Decide for yourself.
            </span>
          </h2>
          <p style={{ margin: '0 auto 28px', maxWidth: 640, fontSize: 17, color: C.muted, lineHeight: 1.65 }}>
            The free read is the same calculation paid users get. Try it on today&apos;s tape before you decide whether to upgrade.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                  border: 'none',
                  borderRadius: 16,
                  padding: '18px 36px',
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--text-inverse)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: `0 14px 48px ${C.amber}50`,
                }}
              >
                Launch the free dashboard <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: '18px 36px',
                  fontSize: 17,
                  fontWeight: 800,
                  color: C.light,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                See pricing <ArrowRight size={18} />
              </button>
            </Link>
          </div>

          <p style={{ marginTop: 24, color: C.muted, fontSize: 13, lineHeight: 1.65, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            Educational content only — not financial advice. ZeroGEX surfaces structural reads on dealer positioning; trade decisions remain yours.
          </p>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
