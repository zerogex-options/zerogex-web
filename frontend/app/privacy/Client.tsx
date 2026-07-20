'use client';

import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { usePageT } from '@/core/LanguageContext';
import { ShieldCheck } from 'lucide-react';
import { dict } from './Client.i18n';

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

export default function PrivacyPage() {
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
              <ShieldCheck size={14} /> {t('badgeLabel')}
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
              {t('effectiveDate', { date: EFFECTIVE_DATE })}
            </p>
          </div>

          <Section title={t('s1Title')}>
            <p>{t('s1Body')}</p>
          </Section>

          <Section title={t('s2Title')}>
            <p>{t('s2Intro')}</p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>
                <strong>{t('s2Item1Label')}</strong> {t('s2Item1Text')}
              </li>
              <li>
                <strong>{t('s2Item2Label')}</strong> {t('s2Item2Text')}
              </li>
              <li>
                <strong>{t('s2Item3Label')}</strong> {t('s2Item3Text')}
              </li>
              <li>
                <strong>{t('s2Item4Label')}</strong> {t('s2Item4Text')}
              </li>
            </ul>
          </Section>

          <Section title={t('s3Title')}>
            <ul style={{ paddingLeft: 22 }}>
              <li>{t('s3Item1')}</li>
              <li>{t('s3Item2')}</li>
              <li>{t('s3Item3')}</li>
              <li>{t('s3Item4')}</li>
              <li>{t('s3Item5')}</li>
              <li>{t('s3Item6')}</li>
            </ul>
          </Section>

          <Section title={t('s4Title')}>
            <p>{t('s4Intro')}</p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>
                <strong>{t('s4Item1Label')}</strong> {t('s4Item1TextPrefix')}{' '}
                <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer" style={{ color: C.amber }}>
                  stripe.com/privacy
                </a>
                .
              </li>
              <li>
                <strong>{t('s4Item2Label')}</strong> {t('s4Item2Text')}
              </li>
              <li>
                <strong>{t('s4Item3Label')}</strong> {t('s4Item3Text')}
              </li>
            </ul>
            <p style={{ marginTop: 12 }}>{t('s4Closing')}</p>
          </Section>

          <Section title={t('s5Title')}>
            <p>{t('s5Body')}</p>
          </Section>

          <Section title={t('s6Title')}>
            <p>{t('s6Body')}</p>
          </Section>

          <Section title={t('s7Title')}>
            <p>
              {t('s7Prefix')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>
              {t('s7Suffix')}
            </p>
          </Section>

          <Section title={t('s8Title')}>
            <p>{t('s8Intro')}</p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s8CategoriesLabel')}</strong> {t('s8CategoriesText')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s8NoSaleLabel')}</strong> {t('s8NoSaleText')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s8RightsLabel')}</strong> {t('s8RightsIntro')}
            </p>
            <ul style={{ paddingLeft: 22, marginTop: 8 }}>
              <li>
                <strong>{t('s8RightsItem1Label')}</strong> {t('s8RightsItem1Text')}
              </li>
              <li>
                <strong>{t('s8RightsItem2Label')}</strong> {t('s8RightsItem2Text')}
              </li>
              <li>
                <strong>{t('s8RightsItem3Label')}</strong> {t('s8RightsItem3Text')}
              </li>
              <li>
                <strong>{t('s8RightsItem4Label')}</strong> {t('s8RightsItem4Text')}
              </li>
              <li>
                <strong>{t('s8RightsItem5Label')}</strong> {t('s8RightsItem5Text')}
              </li>
              <li>
                <strong>{t('s8RightsItem6Label')}</strong> {t('s8RightsItem6TextPrefix')}{' '}
                <strong>{t('s8RightsItem6AppealLabel')}</strong> {t('s8RightsItem6TextSuffix')}
              </li>
            </ul>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s8HowToLabel')}</strong> {t('s8HowToPrefix')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.amber }}>
                {CONTACT_EMAIL}
              </a>
              {t('s8HowToSuffix')}
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>{t('s8ShineLabel')}</strong> {t('s8ShineText')}
            </p>
          </Section>

          <Section title={t('s9Title')}>
            <p>{t('s9Body')}</p>
          </Section>

          <Section title={t('s10Title')}>
            <p>{t('s10Body')}</p>
          </Section>

          <Section title={t('s11Title')}>
            <p>{t('s11Body')}</p>
          </Section>

          <Section title={t('s12Title')}>
            <p>{t('s12Body')}</p>
          </Section>

          <Section title={t('s13Title')}>
            <p>
              {t('s13Prefix')}{' '}
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
