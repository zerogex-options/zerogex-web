'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import GammaProfileHero from '@/components/marketing/GammaProfileHero';
import { TestimonialsSection } from '@/components/marketing/Testimonials';
import { useTheme } from '@/core/ThemeContext';
import { useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import { useAuthSession } from '@/hooks/useAuthSession';
import { normalizeTier } from '@/core/auth';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';
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

// ── Stat value ────────────────────────────────────────────────────────────────
// Renders the real stat value as text from the very first paint — server-side,
// pre-hydration, and with JS disabled — so crawlers, link unfurlers, and
// slow-JS visitors never read a misleading "0+ Supported Symbols" / "0s". (The
// old count-from-zero flashed a false zero in the fetched HTML and again on
// scroll-into-view.) As pure progressive enhancement, when JS is present and
// motion is allowed the real number fades and rises in once it scrolls into
// view — opacity/transform only, so a "0" is never shown and no-JS / reduced-
// motion visitors just see the plain, already-visible number.
function AnimatedNumber({ target, prefix = '', suffix = '', decimals = 0 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // `shown` (set async, only from the observer callback) drives the reveal.
  // First paint has no opacity styling at all → the number is plainly visible
  // server-side, pre-hydration, and with JS disabled.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced-motion users keep the plain, already-visible number.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Arm imperatively — hide instantly via the ref rather than React state, so
    // we don't setState synchronously in the effect. On no-JS this never runs,
    // so the number stays visible. The observer then reveals it on scroll-in.
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      style={{
        display: 'inline-block',
        // Only the reveal is animated; the imperative arm above hid it instantly
        // so the number never fades *out*. No-JS/reduced-motion never sets these.
        ...(shown
          ? { opacity: 1, transform: 'none', transition: 'opacity 0.6s ease, transform 0.6s ease' }
          : null),
      }}
    >
      {prefix}{decimals > 0 ? target.toFixed(decimals) : Math.round(target)}{suffix}
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
        borderRadius: 'var(--radius-panel)',
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
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? color : C.border}`,
        borderRadius: 'var(--radius-panel)',
        padding: '28px 24px',
        transition: 'border-color 0.2s ease',
        cursor: 'default',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Icon size={24} strokeWidth={1.75} style={{ color }} />
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
          borderRadius: 'var(--radius-control)',
          background: hovered ? `${color}18` : 'var(--bg-card)',
          border: `1px solid ${hovered ? color : C.border}`,
          transition: 'background 0.2s ease, border-color 0.2s ease',
          cursor: 'pointer',
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
        className="zg-eyebrow"
        style={{
          display: 'inline-block',
          color: 'var(--color-accent-hot)',
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

  // Auth-aware hero CTA (requirement #7). Cold/logged-out visitors get a clear
  // "Start 7-Day Free Trial" primary; existing subscribers get "View Live
  // Dashboard" so we don't push a trial at someone who already pays. Signed-in-
  // but-unpaid users start the trial from /pricing (account already exists).
  const { data: authSession } = useAuthSession();
  const isAuthed = !!authSession?.authenticated;
  const tier = normalizeTier(authSession?.user?.tier);
  const canLaunchApp = isAuthed && (tier === 'basic' || tier === 'pro' || tier === 'admin');
  // Signed-in-but-unpaid visitors start the trial on /pricing; ?trial=1 makes
  // that page show the "You're almost done — choose your plan" trial hero, same
  // as a visitor arriving straight from registration.
  const heroTrialHref = isAuthed ? '/pricing?trial=1' : '/register';
  // "Explore/Launch dashboard" CTAs (mid-page + final). Route by auth so the
  // label never mismatches the destination: paid users open the live dashboard;
  // signed-in-but-unpaid users start the trial on /pricing (their account
  // already exists); logged-out users register with the dashboard as the
  // post-signup target — never a silent bounce to the free delayed-levels page.
  const exploreDashboardHref = canLaunchApp
    ? '/dashboard'
    : isAuthed
      ? '/pricing?trial=1'
      : '/register?next=/dashboard';

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
            className="zg-eyebrow"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: 'var(--color-accent-hot)',
              marginBottom: 28,
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: C.green,
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
            <span style={{ color: 'var(--color-accent-hot)' }}>
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

          {/* CTAs (requirement #7): primary = trial for cold visitors (dashboard
              for existing subscribers); secondary = the free levels page. */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href={canLaunchApp ? '/dashboard' : heroTrialHref}
              style={{ textDecoration: 'none' }}
              onClick={
                canLaunchApp
                  ? undefined
                  : () => capture(TelemetryEvent.TrialCtaClick, { location: 'home_hero', ...readUtmParams() })
              }
            >
              <button className="zg-btn zg-btn--primary" style={{ fontSize: 15, padding: '13px 22px' }}>
                {canLaunchApp ? 'View Live Dashboard' : 'Start 7-Day Free Trial'} <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/spx-gamma-levels" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{ fontSize: 15, padding: '13px 22px' }}>
                View Free Levels <ArrowRight size={16} />
              </button>
            </Link>
          </div>

          {/* The hero visual IS the live product output — the gamma profile,
              not a mock. Signed areas, the flip band, and the spot cursor. */}
          <div style={{ marginTop: 56, textAlign: 'left' }}>
            <GammaProfileHero symbol="SPY" />
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
              className="zg-panel"
              style={{
                padding: '24px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <item.icon size={24} strokeWidth={1.75} style={{ color: item.color, marginBottom: 4 }} />
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
            <button className="zg-btn zg-btn--primary" style={{ fontSize: 15, padding: '13px 24px' }}>
              See today&apos;s free gamma levels <ArrowRight size={16} />
            </button>
          </Link>
          <Link href="/trading-mistakes" style={{ textDecoration: 'none' }}>
            <button className="zg-btn zg-btn--secondary" style={{ fontSize: 15, padding: '13px 24px' }}>
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
              className="zg-eyebrow"
              style={{ display: 'inline-block', color: C.green, marginBottom: 20 }}
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
            <Link
              href={exploreDashboardHref}
              onClick={
                canLaunchApp
                  ? undefined
                  : () => capture(TelemetryEvent.TrialCtaClick, { location: 'home_dashboard_explore', ...readUtmParams() })
              }
              style={{ textDecoration: 'none' }}
            >
              <button className="zg-btn zg-btn--secondary" style={{ fontSize: 14, padding: '12px 24px' }}>
                Explore GEX Dashboard <ArrowRight size={15} />
              </button>
            </Link>
          </div>

          {/* Visual explanation */}
          <div className="zg-panel" style={{ padding: 28 }}>
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
                <item.icon size={20} strokeWidth={1.75} style={{ color: item.color, flexShrink: 0, marginTop: 2 }} />
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
              className="zg-panel"
              style={{ padding: '24px 22px' }}
            >
              <item.icon size={24} strokeWidth={1.75} style={{ color: item.color, marginBottom: 16 }} />
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
            <div className="zg-eyebrow" style={{ color: C.amber, marginBottom: 8 }}>
              Education Hub
            </div>
            <div className="zg-h2" style={{ color: C.light }}>
              Read the methodology, then read the tape.
            </div>
          </div>
          <Link href="/articles" style={{ textDecoration: 'none' }}>
            <button className="zg-btn zg-btn--secondary" style={{ fontSize: 13, padding: '10px 16px' }}>
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
                className="zg-panel"
                style={{
                  padding: '22px 22px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'border-color 0.18s ease',
                }}
              >
                <div className="zg-eyebrow" style={{ color: C.amber }}>
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

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      {/* Social proof, placed immediately before the final CTA: let a real user
          make the case in their own words, then ask for the trial. */}
      <TestimonialsSection />

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
            <span style={{ color: 'var(--color-accent-hot)' }}>
              Market Makers See?
            </span>
          </h2>
          <p className="zg-lead" style={{ color: subtext, margin: '0 auto 40px', maxWidth: 520 }}>
            {canLaunchApp
              ? 'Launch the ZeroGEX dashboard now and start trading with institutional gamma intelligence.'
              : 'Start your 7-day free trial and trade with institutional gamma intelligence — live SPY, SPX, and QQQ.'}
          </p>
          <Link
            href={exploreDashboardHref}
            onClick={
              canLaunchApp
                ? undefined
                : () => capture(TelemetryEvent.TrialCtaClick, { location: 'home_footer', ...readUtmParams() })
            }
            style={{ textDecoration: 'none' }}
          >
            <button className="zg-btn zg-btn--primary" style={{ fontSize: 17, padding: '16px 40px' }}>
              {canLaunchApp ? 'Launch ZeroGEX Dashboard' : 'Start 7-Day Free Trial'} <ArrowRight size={20} />
            </button>
          </Link>
          {!canLaunchApp && (
            <p className="zg-small" style={{ color: subtext, margin: '16px 0 0', fontWeight: 600 }}>
              7-day free trial. No charge until day 7. Cancel anytime.
            </p>
          )}
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
