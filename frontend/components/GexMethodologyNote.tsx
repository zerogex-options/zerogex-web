import Link from 'next/link';
import { getServerT } from '@/core/localizedContent';
import type { PageDictionary } from '@/core/LanguageContext';

// Single source of truth for the "how we model dealer positioning" disclosure.
// Rendered wherever Net GEX / dealer-positioning is prominently presented so the
// modeled-convention caveat lives in one place instead of being re-worded per
// article. Locale-aware via getServerT (server component only).
const DICT: PageDictionary = {
  en: {
    heading: 'How ZeroGEX models dealer positioning',
    body:
      'Public option-chain data does not disclose the complete long and short inventory of dealers. ZeroGEX therefore applies a modeled positioning convention when calculating Net GEX. Calls are assigned positive exposure and puts negative exposure, broadly corresponding to an assumption that dealers are net long the calls customers sell and net short the puts customers buy for protection. This convention is useful for comparing the structure of the option chain over time, but it is not a direct measurement of actual dealer inventory.',
    link: 'Read the full methodology',
  },
  de: {
    heading: 'Wie ZeroGEX die Dealer-Positionierung modelliert',
    body:
      'Öffentliche Optionsketten-Daten geben den vollständigen Long- und Short-Bestand der Dealer nicht preis. ZeroGEX wendet daher bei der Berechnung von Net GEX eine modellierte Positionierungs-Konvention an. Calls erhalten ein positives, Puts ein negatives Exposure, was grob der Annahme entspricht, dass Dealer netto long in den von Kunden verkauften Calls und netto short in den von Kunden zur Absicherung gekauften Puts sind. Diese Konvention ist nützlich, um die Struktur der Optionskette im Zeitverlauf zu vergleichen, sie ist jedoch keine direkte Messung des tatsächlichen Dealer-Bestands.',
    link: 'Vollständige Methodik lesen',
  },
  es: {
    heading: 'Cómo modela ZeroGEX el posicionamiento de los dealers',
    body:
      'Los datos públicos de la cadena de opciones no revelan el inventario completo, largo y corto, de los dealers. Por eso ZeroGEX aplica una convención de posicionamiento modelada al calcular el Net GEX. A las calls se les asigna exposición positiva y a las puts negativa, correspondiendo a grandes rasgos con el supuesto de que los dealers están netos largos en las calls que venden los clientes y netos cortos en las puts que los clientes compran como protección. Esta convención es útil para comparar la estructura de la cadena de opciones a lo largo del tiempo, pero no es una medición directa del inventario real de los dealers.',
    link: 'Leer la metodología completa',
  },
  fr: {
    heading: 'Comment ZeroGEX modélise le positionnement des dealers',
    body:
      "Les données publiques de la chaîne d'options ne révèlent pas l'inventaire complet, long et short, des dealers. ZeroGEX applique donc une convention de positionnement modélisée pour calculer le Net GEX. Les calls reçoivent une exposition positive et les puts une exposition négative, ce qui correspond globalement à l'hypothèse que les dealers sont nets acheteurs des calls vendus par les clients et nets vendeurs des puts achetés par les clients pour se protéger. Cette convention est utile pour comparer la structure de la chaîne d'options dans le temps, mais elle ne constitue pas une mesure directe de l'inventaire réel des dealers.",
    link: 'Lire la méthodologie complète',
  },
  it: {
    heading: 'Come ZeroGEX modella il posizionamento dei dealer',
    body:
      "I dati pubblici della catena di opzioni non rivelano l'inventario completo, long e short, dei dealer. ZeroGEX applica quindi una convenzione di posizionamento modellata nel calcolo del Net GEX. Alle call viene assegnata un'esposizione positiva e alle put negativa, corrispondente in linea di massima all'ipotesi che i dealer siano netti lunghi sulle call vendute dai clienti e netti corti sulle put acquistate dai clienti per protezione. Questa convenzione è utile per confrontare la struttura della catena di opzioni nel tempo, ma non è una misura diretta dell'inventario reale dei dealer.",
    link: 'Leggi la metodologia completa',
  },
};

// Compact, English-only form for tight UI slots (tooltips, card footers) where a
// full localized block does not fit. Client components that need a localized
// short form should thread their own dictionary.
export const GEX_METHODOLOGY_SHORT =
  'Modeled dealer gamma using the traditional call-positive / put-negative open-interest convention. Actual dealer inventory is not directly observable from public option-chain data.';

export default async function GexMethodologyNote() {
  const t = await getServerT(DICT);
  return (
    <aside
      className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-sm leading-relaxed text-[var(--color-text-secondary)]"
      aria-label="Methodology note"
    >
      <div className="mb-2 font-semibold text-[var(--color-text-primary)]">{t('heading')}</div>
      <p>{t('body')}</p>
      <p className="mt-3">
        <Link
          href="/methodology"
          className="font-semibold text-[var(--color-warning)] underline underline-offset-2"
        >
          {t('link')} →
        </Link>
      </p>
    </aside>
  );
}
