import Link from 'next/link';
import { Megaphone, Sparkles, Compass } from 'lucide-react';

export const metadata = {
  title: 'Product Updates | ZeroGEX',
  description:
    "What's new at ZeroGEX and what's coming next: the TradingView and NinjaTrader indicators, ES and NQ coverage, Gamma Shift, Pin Strike, and the road ahead. A running log of platform updates.",
  alternates: { canonical: '/updates' },
};

type Item = { title: string; href?: string; body: string };
type Update = {
  date: string;
  title: string;
  intro: string;
  whatsNew: Item[];
  whatsComing?: Item[];
};

// Newest first. Add a new object to the top of this array to publish an update.
const UPDATES: Update[] = [
  {
    date: 'August 30, 2026',
    title: 'Your levels on your own charts, plus futures',
    intro:
      'Two things people have asked for since the last note are here: the ZeroGEX levels on the chart you already trade, and real futures coverage. Here is everything that shipped since July, and where the platform goes next.',
    whatsNew: [
      {
        title: 'Your levels, on your own chart',
        href: '/tradingview-indicator',
        body: 'Two indicators that put the ZeroGEX levels on the chart you already trade. The TradingView script is free and draws the Gamma Flip, Call Wall, Put Wall, and Max Pain on SPY, SPX, QQQ, NDX, ES, or NQ, with optional cross-alerts. The NinjaTrader 8 indicator, included with Pro, polls the ZeroGEX API and keeps those levels current on its own, along with Pin Strike, the strikes carrying the most dealer gamma, and VWAP. You never retype a number.',
      },
      {
        title: 'ES and NQ',
        href: '/es-gamma-levels',
        body: 'Futures are first-class now. ES and NQ have their own gamma levels and their own free pages, and they carry the same read as SPY, SPX, QQQ, and NDX everywhere else on the site. The levels come from the SPX and NDX options books and are converted to futures prices on the live basis, so what you read is quoted where you actually trade.',
      },
      {
        title: 'Gamma Shift',
        href: '/gamma-shift',
        body: 'What changed, not just where things stand. Gamma Shift shows the per-strike move in dealer gamma between two points in time, read three ways. It also separates out the part explained by contracts rolling off at expiration, so a shift caused by expiry doesn’t read as fresh positioning.',
      },
      {
        title: 'Pin Strike',
        href: '/education/pin-strike-explained',
        body: 'A new dealer-positioning metric: the reachable 0DTE strike carrying the strongest restoring dealer gamma into expiration. In plain terms, the strike that hedging pressure is most likely to hold price toward. It is its own read, not a rename of Max Pain or the walls, and it now appears across the gamma charts, the Live Bulletin positioning map, Daily Replay, and the levels pages.',
      },
      {
        title: 'Market Tide, Pair Comparison, and Volatility',
        href: '/market-tide',
        body: 'Three new metric pages. Market Tide folds gamma and flow across the covered indices into a single bearish-to-bullish score. Pair Comparison puts any two of SPY, QQQ, SPX, and NDX side by side on strike-aligned Net GEX ladders, with a replay scrubber to watch the levels migrate through a session. Volatility charts put/call IV skew alongside realized-versus-implied.',
      },
    ],
    whatsComing: [
      {
        title: 'Enhanced backtesting',
        body: 'More strategies, more control, deeper analytics, and a longer history window as we expand the dataset.',
      },
      {
        title: 'More tickers',
        body: 'ES and NQ were the start. Coverage keeps growing beyond SPY, SPX, QQQ, and NDX.',
      },
      {
        title: 'More automated strategies',
        body: 'Additional TradeWorkz™ bots, each with the same public, no-cherry-picking track record.',
      },
      {
        title: 'A more streamlined experience',
        body: 'An ongoing pass to simplify the platform: fewer clicks to the read that matters, and less on-screen noise.',
      },
      {
        title: 'A sharper mobile experience',
        body: 'Continued work to make ZeroGEX feel great on the phone, not just the desktop.',
      },
    ],
  },
  {
    date: 'July 24, 2026',
    title: 'Now live — plus what’s coming next',
    intro:
      'Since the last note, several of the most-requested pieces shipped — including a couple that were on the “coming next” list last time. Here’s what’s live now, and where the platform is headed.',
    whatsNew: [
      {
        title: 'Trade Bias',
        href: '/trade-bias',
        body: 'A single, signed directional call — which way to lean, how convinced, and the regime it started from. It fuses the gamma and volatility regime (the structural baseline) with live price action, order flow, tape, and momentum, and it tells you when the live read overrides the structure. Read it for a multi-day swing or a same-day 0DTE horizon.',
      },
      {
        title: 'Gamma Chart',
        href: '/chart',
        body: 'A proprietary price-and-dealer-gamma terminal — SPY, QQQ, SPX, and NDX price with the Gamma Flip, Call/Put Walls, and Max Pain drawn inline, a live dealer-gamma structure rail, and full session rewind/replay. Real-time for members; a ~15-minute-delayed version is free for everyone.',
      },
      {
        title: 'My Dashboard',
        href: '/my-dashboard',
        body: 'The customizable, widget-based board from last update’s roadmap is here — pull your favorite charts and cards into one view, arrange them how you like, and save your layout, chart settings, and symbol selections. Start from a quick-start preset or add widgets one at a time.',
      },
      {
        title: 'NDX',
        href: '/ndx-gamma-levels',
        body: 'The Nasdaq-100 joins SPY, SPX, and QQQ — the same gamma read, levels, and dealer positioning across every ZeroGEX tool, plus a free ~15-minute-delayed NDX gamma-levels page.',
      },
      {
        title: 'Self-service API keys',
        href: '/account',
        body: 'Generate and manage your own Pro API keys right from the Account page — no more requesting one by hand.',
      },
    ],
    whatsComing: [
      {
        title: 'Enhanced backtesting',
        body: 'More strategies, more control, deeper analytics, and a longer history window as we expand the dataset.',
      },
      {
        title: 'More tickers',
        body: 'Coverage keeps growing beyond SPY, SPX, QQQ, and NDX — the same gamma read on more of what you watch.',
      },
      {
        title: 'More automated strategies',
        body: 'Additional TradeWorkz™ bots — each with the same public, no-cherry-picking track record.',
      },
      {
        title: 'A more streamlined, simplified experience',
        body: 'An ongoing pass to simplify the platform — fewer clicks to the read that matters, a cleaner layout, and less on-screen noise, so what you need is faster to find and act on.',
      },
      {
        title: 'A sharper mobile experience',
        body: 'Continued work to make ZeroGEX feel great on the phone, not just the desktop.',
      },
    ],
  },
  {
    date: 'July 22, 2026',
    title: "What's new — and what's coming next",
    intro:
      'Nearly everything below started as a message from a ZeroGEX trader. Here is a quick look at what has shipped recently and where the platform is headed.',
    whatsNew: [
      {
        title: 'Backtesting',
        href: '/backtesting',
        body: 'Test options strategies and ZeroGEX signals against historical market data — a full tearsheet (risk-adjusted returns, drawdown, win rate), a Monte Carlo outcome cone, a benchmark, and shareable “prove it” report links. History depth is growing over time.',
      },
      {
        title: 'Multi-expiration GEX',
        href: '/gex-strike-profile',
        body: 'The GEX Strike Profile and strike charts now let you select multiple expirations at once, so you can see how the walls and the gamma flip stack across the dates you actually trade.',
      },
      {
        title: 'Forced Flow & Charm-into-Close',
        href: '/forced-flow',
        body: 'A new read on potential dealer hedging pressure into the close — showing where charm and vanna may influence late-session flows.',
      },
      {
        title: 'Daily Forecast',
        href: '/forecast',
        body: 'Each morning, a plain-English read on the day ahead: an Expected Volatility estimate, a projected range, and the Key Levels that matter — with how far price sits from each. It grades itself against what actually happened, so you see a track record, not just a claim.',
      },
      {
        title: 'TradeWorkz™',
        href: '/trading-signals',
        body: 'A growing set of automated strategies built around ZeroGEX’s proprietary metrics and levels — posting their entries and exits in real time, backed by a fully public trade audit (every win and loss, not just the highlights).',
      },
    ],
    whatsComing: [
      {
        title: 'My Dashboard',
        body: 'A customizable, widget-based view — pull your favorite charts and cards into one board, move things where you want them, and save your layout, chart settings, and symbol selections.',
      },
      {
        title: 'Enhanced backtesting',
        body: 'More strategies, more control, deeper analytics, and a longer history window as we expand the dataset.',
      },
      {
        title: 'More tickers',
        body: 'Expanding coverage beyond SPY, SPX, and QQQ — the same gamma read on more of what you watch.',
      },
      {
        title: 'More automated strategies',
        body: 'Additional TradeWorkz™ bots — each with the same public, no-cherry-picking track record.',
      },
      {
        title: 'A sharper mobile experience',
        body: 'Continued work to make ZeroGEX feel great on the phone, not just the desktop.',
      },
    ],
  },
];

function ItemRow({ item, marker }: { item: Item; marker: 'new' | 'next' }) {
  const dot =
    marker === 'new' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]';
  return (
    <li className="flex gap-3">
      <span className={`mt-1 flex-shrink-0 text-sm font-bold ${dot}`}>
        {marker === 'new' ? '▸' : '→'}
      </span>
      <span className="text-[15px] leading-7 text-[var(--color-text-secondary)]">
        <strong className="text-[var(--color-text-primary)]">
          {item.href ? (
            <Link
              href={item.href}
              className="text-[var(--color-warning)] hover:text-[var(--heat-low)]"
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
          .
        </strong>{' '}
        {item.body}
      </span>
    </li>
  );
}

export default function UpdatesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="zg-feature-shell mb-8 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <Megaphone size={14} />
          Product Updates
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">
          What&apos;s new at ZeroGEX
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          A running log of what we&apos;ve shipped and where the platform is headed. ZeroGEX is
          largely shaped by trader feedback — if there&apos;s something you want to see, just reply
          to any email.
        </p>
      </div>

      <div className="space-y-8">
        {UPDATES.map((u) => (
          <article key={u.date} className="zg-feature-shell p-8">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              {u.date}
            </div>
            <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">
              {u.title}
            </h2>
            <p className="mb-6 text-[15px] leading-7 text-[var(--color-text-secondary)]">
              {u.intro}
            </p>

            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
              <Sparkles size={16} className="text-[var(--color-warning)]" />
              What&apos;s new
            </div>
            <ul className="mb-6 space-y-3">
              {u.whatsNew.map((item) => (
                <ItemRow key={item.title} item={item} marker="new" />
              ))}
            </ul>

            {u.whatsComing && u.whatsComing.length > 0 && (
              <>
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                  <Compass size={16} className="text-[var(--color-text-secondary)]" />
                  What&apos;s coming next
                </div>
                <ul className="space-y-3">
                  {u.whatsComing.map((item) => (
                    <ItemRow key={item.title} item={item} marker="next" />
                  ))}
                </ul>
                <p className="mt-6 text-xs leading-6 text-[var(--color-text-secondary)]">
                  Roadmap items are a direction, not a promise — priorities shift with your feedback.
                </p>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
