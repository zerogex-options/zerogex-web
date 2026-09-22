import type { PageDictionary } from '@/core/LanguageContext';

// Copy for the Account page's 7-day money-back guarantee panel
// (components/MoneyBackGuaranteePanel.tsx). {amount}, {plan} and {deadline} are
// filled from GET /api/billing/money-back, i.e. from the live Stripe payment
// the refund would return — never restated here.
export const dict: PageDictionary = {
  en: {
    title: '7-day money-back guarantee',
    body: "Not the right fit? You can get a full refund of {amount} for {plan} until {deadline}. Your subscription is canceled and your access ends as soon as the refund is issued. Limit one refund per customer.",
    request: 'Request a full refund',
    confirmHeading: 'Refund {amount} and end your subscription now?',
    confirmBody:
      "The refund goes back to the card you paid with. Your access ends right away, and the guarantee can't be used again on a future subscription.",
    reasonLabel: 'What made it not the right fit? (optional)',
    reasonPlaceholder: 'Choose a reason',
    commentPlaceholder: 'Anything else you’d like me to know? (optional)',
    confirm: 'Refund and cancel',
    keep: 'Keep my plan',
    working: 'Processing…',
    done: 'Refunded {amount}. Your subscription has been canceled — a confirmation email is on its way.',
    doneFollowUp:
      "Refunded {amount}. We're finishing the cancellation on our side; you won't be charged again, and we'll email you when it's done.",
    unfinishedBody:
      "Your earlier refund request didn't finish. You can pick it up where it left off — you'll never be refunded or charged twice.",
    retry: 'Finish my refund',
    failed: "Couldn't process the refund just now. Nothing was refunded or canceled — please try again in a few minutes.",
  },
  it: {
    title: 'Garanzia soddisfatti o rimborsati di 7 giorni',
    body: "Non fa per te? Puoi ottenere il rimborso completo di {amount} per {plan} fino al {deadline}. L'abbonamento viene annullato e l'accesso termina non appena il rimborso viene emesso. Massimo un rimborso per cliente.",
    request: 'Richiedi il rimborso completo',
    confirmHeading: "Rimborsare {amount} e terminare l'abbonamento ora?",
    confirmBody:
      "Il rimborso torna sulla carta con cui hai pagato. L'accesso termina subito e la garanzia non potrà essere usata di nuovo su un abbonamento futuro.",
    reasonLabel: 'Perché non faceva per te? (facoltativo)',
    reasonPlaceholder: 'Scegli un motivo',
    commentPlaceholder: 'Qualcos’altro che vuoi farmi sapere? (facoltativo)',
    confirm: 'Rimborsa e annulla',
    keep: 'Mantieni il mio piano',
    working: 'Elaborazione…',
    done: "Rimborsati {amount}. L'abbonamento è stato annullato: ti stiamo inviando un'email di conferma.",
    doneFollowUp:
      "Rimborsati {amount}. Stiamo completando l'annullamento: non ti verrà addebitato altro e ti avviseremo via email quando avremo finito.",
    unfinishedBody:
      'La tua precedente richiesta di rimborso non è stata completata. Puoi riprenderla da dove si era fermata: non verrai mai rimborsato o addebitato due volte.',
    retry: 'Completa il rimborso',
    failed: 'Impossibile elaborare il rimborso in questo momento. Non è stato rimborsato né annullato nulla: riprova tra qualche minuto.',
  },
  de: {
    title: '7-Tage-Geld-zurück-Garantie',
    body: 'Nicht das Richtige? Du kannst bis {deadline} eine volle Erstattung von {amount} für {plan} erhalten. Dein Abonnement wird gekündigt und dein Zugang endet, sobald die Erstattung ausgelöst ist. Maximal eine Erstattung pro Kunde.',
    request: 'Volle Erstattung anfordern',
    confirmHeading: '{amount} erstatten und dein Abonnement jetzt beenden?',
    confirmBody:
      'Die Erstattung geht auf die Karte, mit der du bezahlt hast. Dein Zugang endet sofort, und die Garantie kann für ein künftiges Abonnement nicht erneut genutzt werden.',
    reasonLabel: 'Warum hat es nicht gepasst? (optional)',
    reasonPlaceholder: 'Grund auswählen',
    commentPlaceholder: 'Möchtest du mir noch etwas mitteilen? (optional)',
    confirm: 'Erstatten und kündigen',
    keep: 'Plan behalten',
    working: 'Wird bearbeitet…',
    done: '{amount} erstattet. Dein Abonnement wurde gekündigt — eine Bestätigung per E-Mail ist unterwegs.',
    doneFollowUp:
      '{amount} erstattet. Wir schließen die Kündigung auf unserer Seite ab; es wird nichts mehr abgebucht, und wir melden uns per E-Mail, sobald sie erledigt ist.',
    unfinishedBody:
      'Deine frühere Erstattungsanfrage wurde nicht abgeschlossen. Du kannst sie dort fortsetzen, wo sie stehen geblieben ist — es wird nie doppelt erstattet oder abgebucht.',
    retry: 'Erstattung abschließen',
    failed: 'Die Erstattung konnte gerade nicht verarbeitet werden. Es wurde nichts erstattet oder gekündigt — bitte versuche es in ein paar Minuten erneut.',
  },
  es: {
    title: 'Garantía de devolución de 7 días',
    body: '¿No es para ti? Puedes obtener un reembolso completo de {amount} por {plan} hasta el {deadline}. Tu suscripción se cancela y tu acceso termina en cuanto se emite el reembolso. Límite de un reembolso por cliente.',
    request: 'Solicitar un reembolso completo',
    confirmHeading: '¿Reembolsar {amount} y terminar tu suscripción ahora?',
    confirmBody:
      'El reembolso vuelve a la tarjeta con la que pagaste. Tu acceso termina de inmediato y la garantía no podrá usarse de nuevo en una suscripción futura.',
    reasonLabel: '¿Por qué no era para ti? (opcional)',
    reasonPlaceholder: 'Elige un motivo',
    commentPlaceholder: '¿Algo más que quieras contarme? (opcional)',
    confirm: 'Reembolsar y cancelar',
    keep: 'Conservar mi plan',
    working: 'Procesando…',
    done: 'Reembolsados {amount}. Tu suscripción ha sido cancelada; te enviamos un correo de confirmación.',
    doneFollowUp:
      'Reembolsados {amount}. Estamos terminando la cancelación; no se te cobrará nada más y te avisaremos por correo cuando esté lista.',
    unfinishedBody:
      'Tu solicitud de reembolso anterior no terminó. Puedes retomarla donde quedó: nunca se te reembolsará ni cobrará dos veces.',
    retry: 'Terminar mi reembolso',
    failed: 'No pudimos procesar el reembolso en este momento. No se reembolsó ni canceló nada: inténtalo de nuevo en unos minutos.',
  },
  fr: {
    title: 'Garantie satisfait ou remboursé de 7 jours',
    body: "Ça ne vous convient pas ? Vous pouvez obtenir un remboursement intégral de {amount} pour {plan} jusqu'au {deadline}. Votre abonnement est annulé et votre accès prend fin dès l'émission du remboursement. Limité à un remboursement par client.",
    request: 'Demander un remboursement intégral',
    confirmHeading: 'Rembourser {amount} et mettre fin à votre abonnement maintenant ?',
    confirmBody:
      "Le remboursement est versé sur la carte utilisée pour le paiement. Votre accès prend fin immédiatement, et la garantie ne pourra pas être réutilisée sur un futur abonnement.",
    reasonLabel: "Pourquoi cela ne vous convenait-il pas ? (facultatif)",
    reasonPlaceholder: 'Choisissez une raison',
    commentPlaceholder: 'Autre chose à me dire ? (facultatif)',
    confirm: 'Rembourser et annuler',
    keep: 'Garder mon offre',
    working: 'Traitement…',
    done: 'Remboursement de {amount} effectué. Votre abonnement a été annulé — un e-mail de confirmation est en route.',
    doneFollowUp:
      "Remboursement de {amount} effectué. Nous finalisons l'annulation de notre côté ; rien ne vous sera plus prélevé et nous vous préviendrons par e-mail une fois terminé.",
    unfinishedBody:
      "Votre précédente demande de remboursement n'a pas abouti. Vous pouvez la reprendre là où elle s'est arrêtée — vous ne serez jamais remboursé ni débité deux fois.",
    retry: 'Finaliser mon remboursement',
    failed: "Impossible de traiter le remboursement pour le moment. Rien n'a été remboursé ni annulé — réessayez dans quelques minutes.",
  },
};
