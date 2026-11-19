import type { PageDictionary } from '@/core/LanguageContext';

// Copy for the site-wide Black Friday bar (components/BlackFridayBar.tsx).
// {pct} is the discount and {deadline} the sale's last day ("Tuesday,
// December 1"), both from core/blackFridaySale.ts. The bar only reaches members
// the sale is for, so it doesn't repeat "for new members".
export const dict: PageDictionary = {
  en: {
    label: 'Black Friday',
    text: '{pct}% off your first year of ZeroGEX, on every plan. Ends {deadline}.',
    cta: 'See the sale',
    dismiss: 'Dismiss',
  },
  it: {
    label: 'Black Friday',
    text: '{pct}% di sconto sul tuo primo anno di ZeroGEX, su tutti i piani. Termina {deadline}.',
    cta: 'Vedi l’offerta',
    dismiss: 'Chiudi',
  },
  de: {
    label: 'Black Friday',
    text: '{pct} % Rabatt auf dein erstes Jahr ZeroGEX, für jeden Plan. Endet {deadline}.',
    cta: 'Zum Angebot',
    dismiss: 'Schließen',
  },
  es: {
    label: 'Black Friday',
    text: '{pct} % de descuento en tu primer año de ZeroGEX, en todos los planes. Termina el {deadline}.',
    cta: 'Ver la oferta',
    dismiss: 'Cerrar',
  },
  fr: {
    label: 'Black Friday',
    text: '{pct} % de réduction sur votre première année de ZeroGEX, sur toutes les offres. Se termine le {deadline}.',
    cta: 'Voir l’offre',
    dismiss: 'Fermer',
  },
};
