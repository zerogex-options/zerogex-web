import type { PageDictionary } from '@/core/LanguageContext';

// The dashboard's reminder to a member whose trial started without a card and
// still has none (core/noCardTrial.ts). {date} is the trial end, formatted in
// the member's language by the component.
export const dict: PageDictionary = {
  en: {
    message:
      'Your free trial ends on {date}. There’s no card on your account: add one to keep your plan, or the trial simply ends.',
    cta: 'Add a card',
  },
  it: {
    message:
      'La tua prova gratuita termina il {date}. Sul tuo account non c’è nessuna carta: aggiungine una per mantenere il piano, altrimenti la prova termina e basta.',
    cta: 'Aggiungi una carta',
  },
  de: {
    message:
      'Deine kostenlose Testphase endet am {date}. In deinem Konto ist keine Karte hinterlegt: Hinterlege eine, um deinen Plan zu behalten, sonst endet die Testphase einfach.',
    cta: 'Karte hinterlegen',
  },
  es: {
    message:
      'Tu prueba gratuita termina el {date}. No hay ninguna tarjeta en tu cuenta: añade una para mantener tu plan o la prueba simplemente terminará.',
    cta: 'Añadir una tarjeta',
  },
  fr: {
    message:
      'Votre essai gratuit se termine le {date}. Aucune carte n’est enregistrée sur votre compte : ajoutez-en une pour garder votre abonnement, sinon l’essai prend simplement fin.',
    cta: 'Ajouter une carte',
  },
};
