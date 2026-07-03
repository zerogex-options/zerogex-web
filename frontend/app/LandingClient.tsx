'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Activity,
  Zap,
  Target,
  Eye,
  BarChart,
  Calculator,
  Layers,
  ArrowRight,
  ChevronDown,
  Shield,
  Clock,
} from 'lucide-react';

// ── Brand colors ──────────────────────────────────────────────────────────────
const C = {
  bgDark:   'var(--color-bg)',
  card:     'var(--color-surface)',
  cardHover:'var(--bg-hover)',
  light:    'var(--color-text-primary)',
  muted:    'var(--color-text-secondary)',
  amber:    'var(--color-brand-primary)',
  green:    'var(--color-positive)',
  red:      'var(--color-negative)',
  border:   'var(--border-default)',
  glow:     'var(--color-warning-soft)',
};

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ target, prefix = '', suffix = '', decimals = 0 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1400;
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setValue(parseFloat((ease * target).toFixed(decimals)));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, decimals]);

  return (
    <span ref={ref}>
      {prefix}{decimals > 0 ? value.toFixed(decimals) : Math.round(value)}{suffix}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, isDark = true }: { label: string; value: React.ReactNode; sub?: string; isDark?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: '28px 24px',
        textAlign: 'center',
      }}
    >
      <div
        className="zg-h2"
        style={{ color: 'var(--color-accent-hot)', letterSpacing: '-0.02em', lineHeight: 1 }}
      >
        {value}
      </div>
      <div className="zg-body" style={{ fontWeight: 600, marginTop: 8 }}>{label}</div>
      {sub && <div className="zg-caption" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon, title, description, color = C.amber, isDark = true,
}: {
  icon: React.ElementType; title: string; description: string; color?: string; isDark?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? color + '55' : C.border}`,
        borderRadius: 16,
        padding: '28px 24px',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 16px 40px var(--color-info-soft), 0 0 24px ${color}25` : '0 4px 16px var(--color-info-soft)',
        cursor: 'default',
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${color}20`,
          border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          transition: 'all 0.25s ease',
          boxShadow: hovered ? `0 0 16px ${color}40` : 'none',
        }}
      >
        <Icon size={22} style={{ color }} />
      </div>
      <div className="zg-h4" style={{ marginBottom: 8 }}>{title}</div>
      <div className="zg-small" style={{ lineHeight: 1.6 }}>{description}</div>
    </div>
  );
}

// ── Tool pill ─────────────────────────────────────────────────────────────────
function ToolPill({ href, icon: Icon, label, color = C.amber, isDark = true }: {
  href: string; icon: React.ElementType; label: string; color?: string; isDark?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px',
          borderRadius: 12,
          background: hovered ? `${color}18` : 'var(--bg-card)',
          border: `1px solid ${hovered ? color + '60' : C.border}`,
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          transform: hovered ? 'translateY(-2px)' : 'none',
        }}
      >
        <Icon size={16} style={{ color: hovered ? color : C.muted }} />
        <span className="zg-small" style={{ fontWeight: 600, color: hovered ? C.light : C.muted }}>{label}</span>
        <ArrowRight size={12} style={{ color: hovered ? color : 'transparent', marginLeft: 'auto', transition: 'all 0.2s' }} />
      </div>
    </Link>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 56 }}>
      <span
        className="zg-label"
        style={{
          display: 'inline-block',
          color: 'var(--color-accent-hot)',
          background: 'var(--color-accent-soft)',
          border: '1px solid var(--color-accent-soft)',
          borderRadius: 100,
          padding: '4px 14px',
          marginBottom: 16,
        }}
      >
        {eyebrow}
      </span>
      <h2
        className="zg-h1"
        style={{ margin: 0, color: 'var(--text-primary)' }}
      >
        {title}
      </h2>
      {sub && (
        <p
          className="zg-lead"
          style={{ marginTop: 14, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const bg     = 'transparent';
  const text   = isDark ? C.light  : 'var(--color-text-primary)';
  const subtext = 'var(--color-text-secondary)';

  const { data: spyQuote } = useMarketQuote('SPY', 60000);
  const { data: spxQuote } = useMarketQuote('SPX', 60000);
  const { data: qqqQuote } = useMarketQuote('QQQ', 60000);
  const { data: spyGex } = useGEXSummary('SPY', 60000);
  // Dealer gamma AT SPOT (sign-consistent with the gamma flip), not the
  // chain-wide total. Falls back to the total until the backend writes it.
  const spyNetGexAtSpot = spyGex?.net_gex_at_spot ?? spyGex?.net_gex ?? null;

  const formatPrice = (value?: number | null, decimals = 2) => (value != null ? value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '--');
  const formatSigned = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatDollarCompact = (value?: number | null) => {
    if (value == null) return '--';
    const abs = Math.abs(value);
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const tickerItems = useMemo(() => {
    const buildQuoteItem = (symbol: string, close?: number | null, open?: number | null) => {
      if (close == null || open == null || open === 0) {
        return { symbol, price: '--', change: '--', pct: '--', up: true };
      }
      const change = close - open;
      const pct = (change / open) * 100;
      return {
        symbol,
        price: formatPrice(close),
        change: formatSigned(change),
        pct: formatPct(pct),
        up: change >= 0,
      };
    };

    const gexPositive = (spyNetGexAtSpot ?? 0) >= 0;
    const pcr = spyGex?.put_call_ratio;
    const pcrBias = pcr == null ? 'Neutral' : pcr >= 1.2 ? 'Bearish' : pcr <= 0.8 ? 'Bullish' : 'Neutral';

    return [
      buildQuoteItem('SPY', spyQuote?.close, spyQuote?.open),
      buildQuoteItem('SPX', spxQuote?.close, spxQuote?.open),
      buildQuoteItem('QQQ', qqqQuote?.close, qqqQuote?.open),
      { symbol: 'NET GEX', price: formatDollarCompact(spyNetGexAtSpot ?? undefined), change: gexPositive ? 'Positive' : 'Negative', pct: gexPositive ? 'Bullish' : 'Bearish', up: gexPositive },
      { symbol: 'Γ FLIP', price: spyGex?.gamma_flip != null ? `$${formatPrice(spyGex.gamma_flip)}` : '--', change: 'Key Level', pct: 'Watch', up: true },
      { symbol: 'MAX PAIN', price: spyGex?.max_pain != null ? `$${formatPrice(spyGex.max_pain)}` : '--', change: '0DTE Target', pct: '', up: true },
      { symbol: 'PUT/CALL', price: pcr != null ? pcr.toFixed(2) : '--', change: 'Ratio', pct: pcrBias, up: pcrBias !== 'Bearish' },
    ];
  }, [spyQuote, spxQuote, qqqQuote, spyGex, spyNetGexAtSpot]);

  const previewMetrics = useMemo(() => {
    const putCallRatio = spyGex?.put_call_ratio ?? null;
    return [
      { label: 'Net GEX', value: formatDollarCompact(spyNetGexAtSpot ?? undefined), color: (spyNetGexAtSpot ?? 0) >= 0 ? C.green : C.red, up: (spyNetGexAtSpot ?? 0) >= 0 },
      { label: 'Gamma Flip', value: spyGex?.gamma_flip != null ? `$${formatPrice(spyGex.gamma_flip)}` : '--', color: C.amber, up: true },
      { label: 'Max Pain', value: spyGex?.max_pain != null ? `$${formatPrice(spyGex.max_pain)}` : '--', color: C.amber, up: true },
      { label: 'Call Wall', value: spyGex?.call_wall != null ? `$${formatPrice(spyGex.call_wall)}` : '--', color: C.green, up: true },
      { label: 'Put Wall', value: spyGex?.put_wall != null ? `$${formatPrice(spyGex.put_wall)}` : '--', color: C.red, up: false },
      { label: 'Put/Call', value: putCallRatio != null ? putCallRatio.toFixed(2) : '--', color: putCallRatio != null && putCallRatio > 1 ? C.red : C.amber, up: !(putCallRatio != null && putCallRatio > 1) },
    ];
  }, [spyGex, spyNetGexAtSpot]);


  return (
    <div style={{ background: bg, color: text, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      <LandingHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '100px 24px 60px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `
              linear-gradient(${isDark ? 'var(--border-subtle)' : 'var(--border-subtle)'} 1px, transparent 1px),
              linear-gradient(90deg, ${isDark ? 'var(--border-subtle)' : 'var(--border-subtle)'} 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 900, width: '100%' }}>
          {/* Badge */}
          <div
            className="zg-label"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: 'var(--color-accent-hot)',
              background: 'var(--color-accent-soft)',
              border: '1px solid var(--color-accent-soft)',
              borderRadius: 100, padding: '5px 16px',
              marginBottom: 28,
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: C.green,
                boxShadow: `0 0 6px ${C.green}`,
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }}
            />
            For SPY · SPX · QQQ day traders
          </div>

          {/* Headline — pain-first hook */}
          <h1
            className="zg-display"
            style={{ margin: '0 0 18px', color: text }}
          >
            Stop trading{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-low) 50%, var(--color-warning) 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              SPY blind.
            </span>
          </h1>

          {/* Supporting tagline — the through-line for the brand */}
          <p
            className="zg-h2"
            style={{
              color: text,
              margin: '0 auto 18px',
              maxWidth: 760,
            }}
          >
            Know the levels that matter — before SPY/SPX/QQQ get there.
          </p>

          {/* Sub-headline body */}
          <p
            className="zg-lead"
            style={{ color: subtext, maxWidth: 680, margin: '0 auto 40px' }}
          >
            ZeroGEX shows live call walls, put walls, the gamma flip, and dealer positioning — so you can see where price is likely to react, instead of guessing.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                  border: 'none', borderRadius: 14,
                  padding: '13px 22px',
                  fontSize: 15, fontWeight: 700, color: 'var(--text-inverse)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: `0 8px 32px ${C.amber}55`,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${C.amber}70`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${C.amber}55`;
                }}
              >
                View Live Dashboard <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '13px 22px',
                  fontSize: 15, fontWeight: 600,
                  color: text,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.amber + '80';
                  (e.currentTarget as HTMLElement).style.background = `${C.amber}12`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.border;
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                Learn More <ChevronDown size={16} />
              </button>
            </Link>
          </div>

          {/* Mock dashboard preview card */}
          <div
            style={{
              marginTop: 56,
              borderRadius: 20,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
              background: 'var(--bg-card)',
              boxShadow: `0 32px 80px var(--color-info-soft), 0 0 0 1px ${C.amber}20`,
              padding: 'clamp(14px, 3.5vw, 24px)',
            }}
          >
            {/* Mock metric row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                gap: 10,
              }}
            >
              {previewMetrics.map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: 'var(--bg-hover)',
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div className="zg-label" style={{ color: C.muted, marginBottom: 4 }}>
                    {m.label}
                  </div>
                  <div className="zg-h4" style={{ color: m.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {m.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker tape ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-hover)',
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: '10px 0',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <style>{`
          @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
          @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        `}</style>
        <div
          style={{
            display: 'flex', gap: 0,
            animation: 'ticker 30s linear infinite',
            width: 'max-content',
          }}
        >
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <div
              key={i}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '0 28px',
                borderRight: `1px solid ${C.border}`,
                whiteSpace: 'nowrap',
              }}
            >
              <span className="zg-label" style={{ color: C.muted }}>
                {item.symbol}
              </span>
              <span className="zg-mono" style={{ fontSize: 13, color: text }}>
                {item.price}
              </span>
              <span className="zg-caption" style={{ fontWeight: 600, color: item.up ? C.green : C.red }}>
                {item.up ? <TrendingUp size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <TrendingDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                {' '}{item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── What traders use ZeroGEX for ─────────────────────────────────────── */}
      {/* Conversion-focused use-case grid. Sits right after the ticker so a
          trader who lands on the page understands what the product DOES for
          them within the first scroll — before any "features" framing. */}
      <section
        style={{
          padding: '80px 32px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <SectionHeading
          eyebrow="What traders use ZeroGEX for"
          title="Plan trades around live positioning, not guesswork."
          sub="The dealer book sets the structural pressure that drives where price reacts. ZeroGEX surfaces it in six ways you can act on."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {[
            {
              icon: Target,
              title: 'Identify likely support and resistance',
              body: 'Use put walls and call walls as structural zones — not psychological levels — so you know where flow concentration is most likely to absorb or reject price.',
              color: C.amber,
            },
            {
              icon: BarChart2,
              title: 'Spot pinning and compression',
              body: 'See when price is being magneted toward a heavy gamma strike and the range is structurally compressed. Fade extremes, skip the middle.',
              color: C.green,
            },
            {
              icon: Activity,
              title: 'Track gamma flip regime changes',
              body: 'The flip is the line between dealer-dampening and dealer-amplifying regimes. Watch live distance from spot — when spot crosses it, the playbook flips with it.',
              color: C.amber,
            },
            {
              icon: Shield,
              title: 'Avoid chasing into major walls',
              body: 'When price runs toward a heavy call wall in a long-gamma regime, the dealer reflex is to fade. Knowing the wall is there keeps you from buying the top.',
              color: C.red,
            },
            {
              icon: Layers,
              title: 'Know when dips get absorbed vs. extended',
              body: 'Above the flip, dealer hedging tends to absorb weakness. Below the flip, the same weakness gets amplified. Same dip, opposite outcome depending on regime.',
              color: C.green,
            },
            {
              icon: Zap,
              title: 'Plan around real-time positioning',
              body: 'Levels migrate intraday as positioning rebalances. ZeroGEX shows the current structural map, not yesterday’s — so your plan stays calibrated to today’s book.',
              color: C.amber,
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: '24px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${item.color}20`,
                  border: `1px solid ${item.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                }}
              >
                <item.icon size={18} style={{ color: item.color }} />
              </div>
              <div className="zg-h4" style={{ color: text }}>
                {item.title}
              </div>
              <div className="zg-small" style={{ color: subtext }}>
                {item.body}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36, gap: 12, flexWrap: 'wrap' }}>
          <Link href="/spx-gamma-levels" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                border: 'none',
                borderRadius: 14,
                padding: '13px 24px',
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--text-inverse)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: `0 8px 32px ${C.amber}55`,
              }}
            >
              See today&apos;s free gamma levels <ArrowRight size={16} />
            </button>
          </Link>
          <Link href="/trading-mistakes" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: '13px 24px',
                fontSize: 15,
                fontWeight: 700,
                color: text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              5 mistakes ZeroGEX helps you avoid <ArrowRight size={16} />
            </button>
          </Link>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 32px',
          maxWidth: 1200, margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 20,
          }}
        >
          <StatCard isDark={isDark} label="Analytics Modules" value={<AnimatedNumber target={8} suffix="+" />} sub="Gamma, Flow, Signals & more" />
          <StatCard isDark={isDark} label="Data Refresh Rate" value={<AnimatedNumber target={1} suffix="s" />} sub="Real-time market updates" />
          <StatCard isDark={isDark} label="Options Greeks" value={<AnimatedNumber target={4} />} sub="Delta, Gamma, Theta, Vega per contract" />
          <StatCard isDark={isDark} label="Supported Symbols" value={<AnimatedNumber target={3} suffix="+" />} sub="SPY, SPX, QQQ" />
        </div>
      </section>

      {/* ── What is ZeroGEX ──────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 32px',
          maxWidth: 1200, margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 40, alignItems: 'center',
          }}
        >
          <div>
            <div
              className="zg-label"
              style={{
                display: 'inline-block',
                color: C.green, background: `${C.green}18`,
                border: `1px solid ${C.green}40`, borderRadius: 100,
                padding: '4px 14px', marginBottom: 20,
              }}
            >
              What is ZeroGEX?
            </div>
            <h2 className="zg-h1" style={{ color: text, margin: '0 0 20px' }}>
              Gamma Exposure,{' '}
              <span style={{ color: C.amber }}>Decoded</span>
            </h2>
            <p className="zg-body" style={{ color: subtext, margin: '0 0 20px' }}>
              <strong style={{ color: text }}>Gamma Exposure (GEX)</strong> is the hidden force that drives
              intraday market dynamics. When dealers sell options, they must hedge by trading the underlying —
              creating predictable price gravity and invisible walls at key levels.
            </p>
            <p className="zg-body" style={{ color: subtext, margin: '0 0 28px' }}>
              ZeroGEX surfaces these forces in real-time so you can anticipate institutional hedging flows,
              identify gamma flip levels, and time your entries with precision.
            </p>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: `${C.amber}20`, border: `1px solid ${C.amber}60`,
                  borderRadius: 12, padding: '12px 24px',
                  fontSize: 14, fontWeight: 700, color: C.amber, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${C.amber}30`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${C.amber}20`; }}
              >
                Explore GEX Dashboard <ArrowRight size={15} />
              </button>
            </Link>
          </div>

          {/* Visual explanation */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: 28,
            }}
          >
            {[
              { label: 'Gamma Flip Level', desc: 'Price where dealer hedging reverses direction', color: C.amber, icon: Target },
              { label: 'Call Wall',        desc: 'Resistance level from heavy call open interest', color: C.green, icon: TrendingUp },
              { label: 'Put Wall',         desc: 'Support level from heavy put open interest',    color: C.red,   icon: TrendingDown },
              { label: 'Net GEX',          desc: 'Dealer gamma at spot — long (pinning) vs short (amplifying)', color: C.amber, icon: BarChart2 },
              { label: 'Max Pain',         desc: 'Expiry price where option sellers profit most',  color: C.muted, icon: Target },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  padding: '14px 0',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${item.color}20`, border: `1px solid ${item.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <item.icon size={16} style={{ color: item.color }} />
                </div>
                <div>
                  <div className="zg-h4" style={{ color: text, marginBottom: 3 }}>{item.label}</div>
                  <div className="zg-small" style={{ color: subtext }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 32px',
          background: 'var(--bg-subtle)',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeading
            eyebrow="Platform Features"
            title="Everything You Need to Trade Smarter"
            sub="Professional analytics tools built for serious options traders — all in one unified platform."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            <FeatureCard isDark={isDark}
              icon={Activity}
              title="Real-Time GEX Analysis"
              description="Monitor live gamma exposure by strike across all expirations. See exactly where dealer hedging pressure accumulates and where price is most likely to pin or repel."
              color={C.amber}
            />
            <FeatureCard isDark={isDark}
              icon={BarChart2}
              title="Options Flow Tracking"
              description="Track smart money in real-time. Filter unusual options activity by expiration, strike, or premium size to spot institutional positioning before price moves."
              color={C.green}
            />
            <FeatureCard isDark={isDark}
              icon={Zap}
              title="Intraday Trading Tools"
              description="VWAP deviation signals, Opening Range Breakout levels, volume spike detection, and momentum divergence — the tactical edge for day traders."
              color={C.amber}
            />
            <FeatureCard isDark={isDark}
              icon={Target}
              title="Trading Signals"
              description="Composite signals synthesized from GEX, flow, and technical factors across intraday, swing, and multi-day timeframes with backtested accuracy metrics."
              color={C.green}
            />
            <FeatureCard isDark={isDark}
              icon={Eye}
              title="Max Pain Analysis"
              description="Know exactly where options market makers want price to settle at each expiration. Max pain levels act as magnetic targets for 0DTE and weekly option expiries."
              color={C.red}
            />
            <FeatureCard isDark={isDark}
              icon={Calculator}
              title="Options Calculator"
              description="Model any options position in seconds. Project intrinsic P&L across a fan of underlying moves, with live entry pricing from the chain and exact break-even output."
              color={C.muted}
            />
          </div>
        </div>
      </section>

      {/* ── Why ZeroGEX ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="Why ZeroGEX"
          title="The Edge That Institutions Keep Secret"
          sub="Retail traders have historically been at a disadvantage. ZeroGEX levels the playing field."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {[
            {
              icon: Shield,
              title: 'Institutional Intelligence',
              body: 'The same gamma exposure data tracked by major banks and market makers — delivered to your screen in real-time, without the six-figure Bloomberg subscription.',
              color: C.amber,
            },
            {
              icon: Clock,
              title: '1-Second Data Refresh',
              body: 'Options markets move fast. Our platform refreshes key metrics every second so you\'re always working with the most current picture of dealer positioning.',
              color: C.green,
            },
            {
              icon: Layers,
              title: 'Multi-Symbol Coverage',
              body: 'SPY, SPX, and QQQ covered with full GEX analytics, flow tracking, and signal generation — the most liquid and most gamma-rich underlyings in the market.',
              color: C.amber,
            },
            {
              icon: BarChart,
              title: 'Unified Analytics Suite',
              body: 'Eight specialized modules all speaking the same language. No more juggling tabs between platforms — gamma, flow, signals, Greeks, and charts live in one place.',
              color: C.green,
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${C.border}`,
                borderRadius: 16, padding: '24px 22px',
              }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${item.color}20`, border: `1px solid ${item.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <item.icon size={20} style={{ color: item.color }} />
              </div>
              <div className="zg-h4" style={{ color: text, marginBottom: 8 }}>{item.title}</div>
              <div className="zg-small" style={{ color: subtext }}>{item.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Analytics suite links ─────────────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 32px',
          background: 'transparent',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeading
            eyebrow="The Full Suite"
            title="Eight Modules. One Platform."
            sub="Each tool is purpose-built for a specific edge in the options market."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            <ToolPill isDark={isDark} href="/dashboard"            icon={BarChart2}    label="Dashboard — Market Overview"         color={C.amber} />
            <ToolPill isDark={isDark} href="/trading-signals"      icon={Zap}          label="Trading Signals — Buy/Sell Signals"  color={C.green} />
            <ToolPill isDark={isDark} href="/flow-analysis"        icon={Activity}     label="Flow Analysis — Smart Money Tracker" color={C.amber} />
            <ToolPill isDark={isDark} href="/gamma-exposure"       icon={BarChart}     label="Dealer Positioning — GEX Heatmap"    color={C.green} />
            <ToolPill isDark={isDark} href="/intraday-tools"       icon={Target}       label="Intraday Tools — VWAP / ORB"         color={C.amber} />
            <ToolPill isDark={isDark} href="/max-pain"             icon={Eye}          label="Max Pain — Expiry Magnets"           color={C.red}   />
            <ToolPill isDark={isDark} href="/options-calculator"   icon={Calculator}   label="Options Calculator — P&L & Break-Even"  color={C.amber} />
            <ToolPill isDark={isDark} href="/greeks-gex"           icon={Layers}       label="GEX Summary — Headline Levels"       color={C.green} />
          </div>
        </div>
      </section>


      {/* ── Education hub callout ─────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 56px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 18,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="zg-label" style={{ color: C.amber, marginBottom: 8 }}>
              Education Hub
            </div>
            <div className="zg-h2" style={{ color: C.light }}>
              Read the methodology, then read the tape.
            </div>
          </div>
          <Link href="/articles" style={{ textDecoration: 'none' }}>
            <button
              style={{
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.light,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              See all articles <ArrowRight size={14} />
            </button>
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {[
            {
              href: '/education/gamma-exposure-explained',
              eyebrow: 'Pillar Guide',
              title: 'Gamma Exposure (GEX) Explained',
              body: 'The complete guide — what GEX is, how dealer gamma is calculated, and how the flip and walls structure the intraday tape.',
            },
            {
              href: '/real-time-gex-0dte',
              eyebrow: 'For 0DTE Traders',
              title: 'Real-Time GEX for 0DTE',
              body: 'Live gamma flip, call and put walls, dealer positioning, and composite signals — built for SPX/0DTE intraday flow.',
            },
            {
              href: '/education/best-gex-tools',
              eyebrow: 'Comparison',
              title: 'Best GEX Tools, Fairly Compared',
              body: 'Real-time vs delayed, 0DTE coverage, methodology, signals, and price — the criteria that matter when picking a GEX tool.',
            },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: '22px 22px 20px',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'border-color 0.18s ease, transform 0.18s ease',
                }}
              >
                <div className="zg-label" style={{ color: C.amber }}>
                  {item.eyebrow}
                </div>
                <div className="zg-h3" style={{ color: C.light }}>
                  {item.title}
                </div>
                <div className="zg-small" style={{ color: subtext, flex: 1 }}>
                  {item.body}
                </div>
                <div className="zg-small" style={{ marginTop: 6, fontWeight: 700, color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Read <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '100px 32px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="zg-h1" style={{ color: text, margin: '0 0 16px' }}>
            Ready to See What the{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${C.amber}, var(--heat-low))`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Market Makers See?
            </span>
          </h2>
          <p className="zg-lead" style={{ color: subtext, margin: '0 auto 40px', maxWidth: 520 }}>
            Launch the ZeroGEX dashboard now and start trading with institutional gamma intelligence.
          </p>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                border: 'none', borderRadius: 16,
                padding: '18px 44px',
                fontSize: 18, fontWeight: 800, color: 'var(--text-inverse)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: `0 12px 48px ${C.amber}55`,
                letterSpacing: '-0.2px',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.02)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px ${C.amber}70`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'none';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 48px ${C.amber}55`;
              }}
            >
              Launch ZeroGEX Free <ArrowRight size={20} />
            </button>
          </Link>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
