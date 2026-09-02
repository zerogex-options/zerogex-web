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
    dismiss: 'Dismiss',
  },
  it: {
    welcomeDays: 'Benvenuto — la tua prova gratuita di {days} giorni è ora attiva.',
    billingDays: 'Nessun addebito fino al giorno {days}. Annulla in qualsiasi momento.',
    welcomeDeferred: 'Benvenuto — la tua prova gratuita è ora attiva.',
    billingDeferred: 'Nessun addebito fino al termine della prova. Annulla in qualsiasi momento.',
    welcomeNone: 'Benvenuto — il tuo abbonamento è ora attivo.',
    billingNone: 'Annulla in qualsiasi momento.',
    dismiss: 'Chiudi',
  },
  de: {
    welcomeDays: 'Willkommen — deine {days}-tägige kostenlose Testphase ist jetzt aktiv.',
    billingDays: 'Keine Abbuchung bis Tag {days}. Jederzeit kündbar.',
    welcomeDeferred: 'Willkommen — deine kostenlose Testphase ist jetzt aktiv.',
    billingDeferred: 'Keine Abbuchung bis zum Ende der Testphase. Jederzeit kündbar.',
    welcomeNone: 'Willkommen — dein Abonnement ist jetzt aktiv.',
    billingNone: 'Jederzeit kündbar.',
    dismiss: 'Schließen',
  },
  es: {
    welcomeDays: 'Bienvenido — tu prueba gratuita de {days} días ya está activa.',
    billingDays: 'Sin cargo hasta el día {days}. Cancela cuando quieras.',
    welcomeDeferred: 'Bienvenido — tu prueba gratuita ya está activa.',
    billingDeferred: 'Sin cargo hasta que termine la prueba. Cancela cuando quieras.',
    welcomeNone: 'Bienvenido — tu suscripción ya está activa.',
    billingNone: 'Cancela cuando quieras.',
    dismiss: 'Cerrar',
  },
  fr: {
    welcomeDays: 'Bienvenue — votre essai gratuit de {days} jours est maintenant actif.',
    billingDays: 'Aucun débit avant le jour {days}. Annulez à tout moment.',
    welcomeDeferred: 'Bienvenue — votre essai gratuit est maintenant actif.',
    billingDeferred: "Aucun débit avant la fin de votre essai. Annulez à tout moment.",
    welcomeNone: 'Bienvenue — votre abonnement est maintenant actif.',
    billingNone: 'Annulez à tout moment.',
    dismiss: 'Fermer',
  },
};
