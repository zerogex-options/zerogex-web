import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    dealerGammaPositioning: 'Dealer Gamma Positioning',
    futuresImpliedVia: 'futures-implied via {source} · cash closed',
    positioningMap: 'Positioning Map',
    expectedRangeLabel: 'Expected Range · {horizon}',
    expectedRangeSentence:
      '{symbol} ~68% likely to trade between {low} and {high} {horizonPhrase} (1σ implied by {volIndex}). {context}',
    derivedAnalytics: 'Derived analytics · not financial advice',
  },
  it: {
    dealerGammaPositioning: 'Posizionamento Gamma dei Dealer',
    futuresImpliedVia: 'implicito dai futures via {source} · cassa chiusa',
    positioningMap: 'Mappa di Posizionamento',
    expectedRangeLabel: 'Range Previsto · {horizon}',
    expectedRangeSentence:
      '{symbol} ha una probabilità del ~68% di trattare tra {low} e {high} {horizonPhrase} (1σ implicito da {volIndex}). {context}',
    derivedAnalytics: 'Analisi derivata · non è consulenza finanziaria',
  },
  de: {
    dealerGammaPositioning: 'Dealer-Gamma-Positionierung',
    futuresImpliedVia: 'futures-impliziert über {source} · Kassamarkt geschlossen',
    positioningMap: 'Positionierungskarte',
    expectedRangeLabel: 'Erwartete Spanne · {horizon}',
    expectedRangeSentence:
      '{symbol} wird mit ~68 % Wahrscheinlichkeit zwischen {low} und {high} {horizonPhrase} gehandelt (1σ impliziert durch {volIndex}). {context}',
    derivedAnalytics: 'Abgeleitete Analysen · keine Anlageberatung',
  },
  es: {
    dealerGammaPositioning: 'Posicionamiento Gamma de los Dealers',
    futuresImpliedVia: 'implícito por futuros vía {source} · mercado al contado cerrado',
    positioningMap: 'Mapa de Posicionamiento',
    expectedRangeLabel: 'Rango Esperado · {horizon}',
    expectedRangeSentence:
      '{symbol} tiene ~68% de probabilidad de cotizar entre {low} y {high} {horizonPhrase} (1σ implícito por {volIndex}). {context}',
    derivedAnalytics: 'Análisis derivado · no es asesoría financiera',
  },
  fr: {
    dealerGammaPositioning: 'Positionnement Gamma des Dealers',
    futuresImpliedVia: 'implicite via les futures {source} · marché au comptant fermé',
    positioningMap: 'Carte de Positionnement',
    expectedRangeLabel: 'Fourchette Attendue · {horizon}',
    expectedRangeSentence:
      '{symbol} a ~68 % de chances de se négocier entre {low} et {high} {horizonPhrase} (1σ implicite par {volIndex}). {context}',
    derivedAnalytics: 'Analyses dérivées · pas un conseil financier',
  },
};
