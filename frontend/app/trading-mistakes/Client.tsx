'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Moon,
  ShieldAlert,
  Sun,
  TrendingDown,
  TrendingUp,
  Activity,
  Target,
} from 'lucide-react';

const C = {
  bg: 'var(--color-bg)',
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  green: 'var(--color-positive)',
  red: 'var(--color-negative)',
  border: 'var(--border-default)',
};

type Mistake = {
  number: string;
  title: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  iconColor: string;
  mistake: string;
  whatHappens: string;
  zerogex: string;
  reference: { href: string; label: string };
  imagePath: string;
  imageAlt: string;
};

const MISTAKES: Mistake[] = [
  {
    number: '01',
    title: 'Buying into a call wall',
    icon: TrendingUp,
    iconColor: 'var(--color-positive)',
    mistake:
      'Chasing a rally just as price approaches the heaviest call gamma strike — the level where dealer hedging is structurally set up to absorb the move.',
    whatHappens:
      'In a long-gamma regime, dealers must sell into rallies to stay delta-neutral. That structural reflex caps the move. Late buyers get the worst entry; the rip fades; the trade is underwater within minutes.',
    zerogex:
      'The Call Wall card surfaces the current heaviest call gamma strike with live distance from spot. Combined with the gamma flip, you see whether the wall is in a regime that will absorb the move (long-gamma) or release it (short-gamma).',
    reference: { href: '/education/gamma-walls-explained', label: 'Gamma Walls Explained' },
    imagePath: '/blog/zerogex-walls-cards.png',
    imageAlt: 'ZeroGEX Call Wall and Put Wall cards with live distance from spot',
  },
  {
    number: '02',
    title: 'Shorting into a put wall',
    icon: TrendingDown,
    iconColor: 'var(--color-negative)',
    mistake:
      'Selling into a slide right as price approaches the heaviest put gamma strike below spot.',
    whatHappens:
      'In a long-gamma regime, dealers must buy into weakness around the put wall — the structural bid catches the decline. Late shorts get squeezed back through the level; the trade reverses violently.',
    zerogex:
      'The Put Wall card shows the heaviest put gamma strike with live distance from spot. Cross-checked against the regime read, you know when the wall is likely to act as support and when (in a short-gamma regime) it can become a slippage point on the way down.',
    reference: { href: '/education/gamma-walls-explained', label: 'Gamma Walls Explained' },
    imagePath: '/blog/zerogex-walls-chart.png',
    imageAlt: 'ZeroGEX walls chart highlighting the call wall and put wall on the strike-by-strike gamma profile',
  },
  {
    number: '03',
    title: 'Chasing the middle of a pinned range',
    icon: Target,
    iconColor: 'var(--color-brand-primary)',
    mistake:
      'Entering long or short in the middle of a tight intraday range where price is being pulled toward a heavy gamma strike.',
    whatHappens:
      'Pin gravity sucks price back to the magnet strike. Whichever direction you entered, the move reverses on you. Death-by-chop. The setup is unwinnable because the structural pull is against every break out of the middle.',
    zerogex:
      'The Max Pain card and the gamma magnet strike show where the structural pull lives. When the EOD Pressure signal reads near-zero inside the closing window, that\'s the regime signature of a pin — fade extremes only; don\'t chase the middle.',
    reference: { href: '/education/max-pain-explained', label: 'Max Pain — Does It Actually Work?' },
    imagePath: '/blog/zerogex-max-pain-card.png',
    imageAlt: 'ZeroGEX Max Pain card with live distance from spot',
  },
  {
    number: '04',
    title: 'Ignoring gamma flip regime changes',
    icon: Activity,
    iconColor: 'var(--color-brand-primary)',
    mistake:
      'Running the same playbook above and below the gamma flip — fading breakouts in both regimes, or chasing breakouts in both regimes.',
    whatHappens:
      'Above the flip (long-gamma), breakouts fade and mean-reversion works. Below the flip (short-gamma), breakouts extend and mean-reversion gets crushed. Same setup, opposite results, depending on a single threshold most traders never see.',
    zerogex:
      'The Gamma Flip card shows live distance from spot at every refresh. When spot crosses the flip, the regime has changed — and the playbook should change with it. The Net GEX magnitude tells you how sharp the regime is right now.',
    reference: { href: '/education/how-to-read-a-gamma-flip', label: 'How to Read a Gamma Flip' },
    imagePath: '/blog/zerogex-gamma-flip-card.png',
    imageAlt: 'ZeroGEX Gamma Flip card showing SPX spot above the flip with live distance',
  },
  {
    number: '05',
    title: 'Treating every breakout as real',
    icon: ShieldAlert,
    iconColor: 'var(--color-negative)',
    mistake:
      'Buying every upside break above resistance — or selling every downside break below support — without checking whether positioning supports the move.',
    whatHappens:
      'In a long-gamma regime with strengthening dealer positioning, dealers absorb breakouts. Price pokes above resistance, runs into supply, and snaps back into the range. The breakout was a trap. The fade entry would have worked; the chase did not.',
    zerogex:
      'The Trap Detection signal scores [-1, +1] for whether the current break is structurally likely to fail. When it triggers in the opposite direction of a recent break, the read is "fade, don\'t chase." Cross-checked against the regime, that\'s the cleanest fade-the-breakout setup in the stack.',
    reference: { href: '/education/eod-pressure-and-trap-detection', label: 'EOD Pressure & Trap Detection' },
    imagePath: '/blog/zerogex-strike-profile-overview.png',
    imageAlt: 'ZeroGEX strike-profile chart with the dealer gamma curve, flip line, and walls highlighted',
  },
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="zg-eyebrow"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color: C.amber,
      }}
    >
      {children}
    </span>
  );
}

function MistakeSection({ mistake }: { mistake: Mistake }) {
  const Icon = mistake.icon;
  return (
    <article
      className="zg-panel trading-mistake-row"
      style={{
        padding: '32px clamp(20px, 4vw, 40px)',
        marginBottom: 28,
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)',
        gap: 32,
        alignItems: 'start',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: C.amber,
              letterSpacing: '-1px',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {mistake.number}
          </div>
          <Icon size={24} strokeWidth={1.75} style={{ color: mistake.iconColor, flexShrink: 0, marginTop: 2 }} />
        </div>

        <h2
          style={{
            margin: '0 0 16px',
            fontSize: 'clamp(22px, 3vw, 28px)',
            fontWeight: 800,
            color: C.light,
            lineHeight: 1.2,
            letterSpacing: '-0.3px',
          }}
        >
          {mistake.title}
        </h2>

        <p style={{ margin: '0 0 14px', fontSize: 15, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.light, fontWeight: 700 }}>The mistake.</strong> {mistake.mistake}
        </p>

        <p style={{ margin: '0 0 22px', fontSize: 15, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.light, fontWeight: 700 }}>What happens.</strong> {mistake.whatHappens}
        </p>

        <div
          style={{
            padding: '18px 20px',
            borderRadius: 'var(--radius-panel)',
            background: `${C.amber}12`,
            border: `1px solid ${C.amber}55`,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: C.amber,
              marginBottom: 8,
            }}
          >
            <CheckCircle2 size={14} /> How ZeroGEX prevents it
          </div>
          <p style={{ margin: 0, fontSize: 14, color: C.light, lineHeight: 1.65, fontWeight: 500 }}>
            {mistake.zerogex}
          </p>
        </div>

        <Link
          href={mistake.reference.href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: C.amber,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Deeper read: {mistake.reference.label} <ArrowRight size={14} />
        </Link>
      </div>

      <figure
        className="zg-panel"
        style={{
          margin: 0,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mistake.imagePath}
          alt={mistake.imageAlt}
          loading="lazy"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </figure>
    </article>
  );
}

export default function TradingMistakesClient() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{ background: 'transparent', color: C.light, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @media (max-width: 760px) {
          .trading-mistake-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: `${C.bg}ee`,
          borderBottom: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/" className="h-full flex items-center overflow-hidden flex-shrink-0" style={{ textDecoration: 'none', lineHeight: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Link href="/pricing" style={{ textDecoration: 'none' }}>
            <button
              className="zg-btn zg-btn--secondary"
              style={{
                padding: '8px 14px',
                fontSize: 13,
              }}
            >
              Pricing
            </button>
          </Link>
          <Link href="/spx-gamma-levels" style={{ textDecoration: 'none' }}>
            <button
              className="zg-btn zg-btn--primary"
              style={{
                padding: '8px 14px',
                fontSize: 13,
              }}
            >
              Free Gamma Levels <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '60vh', padding: '120px 24px 60px', position: 'relative' }}>
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
            opacity: 0.6,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <Pill>
            <ShieldAlert size={14} /> Trader Mistakes ZeroGEX Helps You Avoid
          </Pill>

          <h1
            style={{
              margin: '20px 0 16px',
              fontSize: 'clamp(36px, 5.5vw, 64px)',
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              color: C.light,
              fontWeight: 900,
            }}
          >
            5 trading mistakes{' '}
            <span
              style={{
                color: 'var(--color-accent-hot)',
              }}
            >
              ZeroGEX helps you avoid.
            </span>
          </h1>

          <p style={{ margin: '0 auto 18px', maxWidth: 760, color: C.light, fontSize: 19, lineHeight: 1.55, fontWeight: 500 }}>
            Every one of these costs SPY/SPX day traders real money — and every one of them is the kind of structural setup that&apos;s readable in real time if you know where to look.
          </p>
          <p style={{ margin: '0 auto', maxWidth: 700, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
            The dealer book sets up these traps; the trader who can&apos;t see the dealer book walks into them. Here&apos;s what each mistake looks like, what happens when you make it, and the specific ZeroGEX surface that prevents it.
          </p>
        </div>
      </section>

      {/* Mistakes */}
      <section style={{ padding: '0 24px 60px', maxWidth: 1140, margin: '0 auto' }}>
        {MISTAKES.map((m) => (
          <MistakeSection key={m.number} mistake={m} />
        ))}
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px 100px', textAlign: 'center', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <Pill>
            <BarChart2 size={14} /> Free Public Dashboard
          </Pill>
          <h2
            style={{
              margin: '20px 0 16px',
              fontSize: 'clamp(28px, 4.5vw, 44px)',
              lineHeight: 1.1,
              letterSpacing: '-1px',
              color: C.light,
              fontWeight: 900,
            }}
          >
            See the structural map{' '}
            <span
              style={{
                color: 'var(--color-accent-hot)',
              }}
            >
              before your next trade.
            </span>
          </h2>
          <p style={{ margin: '0 auto 28px', maxWidth: 620, fontSize: 16, color: C.muted, lineHeight: 1.65 }}>
            The ZeroGEX free dashboard surfaces today&apos;s gamma flip, call and put walls, max pain, and dealer gamma profile for SPY, SPX, and QQQ. No signup, no card.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <Link href="/spx-gamma-levels" style={{ textDecoration: 'none' }}>
              <button
                className="zg-btn zg-btn--primary"
                style={{
                  padding: '16px 32px',
                  fontSize: 15,
                }}
              >
                Open the free gamma levels <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/pricing" style={{ textDecoration: 'none' }}>
              <button
                className="zg-btn zg-btn--secondary"
                style={{
                  padding: '16px 32px',
                  fontSize: 15,
                }}
              >
                See pricing <ArrowRight size={18} />
              </button>
            </Link>
          </div>

          <p style={{ marginTop: 24, color: C.muted, fontSize: 13, lineHeight: 1.65, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' }}>
            Educational content only — not financial advice. ZeroGEX surfaces structural reads on dealer positioning; trade decisions remain yours.
          </p>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
