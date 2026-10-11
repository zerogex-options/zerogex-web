import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import ItemListJsonLd from '@/components/ItemListJsonLd';
import { ARTICLE_REGISTRY, type ArticleMeta } from '@/core/articleRegistry';

export const metadata = {
  title: 'Options Gamma Analysis: SPX, SPY, QQQ & NDX Dealer Flow',
  description:
    'Options gamma analysis for SPX, SPY, QQQ and NDX, newest first\u00a0- pinning, the gamma flip, call and put walls, and 0DTE dealer positioning.',
  alternates: { canonical: '/articles' },
};

// Derived from the article registry rather than typed out here. This page used
// to carry its own copy of every title, blurb and date, and the copy drifted:
// one article was missing outright (so it was also missing from the ItemList
// below), five titles predated their Search Console retitles, and six dates
// were stale. The registry is the source the article pages, the Article
// structured data and the sitemap already read, so the listing now agrees with
// all three by construction. Newest publication first; a later substantive
// edit is shown as "Updated" without moving the piece up the list.
type Article = {
  href: string;
  kind: string;
  title: string;
  blurb: string;
  cta?: string;
};

// Per-article button text where "Read article" would be the wrong verb.
const CTA_OVERRIDES: Record<string, string> = {
  'announcing-folds-of-honor-pledge': 'Read announcement',
};

function fmtListingDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

function kindLine(a: ArticleMeta): string {
  const modified = a.dateModified && a.dateModified !== a.datePublished ? a.dateModified : null;
  const label = modified ? 'Updated' : a.kind === 'pillar' ? 'Pillar' : 'Published';
  return `${label} \u2022 ${fmtListingDate(modified ?? a.datePublished)} \u2022 16:00 UTC`;
}

const ARTICLES: Article[] = Object.values(ARTICLE_REGISTRY)
  .filter((a) => a.href.startsWith('/education/') && a.kind !== 'landing')
  .sort((x, y) => y.datePublished.localeCompare(x.datePublished) || x.title.localeCompare(y.title))
  .map((a) => ({
    href: a.href,
    kind: kindLine(a),
    title: a.title,
    blurb: a.blurb,
    cta: CTA_OVERRIDES[a.slug],
  }));

export default function ArticlesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
      {/* CollectionPage ItemList — mirrors the visible article list below. */}
      <ItemListJsonLd
        items={ARTICLES.map((a) => ({ href: a.href, name: a.title }))}
        id="/articles#articles"
      />
      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <Newspaper size={14} />
          Latest analysis
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">
          Latest Options Gamma Articles &amp; Analysis
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Flow-focused breakdowns of options market structure for SPX, SPY, QQQ, and NDX
          traders&nbsp;- gamma exposure (GEX), the gamma flip, call walls, put walls, pinning, and 0DTE
          dealer positioning. Newest first, with new pieces added regularly; each pairs the concept
          with a worked example and links straight to{' '}
          <Link
            href="/spx-gamma-levels"
            className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
          >
            today’s live SPX / SPY / QQQ / NDX gamma levels
          </Link>
          . Prefer to browse by topic? Start in the{' '}
          <Link
            href="/education"
            className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
          >
            Education hub
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {ARTICLES.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="zg-feature-shell p-6 block cursor-pointer transition-colors hover:border-[var(--color-warning-soft)]"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">{a.kind}</div>
            <h2 className="mb-3 text-xl font-semibold text-[var(--color-text-primary)]">{a.title}</h2>
            <p className="mb-5 text-sm leading-7 text-[var(--color-text-secondary)]">{a.blurb}</p>
            <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)]">
              {a.cta ?? 'Read article'}
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
