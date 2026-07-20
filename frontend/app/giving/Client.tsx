'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './Client.i18n';
import type { GivingTotals } from '@/core/giving';
import {
  ArrowRight,
  Heart,
  Shield,
  HandHeart,
  Receipt,
  CalendarCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ── Brand colors ──────────────────────────────────────────────────────────────
const C = {
  bgDark:    'var(--color-bg)',
  card:      'var(--color-surface)',
  cardHover: 'var(--bg-hover)',
  light:     'var(--color-text-primary)',
  muted:     'var(--color-text-secondary)',
  amber:     'var(--color-brand-primary)',
  green:     'var(--color-positive)',
  red:       'var(--color-negative)',
  border:    'var(--border-default)',
};

const DONATION_PCT = 3;
const FOH_URL = 'https://foldsofhonor.org';
// Folds of Honor partner-tracked donation URL — same URL the QR code
// encodes. Donations through this link are attributed to the ZeroGEX
// partner page inside FOH's donor system.
const FOH_DONATION_URL = 'https://foldsofhonorpartners.donorsupport.co/page/ZeroGX';

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub, color = C.amber }: {
  eyebrow: string; title: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 56 }}>
      <div className="zg-eyebrow" style={{
        display: 'inline-block', color, marginBottom: 16,
      }}>
        {eyebrow}
      </div>
      <h2 style={{
        fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800,
        color: C.light, margin: 0, lineHeight: 1.15, letterSpacing: '-0.5px',
      }}>
        {title}
      </h2>
      {sub && (
        <p style={{
          fontSize: 17, color: C.muted, marginTop: 14,
          maxWidth: 620, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Info card ─────────────────────────────────────────────────────────────────
function InfoCard({ icon: Icon, title, body, color = C.amber, isDark = true }: {
  icon: React.ElementType; title: string; body: string; color?: string; isDark?: boolean;
}) {
  return (
    <div className="zg-panel" style={{ padding: '28px 24px' }}>
      <Icon size={24} strokeWidth={1.75} style={{ color, marginBottom: 16 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: C.light, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{body}</div>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FAQItem({ q, a, isDark = true }: { q: string; a: React.ReactNode; isDark?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: `1px solid ${open ? C.amber + '40' : C.border}`,
      borderRadius: 14, overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', background: open ? `${C.amber}08` : (isDark ? `${C.card}99` : 'var(--bg-card)'),
          border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16,
          transition: 'background 0.2s',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: C.light, lineHeight: 1.4 }}>{q}</span>
        {open
          ? <ChevronUp size={18} style={{ color: C.amber, flexShrink: 0 }} />
          : <ChevronDown size={18} style={{ color: C.muted, flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ padding: '0 24px 20px', background: `${C.amber}06` }}>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, margin: 0 }}>{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GivingPage({ totals }: { totals: GivingTotals }) {
  const { theme } = useTheme();
  const t = usePageT(dict);
  const isDark = theme === 'dark';
  const hasDonations = totals.totalDonatedUsd > 0 && totals.lastDonation !== null;
  const bg = 'transparent';
  const text = 'var(--color-text-primary)';
  const subtext = 'var(--color-text-secondary)';

  return (
    <div style={{ background: bg, color: text, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      <LandingHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 80px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(var(--border-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 800, height: 500,
          background: `radial-gradient(ellipse, ${C.amber}14 0%, transparent 70%)`,
          zIndex: 0, pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 820 }}>
          <div className="zg-eyebrow" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: C.amber, marginBottom: 24,
          }}>
            <Heart size={12} /> {t('heroEyebrow')}
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 68px)', fontWeight: 900,
            lineHeight: 1.08, letterSpacing: '-2px', margin: '0 0 24px', color: text,
          }}>
            {t('heroTitlePre', { pct: DONATION_PCT })}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              {t('heroTitleHighlight')}
            </span>
          </h1>
          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)', color: subtext,
            lineHeight: 1.7, maxWidth: 680, margin: '0 auto 36px',
          }}>
            {t('heroSub', { pct: DONATION_PCT })}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={FOH_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{
                padding: '14px 28px', fontSize: 15,
              }}>
                {t('btnVisitFoh')} <ExternalLink size={14} />
              </button>
            </a>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{
                padding: '14px 28px', fontSize: 15,
              }}>
                {t('btnSeePricing')} <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Foundation spotlight ─────────────────────────────────────────────── */}
      <section style={{ padding: '40px 32px 0', maxWidth: 980, margin: '0 auto' }}>
        <div
          className="zg-panel"
          style={{
            padding: 'clamp(28px, 4vw, 44px)',
            position: 'relative',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 240px) 1fr',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, bottom: 0,
              width: 4,
              background: `linear-gradient(180deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
            }}
          />

          {/* Proud Supporter badge — official mark from the Folds of Honor partner
              kit. See assets/branding/README for source. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#ffffff', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 20, minHeight: 220,
          }}>
            <Image
              src="/folds-of-honor-proud-supporter.png"
              alt={t('proudSupporterAlt')}
              width={260}
              height={260}
              style={{ width: '100%', height: 'auto', maxWidth: 260, objectFit: 'contain' }}
            />
          </div>

          <div>
            <div
              className="zg-eyebrow"
              style={{ display: 'inline-block', color: C.amber, marginBottom: 18 }}
            >
              {t('spotlightEyebrow')}
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: text, margin: '0 0 14px', lineHeight: 1.2 }}>
              {t('spotlightTitle')}
            </h2>
            <p style={{ fontSize: 'clamp(15px, 1.8vw, 17px)', color: subtext, lineHeight: 1.75, margin: '0 0 14px' }}>
              {t('spotlightPara1')}
            </p>
            <p style={{ fontSize: 14, color: subtext, lineHeight: 1.7, margin: 0 }}>
              {t('spotlightPara2')}
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeading
          eyebrow={t('howEyebrow')}
          title={t('howTitle')}
          sub={t('howSub', { pct: DONATION_PCT })}
          color={C.green}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <InfoCard isDark={isDark}
            icon={Receipt}
            title={t('card1Title')}
            body={t('card1Body', { pct: DONATION_PCT })}
            color={C.amber}
          />
          <InfoCard isDark={isDark}
            icon={CalendarCheck}
            title={t('card2Title')}
            body={t('card2Body')}
            color={C.green}
          />
          <InfoCard isDark={isDark}
            icon={Shield}
            title={t('card3Title')}
            body={t('card3Body', { pct: DONATION_PCT })}
            color={C.amber}
          />
        </div>
      </section>

      {/* ── Why this matters ─────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 32px',
        background: isDark
          ? `linear-gradient(180deg, transparent 0%, ${C.card}33 50%, transparent 100%)`
          : 'linear-gradient(180deg, transparent 0%, var(--border-subtle) 50%, transparent 100%)',
      }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40, alignItems: 'center' }}>
          <div>
            <div className="zg-eyebrow" style={{
              display: 'inline-block', color: C.amber, marginBottom: 20,
            }}>
              {t('whyEyebrow')}
            </div>
            <h2 style={{
              fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800,
              color: text, margin: '0 0 20px', lineHeight: 1.2, letterSpacing: '-0.5px',
            }}>
              {t('whyTitle')}
            </h2>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8, margin: '0 0 18px' }}>
              {t('whyPara1')}
            </p>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8 }}>
              {t('whyPara2')}
            </p>
          </div>

          <div className="zg-panel" style={{ padding: 28 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: C.green, marginBottom: 6,
            }}>
              {t('flowLabel')}
            </div>
            <div style={{ fontSize: 13, color: subtext, marginBottom: 18 }}>
              {t('flowUpdated')}
            </div>

            <div style={{ padding: '20px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('totalDonatedLabel')}
              </div>
              <div style={{ fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: 900, color: C.amber, letterSpacing: '-1px', lineHeight: 1.1 }}>
                {formatUsd(totals.totalDonatedUsd)}
              </div>
              <div style={{ fontSize: 13, color: subtext, marginTop: 6 }}>
                {t(totals.donationsCount === 1 ? 'donationsCountSingular' : 'donationsCountPlural', { count: totals.donationsCount })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 0', borderBottom: `1px solid ${C.border}` }}>
              <HandHeart size={24} strokeWidth={1.75} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>
                  {hasDonations ? t('lastDonationLabel') : t('firstDonationPendingLabel')}
                </div>
                <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>
                  {hasDonations
                    ? t('lastDonationBody', {
                        amount: formatUsd(totals.lastDonation!.amountUsd),
                        date: formatDate(totals.lastDonation!.donatedAtIso),
                        quarter: totals.lastDonation!.quarter,
                      })
                    : t('noDonationsYet')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 0 4px' }}>
              <CalendarCheck size={24} strokeWidth={1.75} style={{ color: C.amber, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>
                  {t('nextDonationLabel')}
                </div>
                <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>
                  {t('nextDonationBody', { date: formatShortDate(totals.nextDonationAtIso) })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Donate directly (QR + boilerplate) ──────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading
          eyebrow={t('donateEyebrow')}
          title={t('donateTitle')}
          sub={t('donateSub', { pct: DONATION_PCT })}
          color={C.amber}
        />

        <div className="zg-panel" style={{
          padding: 'clamp(28px, 4vw, 44px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 260px) 1fr',
          gap: 40,
          alignItems: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#ffffff', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 16,
          }}>
            <Image
              src="/folds-of-honor-donation-qr.png"
              alt={t('qrAlt')}
              width={260}
              height={260}
              style={{ width: '100%', height: 'auto', maxWidth: 260, objectFit: 'contain' }}
            />
          </div>

          <div>
            <div
              className="zg-eyebrow"
              style={{ display: 'inline-block', color: C.amber, marginBottom: 14 }}
            >
              {t('aboutEyebrow')}
            </div>
            <p style={{ fontSize: 14, color: subtext, lineHeight: 1.75, margin: '0 0 18px' }}>
              {t('aboutPara')}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={FOH_DONATION_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <button className="zg-btn zg-btn--primary" style={{ padding: '12px 22px', fontSize: 14 }}>
                  <Heart size={14} /> {t('btnDonateDirectly')}
                </button>
              </a>
              <a href={FOH_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <button className="zg-btn zg-btn--secondary" style={{ padding: '12px 22px', fontSize: 14 }}>
                  <ExternalLink size={14} /> foldsofhonor.org
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 900, margin: '0 auto' }}>
        <SectionHeading
          eyebrow={t('faqEyebrow')}
          title={t('faqTitle')}
          sub={t('faqSub')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FAQItem isDark={isDark}
            q={t('faq1Q', { pct: DONATION_PCT })}
            a={t('faq1A', { pct: DONATION_PCT })}
          />
          <FAQItem isDark={isDark}
            q={t('faq2Q')}
            a={t('faq2A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq3Q')}
            a={t('faq3A', { pct: DONATION_PCT })}
          />
          <FAQItem isDark={isDark}
            q={t('faq4Q')}
            a={
              <>
                {t('faq4A1')}{' '}
                <a
                  href={FOH_DONATION_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: C.amber, fontWeight: 600, textDecoration: 'none' }}
                >
                  foldsofhonorpartners.donorsupport.co/page/ZeroGX
                </a>
                {t('faq4A2')}
              </>
            }
          />
          <FAQItem isDark={isDark}
            q={t('faq5Q')}
            a={t('faq5A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq6Q')}
            a={t('faq6A', { pct: DONATION_PCT })}
          />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{
        padding: '100px 32px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 700, height: 400,
          background: `radial-gradient(ellipse, ${C.amber}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 900,
            color: text, margin: '0 0 16px', letterSpacing: '-1px', lineHeight: 1.1,
          }}>
            {t('ctaTitlePre')}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              {t('ctaTitleHighlight')}
            </span>
          </h2>
          <p style={{ fontSize: 18, color: subtext, margin: '0 auto 40px', maxWidth: 560, lineHeight: 1.65 }}>
            {t('ctaSub')}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{
                padding: '16px 40px', fontSize: 15,
              }}>
                {t('btnSeePricing')} <ArrowRight size={18} />
              </button>
            </Link>
            <a href={FOH_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{
                padding: '16px 32px', fontSize: 16,
              }}>
                <ExternalLink size={16} /> {t('btnLearnAboutFoh')}
              </button>
            </a>
          </div>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
