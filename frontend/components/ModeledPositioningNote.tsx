'use client';

import Link from 'next/link';
import { usePageT, type PageDictionary } from '@/core/LanguageContext';

/**
 * The compact, in-product form of the dealer-positioning disclosure.
 *
 * GexMethodologyNote is the long-form block, but it is a server component and
 * only ever renders on the education pages — so the actual product surfaces,
 * where the numbers are read and acted on, carried the caveat in tooltips at
 * best. This is the one-line client-side counterpart: it says the same thing in
 * a sentence and points at /methodology for the full disclosure, so the claim
 * and its qualification live on the same screen.
 *
 * Deliberately quiet — caption type, muted colour, no border or background — so
 * it reads as a footnote under the analytics rather than a warning banner.
 * Keep the wording in sync with GEX_METHODOLOGY_SHORT and /methodology.
 */
const DICT: PageDictionary = {
  en: {
    body: 'Dealer positioning is modeled, not directly observed.',
    link: 'Learn about the methodology',
  },
  de: {
    body: 'Dealer-Positionierung wird modelliert, nicht direkt beobachtet.',
    link: 'Mehr zur Methodik',
  },
  es: {
    body: 'El posicionamiento de los dealers es modelado, no observado directamente.',
    link: 'Conoce la metodología',
  },
  fr: {
    body: 'Le positionnement des dealers est modélisé, pas observé directement.',
    link: 'En savoir plus sur la méthodologie',
  },
  it: {
    body: 'Il posizionamento dei dealer è modellato, non osservato direttamente.',
    link: 'Scopri la metodologia',
  },
};

export default function ModeledPositioningNote({ className = '' }: { className?: string }) {
  const t = usePageT(DICT);

  return (
    <p
      className={`text-xs leading-relaxed text-[var(--text-muted)] ${className}`}
      data-testid="modeled-positioning-note"
    >
      {t('body')}{' '}
      <Link
        href="/methodology"
        className="underline underline-offset-2 hover:text-[var(--color-text-primary)]"
      >
        {t('link')}
      </Link>
    </p>
  );
}
