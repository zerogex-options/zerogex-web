import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    ariaLabel: 'Component contribution stack. Composite {composite}.',
    tooltip: '{title} • score {score} • contrib {contrib} • max {max} ({weightPct}% of weight)',
    neutral: '50 (Neutral)',
  },
  it: {
    ariaLabel: 'Pila dei contributi dei componenti. Composito {composite}.',
    tooltip: '{title} • punteggio {score} • contributo {contrib} • massimo {max} ({weightPct}% del peso)',
    neutral: '50 (Neutro)',
  },
  de: {
    ariaLabel: 'Beitragsstapel der Komponenten. Composite {composite}.',
    tooltip: '{title} • Score {score} • Beitrag {contrib} • Max {max} ({weightPct}% der Gewichtung)',
    neutral: '50 (Neutral)',
  },
  es: {
    ariaLabel: 'Pila de contribución de componentes. Compuesto {composite}.',
    tooltip: '{title} • puntuación {score} • contribución {contrib} • máx {max} ({weightPct}% del peso)',
    neutral: '50 (Neutral)',
  },
  fr: {
    ariaLabel: 'Pile de contribution des composants. Composite {composite}.',
    tooltip: '{title} • score {score} • contribution {contrib} • max {max} ({weightPct}% du poids)',
    neutral: '50 (Neutre)',
  },
};
