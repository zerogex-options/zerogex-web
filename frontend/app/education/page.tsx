import Link from 'next/link';
import { ArrowRight, BookOpen, Newspaper, GraduationCap, LifeBuoy } from 'lucide-react';
import ItemListJsonLd from '@/components/ItemListJsonLd';

export const metadata = {
  title: 'Options Gamma Education: GEX, Gamma Flip, Call Walls & 0DTE Dealer Positioning',
  description:
    'ZeroGEX options gamma education — GEX, the gamma flip, call walls, put walls, 0DTE dealer positioning, vanna and charm, and max pain. Plain-English explainers plus today’s live SPX / SPY / QQQ levels.',
  alternates: { canonical: '/education' },
};

const sections = [
  {
    href: '/articles',
    title: 'Articles',
    description:
      'Long-form, flow-focused breakdowns of market structure — gamma exposure, dealer hedging, options tape, and the signals built on top of them.',
    icon: Newspaper,
    available: true,
  },
  {
    href: '/guides',
    title: 'Guides',
    description:
      'Reference material you come back to. Start with "Signals: Explained" — every ZeroGEX signal, what it asks, and what its score means.',
    icon: GraduationCap,
    available: true,
  },
  {
    href: '/help',
    title: 'Help',
    description:
      'Platform Guide, FAQs, and Quick Start walkthroughs for getting the most out of the ZeroGEX platform.',
    icon: LifeBuoy,
    available: true,
  },
];

// Curated deep links from the hub straight to the highest-intent explainers.
// The hub previously linked only to the three sub-sections above and to no
// individual article — so its crawl authority never reached the pages that
// target real non-brand search demand (put wall, call wall, gamma flip, GEX,
// net GEX, GEX tools, max pain). Anchor text is kept close to the query it
// targets. These entries also back the ItemList structured data below, so the
// visible list and the schema stay in lockstep.
const popularExplainers = [
  { href: '/education/what-is-gex-in-trading', label: 'What Is GEX in Trading?' },
  { href: '/education/gamma-exposure-explained', label: 'Gamma Exposure (GEX) Explained: The Complete Guide' },
  { href: '/education/how-to-read-a-gamma-flip', label: 'How to Read a Gamma Flip' },
  { href: '/education/what-is-a-put-wall', label: 'What Is a Put Wall?' },
  { href: '/education/what-is-a-call-wall', label: 'What Is a Call Wall?' },
  { href: '/education/spx-net-gamma-exposure-today', label: 'SPX Net Gamma Exposure Today' },
  { href: '/education/best-gex-tools', label: 'Best GEX Tools, Fairly Compared' },
  { href: '/education/max-pain-explained', label: 'Max Pain Explained' },
];

export default function EducationHubPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      {/* ItemList structured data — mirrors the "Popular explainers" list. */}
      <ItemListJsonLd
        items={popularExplainers.map((e) => ({ href: e.href, name: e.label }))}
        id="/education#popular-explainers"
      />
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <BookOpen size={14} />
          Education
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">
          Options Gamma Education Hub
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Practical options market-structure education — gamma exposure (GEX), the gamma flip, call
          walls, put walls, and 0DTE dealer positioning. Browse in-depth articles, reference guides,
          and product help, then check{' '}
          <Link
            href="/spx-gamma-levels"
            className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
          >
            today’s live SPX / SPY / QQQ gamma levels
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="zg-feature-shell group flex flex-col p-6 transition hover:border-[var(--color-warning-soft)]"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                  <Icon size={20} />
                </span>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{section.title}</h2>
                {!section.available && (
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                    Under construction
                  </span>
                )}
              </div>
              <p className="mb-5 flex-1 text-sm leading-7 text-[var(--color-text-secondary)]">{section.description}</p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
                {section.available ? 'Explore' : 'Preview'}
                <ArrowRight size={16} />
              </span>
            </Link>
          );
        })}
      </div>

      {/* Popular explainers — direct links from the hub to the most-read
          gamma concepts. Feeds internal authority to the non-brand target
          pages and gives searchers who land on the hub an immediate next step. */}
      <section className="mt-12">
        <h2 className="mb-1 text-xl font-semibold text-[var(--color-text-primary)]">
          Popular explainers
        </h2>
        <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">
          Start with the most-read gamma concepts, then pull up{' '}
          <Link
            href="/spx-gamma-levels"
            className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
          >
            today’s live SPX / SPY / QQQ gamma levels
          </Link>
          .
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {popularExplainers.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="zg-feature-shell group flex items-center justify-between gap-3 p-4 transition hover:border-[var(--color-warning-soft)]"
            >
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {item.label}
              </span>
              <ArrowRight
                size={16}
                className="shrink-0 text-[var(--color-warning)] transition group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
