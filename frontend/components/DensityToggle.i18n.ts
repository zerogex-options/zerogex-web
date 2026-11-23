import type { PageDictionary } from '@/core/LanguageContext';

// Copy for the Simple / Detailed view switch (components/DensityToggle.tsx),
// moved here from the Main Dashboard's dictionary when Dealer Positioning got
// the same switch.
export const dict: PageDictionary = {
  en: { densityAriaLabel: 'View density' },
  it: { densityAriaLabel: 'Densità di visualizzazione' },
  de: { densityAriaLabel: 'Ansichtsdichte' },
  es: { densityAriaLabel: 'Densidad de visualización' },
  fr: { densityAriaLabel: 'Densité d’affichage' },
};
