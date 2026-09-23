import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Ban, KeyRound, Radio } from 'lucide-react';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import { INTEGRATIONS_HUB } from '@/core/integrations';

// A landing for Collective2 strategy managers — people who already run a
// systematic strategy and publish its signals, who are an unusually exact
// match for what the API sells.
//
// WHAT THIS PAGE IS, AND WHAT IT DELIBERATELY IS NOT
// -------------------------------------------------
// It is NOT a Collective2 integration. There is no C2 credential here, nothing
// of ours is submitted to C2, and no ZeroGEX strategy is published there. The
// page sells the EXISTING Pro API to an audience that already has the problem
// it solves; it ships no new code path and — this is the point of it — adds no
// onward distribution channel to inventory (F8 in
// oa:docs/compliance/market-data-licensing-audit-2026-09-02.md), because the
// data still leaves through exactly one door: the API the reader already has
// to buy.
//
// The alternative that was considered and deferred is publishing ZeroGEX's own
// signal-engine book as a C2 strategy. That is a different proposition with a
// real compliance surface, and the decision behind it is not an engineering
// one; see docs/integrations-ibkr-collective2-feasibility.md §2.
//
// So the copy below has to hold a line it would be easy to blur: ZeroGEX is
// UPSTREAM of the reader's decision, never between them and C2. Anything that
// reads as "follow our signals and relay them" is wrong on the facts and
// starts a conversation about what we are registered to do. The "What this is
// not" section is load-bearing, not boilerplate.

const PATH = '/collective2-strategy-data';
const TITLE = 'Dealer Positioning Data for Collective2 Strategy Managers — ZeroGEX API';
const DESCRIPTION =
  'Feed gamma flip, call wall, put wall, max pain and the per-strike gamma profile into the strategy you publish on Collective2. One REST call, six symbols, refreshed through the session. An input to your rules — not a signal service, and not a bridge to C2.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    siteName: SITE_NAME,
    images: [{ url: SITE_DEFAULT_OG_IMAGE, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_DEFAULT_OG_IMAGE],
  },
};

// WebPage rather than SoftwareApplication: nothing is downloaded here. The
// four integration landings each declare an application because each ships
// one; this page describes an audience's use of an API, so declaring a fifth
// application would invent a product that does not exist.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  audience: { '@type': 'Audience', audienceType: 'Systematic trading strategy developers' },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
};

const API_DOCS = 'https://api.zerogex.io/docs';

const SECTION_STYLE = {
  border: '1px solid var(--border-default)',
  borderRadius: 18,
  padding: 'var(--ind-card-pad)',
  marginBottom: 32,
  background: 'var(--color-surface)',
} as const;

const H2_STYLE = {
  margin: '0 0 12px 0',
  fontSize: 23,
  fontWeight: 800,
  letterSpacing: '-0.3px',
} as const;

const BODY_STYLE = {
  margin: '0 0 16px 0',
  fontSize: 14.5,
  lineHeight: 1.7,
  color: 'var(--color-text-secondary)',
  maxWidth: 760,
} as const;

const STRONG = { color: 'var(--color-text-primary)' } as const;

const CTA_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 20px',
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 800,
  textDecoration: 'none',
} as const;

const PRIMARY_CTA = { ...CTA_BASE, background: 'var(--color-brand-accent)', color: '#ffffff' } as const;
const SECONDARY_CTA = {
  ...CTA_BASE,
  border: '1px solid var(--border-default)',
  color: 'var(--color-text-primary)',
} as const;

// The one call, written the way a strategy actually has to use it: both
// null-checks are in the contract, and a strategy that skips them trades on a
// stale or unresolved level. Cheaper to show it here than to answer it in
// support after someone's subscribers have worn the trade.
const SAMPLE = `import os, requests

URL  = "https://api.zerogex.io/api/v1/levels/{symbol}"
HEAD = {"Authorization": f"Bearer {os.environ['ZEROGEX_API_KEY']}"}

snap = requests.get(URL.format(symbol="SPX"), headers=HEAD, timeout=5).json()

# Freshness is explicit, so staleness is your decision rather than a surprise.
if (snap["age_seconds"] or 0) > 180:
    return                      # snapshot is old — sit this cycle out

flip = snap["levels"]["gamma_flip"]
if flip is None:
    return                      # unresolved on a thin chain — hide, don't zero

long_gamma = snap["net_gex_at_spot"] > 0    # dealers hedging against the move
above_flip = snap["spot"] > flip

# ...your rules take it from here. The order you send to C2 is still yours.`;

const USES = [
  {
    title: 'A regime filter, separate from your entry',
    body: 'The sign of net gamma at spot says whether dealer hedging is damping moves or amplifying them. That is a different question from "is my setup present", and it is one most systematic strategies have no input for at all, because it comes off the option chain rather than off the tape.',
  },
  {
    title: 'Location, as a target or an invalidation',
    body: 'The call wall and put wall are where modeled dealer gamma is most concentrated. Distance to them gives a strategy something to size against, take profit into, or stand down in front of — a number that moves with the option chain rather than with price history.',
  },
  {
    title: 'The gamma flip as a bias line',
    body: 'One level, published per symbol, that a strategy can read as a directional gate. It is also the level that most often resolves to null on a thin chain, which is why the sample above checks.',
  },
  {
    title: 'The full per-strike profile when you want to model it yourself',
    body: 'The same call returns the gamma profile nearest to spot — up to 200 strikes, aggregated across expirations, with call and put exposure signed separately. If your edge is in the shape rather than the headline levels, it is all in the one response.',
  },
];

const NOT = [
  {
    title: 'Not a signal service to relay',
    body: 'We publish analytics, not trades for you to forward. There is no ZeroGEX strategy on Collective2 to subscribe to or mirror, and nothing here tells you what to buy.',
  },
  {
    title: 'Not a bridge to Collective2',
    body: 'ZeroGEX never connects to C2 or to your broker, holds no C2 credential, and sees neither your strategy nor your orders. You call our API; you submit your own signals exactly as you do now.',
  },
  {
    title: 'Not affiliated with Collective2',
    body: 'ZeroGEX is an independent data provider. Collective2 is a trademark of its owner, referenced here only to describe who this page is for. There is no partnership, endorsement or revenue share between us.',
  },
  {
    title: 'Not investment advice',
    body: 'Dealer positioning is modeled from the option chain under a disclosed convention, not observed directly. What you do with it, and what your subscribers wear, is yours.',
  },
];

function FlowStep({ label, sub, muted = false }: { label: string; sub: string; muted?: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 150px',
        minWidth: 140,
        border: `1px solid color-mix(in srgb, var(${muted ? '--border-subtle' : '--color-brand-accent'}) 27%, transparent)`,
        background: muted ? 'var(--color-bg)' : 'color-mix(in srgb, var(--color-brand-accent) 6%, transparent)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>{sub}</div>
    </div>
  );
}

export default function Collective2StrategyDataPage() {
  return (
    <IndicatorPageShell crumb="Collective2 Strategy Data" path={PATH} jsonLd={JSON_LD}>
      <header style={{ marginBottom: 40 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--color-brand-accent)',
            border: '1px solid color-mix(in srgb, var(--color-brand-accent) 27%, transparent)',
            background: 'color-mix(in srgb, var(--color-brand-accent) 8%, transparent)',
            borderRadius: 999,
            padding: '5px 14px',
            marginBottom: 18,
          }}
        >
          <Radio size={12} /> Pro API · For strategy managers
        </div>

        <h1
          style={{
            margin: '0 0 16px 0',
            fontSize: 'clamp(28px, 4.2vw, 38px)',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-0.4px',
          }}
        >
          Dealer positioning as an input to your Collective2 strategy
        </h1>

        <p style={{ ...BODY_STYLE, fontSize: 16 }}>
          You write the rules and you publish the signals. ZeroGEX supplies one input a standard market
          data feed does not carry — <strong style={STRONG}>where dealers are hedged</strong> — recomputed
          through the session and served over a documented REST API.
        </p>
        <p style={BODY_STYLE}>
          It sits <strong style={STRONG}>upstream of your decision</strong>, never between you and C2. We
          hold no Collective2 credential, submit nothing on your behalf, and never see your strategy or
          your orders.
        </p>
      </header>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>Where it sits</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch', marginBottom: 16 }}>
          <FlowStep label="ZeroGEX API" sub="Levels and the gamma profile, per symbol" />
          <FlowStep label="Your strategy" sub="Your rules, your code, your judgement" />
          <FlowStep label="Collective2" sub="You submit your signals, as you do today" muted />
          <FlowStep label="Your subscribers" sub="Autotrade at their own broker" muted />
        </div>
        <p style={{ ...BODY_STYLE, marginBottom: 0 }}>
          The two boxes on the right are yours and C2&apos;s and we are not in either of them. Every
          arrangement you already have with Collective2 — your listing, your fee, your track record, your
          subscribers — is unchanged by adding us on the left.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>What one call gives you</h2>
        <p style={BODY_STYLE}>
          <code style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
            GET /api/v1/levels/{'{symbol}'}
          </code>{' '}
          returns the gamma flip, call wall, put wall, max pain and pin strike, plus net gamma at spot,
          the underlying&apos;s price, and the per-strike gamma profile — for{' '}
          <strong style={STRONG}>SPX, SPY, QQQ, NDX, ES and NQ</strong>. It is a versioned contract, so
          the field names do not move under you, and it carries only derived analytics — never raw
          per-contract quotes.
        </p>
        <p style={BODY_STYLE}>
          The numbers refresh on roughly a 60-second analytics cycle, and every response states its own
          freshness: <code>as_of</code>, <code>data_as_of</code> and <code>age_seconds</code>. Any level
          can come back <code>null</code> when the engine could not resolve it — hide it, do not treat it
          as zero. Both of those are things a strategy has to handle, so the sample handles them.
        </p>
        <pre
          style={{
            margin: '0 0 18px 0',
            padding: '18px 20px',
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            background: 'var(--color-bg)',
            overflowX: 'auto',
            fontSize: 12.5,
            lineHeight: 1.65,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--color-text-primary)',
          }}
        >
          <code>{SAMPLE}</code>
        </pre>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href={API_DOCS} target="_blank" rel="noopener noreferrer" style={PRIMARY_CTA}>
            Read the API docs <ArrowRight size={16} />
          </a>
          <Link href="/pricing?plan=pro" style={SECONDARY_CTA}>
            What Pro costs <KeyRound size={16} />
          </Link>
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>What strategy developers actually use it for</h2>
        <p style={BODY_STYLE}>
          We do not know what your strategy trades, so none of these is a recommendation and none comes
          with a backtest of yours. They are the four shapes the data takes in practice.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {USES.map((use) => (
            <div
              key={use.title}
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                padding: '18px',
                background: 'var(--color-bg)',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{use.title}</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
                {use.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={{ ...H2_STYLE, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Ban size={19} style={{ color: 'var(--color-text-secondary)' }} />
          What this is not
        </h2>
        <p style={BODY_STYLE}>
          Worth being blunt about, because &ldquo;data vendor&rdquo; and &ldquo;signal seller&rdquo; get
          conflated constantly in this corner of the market, and the difference matters to you more than
          it does to us.
        </p>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {NOT.map((item) => (
            <li
              key={item.title}
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 14,
                marginTop: 14,
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>{item.title}</div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 1.7,
                  color: 'var(--color-text-secondary)',
                  maxWidth: 760,
                }}
              >
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ ...SECTION_STYLE, marginBottom: 48 }}>
        <h2 style={H2_STYLE}>Getting a key</h2>
        <ol
          style={{
            margin: '0 0 18px 0',
            paddingLeft: 20,
            fontSize: 13.5,
            lineHeight: 1.75,
            color: 'var(--color-text-secondary)',
            maxWidth: 760,
          }}
        >
          <li>
            <strong style={STRONG}>Subscribe to Pro.</strong> API access is a Pro entitlement; there is no
            separate data plan to negotiate and nothing to wait for.
          </li>
          <li>
            <strong style={STRONG}>Generate the key yourself.</strong>{' '}
            <Link href="/account#api-access" style={{ color: 'var(--color-brand-accent)' }}>
              Account → API Access
            </Link>
            . It is revealed once, so put it straight into your secret store. Regenerating revokes the old
            one, so rotation is a single click.
          </li>
          <li>
            <strong style={STRONG}>Send it as a bearer token</strong> on every request. Rate limits are
            per key and sized for production polling; over-limit responses return{' '}
            <code>429</code> with <code>Retry-After</code>.
          </li>
        </ol>
        <p style={{ ...BODY_STYLE, marginBottom: 0, fontSize: 13.5 }}>
          Developing against a chart while you build the rules?{' '}
          <Link href={INTEGRATIONS_HUB.href} style={{ color: 'var(--color-brand-accent)', fontWeight: 700 }}>
            The chart integrations
          </Link>{' '}
          draw the same levels the API returns, so what you see while you work and what your strategy
          reads are the same numbers.
        </p>
      </section>
    </IndicatorPageShell>
  );
}
