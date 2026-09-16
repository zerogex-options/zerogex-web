import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import IndicatorPageShell from '@/components/IndicatorPageShell';
import { SITE_DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/core/articleRegistry';
import EmbedBuilder from './EmbedBuilder';

// The widget's storefront: where someone who writes about the market picks up a
// block of today's dealer positioning for their own page.
//
// WHY THIS PAGE EXISTS. The 4 September Search Console review ended on the one
// finding on-page work cannot fix: the pillar ranks ~55 for "gamma exposure"
// because almost nothing outside the site links here, and the only instrument
// for that is docs/seo/backlink-kit.md — manual, one placement at a time,
// mostly nofollow. A ticker-expansion play is not available to answer it
// either: six symbols are ingested, so there is no long tail of /<ticker>-
// gamma-levels pages to mint. This page is the other lever. Each embed is a
// link someone chose to keep, next to a card that refreshes itself every
// market day, on a site whose readers already care about SPX structure.
//
// The honest constraint, stated here so nobody has to rediscover it: the
// <iframe> earns no link equity at all — its href points from our origin to our
// origin. The plain <a> the snippet puts in the HOST's markup is the entire SEO
// mechanism, and EmbedBuilder tells the embedder they may rewrite its anchor.
// Distributing one identical over-optimized anchor at scale is what Google
// calls a link scheme; a credit line the publisher controls is not, and it is
// the only version consistent with the white-hat rule the outreach kit sets.

const PATH = '/embed';
const TITLE = 'Free Gamma Levels Widget: Embed SPX, SPY & QQQ Levels on Your Site';
const DESCRIPTION =
  'Put today’s gamma flip, call wall, put wall and net GEX on your own site with one line of HTML. Free, no signup, no API key, no cookies — refreshed every 15 minutes for SPX, SPY, QQQ, NDX, ES and NQ.';

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

const FAQ = [
  {
    q: 'Is the gamma levels widget really free?',
    a: 'Yes. It is free to embed on any site, with no account, no API key and no limit on page views. It shows the same 15-minute-delayed levels the public gamma-levels pages show. Real-time data and intraday signals are what the paid plans are for.',
  },
  {
    q: 'How often does the widget update?',
    a: 'The levels refresh every 15 minutes through the trading session, and the widget is cached for the same 15 minutes. You paste the snippet once; the card keeps itself current every market day with no further work.',
  },
  {
    q: 'Does the widget track my readers?',
    a: 'No. The widget sets no cookies, runs no analytics, and does not identify anyone who sees it. The optional "your site" field only tags the outbound link so we can see which sites send readers — it says nothing about the individual reader.',
  },
  {
    q: 'Which symbols can I embed?',
    a: 'SPX, SPY, QQQ, NDX, ES and NQ. ES and NQ levels are derived from the SPX and NDX option chains and carried onto the futures price axis, which the widget states on the card itself.',
  },
  {
    q: 'Can I change the credit line under the widget?',
    a: 'Yes, and you are welcome to. Reword the link text so it fits your page, or describe the widget in your own sentence. We ask only that the credit points at the relevant gamma-levels page so your readers can find the full picture.',
  },
  {
    q: 'Will the widget break my page layout?',
    a: 'It is responsive down to phone width and ships with a fixed fallback height. The optional embed.js script sizes the frame to its content so there is never a scrollbar or a gap; without it the snippet still renders correctly at the fallback height.',
  },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}${PATH}`,
  publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const SECTION_STYLE = {
  border: '1px solid var(--border-default)',
  borderRadius: 18,
  padding: '28px',
  marginBottom: 32,
  background: 'var(--color-surface)',
} as const;

const H2_STYLE = { margin: '0 0 12px 0', fontSize: 23, fontWeight: 800, letterSpacing: '-0.3px' } as const;

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

const PROMISES = [
  {
    icon: Zap,
    title: 'One line of HTML',
    body: 'No build step, no npm package, no API key. It works in WordPress, Ghost, Substack, Webflow, Notion-backed sites and plain hand-written HTML.',
  },
  {
    icon: RefreshCw,
    title: 'Updates itself',
    body: 'Paste it once. The card re-reads the option chain every 15 minutes through the session, so the levels under your writing are never yesterday’s.',
  },
  {
    icon: ShieldCheck,
    title: 'Nothing loaded onto your readers',
    body: 'No cookies, no trackers, no webfonts, no React runtime. The frame is a single small document that cannot reach into your page or slow it down.',
  },
];

export default function EmbedPage() {
  return (
    <IndicatorPageShell crumb="Gamma Levels Widget" path={PATH} jsonLd={JSON_LD}>
      <header style={{ marginBottom: 36 }}>
        <p
          style={{
            display: 'inline-block',
            padding: '5px 14px',
            borderRadius: 999,
            border: '1px solid var(--border-default)',
            color: 'var(--color-brand-accent)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}
        >
          Free · No signup · No API key
        </p>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-1.1px', lineHeight: 1.1, margin: '0 0 16px 0' }}>
          Put today&rsquo;s gamma levels on your site
        </h1>
        <p style={{ ...BODY_STYLE, fontSize: 17, maxWidth: 720 }}>
          A small card showing the <strong style={STRONG}>gamma flip</strong>, the{' '}
          <strong style={STRONG}>call wall</strong>, the <strong style={STRONG}>put wall</strong> and{' '}
          <strong style={STRONG}>net dealer GEX at spot</strong> for SPX, SPY, QQQ, NDX, ES or NQ.
          It refreshes every 15 minutes on its own, so the structure under your market write-up stays
          current without you touching it again.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginBottom: 36 }}>
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 16,
              padding: '20px',
              background: 'var(--color-surface)',
            }}
          >
            <Icon size={19} style={{ color: 'var(--color-brand-accent)', marginBottom: 10 }} />
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 7px 0' }}>{title}</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: 0 }}>{body}</p>
          </div>
        ))}
      </div>

      <section style={SECTION_STYLE} aria-labelledby="builder-heading">
        <h2 id="builder-heading" style={H2_STYLE}>
          Build your snippet
        </h2>
        <p style={BODY_STYLE}>
          Pick a symbol and a theme, check the preview, and copy the HTML. It is the live widget
          below &mdash; not a mockup.
        </p>
        <EmbedBuilder />
      </section>

      <section style={SECTION_STYLE} aria-labelledby="credit-heading">
        <h2 id="credit-heading" style={H2_STYLE}>
          About the credit line
        </h2>
        <p style={BODY_STYLE}>
          The snippet includes a short line of text crediting ZeroGEX and linking to the gamma-levels
          page for the symbol you embedded. <strong style={STRONG}>Please reword it however you
          like</strong> so it reads as your own sentence &mdash; we would rather have a credit that
          fits your page than a hundred identical ones.
        </p>
        <p style={{ ...BODY_STYLE, marginBottom: 0 }}>
          If you would prefer to drop the credit entirely, that is fine too; the widget will keep
          working. It is there so your readers can get to the full picture, and so we can tell that
          the widget is worth continuing to give away.
        </p>
      </section>

      <section style={SECTION_STYLE} aria-labelledby="whatis-heading">
        <h2 id="whatis-heading" style={H2_STYLE}>
          What the numbers on the card mean
        </h2>
        <p style={BODY_STYLE}>
          Every value is <strong style={STRONG}>modeled dealer positioning</strong> derived from the
          option chain, not a forecast and not advice. The gamma flip is the level where modeled net
          dealer gamma changes sign; above it, hedging tends to damp moves, below it, hedging tends
          to amplify them. The call and put walls are the strikes where modeled dealer gamma is most
          concentrated. Net GEX at spot is the signed magnitude at the current price.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/education/gamma-exposure-explained" style={SECONDARY_CTA}>
            What is gamma exposure? <ArrowRight size={15} />
          </Link>
          <Link href="/education/how-to-read-a-gamma-flip" style={SECONDARY_CTA}>
            How to read a gamma flip <ArrowRight size={15} />
          </Link>
          <Link href="/methodology" style={SECONDARY_CTA}>
            Methodology <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section style={SECTION_STYLE} aria-labelledby="faq-heading">
        <h2 id="faq-heading" style={H2_STYLE}>
          Frequently asked questions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 6px 0' }}>{f.q}</h3>
              <p style={{ ...BODY_STYLE, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...SECTION_STYLE, marginBottom: 0 }} aria-labelledby="next-heading">
        <h2 id="next-heading" style={H2_STYLE}>
          Want the live version for yourself?
        </h2>
        <p style={BODY_STYLE}>
          The widget is the delayed, public slice. Real-time levels, the 0DTE profile, intraday
          signals and the full gamma terminal are what a plan unlocks.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/pricing" style={PRIMARY_CTA}>
            See plans <ArrowRight size={15} />
          </Link>
          <Link href="/spx-gamma-levels" style={SECONDARY_CTA}>
            Today&rsquo;s free SPX levels <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </IndicatorPageShell>
  );
}
