import Link from 'next/link';
import { Megaphone, Sparkles, Compass } from 'lucide-react';

export const metadata = {
  title: 'Product Updates | ZeroGEX',
  description:
    "What's new at ZeroGEX and what's coming next — backtesting, multi-expiration GEX, the Daily Forecast, TradeWorkz, and the road ahead. A running log of platform updates.",
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
