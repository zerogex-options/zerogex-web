'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
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
            About ZeroGEX
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900,
            lineHeight: 1.08, letterSpacing: '-2px', margin: '0 0 24px', color: text,
          }}>
            Trade With Dealer Positioning —{' '}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              Not Guesswork
            </span>
          </h1>
          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)', color: subtext,
            lineHeight: 1.7, maxWidth: 640, margin: '0 auto 36px',
          }}>
            Real-time gamma exposure, flow, and market structure used to anticipate moves before they happen.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{ fontSize: 15, padding: '14px 28px' }}>
                Open Dashboard <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{ fontSize: 15, padding: '14px 28px' }}>
                View Price Tiers <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          <div style={{ marginTop: 48, maxWidth: 560, marginInline: 'auto' }}>
            <div className="zg-eyebrow" style={{ color: C.amber, textAlign: 'center', marginBottom: 18, fontSize: 12 }}>
              Why Traders Use ZeroGEX
            </div>
            <div className="zg-panel" style={{ overflow: 'hidden', textAlign: 'left' }}>
              {[
                { icon: Target, text: 'Identify support and resistance before price gets there.' },
                { icon: Activity, text: 'Know when volatility is likely to expand or compress.' },
                { icon: Eye, text: 'See dealer hedging flows as they happen, in real time.' },
                { icon: Shield, text: 'Avoid getting trapped on the wrong side of a move.' },
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
            About ZeroGEX
          </div>
          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: text, lineHeight: 1.75, margin: 0 }}>
            ZeroGEX was built for traders who want more than lagging indicators and hand-drawn levels.
            It provides a live map of SPY/SPX/QQQ options positioning — including gamma exposure,
            call/put walls, gamma flip, dealer positioning, and flow pressure — so traders can better
            understand where support, resistance, acceleration, pinning, or squeeze risk may develop.
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
              Our Mission
            </div>
            <h2 style={{
              fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800,
              color: text, margin: '0 0 20px', lineHeight: 1.2, letterSpacing: '-0.5px',
            }}>
              Democratizing{' '}
              <span style={{ color: C.amber }}>Institutional Analytics</span>
            </h2>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8, margin: '0 0 18px' }}>
              For decades, gamma exposure data was the exclusive domain of market makers and
              prime brokers. The tools to interpret dealer positioning, identify gamma flip levels,
              and anticipate hedging-driven price moves cost hundreds of thousands of dollars per year.
            </p>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8, margin: '0 0 18px' }}>
              ZeroGEX changes that. We built a real-time analytics engine that computes the same
              metrics used by institutional desks — and delivers them to every trader, at every level,
              through a single unified platform.
            </p>
            <p style={{ fontSize: 16, color: subtext, lineHeight: 1.8 }}>
              Our belief is simple: better data leads to better decisions. When retail traders can
              see what the market makers see, they stop being the uninformed counterparty and start
              trading with structural advantage.
            </p>
          </div>

          <div className="zg-panel" style={{ padding: '28px 28px 12px' }}>
            {[
              { icon: Shield, label: 'Institutional Grade', desc: 'Same metrics tracked by major banks and market makers, without the Bloomberg subscription', color: C.amber },
              { icon: Clock,  label: '1-Second Refresh',   desc: 'Real-time data pipeline refreshing GEX, flow, and positioning every second markets are open', color: C.green },
              { icon: Globe,  label: 'Accessible to All',  desc: 'No accreditation required, no minimum account size — every serious trader gets the same edge', color: C.amber },
              { icon: Cpu,    label: 'Purpose-Built Engine', desc: 'Proprietary gamma calculation engine built from the ground up for speed and accuracy', color: C.green },
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
                alt="Folds of Honor Proud Supporter"
                width={64}
                height={64}
                style={{ width: 64, height: 64, objectFit: 'contain' }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="zg-eyebrow" style={{ color: C.amber, marginBottom: 6, fontSize: 11 }}>
                Folds of Honor Proud Supporter
              </div>
              <div style={{ fontSize: 'clamp(15px, 1.8vw, 17px)', fontWeight: 700, color: text, marginBottom: 4 }}>
                3% of every ZeroGEX subscription funds educational scholarships for military families.
              </div>
              <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>
                Donated quarterly to Folds of Honor. Full mechanics, running total, and receipts on our giving page.
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
            eyebrow="Under the Hood"
            title="How ZeroGEX Works"
            sub="A real-time data pipeline built on market microstructure principles — from options chain to actionable insight in under a second."
            color={C.green}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <InfoCard isDark={isDark}
              icon={Database}
              title="Options Chain Ingestion"
              body="We ingest live options chain data across all strikes and expirations for SPY, SPX, and QQQ. Open interest, volume, bid/ask spreads, and Greeks are captured tick-by-tick during market hours."
              color={C.amber}
            />
            <InfoCard isDark={isDark}
              icon={Cpu}
              title="Gamma Exposure Calculation"
              body="For each strike, we compute GEX as: Gamma × Open Interest × Contract Multiplier × Spot Price². Calls contribute positive gamma; puts contribute negative gamma. The displayed Net GEX is this cumulative curve's value at the current spot price (not a raw all-strikes sum), so it stays sign-consistent with the gamma flip — positive Net GEX at spot means dealers are net long gamma."
              color={C.green}
            />
            <InfoCard isDark={isDark}
              icon={TrendingUp}
              title="Key Level Detection"
              body="Gamma Flip is the zero-gamma level where the cumulative net GEX curve crosses zero: with spot above it dealers are long gamma and hedging is stabilizing, below it dealers are short gamma and hedging is destabilizing. Call Wall and Put Wall are the strikes with maximum gamma-weighted open interest on each side. Max Pain is computed as the expiry price minimizing total option holder value."
              color={C.amber}
            />
            <InfoCard isDark={isDark}
              icon={Activity}
              title="Flow & Signal Synthesis"
              body="Unusual options activity is flagged by comparing volume to open interest ratios and premium size versus average. Trading signals synthesize GEX regime, flow direction, and technical factors into composite scores with directional conviction levels."
              color={C.green}
            />
            <InfoCard isDark={isDark}
              icon={Zap}
              title="Real-Time Delivery"
              body="All computed metrics are pushed to the frontend every second via an optimized API layer. The platform auto-refreshes without page reloads, so you always see current positioning without any manual intervention."
              color={C.amber}
            />
            <InfoCard isDark={isDark}
              icon={BarChart2}
              title="Greeks Pipeline"
              body="Per-contract Greeks — Delta, Gamma, Theta, Vega — are calculated on every chain ingest using a Black-Scholes pipeline against our live implied-volatility surfaces, then aggregated into dealer-level vanna and charm exposures for the signals engine."
              color={C.green}
            />
          </div>
        </div>
      </section>

      {/* ── Platform modules ─────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeading
          eyebrow="The Platform"
          title="Eight Modules, One Cohesive Edge"
          sub="Every tool in the suite is designed to work together, giving you a complete picture of market structure from every angle."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {[
            {
              icon: BarChart2, href: '/dashboard', label: 'Dashboard', color: C.amber,
              desc: 'The command center. Net GEX, Gamma Flip, Max Pain, Call/Put Walls, and live candlestick charts — everything you need to orient to the current market structure at a glance.',
            },
            {
              icon: Zap, href: '/trading-signals', label: 'Trading Signals', color: C.green,
              desc: 'Composite buy/sell signals built from GEX regime, options flow direction, and technical momentum. Signals are rated by conviction level and tagged with the timeframe they\'re most relevant to.',
            },
            {
              icon: Activity, href: '/flow-analysis', label: 'Flow Analysis', color: C.amber,
              desc: 'Real-time smart money tracker. Identifies unusual options activity — large premium blocks, sweep orders, and sentiment-shifting prints — filtered by size, expiry, and directional bias.',
            },
            {
              icon: BarChart2, href: '/gamma-exposure', label: 'Dealer Positioning', color: C.green,
              desc: 'Full strike-by-strike GEX heatmap across all expirations. Visualize exactly where dealer gamma is concentrated, how it\'s distributed, and which levels are most likely to influence price.',
            },
            {
              icon: Target, href: '/intraday-tools', label: 'Intraday Tools', color: C.amber,
              desc: 'Tactical intraday edge for active traders. VWAP deviation alerts, Opening Range Breakout levels, volume-weighted momentum, and gamma-adjusted support/resistance updated every minute.',
            },
            {
              icon: Eye, href: '/max-pain', label: 'Max Pain', color: C.red,
              desc: 'Calculates max pain across all expirations — daily, weekly, monthly. Shows the gravitational pull of market maker profit maximization, especially powerful for 0DTE and options expiry weeks.',
            },
            {
              icon: Calculator, href: '/options-calculator', label: 'Options Calculator', color: C.amber,
              desc: 'Pull a live entry price from the chain, then project intrinsic P&L across a configurable fan of underlying moves. Returns position cost, break-even, and per-step P&L for any strike or expiration.',
            },
            {
              icon: Layers, href: '/greeks-gex', label: 'GEX Summary', color: C.green,
              desc: 'Headline GEX numbers (Net, Call, Put) plus the day\'s key dealer levels — gamma flip, max pain, and the call/put walls — at a glance.',
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
            eyebrow="API Access"
            title="Build on ZeroGEX"
            sub="Forty-plus endpoints across GEX, options flow, signals, technicals, max pain, market data, and backtesting. OpenAPI 3.1 compliant with interactive documentation."
            color={C.green}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 40 }}>
            <APILink isDark={isDark}
              href="https://api.zerogex.io/docs"
              label="Swagger UI — Interactive API Explorer"
              desc="Browse all endpoints, inspect request/response schemas, and execute live API calls from your browser"
            />
            <APILink isDark={isDark}
              href="https://api.zerogex.io/redoc"
              label="ReDoc — Full API Reference"
              desc="Clean, searchable reference documentation for every endpoint, parameter, and data model"
            />
            <APILink isDark={isDark}
              href="https://api.zerogex.io/openapi.json"
              label="OpenAPI 3.1 Schema"
              desc="Machine-readable OpenAPI specification for code generation, SDK building, or integration testing"
            />
          </div>

          <div className="zg-panel" style={{ padding: '32px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Code2 size={24} strokeWidth={1.75} style={{ color: C.green, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.light }}>Sample of available endpoints</div>
                <div style={{ fontSize: 13, color: C.muted }}>A selection of the most-used endpoints — full catalog at the docs links above. All endpoints require a Bearer API key.</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {[
                { method: 'GET', path: '/api/gex/summary', desc: 'Net GEX at spot, gamma flip, call/put walls, max pain' },
                { method: 'GET', path: '/api/gex/by-strike', desc: 'Per-strike GEX with vanna/charm exposures' },
                { method: 'GET', path: '/api/gex/profile', desc: 'Spot-shift dealer gamma curve across strikes' },
                { method: 'GET', path: '/api/gex/historical-context', desc: 'Live GEX vs 30d / all-time distributions' },
                { method: 'GET', path: '/api/market/quote', desc: 'Real-time underlying OHLC with session context' },
                { method: 'GET', path: '/api/market/volatility', desc: 'VIX/VXN level and momentum (0–10 scale)' },
                { method: 'GET', path: '/api/flow/smart-money', desc: 'Unusual options activity feed (1-min granularity)' },
                { method: 'GET', path: '/api/flow/series', desc: '5-min aggregated call/put premium and volume' },
                { method: 'GET', path: '/api/max-pain/current', desc: 'Current max pain with per-expiration payoff curves' },
                { method: 'GET', path: '/api/signals/score', desc: 'Composite MSI gauge (0–100) with components' },
                { method: 'GET', path: '/api/signals/basic', desc: 'Bundle of all six Basic Signal scores' },
                { method: 'GET', path: '/api/signals/advanced/squeeze-setup', desc: 'Squeeze Setup signal (one of eight Advanced)' },
                { method: 'GET', path: '/api/technicals/dealer-hedging', desc: 'Current dealer hedge-pressure snapshot' },
                { method: 'GET', path: '/api/tools/option-calculator', desc: 'Intrinsic-value P&L fan across underlying moves' },
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
          eyebrow="FAQ"
          title="Common Questions"
          sub="Everything you need to know about how ZeroGEX works and how to get the most from it."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FAQItem isDark={isDark}
            q="What is Gamma Exposure (GEX) and why does it matter?"
            a="Gamma Exposure is the aggregate sensitivity of options dealers' delta hedges to price moves in the underlying. When dealers are long gamma (positive net GEX at spot), they must sell when price rises and buy when it falls — creating a dampening effect on volatility and strong intraday support/resistance. When they're short gamma (negative net GEX at spot), they chase price and amplify moves in both directions. Knowing the GEX regime helps you understand whether the market is likely to mean-revert or trend on any given day."
          />
          <FAQItem isDark={isDark}
            q="How is the Gamma Flip level calculated?"
            a="The Gamma Flip is the level at which the cumulative net GEX curve transitions from positive to negative (or vice versa) — the zero-gamma crossing. With spot above the flip, dealers are long gamma and hedging is stabilizing; with spot below it, dealers are short gamma and hedging amplifies moves. The displayed Net GEX is measured at spot, so it never contradicts the flip. This level often acts as a pivot between mean-reverting and trending market regimes."
          />
          <FAQItem isDark={isDark}
            q="What is Max Pain, and how reliable is it?"
            a="Max Pain is the price at expiration where the total dollar value of options held by buyers is minimized — i.e., where option sellers (market makers) make the most money. It's calculated by summing the intrinsic value of all calls and puts at each possible expiry price and finding the minimum. Max Pain is most reliable in the final 24–48 hours before expiration, especially for 0DTE options, where market maker incentives to pin price near that level are strongest."
          />
          <FAQItem isDark={isDark}
            q="What symbols are currently supported?"
            a="ZeroGEX currently provides full analytics coverage for SPY (S&P 500 ETF), SPX (S&P 500 Index), and QQQ (Nasdaq 100 ETF). These instruments represent the most liquid and most gamma-rich underlyings in the U.S. options market, where dealer hedging activity has the greatest impact on intraday price dynamics."
          />
          <FAQItem isDark={isDark}
            q="How often does the data refresh?"
            a="Key GEX metrics, flow data, and price quotes refresh every 1 second during regular market hours (9:30 AM – 4:00 PM ET). The platform streams updates automatically — there's no need to manually refresh the page. During pre-market and after-hours sessions, we show extended-hours quotes alongside the prior regular-session close for context."
          />
          <FAQItem isDark={isDark}
            q="Can I access ZeroGEX data programmatically via API?"
            a="Yes. The full ZeroGEX data API is documented at api.zerogex.io/docs (Swagger UI) and api.zerogex.io/redoc (ReDoc), with an OpenAPI 3.1 schema published at api.zerogex.io/openapi.json. Every endpoint exposes the same data powering the web platform — GEX summaries, per-strike breakdowns, the spot-shift dealer-gamma profile, options flow, the composite MSI score and the eight Advanced + six Basic signals, max pain, technicals, and the backtesting engine. All endpoints require a Bearer API key; direct API access ships with the Pro plan."
          />
          <FAQItem isDark={isDark}
            q="Is ZeroGEX suitable for 0DTE trading?"
            a="Absolutely — in fact, 0DTE traders often get the most value from GEX analytics. On expiration days, the gamma of 0DTE options is extremely high, meaning dealer hedging flows are at their most intense. Max Pain becomes particularly reliable as a price magnet, Call Wall and Put Wall define the intraday trading range with high accuracy, and the GEX regime (positive vs. negative) predicts whether the market is likely to pin or break out. The 1-second data refresh is also critical for 0DTE timeframes."
          />
          <FAQItem isDark={isDark}
            q="How does the Options Calculator work?"
            a="The Options Calculator pulls the live entry price from the chain (mid → last → bid/ask midpoint fallback) and then walks a configurable fan of underlying-price moves — up for calls, down for puts — at the step size you choose. For each step it returns the position's intrinsic value at expiration, the P&L net of your brokerage fees, and the exact break-even price. Use the per-contract Greeks shown on each option contract for Δ, Γ, Θ, V at the chosen strike."
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
            Start Trading with{' '}
            <span style={{
              color: 'var(--color-accent-hot)',
            }}>
              Institutional Intelligence
            </span>
          </h2>
          <p style={{ fontSize: 18, color: subtext, margin: '0 auto 40px', maxWidth: 500, lineHeight: 1.65 }}>
            The Dashboard is the real-time command center — and the free Gamma Levels pages (SPX, SPY, QQQ) — delayed about 15 minutes — are open to anyone, no sign-up required.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--primary" style={{ padding: '16px 40px', fontSize: 15 }}>
                Launch Dashboard <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button className="zg-btn zg-btn--secondary" style={{ padding: '16px 32px', fontSize: 14 }}>
                <BookOpen size={16} /> Review Tier Access
              </button>
            </Link>
          </div>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
