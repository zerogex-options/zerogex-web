// The returning-member screen (core/returningWall.ts) in the site's other
// languages (core/i18n/locales.ts). English is written in core/returningWall.ts;
// each block here says the same thing, and tests/returningWall.test.ts checks
// that every block is complete.
//
// Same voice and words as the newcomer and Pro screens beside it
// (core/basicWall.i18n.ts, core/proWall.i18n.ts): German says "du", Italian and
// Spanish "tu"/"tú", French "vous", and the links they share read the same.
// "Founding Member" stays English, as on the founding page
// (app/founding/Client.i18n.ts). Page names arrive the way the member's menu
// shows them, so the sentences name them without an article ("die Seite X").
//
// Pure: type-only imports, so tests load it under bare node --test.

import type { Locale } from './i18n/locales.ts';
import type { ReturningWallText } from './returningWall.ts';

export const RETURNING_WALL_TRANSLATIONS: Record<Exclude<Locale, 'en'>, ReturningWallText> = {
  it: {
    welcomeBack: 'Bentornato',
    heading: 'Il tuo account è ancora qui',
    reaching: (page, plan) =>
      page ? `Stavi cercando di aprire ${page}: questa pagina è inclusa in ${plan}.` : `Questa pagina è inclusa in ${plan}.`,
    stillThere:
      "Tutto ciò che avevi è esattamente dove l'avevi lasciato: layout, simboli e impostazioni sono ancora tutti nel tuo account.",
    foundingRestore:
      'Sei un Founding Member. Quella tariffa resta tua e si applica automaticamente quando ti abboni di nuovo: la tariffa founding è chiusa ai nuovi membri, ma mai per te.',
    resubscribe: (plan) => `Abbonati di nuovo a ${plan}`,
    comparePlans: 'Confronta i piani',
    freeLevels: 'Oppure continua a usare i livelli gratuiti e differiti',
    shippedSince: 'Novità da quando hai lasciato ZeroGEX',
    recentlyShipped: 'Novità recenti',
  },

  de: {
    welcomeBack: 'Willkommen zurück',
    heading: 'Dein Konto ist noch da',
    reaching: (page, plan) =>
      page ? `Du wolltest die Seite ${page} öffnen; sie ist in ${plan} enthalten.` : `Diese Seite ist in ${plan} enthalten.`,
    stillThere:
      'Alles ist genau so, wie du es verlassen hast - deine Layouts, Symbole und Einstellungen sind alle noch in deinem Konto.',
    foundingRestore:
      'Du bist Founding Member. Dein Tarif gehört weiterhin dir und gilt automatisch, wenn du wieder abonnierst - der Founding-Tarif ist für neue Mitglieder geschlossen, aber nie für dich.',
    resubscribe: (plan) => `${plan} wieder abonnieren`,
    comparePlans: 'Pläne vergleichen',
    freeLevels: 'Oder nutze weiter die kostenlosen, verzögerten Level',
    shippedSince: 'Neu, seit du weg warst',
    recentlyShipped: 'Kürzlich erschienen',
  },

  es: {
    welcomeBack: 'Bienvenido de nuevo',
    heading: 'Tu cuenta sigue aquí',
    reaching: (page, plan) =>
      page ? `Intentabas abrir ${page}: esta página está incluida en ${plan}.` : `Esta página está incluida en ${plan}.`,
    stillThere:
      'Todo lo que tenías está exactamente donde lo dejaste: tus diseños, símbolos y ajustes siguen en tu cuenta.',
    foundingRestore:
      'Eres Founding Member. Esa tarifa sigue siendo tuya y se aplica automáticamente cuando vuelvas a suscribirte: la tarifa founding se cerró a nuevos miembros, pero nunca para ti.',
    resubscribe: (plan) => `Vuelve a suscribirte a ${plan}`,
    comparePlans: 'Comparar planes',
    freeLevels: 'O sigue usando los niveles gratuitos y diferidos',
    shippedSince: 'Novedades desde que te fuiste',
    recentlyShipped: 'Novedades recientes',
  },

  fr: {
    welcomeBack: 'Bon retour parmi nous',
    heading: 'Votre compte est toujours là',
    reaching: (page, plan) =>
      page ? `Vous vouliez ouvrir ${page} : cette page est incluse dans ${plan}.` : `Cette page est incluse dans ${plan}.`,
    stillThere:
      "Tout ce que vous aviez est exactement là où vous l'avez laissé : vos mises en page, symboles et réglages sont toujours sur votre compte.",
    foundingRestore:
      "Vous êtes Founding Member. Ce tarif reste le vôtre et s'applique automatiquement quand vous vous réabonnez : le tarif founding est fermé aux nouveaux membres, mais jamais pour vous.",
    resubscribe: (plan) => `Se réabonner à ${plan}`,
    comparePlans: 'Comparer les offres',
    freeLevels: 'Ou continuez avec les niveaux gratuits et différés',
    shippedSince: 'Nouveautés depuis votre départ',
    recentlyShipped: 'Nouveautés récentes',
  },
};
