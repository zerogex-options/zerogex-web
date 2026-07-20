'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './Client.i18n';
import {
  ArrowRight,
  BarChart2,
  Activity,
  Zap,
  Target,
  Eye,
  Calculator,
  Layers,
  Shield,
  Clock,
  Code2,
  BookOpen,
  ExternalLink,
  TrendingUp,
  Database,
  Cpu,
  Globe,
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

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub, color = C.amber }: {
  eyebrow: string; title: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 56 }}>
      <div className="zg-eyebrow" style={{ color, marginBottom: 16, fontSize: 12 }}>
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
      <div style={{ marginBottom: 16 }}>
        <Icon size={24} strokeWidth={1.75} style={{ color }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.light, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{body}</div>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FAQItem({ q, a, isDark = true }: { q: string; a: string; isDark?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: `1px solid ${open ? C.amber + '40' : C.border}`,
      borderRadius: 'var(--radius-panel)', overflow: 'hidden',
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

// ── API link row ──────────────────────────────────────────────────────────────
function APILink({ href, label, desc, isDark = true }: { href: string; label: string; desc: string; isDark?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '18px 22px', borderRadius: 'var(--radius-panel)',
        background: 'var(--bg-card)', border: `1px solid ${C.border}`,
        transition: 'all 0.2s', cursor: 'pointer',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = C.amber + '50';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = C.border;
        }}
      >
        <ExternalLink size={20} strokeWidth={1.75} style={{ color: C.amber, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.light, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{desc}</div>
        </div>
        <ArrowRight size={16} style={{ color: C.muted }} />
      </div>
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AboutPage() {
  const t = usePageT(dict);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(var(--border-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }} />
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '40%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 800, height: 500,
          background: `radial-gradient(ellipse, ${C.green}12 0%, transparent 70%)`,
          zIndex: 0, pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 800 }}>
          <div className="zg-eyebrow" style={{ color: C.green, marginBottom: 24, fontSize: 12 }}>
            {t('aboutEyebrow')}
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900,
            lineHeight: 1.08, letterSpacing: '-2px', margin: '0 0 24px', color: text,
          }}>
            {t('heroTitle')}{' '}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              {t('heroTitleHighlight')}
            </span>
          </h1>
          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)', color: subtext,
            lineHeight: 1.7, maxWidth: 640, margin: '0 auto 36px',
          }}>
            {t('heroSub')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{ fontSize: 15, padding: '14px 28px' }}>
                {t('btnOpenDashboard')} <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{ fontSize: 15, padding: '14px 28px' }}>
                {t('btnViewPriceTiers')} <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          <div style={{ marginTop: 48, maxWidth: 560, marginInline: 'auto' }}>
            <div className="zg-eyebrow" style={{ color: C.amber, textAlign: 'center', marginBottom: 18, fontSize: 12 }}>
              {t('whyEyebrow')}
            </div>
            <div className="zg-panel" style={{ overflow: 'hidden', textAlign: 'left' }}>
              {[
                { icon: Target, text: t('why1') },
                { icon: Activity, text: t('why2') },
                { icon: Eye, text: t('why3') },
                { icon: Shield, text: t('why4') },
              ].map((w, i) => {
                const Icon = w.icon;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'center',
                      padding: '16px 22px',
                      borderTop: i > 0 ? `1px solid ${C.border}` : undefined,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.75} style={{ color: C.amber, flexShrink: 0 }} />
                    <span style={{ color: text, fontSize: 15.5, lineHeight: 1.5 }}>{w.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Founder Intro ────────────────────────────────────────────────────── */}
      <section style={{ padding: '40px 32px 0', maxWidth: 880, margin: '0 auto' }}>
        <div
          className="zg-panel"
          style={{
            padding: 'clamp(28px, 4vw, 44px)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, bottom: 0,
              width: 3,
              background: C.amber,
            }}
          />
          <div className="zg-eyebrow" style={{ color: C.amber, marginBottom: 18, fontSize: 12 }}>
            {t('aboutEyebrow')}
          </div>
          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: text, lineHeight: 1.75, margin: 0 }}>
            {t('founderIntro')}
          </p>
        </div>
      </section>

      {/* ── Mission ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 40, alignItems: 'center',
        }}>
          <div>
            <div className="zg-eyebrow" style={{ color: C.amber, marginBottom: 20, fontSize: 12 }}>
              {t('missionEyebrow')}
            </div>
            <h2 style={{
              fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800,
              color: text, margin: '0 0 20px', lineHeight: 1.2, letterSpacing: '-0.5px',
            }}>
              {t('missionTitle')}{' '}
              <span style={{ color: C.amber }}>{t('missionTitleHighlight')}</span>
            </h2>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8, margin: '0 0 18px' }}>
              {t('missionP1')}
            </p>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8, margin: '0 0 18px' }}>
              {t('missionP2')}
            </p>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8 }}>
              {t('missionP3')}
            </p>
          </div>

          <div className="zg-panel" style={{ padding: '28px 28px 12px' }}>
            {[
              { icon: Shield, label: t('missionItem1Label'), desc: t('missionItem1Desc'), color: C.amber },
              { icon: Clock,  label: t('missionItem2Label'), desc: t('missionItem2Desc'), color: C.green },
              { icon: Globe,  label: t('missionItem3Label'), desc: t('missionItem3Desc'), color: C.amber },
              { icon: Cpu,    label: t('missionItem4Label'), desc: t('missionItem4Desc'), color: C.green },
            ].map((item) => (
              <div key={item.label} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                padding: '16px 0', borderBottom: `1px solid ${C.border}`,
              }}>
                <item.icon size={20} strokeWidth={1.75} style={{ color: item.color, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Giving Back callout ──────────────────────────────────────────────── */}
      <section style={{ padding: '20px 32px 60px', maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/giving" style={{ textDecoration: 'none', display: 'block' }}>
          <div className="zg-panel" style={{
            padding: 'clamp(20px, 3vw, 28px)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 'clamp(16px, 3vw, 24px)',
            alignItems: 'center',
            borderColor: `${C.amber}40`,
            transition: 'border-color 0.2s',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 4, flexShrink: 0,
              border: `1px solid ${C.border}`,
            }}>
              <Image
                src="/folds-of-honor-proud-supporter.png"
                alt={t('givingAlt')}
                width={64}
                height={64}
                style={{ width: 64, height: 64, objectFit: 'contain' }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="zg-eyebrow" style={{ color: C.amber, marginBottom: 6, fontSize: 11 }}>
                {t('givingAlt')}
              </div>
              <div style={{ fontSize: 'clamp(15px, 1.8vw, 17px)', fontWeight: 700, color: text, marginBottom: 4 }}>
                {t('givingHeadline')}
              </div>
              <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>
                {t('givingDesc')}
              </div>
            </div>
            <ArrowRight size={20} style={{ color: C.amber, flexShrink: 0 }} />
          </div>
        </Link>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 32px',
        background: isDark
          ? `linear-gradient(180deg, transparent 0%, ${C.card}33 50%, transparent 100%)`
          : 'linear-gradient(180deg, transparent 0%, var(--border-subtle) 50%, transparent 100%)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeading
            eyebrow={t('howEyebrow')}
            title={t('howTitle')}
            sub={t('howSub')}
            color={C.green}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <InfoCard isDark={isDark}
              icon={Database}
              title={t('infoCard1Title')}
              body={t('infoCard1Body')}
              color={C.amber}
            />
            <InfoCard isDark={isDark}
              icon={Cpu}
              title={t('infoCard2Title')}
              body={t('infoCard2Body')}
              color={C.green}
            />
            <InfoCard isDark={isDark}
              icon={TrendingUp}
              title={t('infoCard3Title')}
              body={t('infoCard3Body')}
              color={C.amber}
            />
            <InfoCard isDark={isDark}
              icon={Activity}
              title={t('infoCard4Title')}
              body={t('infoCard4Body')}
              color={C.green}
            />
            <InfoCard isDark={isDark}
              icon={Zap}
              title={t('infoCard5Title')}
              body={t('infoCard5Body')}
              color={C.amber}
            />
            <InfoCard isDark={isDark}
              icon={BarChart2}
              title={t('infoCard6Title')}
              body={t('infoCard6Body')}
              color={C.green}
            />
          </div>
        </div>
      </section>

      {/* ── Platform modules ─────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeading
          eyebrow={t('platformEyebrow')}
          title={t('platformTitle')}
          sub={t('platformSub')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {[
            {
              icon: BarChart2, href: '/dashboard', label: t('module1Label'), color: C.amber,
              desc: t('module1Desc'),
            },
            {
              icon: Zap, href: '/trading-signals', label: t('module2Label'), color: C.green,
              desc: t('module2Desc'),
            },
            {
              icon: Activity, href: '/flow-analysis', label: t('module3Label'), color: C.amber,
              desc: t('module3Desc'),
            },
            {
              icon: BarChart2, href: '/gamma-exposure', label: t('module4Label'), color: C.green,
              desc: t('module4Desc'),
            },
            {
              icon: Target, href: '/intraday-tools', label: t('module5Label'), color: C.amber,
              desc: t('module5Desc'),
            },
            {
              icon: Eye, href: '/max-pain', label: t('module6Label'), color: C.red,
              desc: t('module6Desc'),
            },
            {
              icon: Calculator, href: '/options-calculator', label: t('module7Label'), color: C.amber,
              desc: t('module7Desc'),
            },
            {
              icon: Layers, href: '/greeks-gex', label: t('module8Label'), color: C.green,
              desc: t('module8Desc'),
            },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="zg-panel" style={{
                padding: '22px 20px',
                display: 'flex', gap: 16, alignItems: 'flex-start',
                transition: 'border-color 0.2s', cursor: 'pointer',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = item.color + '80';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '';
                }}
              >
                <item.icon size={24} strokeWidth={1.75} style={{ color: item.color, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.light, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.label}
                    <ArrowRight size={13} style={{ color: item.color, opacity: 0.7 }} />
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{item.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── API Documentation ────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 32px',
        background: isDark
          ? `linear-gradient(180deg, transparent 0%, ${C.card}22 100%)`
          : 'linear-gradient(180deg, transparent 0%, var(--border-subtle) 100%)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeading
            eyebrow={t('apiEyebrow')}
            title={t('apiTitle')}
            sub={t('apiSub')}
            color={C.green}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 40 }}>
            <APILink isDark={isDark}
              href="https://api.zerogex.io/docs"
              label={t('apiLink1Label')}
              desc={t('apiLink1Desc')}
            />
            <APILink isDark={isDark}
              href="https://api.zerogex.io/redoc"
              label={t('apiLink2Label')}
              desc={t('apiLink2Desc')}
            />
            <APILink isDark={isDark}
              href="https://api.zerogex.io/openapi.json"
              label={t('apiLink3Label')}
              desc={t('apiLink3Desc')}
            />
          </div>

          <div className="zg-panel" style={{ padding: '32px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Code2 size={24} strokeWidth={1.75} style={{ color: C.green, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.light }}>{t('sampleEndpointsTitle')}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{t('sampleEndpointsDesc')}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {[
                { method: 'GET', path: '/api/gex/summary', desc: t('ep1Desc') },
                { method: 'GET', path: '/api/gex/by-strike', desc: t('ep2Desc') },
                { method: 'GET', path: '/api/gex/profile', desc: t('ep3Desc') },
                { method: 'GET', path: '/api/gex/historical-context', desc: t('ep4Desc') },
                { method: 'GET', path: '/api/market/quote', desc: t('ep5Desc') },
                { method: 'GET', path: '/api/market/volatility', desc: t('ep6Desc') },
                { method: 'GET', path: '/api/flow/smart-money', desc: t('ep7Desc') },
                { method: 'GET', path: '/api/flow/series', desc: t('ep8Desc') },
                { method: 'GET', path: '/api/max-pain/current', desc: t('ep9Desc') },
                { method: 'GET', path: '/api/signals/score', desc: t('ep10Desc') },
                { method: 'GET', path: '/api/signals/basic', desc: t('ep11Desc') },
                { method: 'GET', path: '/api/signals/advanced/squeeze-setup', desc: t('ep12Desc') },
                { method: 'GET', path: '/api/technicals/dealer-hedging', desc: t('ep13Desc') },
                { method: 'GET', path: '/api/tools/option-calculator', desc: t('ep14Desc') },
              ].map((ep) => (
                <div key={ep.path} style={{
                  background: isDark ? `${C.bgDark}cc` : 'var(--bg-hover)', border: `1px solid ${C.border}`,
                  borderRadius: 'var(--radius-panel)', padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: C.green,
                      background: `${C.green}20`, border: `1px solid ${C.green}30`,
                      borderRadius: 'var(--radius-panel)', padding: '2px 7px', letterSpacing: '0.05em',
                    }}>
                      {ep.method}
                    </span>
                    <code style={{ fontSize: 12, color: C.amber, fontFamily: 'monospace' }}>{ep.path}</code>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{ep.desc}</div>
                </div>
              ))}
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
            q={t('faq1Q')}
            a={t('faq1A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq2Q')}
            a={t('faq2A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq3Q')}
            a={t('faq3A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq4Q')}
            a={t('faq4A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq5Q')}
            a={t('faq5A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq6Q')}
            a={t('faq6A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq7Q')}
            a={t('faq7A')}
          />
          <FAQItem isDark={isDark}
            q={t('faq8Q')}
            a={t('faq8A')}
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
            fontSize: 'clamp(28px, 4.5vw, 52px)', fontWeight: 900,
            color: text, margin: '0 0 16px', letterSpacing: '-1px', lineHeight: 1.1,
          }}>
            {t('ctaTitle')}{' '}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              {t('ctaTitleHighlight')}
            </span>
          </h2>
          <p style={{ fontSize: 18, color: subtext, margin: '0 auto 40px', maxWidth: 500, lineHeight: 1.65 }}>
            {t('ctaSub')}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{ padding: '16px 40px', fontSize: 15 }}>
                {t('btnLaunchDashboard')} <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{ padding: '16px 32px', fontSize: 14 }}>
                <BookOpen size={16} /> {t('btnReviewTierAccess')}
              </button>
            </Link>
          </div>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
