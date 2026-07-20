'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './Client.i18n';
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
      className="zg-eyebrow"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: C.amber,
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
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  title: string;
  body: string;
}) {
  return (
    <div
      className="zg-panel"
      style={{
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Icon size={24} strokeWidth={1.75} style={{ color: C.amber, flexShrink: 0, marginTop: 2 }} />
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.light, letterSpacing: '-0.2px' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: C.muted }}>{body}</p>
    </div>
  );
}

function PainPoint({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="zg-panel"
      style={{
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
  includesTrialLabel,
}: {
  title: string;
  price: string;
  cadence: string;
  highlight?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  includesTrialLabel: string;
}) {
  return (
    <article
      className="zg-panel"
      style={{
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
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
        {includesTrialLabel}
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
          className="zg-btn zg-btn--primary"
          style={{
            width: '100%',
            padding: '12px 18px',
            fontSize: 14,
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
  const t = usePageT(dict);

  return (
    <div style={{ background: 'transparent', color: C.light, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: `${C.bg}ee`,
          borderBottom: `1px solid ${C.border}`,
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
            aria-label={t('toggleTheme')}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Link href="/pricing" style={{ textDecoration: 'none' }}>
            <button
              className="zg-btn zg-btn--secondary"
              style={{
                padding: '8px 14px',
                fontSize: 13,
              }}
            >
              {t('navPricing')}
            </button>
          </Link>
          <Link href="/spx-gamma-levels" style={{ textDecoration: 'none' }}>
            <button
              className="zg-btn zg-btn--primary"
              style={{
                padding: '8px 14px',
                fontSize: 13,
              }}
            >
              {t('navFreeGammaLevels')} <ArrowRight size={14} />
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
            <Activity size={14} /> {t('heroPill')}
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
            {t('heroTitlePre')}{' '}
            <span
              style={{
                color: 'var(--color-accent-hot)',
              }}
            >
              {t('heroTitleHighlight')}
            </span>
          </h1>

          <p style={{ margin: '0 auto 14px', maxWidth: 760, color: C.light, fontSize: 19, lineHeight: 1.65, fontWeight: 500 }}>
            {t('heroSubtitle1')}
          </p>
          <p style={{ margin: '0 auto 32px', maxWidth: 720, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
            {t('heroSubtitle2')}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <Link href="/spx-gamma-levels" style={{ textDecoration: 'none' }}>
              <button
                className="zg-btn zg-btn--primary"
                style={{
                  padding: '15px 28px',
                  fontSize: 15,
                }}
              >
                {t('ctaOpenFreeGammaLevels')} <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button
                className="zg-btn zg-btn--secondary"
                style={{
                  padding: '15px 28px',
                  fontSize: 15,
                }}
              >
                {t('ctaStartTrial', { days: TRIAL_DAYS })} <ArrowRight size={16} />
              </button>
            </Link>
          </div>

          <div style={{ marginTop: 30, display: 'inline-flex', gap: 18, color: C.muted, fontSize: 13, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color={C.amber} /> {t('noCardPreview')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color={C.amber} /> {t('cancelAnytime')}
            </span>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section style={{ padding: '60px 24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Pill>
              <Target size={14} /> {t('problemPill')}
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
              {t('problemTitle')}
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 740, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              {t('problemSubtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <PainPoint
              title={t('pain1Title')}
              body={t('pain1Body')}
            />
            <PainPoint
              title={t('pain2Title')}
              body={t('pain2Body')}
            />
            <PainPoint
              title={t('pain3Title')}
              body={t('pain3Body')}
            />
            <PainPoint
              title={t('pain4Title')}
              body={t('pain4Body')}
            />
          </div>
        </div>
      </section>

      {/* Solution */}
      <section style={{ padding: '70px 24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Pill>
              <Zap size={14} /> {t('solutionPill')}
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
              {t('solutionTitle')}
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 740, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              {t('solutionSubtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            <FeatureCard
              icon={Activity}
              title={t('feat1Title')}
              body={t('feat1Body')}
            />
            <FeatureCard
              icon={Target}
              title={t('feat2Title')}
              body={t('feat2Body')}
            />
            <FeatureCard
              icon={Layers}
              title={t('feat3Title')}
              body={t('feat3Body')}
            />
            <FeatureCard
              icon={BarChart2}
              title={t('feat4Title')}
              body={t('feat4Body')}
            />
            <FeatureCard
              icon={ShieldCheck}
              title={t('feat5Title')}
              body={t('feat5Body')}
            />
            <FeatureCard
              icon={Sparkles}
              title={t('feat6Title')}
              body={t('feat6Body')}
            />
          </div>
        </div>
      </section>

      {/* Proof / free gamma levels */}
      <section style={{ padding: '70px 24px', borderTop: `1px solid ${C.border}` }}>
        <div
          className="zg-panel"
          style={{
            maxWidth: 980,
            margin: '0 auto',
            padding: '36px 28px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center' }}>
            <Pill>
              <BarChart2 size={14} /> {t('proofPill')}
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
              {t('proofTitle')}
            </h2>
            <p style={{ margin: 0, maxWidth: 680, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              {t('proofSubtitle')}
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
                    borderRadius: 'var(--radius-panel)',
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

            <Link href="/spx-gamma-levels" style={{ textDecoration: 'none', marginTop: 8 }}>
              <button
                className="zg-btn zg-btn--primary"
                style={{
                  padding: '15px 28px',
                  fontSize: 15,
                }}
              >
                {t('ctaOpenFreeGammaLevels')} <ArrowRight size={16} />
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
              <Sparkles size={14} /> {t('tiersPill')}
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
              {t('tiersTitle')}
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 720, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              {t('tiersSubtitle', { days: TRIAL_DAYS })}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <TierCard
              title="Basic"
              price="$39"
              cadence="/month"
              features={[
                t('basicFeat1'),
                t('basicFeat2'),
                t('basicFeat3'),
                t('basicFeat4'),
              ]}
              ctaLabel={t('ctaStartTrial', { days: TRIAL_DAYS })}
              ctaHref="/pricing"
              includesTrialLabel={t('includesTrial', { days: TRIAL_DAYS })}
            />
            <TierCard
              title="Pro"
              price="$59"
              cadence="/month"
              highlight={t('mostPopular')}
              features={[
                t('proFeat1'),
                t('proFeat2'),
                t('proFeat3'),
                t('proFeat4'),
              ]}
              ctaLabel={t('ctaStartTrial', { days: TRIAL_DAYS })}
              ctaHref="/pricing"
              includesTrialLabel={t('includesTrial', { days: TRIAL_DAYS })}
            />
          </div>

          <p style={{ textAlign: 'center', marginTop: 22, color: C.muted, fontSize: 13 }}>
            {t('annualBillingPre')}{' '}
            <Link href="/pricing" style={{ color: C.amber }}>
              {t('pricingPageLink')}
            </Link>{' '}
            {t('annualBillingPost')}
          </p>
        </div>
      </section>

      {/* Education depth */}
      <section style={{ padding: '70px 24px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <Pill>
              <Layers size={14} /> {t('eduPill')}
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
              {t('eduTitle')}
            </h2>
            <p style={{ margin: '0 auto', maxWidth: 720, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
              {t('eduSubtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { href: '/education/gamma-exposure-explained', title: t('edu1Title'), body: t('edu1Body') },
              { href: '/education/how-to-read-a-gamma-flip', title: t('edu2Title'), body: t('edu2Body') },
              { href: '/education/gamma-walls-explained', title: t('edu3Title'), body: t('edu3Body') },
              { href: '/education/0dte-dealer-positioning-explained', title: t('edu4Title'), body: t('edu4Body') },
              { href: '/education/max-pain-explained', title: t('edu5Title'), body: t('edu5Body') },
              { href: '/education/vanna-and-charm-explained', title: t('edu6Title'), body: t('edu6Body') },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div
                  className="zg-panel"
                  style={{
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
                    {t('readMore')} <ArrowRight size={14} />
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
            {t('finalTitlePre')}{' '}
            <span
              style={{
                color: 'var(--color-accent-hot)',
              }}
            >
              {t('finalTitleHighlight')}
            </span>
          </h2>
          <p style={{ margin: '0 auto 28px', maxWidth: 640, fontSize: 17, color: C.muted, lineHeight: 1.65 }}>
            {t('finalSubtitle')}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <Link href="/spx-gamma-levels" style={{ textDecoration: 'none' }}>
              <button
                className="zg-btn zg-btn--primary"
                style={{
                  padding: '18px 36px',
                  fontSize: 15,
                }}
              >
                {t('ctaOpenFreeGammaLevels')} <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button
                className="zg-btn zg-btn--secondary"
                style={{
                  padding: '18px 36px',
                  fontSize: 15,
                }}
              >
                {t('seePricing')} <ArrowRight size={18} />
              </button>
            </Link>
          </div>

          <p style={{ marginTop: 24, color: C.muted, fontSize: 13, lineHeight: 1.65, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            {t('disclaimer')}
          </p>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
