'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import { ArrowRight, CheckCircle2, Moon, Sparkles, Sun } from 'lucide-react';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

type TierCardProps = {
  title: string;
  price: string;
  original?: string;
  highlight?: string;
  features: string[];
  accent: string;
};

function TierCard({ title, price, original, highlight, features, accent }: TierCardProps) {
  return (
    <article
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${accent}66`,
        borderRadius: 18,
        padding: 28,
        boxShadow: `0 12px 40px ${accent}20`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.light }}>{title}</h3>
        {highlight && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              border: `1px solid ${accent}66`,
              color: accent,
              borderRadius: 999,
              padding: '4px 10px',
            }}
          >
            {highlight}
          </span>
        )}
      </div>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        {original && (
          <span style={{ fontSize: 20, color: C.muted, textDecoration: 'line-through' }}>
            {original}
          </span>
        )}
        <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', color: C.light }}>{price}</span>
      </div>

      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, lineHeight: 1.55 }}>
            <CheckCircle2 size={18} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function PricingPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{ background: 'transparent', color: C.light, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: `${isDark ? 'var(--color-bg)' : 'var(--color-bg)'}ee`,
          borderBottom: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/" className="h-full flex items-center overflow-hidden flex-shrink-0" style={{ textDecoration: 'none', lineHeight: 0 }}>
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
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Link href="/about" style={{ textDecoration: 'none' }}>
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
              About
            </button>
          </Link>
        </div>
      </nav>

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
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
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
              <Sparkles size={14} /> Price Tiers
            </div>
            <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
              Clear Tiers. Institutional-Grade Value.
            </h1>
            <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 18, lineHeight: 1.7 }}>
              Choose the ZeroGEX access level that fits your workflow. Upgrade at any time to unlock deeper signal intelligence and API workflows.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            <TierCard
              title="Basic"
              original="$25/mo"
              price="$0/mo"
              highlight="Free (For Limited Time)"
              accent="var(--heat-mid)"
              features={[
                'Access to all real-time metrics.',
                'Full strategy tools coverage.',
                'Designed for disciplined daily execution.',
              ]}
            />
            <TierCard
              title="Pro"
              original="$45/mo"
              price="$29/mo"
              highlight="Coming Soon"
              accent="var(--color-brand-primary)"
              features={[
                'Everything included in Basic.',
                'Access to Proprietary Signals.',
                'Direct access to ZeroGEX APIs.',
              ]}
            />
            <TierCard
              title="Elite"
              original="$65/mo"
              price="$39/mo"
              highlight="Coming Soon"
              accent="var(--color-brand-accent)"
              features={[
                'Everything included in Pro.',
                'Access to Advanced Signals.',
                'Built for high-conviction, high-frequency decision loops.',
              ]}
            />
          </div>

          <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center' }}>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 28px',
                  color: 'var(--text-inverse)',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Get Started <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
