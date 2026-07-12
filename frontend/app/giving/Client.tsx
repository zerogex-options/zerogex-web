'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
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
function FAQItem({ q, a, isDark = true }: { q: string; a: string; isDark?: boolean }) {
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
            <Heart size={12} /> Giving Back
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 68px)', fontWeight: 900,
            lineHeight: 1.08, letterSpacing: '-2px', margin: '0 0 24px', color: text,
          }}>
            {DONATION_PCT}% of every subscription supports{' '}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              military families
            </span>
          </h1>
          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)', color: subtext,
            lineHeight: 1.7, maxWidth: 680, margin: '0 auto 36px',
          }}>
            ZeroGEX donates {DONATION_PCT}% of every subscription to Folds of Honor — funding
            educational scholarships for the spouses and children of fallen and disabled
            U.S. service members.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={FOH_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{
                padding: '14px 28px', fontSize: 15,
              }}>
                Visit Folds of Honor <ExternalLink size={14} />
              </button>
            </a>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{
                padding: '14px 28px', fontSize: 15,
              }}>
                See Pricing <ArrowRight size={14} />
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

          {/* Logo block — swap /folds-of-honor-logo.svg with the official asset once approved */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#ffffff', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 24, minHeight: 160,
          }}>
            <Image
              src="/folds-of-honor-logo.svg"
              alt="Folds of Honor"
              width={200}
              height={200}
              style={{ width: '100%', height: 'auto', maxHeight: 200, objectFit: 'contain' }}
            />
          </div>

          <div>
            <div
              className="zg-eyebrow"
              style={{ display: 'inline-block', color: C.amber, marginBottom: 18 }}
            >
              Our Charity Partner
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: text, margin: '0 0 14px', lineHeight: 1.2 }}>
              Folds of Honor
            </h2>
            <p style={{ fontSize: 'clamp(15px, 1.8vw, 17px)', color: subtext, lineHeight: 1.75, margin: '0 0 14px' }}>
              Founded in 2007 by Lt. Col. Dan Rooney — an Air Force F-16 pilot and PGA
              professional — Folds of Honor provides educational scholarships to the spouses
              and children of military service members and first responders who have fallen
              or been disabled while serving the United States.
            </p>
            <p style={{ fontSize: 14, color: subtext, lineHeight: 1.7, margin: 0 }}>
              Since 2007, Folds of Honor has awarded more than 60,000 scholarships totaling
              over $260 million. The organization holds a 4-star rating from Charity
              Navigator and is a registered 501(c)(3) non-profit (EIN 20-8551032).
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="How It Works"
          title="A clean, transparent pledge"
          sub={`${DONATION_PCT}% of every ZeroGEX subscription — gross of taxes and processing fees — is set aside automatically and donated to Folds of Honor each quarter.`}
          color={C.green}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <InfoCard isDark={isDark}
            icon={Receipt}
            title="Calculated per subscription"
            body={`Every paid plan — monthly or annual, founding or standard — contributes ${DONATION_PCT}% of its revenue to the pool. The allocation is tracked in our billing system on each successful Stripe invoice.`}
            color={C.amber}
          />
          <InfoCard isDark={isDark}
            icon={CalendarCheck}
            title="Donated quarterly"
            body="At the end of every calendar quarter we total the contributions and send a single donation to Folds of Honor. We publish the receipt and the running total on this page."
            color={C.green}
          />
          <InfoCard isDark={isDark}
            icon={Shield}
            title="No price increase"
            body={`The donation comes out of ZeroGEX's revenue, not yours. You pay the same subscription price you would otherwise — and ${DONATION_PCT}% of it routes to Folds of Honor.`}
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
              Why Education
            </div>
            <h2 style={{
              fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800,
              color: text, margin: '0 0 20px', lineHeight: 1.2, letterSpacing: '-0.5px',
            }}>
              Knowledge changes outcomes
            </h2>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8, margin: '0 0 18px' }}>
              ZeroGEX exists because we believe that better information leads to better
              decisions. The same belief is at the heart of Folds of Honor — every scholarship
              they fund opens doors for a military family that has already paid an
              extraordinary price.
            </p>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8 }}>
              Every subscription on ZeroGEX helps fund a scholarship. It is the cleanest
              alignment we could find between what we build and what we believe.
            </p>
          </div>

          <div className="zg-panel" style={{ padding: 28 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: C.green, marginBottom: 6,
            }}>
              ZeroGEX → Folds of Honor
            </div>
            <div style={{ fontSize: 13, color: subtext, marginBottom: 18 }}>
              Updated each quarter after the donation clears.
            </div>

            <div style={{ padding: '20px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Total donated to date
              </div>
              <div style={{ fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: 900, color: C.amber, letterSpacing: '-1px', lineHeight: 1.1 }}>
                {formatUsd(totals.totalDonatedUsd)}
              </div>
              <div style={{ fontSize: 13, color: subtext, marginTop: 6 }}>
                Across {totals.donationsCount} {totals.donationsCount === 1 ? 'quarterly donation' : 'quarterly donations'} from ZeroGEX subscribers.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 0', borderBottom: `1px solid ${C.border}` }}>
              <HandHeart size={24} strokeWidth={1.75} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>
                  {hasDonations ? 'Last donation' : 'First donation pending'}
                </div>
                <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>
                  {hasDonations
                    ? `${formatUsd(totals.lastDonation!.amountUsd)} sent on ${formatDate(totals.lastDonation!.donatedAtIso)} (${totals.lastDonation!.quarter}).`
                    : 'No donations have cleared yet — we publish the first quarterly receipt here as soon as it ships.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 0 4px' }}>
              <CalendarCheck size={24} strokeWidth={1.75} style={{ color: C.amber, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>
                  Next donation
                </div>
                <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>
                  Scheduled for {formatShortDate(totals.nextDonationAtIso)} — covering the current calendar quarter.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 900, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions"
          sub="The mechanics of the pledge and where the money goes."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FAQItem isDark={isDark}
            q={`Is the ${DONATION_PCT}% calculated on gross revenue or profit?`}
            a={`We calculate ${DONATION_PCT}% on gross subscription revenue, before taxes and payment-processing fees. We chose gross revenue (rather than profit) because it is unambiguous, easy to audit from our Stripe invoices, and removes any incentive to "creative-accounting" the donation downward.`}
          />
          <FAQItem isDark={isDark}
            q="How often do you donate?"
            a="We tally contributions monthly and send one consolidated donation to Folds of Honor at the end of each calendar quarter. After each donation we update the running total on this page and post the receipt to social media."
          />
          <FAQItem isDark={isDark}
            q="Does my subscription cost more because of the donation?"
            a={`No. The ${DONATION_PCT}% comes out of ZeroGEX's share of the revenue, not yours. You pay the same price you would otherwise — we simply earn slightly less per subscription so that Folds of Honor earns more.`}
          />
          <FAQItem isDark={isDark}
            q="Can I get a tax receipt for the donation?"
            a="No — the donation is made by ZeroGEX, not by you, so the receipt is issued to ZeroGEX. If you would like to make a personal tax-deductible donation directly to Folds of Honor in addition to your subscription, you can do so at foldsofhonor.org."
          />
          <FAQItem isDark={isDark}
            q="Why Folds of Honor specifically?"
            a="Folds of Honor combines mission alignment (education is how we believe outcomes change), proven impact (over 60,000 scholarships, $260M+ distributed), and top-tier accountability (4-star Charity Navigator rating). The organization was founded by a serving Air Force fighter pilot, and the educational focus pairs cleanly with what ZeroGEX is — a platform for traders who want to learn the market better than the people on the other side of their trades."
          />
          <FAQItem isDark={isDark}
            q="Will the donation percentage change in the future?"
            a={`The current pledge is ${DONATION_PCT}% of gross subscription revenue. We may raise this percentage over time, but we will never lower it without a clear explanation here. Any change will be announced on this page and on our social channels in advance.`}
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
            Subscribe, trade,{' '}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              and give back
            </span>
          </h2>
          <p style={{ fontSize: 18, color: subtext, margin: '0 auto 40px', maxWidth: 560, lineHeight: 1.65 }}>
            Every ZeroGEX subscription helps fund a scholarship for a military family.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{
                padding: '16px 40px', fontSize: 15,
              }}>
                See Pricing <ArrowRight size={18} />
              </button>
            </Link>
            <a href={FOH_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{
                padding: '16px 32px', fontSize: 16,
              }}>
                <ExternalLink size={16} /> Learn about Folds of Honor
              </button>
            </a>
          </div>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
