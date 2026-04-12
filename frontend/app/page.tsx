'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import { useGEXByStrike, useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
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
  Sun,
  Moon,
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
        background: isDark
          ? `linear-gradient(135deg, ${C.card} 0%, var(--bg-active) 100%)`
          : 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%)',
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: '28px 24px',
        textAlign: 'center',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 36, fontWeight: 800, color: C.amber, letterSpacing: '-1px', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.light, marginTop: 8 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
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
        background: hovered
          ? (isDark ? `linear-gradient(135deg, ${C.cardHover} 0%, var(--bg-active) 100%)` : 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%)')
          : (isDark ? `linear-gradient(135deg, ${C.card} 0%, var(--bg-active) 100%)` : 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%)'),
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
      <div style={{ fontSize: 16, fontWeight: 700, color: C.light, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{description}</div>
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
          background: hovered ? `${color}18` : (isDark ? `${C.card}cc` : 'var(--bg-card)'),
          border: `1px solid ${hovered ? color + '60' : C.border}`,
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          transform: hovered ? 'translateY(-2px)' : 'none',
        }}
      >
        <Icon size={16} style={{ color: hovered ? color : C.muted }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: hovered ? C.light : C.muted }}>{label}</span>
        <ArrowRight size={12} style={{ color: hovered ? color : 'transparent', marginLeft: 'auto', transition: 'all 0.2s' }} />
      </div>
    </Link>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 56 }}>
      <div
        style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: C.amber,
          background: `${C.amber}18`,
          border: `1px solid ${C.amber}40`,
          borderRadius: 100,
          padding: '4px 14px',
          marginBottom: 16,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          color: C.light,
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: '-0.5px',
        }}
      >
        {title}
      </h2>
      {sub && (
        <p style={{ fontSize: 17, color: C.muted, marginTop: 14, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  const isDark = theme === 'dark';
  const bg     = 'transparent';
  const text   = isDark ? C.light  : 'var(--color-text-primary)';
  const subtext = 'var(--color-text-secondary)';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { data: spyQuote } = useMarketQuote('SPY', 60000);
  const { data: spxQuote } = useMarketQuote('SPX', 60000);
  const { data: qqqQuote } = useMarketQuote('QQQ', 60000);
  const { data: spyGex } = useGEXSummary('SPY', 60000);
  const { data: spyStrikeData } = useGEXByStrike('SPY', 42, 60000, 'distance');

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

    const gexPositive = (spyGex?.net_gex ?? 0) >= 0;
    const pcr = spyGex?.put_call_ratio;
    const pcrBias = pcr == null ? 'Neutral' : pcr >= 1.2 ? 'Bearish' : pcr <= 0.8 ? 'Bullish' : 'Neutral';

    return [
      buildQuoteItem('SPY', spyQuote?.close, spyQuote?.open),
      buildQuoteItem('SPX', spxQuote?.close, spxQuote?.open),
      buildQuoteItem('QQQ', qqqQuote?.close, qqqQuote?.open),
      { symbol: 'NET GEX', price: formatDollarCompact(spyGex?.net_gex), change: gexPositive ? 'Positive' : 'Negative', pct: gexPositive ? 'Bullish' : 'Bearish', up: gexPositive },
      { symbol: 'Γ FLIP', price: spyGex?.gamma_flip != null ? `$${formatPrice(spyGex.gamma_flip)}` : '--', change: 'Key Level', pct: 'Watch', up: true },
      { symbol: 'MAX PAIN', price: spyGex?.max_pain != null ? `$${formatPrice(spyGex.max_pain)}` : '--', change: '0DTE Target', pct: '', up: true },
      { symbol: 'PUT/CALL', price: pcr != null ? pcr.toFixed(2) : '--', change: 'Ratio', pct: pcrBias, up: pcrBias !== 'Bearish' },
    ];
  }, [spyQuote, spxQuote, qqqQuote, spyGex]);

  const previewMetrics = useMemo(() => {
    const putCallRatio = spyGex?.put_call_ratio ?? null;
    return [
      { label: 'Net GEX', value: formatDollarCompact(spyGex?.net_gex), color: (spyGex?.net_gex ?? 0) >= 0 ? C.green : C.red, up: (spyGex?.net_gex ?? 0) >= 0 },
      { label: 'Gamma Flip', value: spyGex?.gamma_flip != null ? `$${formatPrice(spyGex.gamma_flip)}` : '--', color: C.amber, up: true },
      { label: 'Max Pain', value: spyGex?.max_pain != null ? `$${formatPrice(spyGex.max_pain)}` : '--', color: C.amber, up: true },
      { label: 'Call Wall', value: spyGex?.call_wall != null ? `$${formatPrice(spyGex.call_wall)}` : '--', color: C.green, up: true },
      { label: 'Put Wall', value: spyGex?.put_wall != null ? `$${formatPrice(spyGex.put_wall)}` : '--', color: C.red, up: false },
      { label: 'Put/Call', value: putCallRatio != null ? putCallRatio.toFixed(2) : '--', color: putCallRatio != null && putCallRatio > 1 ? C.red : C.amber, up: !(putCallRatio != null && putCallRatio > 1) },
    ];
  }, [spyGex]);

  const previewStrikeBars = useMemo(
    () =>
      (spyStrikeData || []).map((row) => ({
        strike: Number(row.strike),
        netGex: Number(row.net_gex || 0),
      })),
    [spyStrikeData],
  );
  const previewStrikeMaxAbs = useMemo(
    () => Math.max(...previewStrikeBars.map((row) => Math.abs(row.netGex)), 1),
    [previewStrikeBars],
  );

  return (
    <div style={{ background: bg, color: text, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      {/* ── Sticky Nav ───────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: scrolled
            ? `${isDark ? C.bgDark : 'var(--color-bg)'}ee`
            : 'transparent',
          borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <div className="h-full flex items-center overflow-hidden flex-shrink-0" style={{ margin: 0, padding: 0, lineHeight: 0 }}>
          <img
            src='/title.svg'
            alt="ZeroGEX"
            className="h-[130%] sm:h-[150%] w-auto block"
            style={{ maxHeight: 'none', maxWidth: 'none', objectFit: 'contain', objectPosition: 'center', margin: 0, padding: 0 }}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-[10px]"
            style={{
              background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              cursor: 'pointer', color: C.muted,
            }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <Link href="/education" className="hidden sm:block" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              Education
            </button>
          </Link>

          {/* Launch App CTA */}
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button
              className="flex items-center gap-1.5 px-3 py-2 sm:px-[18px] sm:py-2 text-xs sm:text-[13px] font-bold rounded-[10px]"
              style={{
                background: `linear-gradient(135deg, ${C.amber}, var(--heat-mid))`,
                border: 'none',
                color: 'var(--text-inverse)',
                cursor: 'pointer',
                boxShadow: `0 4px 16px ${C.amber}50`,
              }}
            >
              Launch App <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </nav>

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
        {/* Radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 900, height: 600,
            background: `radial-gradient(ellipse, ${C.amber}14 0%, transparent 70%)`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 900 }}>
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: C.amber,
              background: `${C.amber}18`, border: `1px solid ${C.amber}40`,
              borderRadius: 100, padding: '5px 16px',
              marginBottom: 28,
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
            Real-Time Options Analytics Platform
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 'clamp(38px, 7vw, 82px)',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-2px',
              margin: '0 0 24px',
              color: text,
            }}
          >
            Trade with{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-low) 50%, var(--color-warning) 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Institutional
            </span>
            <br />
            Grade Gamma Insights
          </h1>

          {/* Sub-headline */}
          <p
            style={{
              fontSize: 'clamp(16px, 2vw, 21px)',
              color: subtext,
              lineHeight: 1.65,
              maxWidth: 680,
              margin: '0 auto 40px',
            }}
          >
            ZeroGEX puts real-time gamma exposure analytics, dealer positioning, and options flow
            tracking at your fingertips — the same intelligence used by institutional desks,
            now available to every trader.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                  border: 'none', borderRadius: 14,
                  padding: '15px 32px',
                  fontSize: 16, fontWeight: 700, color: 'var(--text-inverse)',
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
                Open Dashboard <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/about" style={{ textDecoration: 'none' }}>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '15px 32px',
                  fontSize: 16, fontWeight: 600,
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
              background: isDark ? `${C.card}aa` : 'var(--bg-card)',
              backdropFilter: 'blur(20px)',
              boxShadow: `0 32px 80px var(--color-info-soft), 0 0 0 1px ${C.amber}20`,
              padding: 24,
            }}
          >
            {/* Mock metric row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
              }}
            >
              {previewMetrics.map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: isDark ? `${C.bgDark}cc` : 'var(--bg-hover)',
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {m.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Gamma-by-Strike mini chart */}
            <div
              style={{
                marginTop: 16, height: 80,
                background: isDark ? `${C.bgDark}cc` : 'var(--bg-hover)',
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'flex-end',
                gap: 3, padding: '10px 14px',
                overflow: 'hidden',
              }}
            >
              {previewStrikeBars.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 12 }}>Loading gamma-by-strike…</div>
              ) : (
                previewStrikeBars.map((bar, i) => {
                const h = Math.max(8, (Math.abs(bar.netGex) / previewStrikeMaxAbs) * 100);
                const positive = bar.netGex >= 0;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      background: positive ? `${C.green}90` : `${C.red}90`,
                      borderRadius: 3,
                      minWidth: 4,
                    }}
                    title={`$${bar.strike.toFixed(0)} • ${bar.netGex >= 0 ? '+' : ''}$${(bar.netGex / 1_000_000).toFixed(1)}M`}
                  />
                );
              })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker tape ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: isDark ? `${C.card}99` : 'var(--bg-hover)',
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
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.1em' }}>
                {item.symbol}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: text }}>
                {item.price}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: item.up ? C.green : C.red }}>
                {item.up ? <TrendingUp size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <TrendingDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                {' '}{item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

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
          <StatCard isDark={isDark} label="Options Greeks" value={<AnimatedNumber target={5} />} sub="Delta, Gamma, Theta, Vega, Charm" />
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
              style={{
                display: 'inline-block', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: C.green, background: `${C.green}18`,
                border: `1px solid ${C.green}40`, borderRadius: 100,
                padding: '4px 14px', marginBottom: 20,
              }}
            >
              What is ZeroGEX?
            </div>
            <h2
              style={{
                fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800,
                color: text, margin: '0 0 20px', lineHeight: 1.2, letterSpacing: '-0.5px',
              }}
            >
              Gamma Exposure,{' '}
              <span style={{ color: C.amber }}>Decoded</span>
            </h2>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.75, margin: '0 0 20px' }}>
              <strong style={{ color: text }}>Gamma Exposure (GEX)</strong> is the hidden force that drives
              intraday market dynamics. When dealers sell options, they must hedge by trading the underlying —
              creating predictable price gravity and invisible walls at key levels.
            </p>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.75, margin: '0 0 28px' }}>
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
              background: isDark ? `${C.card}aa` : 'var(--bg-card)',
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: 28,
              backdropFilter: 'blur(12px)',
            }}
          >
            {[
              { label: 'Gamma Flip Level', desc: 'Price where dealer hedging reverses direction', color: C.amber, icon: Target },
              { label: 'Call Wall',        desc: 'Resistance level from heavy call open interest', color: C.green, icon: TrendingUp },
              { label: 'Put Wall',         desc: 'Support level from heavy put open interest',    color: C.red,   icon: TrendingDown },
              { label: 'Net GEX',          desc: 'Aggregate directional hedging pressure',         color: C.amber, icon: BarChart2 },
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: subtext, lineHeight: 1.5 }}>{item.desc}</div>
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
          background: isDark
            ? `linear-gradient(180deg, transparent 0%, ${C.card}33 50%, transparent 100%)`
            : 'linear-gradient(180deg, transparent 0%, var(--border-subtle) 50%, transparent 100%)',
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
              description="Price any option in seconds. Calculate theoretical value, all five Greeks, and break-even zones with our built-in Black-Scholes and implied volatility engine."
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
                background: isDark ? `${C.card}66` : 'var(--bg-card)',
                border: `1px solid ${C.border}`,
                borderRadius: 16, padding: '24px 22px',
                backdropFilter: 'blur(8px)',
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
              <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 14, color: subtext, lineHeight: 1.65 }}>{item.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Analytics suite links ─────────────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 32px',
          background: isDark
            ? `linear-gradient(180deg, transparent 0%, ${C.card}22 100%)`
            : 'transparent',
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
            <ToolPill isDark={isDark} href="/flow-analysis"        icon={Activity}     label="Market Tide — Smart Money Tracker" color={C.amber} />
            <ToolPill isDark={isDark} href="/gamma-exposure"       icon={BarChart}     label="Gamma Exposure — GEX Heatmap"        color={C.green} />
            <ToolPill isDark={isDark} href="/intraday-tools"       icon={Target}       label="Intraday Tools — VWAP / ORB"         color={C.amber} />
            <ToolPill isDark={isDark} href="/max-pain"             icon={Eye}          label="Max Pain — Expiry Magnets"           color={C.red}   />
            <ToolPill isDark={isDark} href="/options-calculator"   icon={Calculator}   label="Options Calculator — Greeks Engine"  color={C.amber} />
            <ToolPill isDark={isDark} href="/greeks-gex"           icon={Layers}       label="Greeks & GEX — Deep Dive"            color={C.green} />
          </div>
        </div>
      </section>


      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 56px' }}>
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: '26px 24px',
            background: isDark ? `linear-gradient(135deg, ${C.card} 0%, var(--bg-active) 100%)` : 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.amber, marginBottom: 8 }}>
              Latest from Education
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: C.light, marginBottom: 6 }}>
              New: Decoding Gamma Exposure
            </div>
            <div style={{ fontSize: 14, color: subtext, maxWidth: 720 }}>
              Learn how positive vs. negative gamma can shape volatility, trend persistence, and mean-reversion behavior.
            </div>
          </div>
          <Link href="/education/decoding-gamma-exposure" style={{ textDecoration: 'none' }}>
            <button
              style={{
                borderRadius: 10,
                border: `1px solid ${C.amber}55`,
                background: `${C.amber}18`,
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
              Read the guide <ArrowRight size={14} />
            </button>
          </Link>
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
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 700, height: 400,
            background: `radial-gradient(ellipse, ${C.amber}18 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2
            style={{
              fontSize: 'clamp(28px, 4.5vw, 56px)', fontWeight: 900,
              color: text, margin: '0 0 16px', letterSpacing: '-1px', lineHeight: 1.1,
            }}
          >
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
          <p style={{ fontSize: 18, color: subtext, margin: '0 auto 40px', maxWidth: 520, lineHeight: 1.65 }}>
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
