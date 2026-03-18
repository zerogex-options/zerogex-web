'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ── Brand colors ──────────────────────────────────────────────────────────────
const C = {
  bgDark:    '#2a2628',
  card:      '#423d3f',
  cardHover: '#4e4749',
  light:     '#f2f2f2',
  muted:     '#968f92',
  amber:     '#f59e0b',
  green:     '#10b981',
  red:       '#f45854',
  border:    'rgba(150,143,146,0.25)',
};

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub, color = C.amber }: {
  eyebrow: string; title: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 56 }}>
      <div style={{
        display: 'inline-block', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color, background: `${color}18`, border: `1px solid ${color}40`,
        borderRadius: 100, padding: '4px 14px', marginBottom: 16,
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
function InfoCard({ icon: Icon, title, body, color = C.amber }: {
  icon: React.ElementType; title: string; body: string; color?: string;
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, rgba(42,38,40,0.9) 100%)`,
      border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 24px',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}20`, border: `1px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.light, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{body}</div>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
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
          padding: '20px 24px', background: open ? `${C.amber}08` : `${C.card}99`,
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
function APILink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '18px 22px', borderRadius: 14,
        background: `${C.card}cc`, border: `1px solid ${C.border}`,
        transition: 'all 0.2s', cursor: 'pointer',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = C.amber + '50';
          (e.currentTarget as HTMLElement).style.background = `${C.amber}10`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = C.border;
          (e.currentTarget as HTMLElement).style.background = `${C.card}cc`;
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${C.amber}20`, border: `1px solid ${C.amber}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ExternalLink size={18} style={{ color: C.amber }} />
        </div>
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const isDark = theme === 'dark';
  const bg = isDark ? C.bgDark : '#f0eef0';
  const text = isDark ? C.light : '#1a1618';
  const subtext = isDark ? C.muted : '#6b636a';

  return (
    <div style={{ background: bg, color: text, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>

      {/* ── Sticky Nav ───────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `${isDark ? C.bgDark : '#f0eef0'}ee`,
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(20px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img
            src={isDark ? '/title-subtitle-dark.svg' : '/title-subtitle-light.svg'}
            alt="ZeroGEX"
            style={{ height: 160, width: 'auto' }}
          />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{
              background: `${C.card}cc`, border: `1px solid ${C.border}`,
              borderRadius: 10, width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: C.muted,
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button style={{
              background: `linear-gradient(135deg, ${C.amber}, #e08800)`,
              border: 'none', borderRadius: 10, padding: '8px 18px',
              fontSize: 13, fontWeight: 700, color: '#1a1618', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: `0 4px 16px ${C.amber}50`,
            }}>
              Launch App <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </nav>

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
            linear-gradient(rgba(150,143,146,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(150,143,146,0.06) 1px, transparent 1px)
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
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: C.green,
            background: `${C.green}18`, border: `1px solid ${C.green}40`,
            borderRadius: 100, padding: '5px 16px', marginBottom: 24,
          }}>
            About ZeroGEX
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900,
            lineHeight: 1.08, letterSpacing: '-2px', margin: '0 0 24px', color: text,
          }}>
            Built for Traders Who{' '}
            <span style={{
              background: `linear-gradient(135deg, ${C.amber} 0%, #fbbf24 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Demand More
            </span>
          </h1>
          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)', color: subtext,
            lineHeight: 1.7, maxWidth: 640, margin: '0 auto 36px',
          }}>
            ZeroGEX was built on a simple premise: the analytics that move markets shouldn't be
            locked behind institutional paywalls. We bring dealer-grade gamma intelligence
            directly to every options trader.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button style={{
                background: `linear-gradient(135deg, ${C.amber} 0%, #e08800 100%)`,
                border: 'none', borderRadius: 12, padding: '14px 28px',
                fontSize: 15, fontWeight: 700, color: '#1a1618', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: `0 8px 28px ${C.amber}50`,
              }}>
                Open Dashboard <ArrowRight size={16} />
              </button>
            </Link>
            <a href="https://api.zerogex.io/docs" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '14px 28px',
                fontSize: 15, fontWeight: 600, color: C.light,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                API Docs <ExternalLink size={14} />
              </button>
            </a>
          </div>
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
            <div style={{
              display: 'inline-block', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: C.amber, background: `${C.amber}18`,
              border: `1px solid ${C.amber}40`, borderRadius: 100,
              padding: '4px 14px', marginBottom: 20,
            }}>
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

          <div style={{
            background: `${C.card}aa`, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: 28, backdropFilter: 'blur(12px)',
          }}>
            {[
              { icon: Shield, label: 'Institutional Grade', desc: 'Same metrics tracked by major banks and market makers, without the Bloomberg subscription', color: C.amber },
              { icon: Clock,  label: '1-Second Refresh',   desc: 'Real-time data pipeline refreshing GEX, flow, and positioning every second markets are open', color: C.green },
              { icon: Globe,  label: 'Accessible to All',  desc: 'No accreditation required, no minimum account size — every serious trader gets the same edge', color: C.amber },
              { icon: Cpu,    label: 'Purpose-Built Engine', desc: 'Proprietary gamma calculation engine built from the ground up for speed and accuracy', color: C.green },
            ].map((item) => (
              <div key={item.label} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '16px 0', borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${item.color}20`, border: `1px solid ${item.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <item.icon size={17} style={{ color: item.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: subtext, lineHeight: 1.55 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 32px',
        background: `linear-gradient(180deg, transparent 0%, ${C.card}33 50%, transparent 100%)`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeading
            eyebrow="Under the Hood"
            title="How ZeroGEX Works"
            sub="A real-time data pipeline built on market microstructure principles — from options chain to actionable insight in under a second."
            color={C.green}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <InfoCard
              icon={Database}
              title="Options Chain Ingestion"
              body="We ingest live options chain data across all strikes and expirations for SPY, SPX, QQQ, and IWM. Open interest, volume, bid/ask spreads, and Greeks are captured tick-by-tick during market hours."
              color={C.amber}
            />
            <InfoCard
              icon={Cpu}
              title="Gamma Exposure Calculation"
              body="For each strike, we compute GEX as: Gamma × Open Interest × Contract Multiplier × Spot Price². Call GEX is positive (dealers short gamma); Put GEX is negative. Net GEX is the aggregate sum across all strikes."
              color={C.green}
            />
            <InfoCard
              icon={TrendingUp}
              title="Key Level Detection"
              body="Gamma Flip is identified as the strike where net GEX crosses zero. Call Wall and Put Wall are the strikes with maximum gamma-weighted open interest on each side. Max Pain is computed as the expiry price minimizing total option holder value."
              color={C.amber}
            />
            <InfoCard
              icon={Activity}
              title="Flow & Signal Synthesis"
              body="Unusual options activity is flagged by comparing volume to open interest ratios and premium size versus average. Trading signals synthesize GEX regime, flow direction, and technical factors into composite scores with directional conviction levels."
              color={C.green}
            />
            <InfoCard
              icon={Zap}
              title="Real-Time Delivery"
              body="All computed metrics are pushed to the frontend every second via an optimized API layer. The platform auto-refreshes without page reloads, so you always see current positioning without any manual intervention."
              color={C.amber}
            />
            <InfoCard
              icon={BarChart2}
              title="Greeks Engine"
              body="Our built-in Black-Scholes engine calculates theoretical option prices and all five Greeks — Delta, Gamma, Theta, Vega, and Charm — using live implied volatility surfaces. The Options Calculator lets you model any scenario in real time."
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
              icon: BarChart2, href: '/gamma-exposure', label: 'Gamma Exposure', color: C.green,
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
              desc: 'Price options in real time using Black-Scholes with live IV surfaces. Model P&L at expiry, calculate break-even prices, and analyze all five Greeks for any strike or expiration.',
            },
            {
              icon: Layers, href: '/greeks-gex', label: 'Greeks & GEX', color: C.green,
              desc: 'Deep-dive into the relationship between individual Greeks and aggregate gamma exposure. See how Delta, Gamma, Theta, Vega, and Charm interact across the options surface.',
            },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: `${C.card}99`, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: '22px 20px',
                display: 'flex', gap: 16, alignItems: 'flex-start',
                transition: 'all 0.2s', cursor: 'pointer',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = item.color + '50';
                  (e.currentTarget as HTMLElement).style.background = `${item.color}0a`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = C.border;
                  (e.currentTarget as HTMLElement).style.background = `${C.card}99`;
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${item.color}20`, border: `1px solid ${item.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <item.icon size={20} style={{ color: item.color }} />
                </div>
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
        background: `linear-gradient(180deg, transparent 0%, ${C.card}22 100%)`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeading
            eyebrow="API Access"
            title="Build on ZeroGEX"
            sub="Full programmatic access to every data endpoint powering the platform. OpenAPI-compliant with interactive documentation."
            color={C.green}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 40 }}>
            <APILink
              href="https://api.zerogex.io/docs"
              label="Swagger UI — Interactive API Explorer"
              desc="Browse all endpoints, inspect request/response schemas, and execute live API calls from your browser"
            />
            <APILink
              href="https://api.zerogex.io/redoc"
              label="ReDoc — Full API Reference"
              desc="Clean, searchable reference documentation for every endpoint, parameter, and data model"
            />
            <APILink
              href="https://api.zerogex.io/openapi.json"
              label="OpenAPI JSON Schema"
              desc="Machine-readable OpenAPI 3.0 specification for code generation, SDK building, or integration testing"
            />
          </div>

          <div style={{
            background: `${C.card}aa`, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: '32px 36px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${C.green}20`, border: `1px solid ${C.green}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Code2 size={20} style={{ color: C.green }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.light }}>Available Endpoints</div>
                <div style={{ fontSize: 13, color: C.muted }}>Core data endpoints available via the ZeroGEX API</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {[
                { method: 'GET', path: '/gex/summary', desc: 'Net GEX, gamma flip, max pain, key levels' },
                { method: 'GET', path: '/gex/by-strike', desc: 'Full strike-by-strike GEX breakdown' },
                { method: 'GET', path: '/quote/{symbol}', desc: 'Real-time market quote with OHLCV' },
                { method: 'GET', path: '/flow/unusual', desc: 'Unusual options activity feed' },
                { method: 'GET', path: '/signals', desc: 'Current trading signal ratings' },
                { method: 'GET', path: '/greeks/{symbol}', desc: 'Full Greeks surface by strike' },
                { method: 'GET', path: '/max-pain/{expiry}', desc: 'Max pain by expiration date' },
                { method: 'GET', path: '/intraday/levels', desc: 'VWAP, ORB, and intraday levels' },
              ].map((ep) => (
                <div key={ep.path} style={{
                  background: `${C.bgDark}cc`, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: C.green,
                      background: `${C.green}20`, border: `1px solid ${C.green}30`,
                      borderRadius: 5, padding: '2px 7px', letterSpacing: '0.05em',
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
          <FAQItem
            q="What is Gamma Exposure (GEX) and why does it matter?"
            a="Gamma Exposure is the aggregate sensitivity of options dealers' delta hedges to price moves in the underlying. When dealers are short gamma (positive GEX), they must buy when price rises and sell when it falls — creating a dampening effect on volatility and strong intraday support/resistance. When they're long gamma (negative GEX), they amplify moves in both directions. Knowing the GEX regime helps you understand whether the market is likely to trend or mean-revert on any given day."
          />
          <FAQItem
            q="How is the Gamma Flip level calculated?"
            a="The Gamma Flip is the strike price at which net GEX transitions from positive to negative (or vice versa). We calculate it by summing call GEX minus put GEX across all strikes and identifying the zero-crossing point. This level is significant because above it, dealer hedging is stabilizing; below it, dealer hedging amplifies moves. It often acts as a pivot between trending and mean-reverting market regimes."
          />
          <FAQItem
            q="What is Max Pain, and how reliable is it?"
            a="Max Pain is the price at expiration where the total dollar value of options held by buyers is minimized — i.e., where option sellers (market makers) make the most money. It's calculated by summing the intrinsic value of all calls and puts at each possible expiry price and finding the minimum. Max Pain is most reliable in the final 24–48 hours before expiration, especially for 0DTE options, where market maker incentives to pin price near that level are strongest."
          />
          <FAQItem
            q="What symbols are currently supported?"
            a="ZeroGEX currently provides full analytics coverage for SPY (S&P 500 ETF), SPX (S&P 500 Index), QQQ (Nasdaq 100 ETF), and IWM (Russell 2000 ETF). These four instruments represent the most liquid and most gamma-rich underlyings in the U.S. options market, where dealer hedging activity has the greatest impact on intraday price dynamics."
          />
          <FAQItem
            q="How often does the data refresh?"
            a="Key GEX metrics, flow data, and price quotes refresh every 1 second during regular market hours (9:30 AM – 4:00 PM ET). The platform streams updates automatically — there's no need to manually refresh the page. During pre-market and after-hours sessions, we show extended-hours quotes alongside the prior regular-session close for context."
          />
          <FAQItem
            q="Can I access ZeroGEX data programmatically via API?"
            a="Yes. The full ZeroGEX data API is publicly accessible and documented at api.zerogex.io/docs. The API is OpenAPI 3.0 compliant, supports JSON responses, and exposes all the same data powering the web platform — including GEX summaries, strike-by-strike breakdowns, real-time quotes, flow data, trading signals, and more. Both Swagger UI and ReDoc documentation are available."
          />
          <FAQItem
            q="Is ZeroGEX suitable for 0DTE trading?"
            a="Absolutely — in fact, 0DTE traders often get the most value from GEX analytics. On expiration days, the gamma of 0DTE options is extremely high, meaning dealer hedging flows are at their most intense. Max Pain becomes particularly reliable as a price magnet, Call Wall and Put Wall define the intraday trading range with high accuracy, and the GEX regime (positive vs. negative) predicts whether the market is likely to pin or break out. The 1-second data refresh is also critical for 0DTE timeframes."
          />
          <FAQItem
            q="How does the Options Calculator work?"
            a="The Options Calculator uses the Black-Scholes pricing model with live implied volatility surfaces fetched from our data pipeline. Enter any symbol, strike, expiration, and option type, and we calculate the theoretical price, Delta, Gamma, Theta, Vega, and Charm in real time. You can also model P&L scenarios at different price levels and time horizons to see how your position performs under various market conditions."
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
              background: `linear-gradient(135deg, ${C.amber}, #fbbf24)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Institutional Intelligence
            </span>
          </h2>
          <p style={{ fontSize: 18, color: subtext, margin: '0 auto 40px', maxWidth: 500, lineHeight: 1.65 }}>
            The dashboard is live and free to use. No sign-up required.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <button style={{
                background: `linear-gradient(135deg, ${C.amber} 0%, #e08800 100%)`,
                border: 'none', borderRadius: 14,
                padding: '16px 40px', fontSize: 17, fontWeight: 800, color: '#1a1618',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: `0 12px 40px ${C.amber}55`,
              }}>
                Launch Dashboard <ArrowRight size={18} />
              </button>
            </Link>
            <a href="https://api.zerogex.io/docs" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '16px 32px',
                fontSize: 16, fontWeight: 600, color: C.light,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <BookOpen size={16} /> Read the API Docs
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`, padding: '48px 32px 32px',
        background: `${C.card}66`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 32,
            justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36,
          }}>
            <div style={{ maxWidth: 280 }}>
              <Link href="/">
                <img
                  src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
                  alt="ZeroGEX" style={{ height: 108, width: 'auto', marginBottom: 12 }}
                />
              </Link>
              <p style={{ fontSize: 13, color: subtext, lineHeight: 1.65, margin: 0 }}>
                Real-time gamma exposure analytics for options traders who want the institutional edge.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.amber, marginBottom: 14 }}>Platform</div>
                {[['/dashboard', 'Dashboard'], ['/gamma-exposure', 'Gamma Exposure'], ['/flow-analysis', 'Flow Analysis'], ['/trading-signals', 'Trading Signals']].map(([href, label]) => (
                  <div key={href} style={{ marginBottom: 8 }}>
                    <Link href={href} style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}>{label}</Link>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.amber, marginBottom: 14 }}>Tools</div>
                {[['/intraday-tools', 'Intraday Tools'], ['/max-pain', 'Max Pain'], ['/options-calculator', 'Options Calc'], ['/about', 'About & API']].map(([href, label]) => (
                  <div key={href} style={{ marginBottom: 8 }}>
                    <Link href={href} style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}>{label}</Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{
            borderTop: `1px solid ${C.border}`, paddingTop: 20,
            display: 'flex', flexWrap: 'wrap', gap: 12,
            justifyContent: 'space-between', alignItems: 'center',
          }}>
            <p style={{ fontSize: 12, color: subtext, margin: 0 }}>© 2026 ZeroGEX, LLC. All rights reserved.</p>
            <p style={{ fontSize: 12, color: subtext, margin: 0, maxWidth: 500, textAlign: 'right' }}>
              Trading involves substantial risk. Past performance is not indicative of future results.
              This platform is for informational purposes only, not investment advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
