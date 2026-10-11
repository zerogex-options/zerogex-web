import { Fragment } from 'react';
import Link from 'next/link';

// The link row at the foot of every receipt surface: the replay, forecast,
// scorecard and hedging-flow indexes and their dated permalinks.
//
// WHY. Those pages are where search sends people ("spx gamma flip call wall
// put wall <date>"), and each one ended with a methodology box and nothing to
// click. The pages that actually convert a visitor (the free gamma levels, the
// graded track record, the methodology) were one or two navigations away
// through the header, which a reader arriving from a search result rarely
// opens. This row puts them on the page itself, in the same muted style as the
// closing link row on /track-record, so the eight surfaces stop being
// dead ends without growing a second navigation.

// The symbols that have a /<symbol>-gamma-levels page. Mirrors the
// app/*-gamma-levels routes rather than core/symbols' ingested list, because
// the question here is "does the page exist", not "is the symbol ingested".
const GAMMA_LEVELS_SYMBOLS: ReadonlySet<string> = new Set(['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ']);

export type ReceiptFooterLink = { href: string; label: string };

/**
 * The free gamma-levels page for a symbol, or the SPX one when the symbol has
 * no page of its own, so a receipt never links to a route that 404s.
 */
export function gammaLevelsLink(symbol: string): ReceiptFooterLink {
  const upper = symbol.toUpperCase();
  const sym = GAMMA_LEVELS_SYMBOLS.has(upper) ? upper : 'SPX';
  return { href: `/${sym.toLowerCase()}-gamma-levels`, label: `Today's ${sym} gamma levels` };
}

export default function ReceiptFooterLinks({
  symbol,
  extra = [],
}: {
  /** The page's selected symbol; picks which gamma-levels page to link. */
  symbol: string;
  /** Page-specific links appended after the three every receipt carries. */
  extra?: ReceiptFooterLink[];
}) {
  const links: ReceiptFooterLink[] = [
    gammaLevelsLink(symbol),
    { href: '/track-record', label: 'Forecast track record' },
    { href: '/methodology', label: 'Methodology' },
    ...extra,
  ];
  return (
    <nav
      aria-label="Related pages"
      className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-secondary)]"
    >
      {links.map((link, i) => (
        <Fragment key={link.href}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <Link href={link.href} className="underline hover:text-[var(--color-accent)]">
            {link.label}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
