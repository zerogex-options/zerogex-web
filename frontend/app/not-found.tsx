import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';

// Branded 404. Next used to fall through to its default "This page could not
// be found." screen, which offers a visitor who followed a dead link (there
// are hundreds of stale localized-slug URLs still in Google's index — see the
// redirects in next.config.ts) nothing to click. Next.js marks not-found
// responses noindex on its own, so this page only needs to route people
// somewhere useful: the free levels, the explainers, and on-site search.
const LINKS = [
  { href: '/spx-gamma-levels', label: 'Free SPX gamma levels (today)' },
  { href: '/education/gamma-exposure-explained', label: 'Gamma exposure (GEX) explained' },
  { href: '/education', label: 'Education hub' },
  { href: '/articles', label: 'All articles' },
  { href: '/pricing', label: 'Pricing' },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="zg-feature-shell p-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          404 — page not found
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">
          That page isn&rsquo;t here
        </h1>
        <p className="mb-6 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          The link you followed may be out of date, or the page may have moved. The free gamma
          levels and every explainer are one click away below, or search the site.
        </p>
        <ul className="mb-6 grid gap-3 sm:grid-cols-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline"
              >
                {link.label}
                <ArrowRight size={14} />
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)]"
        >
          <Search size={14} />
          Search ZeroGEX
        </Link>
      </div>
    </div>
  );
}
