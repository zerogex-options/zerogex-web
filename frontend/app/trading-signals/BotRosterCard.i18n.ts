import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    live: 'LIVE',
    paused: 'PAUSED',
    hitRate: 'Hit rate {rate} · {trades} trades',
  },
  it: {
    live: 'ATTIVO',
    paused: 'IN PAUSA',
    hitRate: 'Tasso di successo {rate} · {trades} operazioni',
  },
  de: {
    live: 'LIVE',
    paused: 'PAUSIERT',
    hitRate: 'Trefferquote {rate} · {trades} Trades',
  },
  es: {
    live: 'ACTIVO',
    paused: 'PAUSADO',
    hitRate: 'Tasa de acierto {rate} · {trades} operaciones',
  },
  fr: {
    live: 'ACTIF',
    paused: 'EN PAUSE',
    hitRate: 'Taux de réussite {rate} · {trades} trades',
  },
};
