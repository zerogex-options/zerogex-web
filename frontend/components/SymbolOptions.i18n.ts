import type { PageDictionary } from '@/core/LanguageContext';

// Group headings in a symbol dropdown, one per asset class (core/symbols.ts
// SYMBOL_GROUPS). Keyed by AssetClass.
export const dict: PageDictionary = {
  en: { etf: 'ETFs', index: 'Indexes', future: 'Futures', stock: 'Stocks' },
  it: { etf: 'ETF', index: 'Indici', future: 'Futures', stock: 'Azioni' },
  de: { etf: 'ETFs', index: 'Indizes', future: 'Futures', stock: 'Aktien' },
  es: { etf: 'ETF', index: 'Índices', future: 'Futuros', stock: 'Acciones' },
  fr: { etf: 'ETF', index: 'Indices', future: 'Contrats à terme', stock: 'Actions' },
};
