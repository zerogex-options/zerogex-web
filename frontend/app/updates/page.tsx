import Link from 'next/link';
import { Megaphone, Sparkles, Compass } from 'lucide-react';

export const metadata = {
  title: 'Product Updates | ZeroGEX',
  description:
    "What's new at ZeroGEX and what's coming next: chart integrations for TradingView, thinkorswim, NinjaTrader and Sierra Chart, ES and NQ coverage, Gamma Shift, Pin Strike, and the road ahead. A running log of platform updates.",
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
    date: 'September 16, 2026',
    title: 'A baseline for spreads, and 0DTE on the replay',
    intro:
      'Two things shipped today, and both of them were a question the site could not answer. The Spread Monitor could tell you how wide the market was, but not whether that width was unusual \u2014 and a number with nothing to compare it to is a number you still have to guess about; it has a baseline now, and the baseline knows what time it is. The Daily Replay had the opposite problem: it answered, but only ever about the whole chain. A member cancelled last week and told me so, and he was right. It knows both books now.',
    whatsNew: [
      {
        title: 'Spread surface vs history',
        href: '/spread-monitor',
        body: 'A new section that draws today\u2019s quoted width across the strikes on top of what the same symbol normally quotes in the same band \u2014 the median, and the middle half of its own distribution shaded behind it. Puts and calls are a toggle rather than an overlay, because the reading people care about is the one where the puts moved and the calls did not.',
      },
      {
        title: 'Compared at the same time of day',
        href: '/spread-monitor',
        body: 'Spreads have a shape through the session: the open and the close are structurally wider than midday. So a 3:40pm reading is ranked against prior sessions at 3:40pm, not against their whole day, and the panel names the half-hour it matched. Without that, every late-afternoon reading looks like a deterioration and every lunchtime one looks calm.',
      },
      {
        title: 'Which expiry is actually unusual',
        href: '/spread-monitor',
        body: 'A second chart ranks each expiry bucket against its own history rather than plotting its width. 0DTE is the widest book every day of the year, so a width chart there says the same thing forever; a percentile chart says "the chain is broadly normal and the front expiry is not", which is the thing worth knowing. Buckets without enough stored history say so instead of drawing a bar.',
      },
      {
        title: 'It says when it cannot say',
        href: '/help/platform/spread-monitor',
        body: 'The panel prints how many comparable sessions are behind every comparison, over what dates, at what time of day \u2014 and prints zero when that is the answer. Below eight sessions no percentile is shown at all, because "the widest of the four days we have" is not a distribution, and drawing it as one would be the most misleading thing on the page.',
      },
      {
        title: 'All exps / 0DTE on any replayed session',
        href: '/replay',
        body: 'Every session page has a switch above the scrubber. 0DTE means the contracts that expired that afternoon \u2014 on a replay of September 15, that is the September 15 expiry, and it stays that expiry however long from now you open the link. The filter and the playhead both live in the address bar, so sending someone the 0DTE surface at 2:47 PM is a copy and a paste. A session whose chain carried no same-day expiration says so, instead of quietly showing you everything.',
      },
      {
        title: 'On the replay, the levels follow the filter \u2014 not just the bars',
        href: '/replay',
        body: 'This is the part that matters. On 0DTE the Call Wall, Put Wall, Gamma Flip and Max Pain are rebuilt from that day\u2019s expiry alone, so what you are reading is the book that actually had to be hedged into the bell \u2014 not a whole-chain level drawn over same-day bars. Pin Strike and GEX King stay whole-chain, because both are whole-chain by definition; that is also how they behave under the Expiry selector on the live charts.',
      },
      {
        title: 'And one that was already there: the Gamma Chart rewinds by expiration',
        href: '/chart',
        body: 'Worth saying out loud, since it took a cancellation to learn it was not obvious. The Gamma Chart has a Rewind button that replays the session minute by minute, and the Expiry selector beside the gamma rail has its own 0DTE row. Set it, and the rewind, the walls and the flip all follow the same-day book. That has been live for members the whole time. It was just too well hidden \u2014 which is mine to fix, not yours to find.',
      },
    ],
  },
  {
    date: 'September 10, 2026',
    title: 'Spread Monitor: can you actually get filled?',
    intro:
      'A question came up on X this week that we could not answer: index put spreads had gone wide enough to be untradeable, and nobody had a number for how wide, or whether it was unusual. The quote data was already in the pipeline — nothing was summarising it. Now something is.',
    whatsNew: [
      {
        title: 'Spread Monitor',
        href: '/spread-monitor',
        body: 'A new Metrics page for execution quality. It shows how wide the option market is quoted, which side of the book is the expensive one, where in the chain the market thins out, and how much of the chain has no bid at all — contracts you cannot sell at any price, which no width statistic can express and which a median alone would hide. Puts and calls are always plotted apart, because the days people complain about are days when the puts widened and the calls did not.',
      },
      {
        title: 'A baseline, not a threshold',
        href: '/help/platform/spread-monitor',
        body: 'There is no universal "wide" for a quoted spread — an SPX put is structurally wider than an SPY put on the calmest day of the year. So the page never calls a reading wide in the abstract. It ranks today against the same symbol\u2019s own trailing sessions, and when it does not have that history it shows the measurement and withholds the verdict.',
      },
      {
        title: 'Side by side across the indices',
        href: '/spread-monitor',
        body: 'A cross-symbol table answers "is NDX any better than SPX today?" on a comparable basis — width in basis points of the index level, since a dollar-wide market means something different on an index near 6,800 than on one near 25,000. ES and NQ are deliberately absent: they carry no option chain of their own here, and scaling an SPX quote by the futures basis would invent a market nobody published.',
      },
    ],
  },
  {
    date: 'August 30, 2026',
    title: 'Your levels on your own charts, plus futures',
    intro:
      'Two things people have asked for since the last note are here: the ZeroGEX levels on the chart you already trade, and real futures coverage. Here is everything that shipped since July, and where the platform goes next.',
    whatsNew: [
      {
        title: 'Your levels, on your own charts',
        href: '/integrations',
        body: 'Four integrations that put the ZeroGEX levels on the platform you already trade from. The TradingView and thinkorswim scripts are free: they draw the Gamma Flip, Call Wall, Put Wall and Max Pain as horizontal lines, with optional cross-alerts. The NinjaTrader 8 and Sierra Chart studies, included with Pro, poll the ZeroGEX API and keep those levels current on their own, Pin Strike included, so you never retype a number.',
      },
      {
        title: 'ES and NQ',
        href: '/es-gamma-levels',
        body: 'Futures are first-class now. ES and NQ have their own gamma levels and their own free pages, and they carry the same read as SPY, SPX, QQQ, and NDX everywhere else on the site. The levels come from the SPX and NDX options books and are converted to futures prices on the live basis, so what you read is quoted where you actually trade.',
      },
      {
        title: 'Gamma Shift',
        href: '/gamma-shift',
        body: 'What changed, not just where things stand. Gamma Shift shows the per-strike move in modeled dealer gamma between two points in time, read three ways. It also separates out the part explained by contracts rolling off at expiration, so a shift caused by expiry doesn’t read as fresh positioning.',
      },
      {
        title: 'Pin Strike',
        href: '/education/pin-strike-explained',
        body: 'A new dealer-positioning metric: the reachable 0DTE strike with the strongest modeled restoring dealer gamma into expiration. In plain terms, the strike that hedging pressure is most likely to hold price toward. It is its own read, not a rename of Max Pain or the walls, and it now appears across the gamma charts, the Live Bulletin positioning map, Daily Replay, and the levels pages.',
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
          // Keyed on date AND title, not the date alone: two notes shipping on
          // one day is normal here (it nearly happened the day this was
          // written), and duplicate keys make React reuse one article's DOM for
          // the other.
          <article key={`${u.date} · ${u.title}`} className="zg-feature-shell p-8">
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
