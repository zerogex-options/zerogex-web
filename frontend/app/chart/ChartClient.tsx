'use client';

/**
 * The Gamma Terminal — ZeroGEX's flagship, proprietary trading surface.
 *
 * Every retail trader already has candles. What they don't have is candles
 * with the dealer-gamma structure drawn inline: the Gamma Flip that splits the
 * pinning regime from the trending one, the Call/Put Walls that act as magnets
 * and brakes, Max Pain, the GEX ribbons behind the tape — and, beside the
 * chart, the per-strike book itself, as either two strike-aligned Net-GEX
 * ladders or the chart's own gamma-structure rail (see TerminalSurface).
 *
 * This page is the fold of what used to be two: the Gamma Chart (this route,
 * public and delayed for anonymous visitors) and the Gamma Terminal (a
 * members-only beta at /gamma-terminal, now 301'd here). Nothing was dropped
 * in the fold — the ladders came over, the strike panel and its four views
 * stayed, and the public, ~15-minute-delayed mode now covers both.
 *
 * It renders in two modes, driven by `snapshot`:
 *   • live (snapshot = null) — the subscriber view; everything polls in real time.
 *   • delayed (snapshot set) — the public view; the chart, the Key Levels strip,
 *     the ladders and the Playbook all render frozen, ~15-min-delayed server
 *     snapshots and do zero client fetching. The page (a server component)
 *     picks the mode from the visitor's session.
 *
 * The mode also decides how much prose the hero opens with. A member has
 * already bought the argument, so the pitch and the spec row start folded
 * behind a one-line disclosure; the public page still has to make the case, so
 * they start open. Either reader can toggle it.
 */

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Columns3, Gauge, Layers, LineChart, Sparkles, Target, Waves } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import type { ChartSnapshot } from '@/components/GammaTerminalChart';
import TooltipWrapper from '@/components/TooltipWrapper';
import { SYMBOLS } from '@/core/symbols';
import GammaExpectationMatrix from '@/components/GammaExpectationMatrix';
import KeyLevelsStrip from '@/components/KeyLevelsStrip';
import TerminalSurface, { type LadderSnapshots } from './TerminalSurface';

// The whole instrument, in the order a reader meets it. Lives behind the info
// icon beside the title so the hero stays short — it is the Gamma Terminal's
// reading guide, carried over verbatim in substance from the standalone page.
const INFO_TEXT =
  "The Gamma Chart with the per-strike dealer-gamma book beside it. The chart is candles with the Gamma Flip, " +
  "Call/Put Walls, Max Pain, Pin Strike and GEX King, plus the GEX ribbons behind the tape. Reading the ribbons: " +
  "every strike is a horizontal lane; every bar drops one orb in that lane sized by the strike's net dealer gamma " +
  "in the 5-minute analytics bucket the bar falls in, relative to the heaviest strike on screen. Gold means dealers " +
  "are net long gamma at that strike (they sell rallies and buy dips into it\u00a0- a magnet and a brake); violet means " +
  "net short (they chase\u00a0- an accelerant). A fat ribbon that persists all session is a wall; one that thickens is " +
  "positioning building, one that thins is eroding; a lane changing color is the strike flipping sides. Orbs are " +
  "capped to the lane, so a zoomed-in price axis makes them fatter and a wide one thinner, and the history covers " +
  "the polled strike window, so earlier bars stay blank. " +
  "Beside the tape you choose one of two readings of the same book. GAMMA LADDERS puts two strike-aligned Net-GEX " +
  "ladders next to the chart: the chart holds spot at the center of its tape and the ladders pin their spot row to " +
  "the same height, so the three instruments line up. The underlying you pick (from the first ladder's dropdown, " +
  "the chart's switcher or the header) drives the chart AND the first ladder; the second ladder compares any other " +
  "symbol and opens on the same index's other book (SPY↔SPX, ES→SPX, QQQ↔NDX, NQ→NDX). Both stay centered on spot " +
  "and strike-aligned, with the Gamma Flip, Call/Put Walls and Max Pain marked and the heaviest strike in view " +
  "crowned. After the options close, an ETF's latest analytics buckets can carry no positioning; the ladder then " +
  "shows the newest bucket that did and marks the rows 'as of' that time, while the header levels stay live. " +
  "STRIKE PANEL puts the gamma-structure rail there instead: net dealer gamma by price, drawn across the tape's " +
  "own price band so a strike's bar sits level with that price on the candles. It is the same rail the chart used " +
  "to carry in a narrow column inside itself, with the same four views\u00a0- a smoothed silhouette, or per-strike bars " +
  "in Net, Split (calls and puts apart) or Combined\u00a0- and the same optional on-bar $ labels, which move onto the " +
  "panel with it. The ladders and the rail answer the same question about the same book, so the panel shows one " +
  "at a time and your choice is remembered. " +
  "The chart itself is identical under either: same width, same toolbar, same overlays\u00a0- the GEX ribbons included, " +
  "since those read the tape rather than the panel. " +
  "The chart keeps its own toolbar for symbol, timeframe, price style, overlays, Expiry filter and Rewind. The " +
  "Expiry filter scopes the ladders too (Max Pain reads NA while filtered, as it has no per-expiry-set " +
  "equivalent). In Rewind, both ladders follow the chart's clock and show the book, spot and levels as of that " +
  "bucket, labelled with its time. Strikes shows only strikes carrying dealer gamma (Active) or every listed " +
  "strike near spot (All); Session Δ marks whether dealer gamma at each strike has built or eroded since the " +
  "09:30 ET open. " +
  "Gamma levels and Net GEX are modeled estimates of dealer positioning\u00a0- decision-support context only, not " +
  "investment advice.";

const EDGE_CARDS: Array<{ icon: React.ReactNode; accent: string; title: string; body: string }> = [
  {
    icon: <Gauge size={18} />,
    accent: 'var(--heat-mid)',
    title: 'Gamma Flip',
    body: 'The price where dealer gamma flips sign. Above it, dealers dampen moves (pinning); below it, they amplify them (trending). It is the single most important line on the chart\u00a0- and it is drawn for you.',
  },
  {
    icon: <Target size={18} />,
    accent: 'var(--color-bull)',
    title: 'Call & Put Walls',
    body: 'The strikes carrying the heaviest dealer gamma. They behave like magnets and brakes: price gets pinned toward them into expiry and often reverses off them. We plot both, right on the tape.',
  },
  {
    icon: <Columns3 size={18} />,
    accent: 'var(--color-flip)',
    title: 'Gamma Ladders',
    body: 'Two strike-aligned Net-GEX books beside the tape, pinned to the same spot row as the candles. Read your underlying strike by strike, and compare it against another\u00a0- SPY against SPX, QQQ against NDX\u00a0- in the same glance.',
  },
  {
    icon: <Waves size={18} />,
    accent: 'var(--color-navy)',
    title: 'Gamma Structure Rail',
    body: 'The other way to read the same book, in the same panel: net dealer gamma at every price, drawn across the tape\u2019s own price band as a silhouette or as per-strike Net / Split / Combined bars. The walls literally bulge out level with the candles they act on.',
  },
  {
    icon: <Sparkles size={18} />,
    accent: 'var(--color-warning)',
    title: 'GEX Ribbons',
    body: 'Per-strike dealer gamma through time, behind the tape. Gold lanes are strikes where dealers are long gamma, violet where they are short\u00a0- so you watch a wall build, erode or flip sides as the session runs.',
  },
  {
    icon: <Layers size={18} />,
    accent: 'var(--color-accent-hot)',
    title: 'Regime Zones',
    body: 'The backdrop is tinted by regime\u00a0- long-gamma pinning above the flip, short-gamma trending below. One glance tells you whether to fade extremes or ride momentum.',
  },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</span>
      <span className="zg-eyebrow" style={{ fontSize: 10, marginTop: 2 }}>{label}</span>
    </div>
  );
}

export default function ChartClient({
  snapshot = null,
  delayed = false,
  ladders = null,
}: {
  snapshot?: ChartSnapshot | null;
  delayed?: boolean;
  /** Frozen ladder columns for the public view (see app/chart/snapshot.ts). */
  ladders?: LadderSnapshots | null;
}) {
  // The hero pitch — what this surface is and what it carries — is written for
  // someone deciding whether it is worth paying for. A member has already
  // decided, and on a handset that paragraph plus the spec row is most of a
  // screen standing between them and the chart they came for. So it folds for
  // members and stays open for the public lead magnet; the toggle is there for
  // either, and the choice is nobody's but the reader's.
  //
  // `delayed` IS the paying-member signal, not a proxy for one: this route
  // renders delayed={false} only for a signed-in basic/pro session and the
  // frozen snapshot for everyone else. Keying the default off it also means the
  // indexable public HTML still ships this copy expanded, so nothing about the
  // free page changes for search.
  const [introOpen, setIntroOpen] = useState(delayed);

  return (
    <PageShell width="wide">
      {/* Hero */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: delayed ? 'var(--color-warning)' : 'var(--color-brand-primary)' }} />
          <span className="zg-eyebrow" style={{ color: delayed ? 'var(--color-warning)' : 'var(--color-brand-primary)' }}>
            {delayed ? 'Free preview · ~15-min delayed' : 'Proprietary · ZeroGEX only'}
          </span>
        </div>
        <div className="flex items-center gap-2.5" style={{ marginBottom: 12 }}>
          <h1 className="zg-h1" style={{ margin: 0 }}>The Gamma Terminal</h1>
          <TooltipWrapper text={INFO_TEXT} placement="bottom" />
        </div>

        {/* Key Levels, before the copy rather than after it: the whole point is
            that a phone shows the pin and the flip without scrolling, and the
            lead paragraph below is a screen tall on a handset. Delayed mode
            passes the snapshot straight through, so the public view stays
            frozen server data with zero client fetching, exactly like the
            chart — the public path costs nothing at all. In live mode it is a
            second useGammaPlaybook subscriber alongside the Playbook below,
            which is a deliberate trade: two 30s polls of two small JSON
            endpoints buys the guarantee that the strip and the chart resolve
            their levels through exactly the same code path. */}
        <KeyLevelsStrip snapshot={snapshot} delayed={delayed} className="mb-5" />

        <button
          type="button"
          className="zg-disclosure"
          aria-expanded={introOpen}
          aria-controls="chart-hero-intro"
          onClick={() => setIntroOpen((open) => !open)}
        >
          About this terminal
          {introOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Kept mounted and hidden rather than unmounted: aria-controls has to
            point at something that exists in both states, and the copy is
            static — there is nothing to tear down. */}
        <div id="chart-hero-intro" hidden={!introOpen}>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text-secondary)', maxWidth: 760, marginTop: 12 }}>
            Price and modeled dealer gamma on one surface. See where hedging pressure is modeled to
            concentrate&nbsp;- the Gamma Flip, the Call and Put Walls drawn inline on a fast, precise candle
            chart, and the per-strike book itself in a panel beside the tape: two Net-GEX ladders, or a
            silhouette of modeled dealer positioning at every price. Nothing else shows you this.
            {delayed && (
              <>
                {' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  This free preview is delayed about 15 minutes;
                </strong>{' '}
                members get it live.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-8 mt-5">
            {/* Derived from the same SYMBOLS the chart's own switcher maps, so
                the hero cannot advertise a different set from the one it
                renders — this line still read SPY · QQQ · SPX · NDX after ES
                and NQ shipped. */}
            <Stat value={SYMBOLS.join(' · ')} label="Underlyings" />
            <Stat value="1m → 1D" label="Timeframes" />
            <Stat value={delayed ? '~15 min' : 'Live'} label={delayed ? 'Delayed preview' : 'Dealer gamma overlay'} />
          </div>
        </div>
      </header>

      {/* The instrument: the chart, plus the ladders or the strike panel. */}
      <TerminalSurface snapshot={snapshot} delayed={delayed} ladders={ladders} />

      {/* Why it's different */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <LineChart size={16} style={{ color: 'var(--text-secondary)' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            What you&apos;re looking at
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EDGE_CARDS.map((c) => (
            <div
              key={c.title}
              className="zg-feature-shell p-4 flex flex-col gap-3"
              style={{ borderTop: `2px solid ${c.accent}` }}
            >
              <div
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 'var(--radius-control)', color: c.accent, background: `color-mix(in srgb, ${c.accent} 12%, transparent)` }}
              >
                {c.icon}
              </div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Where do we expect the underlying to go — the regime × wall playbook.
          Fed the same snapshot/mode as the chart so the delayed public view
          reads the frozen snapshot and does no client fetching either. */}
      <GammaExpectationMatrix className="mb-10" snapshot={snapshot} delayed={delayed} />

      {/* Conversion (delayed) or cross-links to deeper tools (live) */}
      {delayed ? (
        <section
          className="zg-feature-shell p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 mb-4"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--color-warning)' }}
        >
          <div className="flex-1">
            <span className="zg-eyebrow" style={{ color: 'var(--color-warning)' }}>Unlock live</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 6px' }}>
              Get the real-time terminal&nbsp;- every symbol, every timeframe
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 620 }}>
              You&apos;re viewing a ~15-minute-delayed snapshot of SPY. Members get the live terminal&nbsp;- real-time
              dealer gamma, {SYMBOLS.join('/')}, all timeframes, the Expiry filter, Session Δ and Rewind&nbsp;- plus the
              full dealer-positioning suite.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/register" className="zg-btn zg-btn--primary">
              Start free <ArrowRight size={15} />
            </Link>
            <Link href="/pricing" className="zg-btn zg-btn--secondary">
              See plans
            </Link>
          </div>
        </section>
      ) : (
        <section
          className="zg-feature-shell p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 mb-4"
          style={{ background: 'var(--bg-subtle)' }}
        >
          <div className="flex-1">
            <span className="zg-eyebrow" style={{ color: 'var(--color-brand-primary)' }}>Go deeper</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 6px' }}>
              The full dealer-positioning breakdown
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 620 }}>
              The terminal shows you the levels and the book. The Dealer Positioning and GEX Strike Profile pages show
              you the forces behind them&nbsp;- net GEX by strike, vanna and charm flows, and the volatility surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/gamma-exposure" className="zg-btn zg-btn--primary">
              Dealer Positioning <ArrowRight size={15} />
            </Link>
            <Link href="/gex-strike-profile" className="zg-btn zg-btn--secondary">
              GEX Strike Profile
            </Link>
          </div>
        </section>
      )}

      <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-muted)', maxWidth: 820 }}>
        Gamma levels and Net GEX are modeled estimates of dealer positioning derived from the options chain
        {delayed ? ' and, in this free preview, are delayed approximately 15 minutes' : ' and update throughout the session'}.
        They are decision-support context, not a guarantee of price behavior, and are not investment advice.
      </p>
    </PageShell>
  );
}
