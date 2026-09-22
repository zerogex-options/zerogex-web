import type { PageDictionary } from '@/core/LanguageContext';

// Three variants, because checkout grants three different things — see
// resolveTrialStartedCopy in ./trialStartedCopy. The `Days` pair is the only
// one that names a number, and it takes it from {days} rather than hardcoding
// the standard 7: a reactivation signup gets REACTIVATION_TRIAL_DAYS (default
// 30) and was previously told their card would be charged three weeks early.
export const dict: PageDictionary = {
  en: {
    welcomeDays: 'Welcome — your {days}-day free trial is now active.',
    billingDays: 'No charge until day {days}. Cancel anytime.',
    welcomeDeferred: 'Welcome — your free trial is now active.',
    billingDeferred: 'No charge until your trial ends. Cancel anytime.',
    welcomeNone: 'Welcome — your subscription is now active.',
    billingNone: 'Cancel anytime.',
    welcomeMoneyBack: 'Welcome — your subscription is now active.',
    billingMoneyBack:
      'Covered by our {days}-day money-back guarantee: not for you? Request a full refund from your Account page within {days} days. One refund per customer.',
    dismiss: 'Dismiss',
  },
  it: {
    welcomeDays: 'Benvenuto — la tua prova gratuita di {days} giorni è ora attiva.',
    billingDays: 'Nessun addebito fino al giorno {days}. Annulla in qualsiasi momento.',
    welcomeDeferred: 'Benvenuto — la tua prova gratuita è ora attiva.',
    billingDeferred: 'Nessun addebito fino al termine della prova. Annulla in qualsiasi momento.',
    welcomeNone: 'Benvenuto — il tuo abbonamento è ora attivo.',
    billingNone: 'Annulla in qualsiasi momento.',
    welcomeMoneyBack: 'Benvenuto — il tuo abbonamento è ora attivo.',
    billingMoneyBack:
      'Coperto dalla nostra garanzia soddisfatti o rimborsati di {days} giorni: non fa per te? Richiedi il rimborso completo dalla pagina Account entro {days} giorni. Un rimborso per cliente.',
    dismiss: 'Chiudi',
  },
  de: {
    welcomeDays: 'Willkommen — deine {days}-tägige kostenlose Testphase ist jetzt aktiv.',
    billingDays: 'Keine Abbuchung bis Tag {days}. Jederzeit kündbar.',
    welcomeDeferred: 'Willkommen — deine kostenlose Testphase ist jetzt aktiv.',
    billingDeferred: 'Keine Abbuchung bis zum Ende der Testphase. Jederzeit kündbar.',
    welcomeNone: 'Willkommen — dein Abonnement ist jetzt aktiv.',
    billingNone: 'Jederzeit kündbar.',
    welcomeMoneyBack: 'Willkommen — dein Abonnement ist jetzt aktiv.',
    billingMoneyBack:
      'Mit unserer {days}-Tage-Geld-zurück-Garantie: Nicht das Richtige? Fordere innerhalb von {days} Tagen über deine Kontoseite eine volle Erstattung an. Eine Erstattung pro Kunde.',
    dismiss: 'Schließen',
  },
  es: {
    welcomeDays: 'Bienvenido — tu prueba gratuita de {days} días ya está activa.',
    billingDays: 'Sin cargo hasta el día {days}. Cancela cuando quieras.',
    welcomeDeferred: 'Bienvenido — tu prueba gratuita ya está activa.',
    billingDeferred: 'Sin cargo hasta que termine la prueba. Cancela cuando quieras.',
    welcomeNone: 'Bienvenido — tu suscripción ya está activa.',
    billingNone: 'Cancela cuando quieras.',
    welcomeMoneyBack: 'Bienvenido — tu suscripción ya está activa.',
    billingMoneyBack:
      'Cubierta por nuestra garantía de devolución de {days} días: ¿no es para ti? Solicita un reembolso completo desde tu página de Cuenta en un plazo de {days} días. Un reembolso por cliente.',
    dismiss: 'Cerrar',
  },
  fr: {
    welcomeDays: 'Bienvenue — votre essai gratuit de {days} jours est maintenant actif.',
    billingDays: 'Aucun débit avant le jour {days}. Annulez à tout moment.',
    welcomeDeferred: 'Bienvenue — votre essai gratuit est maintenant actif.',
    billingDeferred: "Aucun débit avant la fin de votre essai. Annulez à tout moment.",
    welcomeNone: 'Bienvenue — votre abonnement est maintenant actif.',
    billingNone: 'Annulez à tout moment.',
    welcomeMoneyBack: 'Bienvenue — votre abonnement est maintenant actif.',
    billingMoneyBack:
      'Couvert par notre garantie satisfait ou remboursé de {days} jours : ça ne vous convient pas ? Demandez un remboursement intégral depuis votre page Compte sous {days} jours. Un remboursement par client.',
    dismiss: 'Fermer',
  },
};
