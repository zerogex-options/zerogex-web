'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './Client.i18n';
import { FileText } from 'lucide-react';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

const EFFECTIVE_DATE = 'April 25, 2026';
const CONTACT_EMAIL = 'support@zerogex.io';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: C.light,
          letterSpacing: '-0.3px',
        }}
      >
        {title}
      </h2>
      <div style={{ marginTop: 12, color: C.muted, fontSize: 15, lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const { theme } = useTheme();
  const t = usePageT(dict);

  return (
    <div
      style={{
        background: 'transparent',
        color: C.light,
        fontFamily: 'DM Sans, sans-serif',
        overflowX: 'hidden',
      }}
    >
      <LandingHeader />

      <main style={{ minHeight: '100vh', padding: '120px 24px 84px', position: 'relative' }}>
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
          }}
        />
        <article style={{ position: 'relative', zIndex: 1, maxWidth: 820, margin: '0 auto' }}>
          <div style={{ marginBottom: 32 }}>
            <div
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
              <FileText size={14} /> {t('legalBadge')}
            </div>
            <h1
              style={{
                margin: '18px 0 10px',
                fontSize: 'clamp(34px, 5vw, 56px)',
                lineHeight: 1.08,
                letterSpacing: '-1.2px',
              }}
            >
              {t('pageTitle')}
            </h1>
            <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>
              {t('effectiveDateLabel', { date: EFFECTIVE_DATE })}
            </p>
          </div>

          <Section title={t('sectionTitle1')}>
            <p>
              {t('s1Pre')}{' '}
              <Link href="/privacy" style={{ color: C.amber }}>
                {t('s1PrivacyLink')}
              </Link>
              {t('s1Post')}
            </p>
          </Section>

          <Section title={t('sectionTitle2')}>
            <p>{t('s2Body')}</p>
          </Section>

          <Section title={t('sectionTitle3')}>
            <p>
              {t('s3Pre')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>{' '}
              {t('s3Post')}
            </p>
          </Section>

          <Section title={t('sectionTitle4')}>
            <p>{t('s4Intro')}</p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>
                <strong>{t('s4PlanChangesLabel')}</strong> {t('s4PlanChangesBody')}
              </li>
              <li>
                <strong>{t('s4CancellationLabel')}</strong> {t('s4CancellationBody')}
              </li>
              <li>
                <strong>{t('s4RefundsLabel')}</strong> {t('s4RefundsBody')}
              </li>
              <li>
                <strong>{t('s4TaxesLabel')}</strong> {t('s4TaxesBody')}
              </li>
              <li>
                <strong>{t('s4FailedPaymentsLabel')}</strong> {t('s4FailedPaymentsBody')}
              </li>
            </ul>
          </Section>

          <Section title={t('sectionTitle5')}>
            <p>{t('s5Body')}</p>
          </Section>

          <Section title={t('sectionTitle6')}>
            <p>{t('s6Intro')}</p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>{t('s6Item1')}</li>
              <li>{t('s6Item2')}</li>
              <li>{t('s6Item3')}</li>
              <li>{t('s6Item4')}</li>
              <li>{t('s6Item5')}</li>
              <li>{t('s6Item6')}</li>
            </ul>
          </Section>

          <Section title={t('sectionTitle7')}>
            <p>{t('s7Body')}</p>
          </Section>

          <Section title={t('sectionTitle8')}>
            <p>{t('s8Body')}</p>
          </Section>

          <Section title={t('sectionTitle9')}>
            <p>{t('s9Body')}</p>
          </Section>

          <Section title={t('sectionTitle10')}>
            <p>{t('s10Body')}</p>
          </Section>

          <Section title={t('sectionTitle11')}>
            <p>{t('s11Body')}</p>
          </Section>

          <Section title={t('sectionTitle12')}>
            <p>{t('s12Body')}</p>
          </Section>

          <Section title={t('sectionTitle13')}>
            <p>{t('s13Body')}</p>
          </Section>

          <Section title={t('sectionTitle14')}>
            <p>
              <strong>{t('s14Intro')}</strong>
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s14InformalLabel')}</strong> {t('s14InformalPre')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>
              {t('s14InformalPost')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s14AgreementLabel')}</strong> {t('s14AgreementBody')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s14RulesLabel')}</strong> {t('s14RulesBody')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s14ClassActionLabel')}</strong> {t('s14ClassActionBody')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s14ExceptionsLabel')}</strong> {t('s14ExceptionsBody')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s14OptOutLabel')}</strong> {t('s14OptOutPre')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>{' '}
              {t('s14OptOutPost')}
            </p>
          </Section>

          <Section title={t('sectionTitle15')}>
            <p>{t('s15Body')}</p>
          </Section>

          <Section title={t('sectionTitle16')}>
            <p>
              {t('s16Pre')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </article>
      </main>

      <Footer theme={theme} />
    </div>
  );
}
