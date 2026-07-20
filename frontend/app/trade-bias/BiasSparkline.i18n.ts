import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    ariaLabel: 'Intraday bias trend',
    notEnoughHistory: 'Not enough history yet — the bias plots here as it accumulates.',
  },
  it: {
    ariaLabel: 'Andamento del bias intraday',
    notEnoughHistory: 'Non c’è ancora abbastanza storico — il bias verrà rappresentato qui man mano che si accumula.',
  },
  de: {
    ariaLabel: 'Intraday-Bias-Verlauf',
    notEnoughHistory: 'Noch nicht genug Verlauf — der Bias wird hier dargestellt, sobald sich Daten ansammeln.',
  },
  es: {
    ariaLabel: 'Tendencia del sesgo intradía',
    notEnoughHistory: 'Todavía no hay suficiente historial — el sesgo se representará aquí a medida que se acumule.',
  },
  fr: {
    ariaLabel: 'Tendance du biais intrajournalier',
    notEnoughHistory: 'Pas encore assez d’historique — le biais s’affichera ici au fur et à mesure qu’il s’accumule.',
  },
};
