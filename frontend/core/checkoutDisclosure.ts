// The line of text Stripe Checkout shows directly above the Subscribe button
// (custom_text.submit), stating the terms of what the customer is about to buy
// in the moment before they authorize the charge:
//
//   trial       how long it is free, that nothing is charged until it ends, and
//               that it renews automatically afterwards.
//   trial_no_card
//               a trial started without a card (core/noCardTrial.ts): nothing
//               is charged, a card added before the end keeps the plan and
//               starts the automatic renewal, and without one the trial simply
//               ends.
//   money_back  the 7-day money-back guarantee, that access ends when the refund
//               is issued, and the one-refund-per-customer limit — stated here,
//               before payment, because a limit first mentioned at refund time
//               is not a limit the customer agreed to.
//   none        the automatic renewal alone (a returning member on the trial
//               plan, who has already had their trial).
//
// Every variant names the automatic renewal and how to cancel, which is the
// disclosure state auto-renewal laws ask for at the point of purchase. Amounts
// are deliberately NOT restated: Stripe prints the exact price, discount and
// schedule on the same page, from the same objects that will be charged, so a
// second copy here could only ever drift from them.
//
// Pure (no imports beyond types) so it is unit-tested directly — see
// tests/checkoutDisclosure.test.ts. Stripe caps the message at 1200 characters.

import type { BillingCadence } from './billingPlans.ts';
import type { Locale } from './i18n/locales.ts';

export type CheckoutProtection =
  | { kind: 'trial'; days: number }
  | { kind: 'trial_no_card'; days: number }
  | { kind: 'money_back'; days: number }
  | { kind: 'none' };

export const STRIPE_CUSTOM_TEXT_MAX = 1200;

type Copy = {
  renewal: Record<BillingCadence, string>;
  trial: (days: number, renewal: string) => string;
  trialNoCard: (days: number, renewal: string) => string;
  moneyBack: (days: number, renewal: string) => string;
  none: (renewal: string) => string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    renewal: { monthly: 'every month', quarterly: 'every 3 months', annual: 'every year' },
    trial: (days, renewal) =>
      `Free for ${days} days\u00a0- you won't be charged until the trial ends. Cancel any time before then from your Account page and you pay nothing. After the trial, your plan renews automatically ${renewal} until you cancel.`,
    trialNoCard: (days, renewal) =>
      `Free for ${days} days, no card needed\u00a0- nothing is charged. To keep your plan after the trial, add a card from your Account page before it ends; from then on it renews automatically ${renewal} until you cancel. Without a card, the trial simply ends.`,
    moneyBack: (days, renewal) =>
      `${days}-day money-back guarantee: if ZeroGEX isn't for you, request a full refund from your Account page within ${days} days of your first payment. Your access ends when the refund is issued. Limit one refund per customer. Your plan renews automatically ${renewal} until you cancel; cancel any time from your Account page.`,
    none: (renewal) =>
      `Your plan renews automatically ${renewal} until you cancel. Cancel any time from your Account page.`,
  },
  it: {
    renewal: { monthly: 'ogni mese', quarterly: 'ogni 3 mesi', annual: 'ogni anno' },
    trial: (days, renewal) =>
      `Gratis per ${days} giorni: non ti verrà addebitato nulla fino al termine della prova. Annulla in qualsiasi momento prima di allora dalla pagina Account e non paghi nulla. Dopo la prova, il piano si rinnova automaticamente ${renewal} finché non lo annulli.`,
    trialNoCard: (days, renewal) =>
      `Gratis per ${days} giorni, senza carta: non ti verrà addebitato nulla. Per mantenere il piano dopo la prova, aggiungi una carta dalla pagina Account prima che finisca; da quel momento si rinnova automaticamente ${renewal} finché non lo annulli. Senza una carta, la prova termina e basta.`,
    moneyBack: (days, renewal) =>
      `Garanzia soddisfatti o rimborsati di ${days} giorni: se ZeroGEX non fa per te, richiedi il rimborso completo dalla pagina Account entro ${days} giorni dal tuo primo pagamento. L'accesso termina quando il rimborso viene emesso. Massimo un rimborso per cliente. Il piano si rinnova automaticamente ${renewal} finché non lo annulli; puoi annullarlo in qualsiasi momento dalla pagina Account.`,
    none: (renewal) =>
      `Il piano si rinnova automaticamente ${renewal} finché non lo annulli. Puoi annullarlo in qualsiasi momento dalla pagina Account.`,
  },
  de: {
    renewal: { monthly: 'jeden Monat', quarterly: 'alle 3 Monate', annual: 'jedes Jahr' },
    trial: (days, renewal) =>
      `${days} Tage kostenlos\u00a0- bis zum Ende der Testphase wird nichts abgebucht. Kündige vorher jederzeit über deine Kontoseite und du zahlst nichts. Nach der Testphase verlängert sich dein Plan automatisch ${renewal}, bis du kündigst.`,
    trialNoCard: (days, renewal) =>
      `${days} Tage kostenlos, ohne Karte\u00a0- es wird nichts abgebucht. Um deinen Plan nach der Testphase zu behalten, hinterlege vor ihrem Ende über deine Kontoseite eine Karte; ab dann verlängert sich dein Plan automatisch ${renewal}, bis du kündigst. Ohne Karte endet die Testphase einfach.`,
    moneyBack: (days, renewal) =>
      `${days}-Tage-Geld-zurück-Garantie: Wenn ZeroGEX nichts für dich ist, fordere innerhalb von ${days} Tagen nach deiner ersten Zahlung über deine Kontoseite eine volle Erstattung an. Dein Zugang endet mit der Erstattung. Maximal eine Erstattung pro Kunde. Dein Plan verlängert sich automatisch ${renewal}, bis du kündigst; kündigen kannst du jederzeit über deine Kontoseite.`,
    none: (renewal) =>
      `Dein Plan verlängert sich automatisch ${renewal}, bis du kündigst. Kündigen kannst du jederzeit über deine Kontoseite.`,
  },
  es: {
    renewal: { monthly: 'cada mes', quarterly: 'cada 3 meses', annual: 'cada año' },
    trial: (days, renewal) =>
      `Gratis durante ${days} días: no se te cobrará nada hasta que termine la prueba. Cancela cuando quieras antes de esa fecha desde tu página de Cuenta y no pagarás nada. Después de la prueba, tu plan se renueva automáticamente ${renewal} hasta que lo canceles.`,
    trialNoCard: (days, renewal) =>
      `Gratis durante ${days} días, sin tarjeta: no se te cobrará nada. Para mantener tu plan después de la prueba, añade una tarjeta desde tu página de Cuenta antes de que termine; a partir de entonces se renueva automáticamente ${renewal} hasta que lo canceles. Sin tarjeta, la prueba simplemente termina.`,
    moneyBack: (days, renewal) =>
      `Garantía de devolución de ${days} días: si ZeroGEX no es para ti, solicita un reembolso completo desde tu página de Cuenta dentro de los ${days} días siguientes a tu primer pago. Tu acceso termina cuando se emite el reembolso. Límite de un reembolso por cliente. Tu plan se renueva automáticamente ${renewal} hasta que lo canceles; puedes cancelarlo cuando quieras desde tu página de Cuenta.`,
    none: (renewal) =>
      `Tu plan se renueva automáticamente ${renewal} hasta que lo canceles. Puedes cancelarlo cuando quieras desde tu página de Cuenta.`,
  },
  fr: {
    renewal: { monthly: 'chaque mois', quarterly: 'tous les 3 mois', annual: 'chaque année' },
    trial: (days, renewal) =>
      `Gratuit pendant ${days} jours : rien ne vous sera prélevé avant la fin de l'essai. Annulez à tout moment avant cette date depuis votre page Compte et vous ne payez rien. Après l'essai, votre abonnement se renouvelle automatiquement ${renewal} jusqu'à ce que vous l'annuliez.`,
    trialNoCard: (days, renewal) =>
      `Gratuit pendant ${days} jours, sans carte : rien ne vous est prélevé. Pour garder votre abonnement après l'essai, ajoutez une carte depuis votre page Compte avant la fin ; ensuite, il se renouvelle automatiquement ${renewal} jusqu'à ce que vous l'annuliez. Sans carte, l'essai prend simplement fin.`,
    moneyBack: (days, renewal) =>
      `Garantie satisfait ou remboursé de ${days} jours : si ZeroGEX ne vous convient pas, demandez un remboursement intégral depuis votre page Compte dans les ${days} jours suivant votre premier paiement. Votre accès prend fin à l'émission du remboursement. Limité à un remboursement par client. Votre abonnement se renouvelle automatiquement ${renewal} jusqu'à ce que vous l'annuliez ; vous pouvez l'annuler à tout moment depuis votre page Compte.`,
    none: (renewal) =>
      `Votre abonnement se renouvelle automatiquement ${renewal} jusqu'à ce que vous l'annuliez. Vous pouvez l'annuler à tout moment depuis votre page Compte.`,
  },
};

export function checkoutSubmitMessage(input: {
  locale: Locale;
  cadence: BillingCadence;
  protection: CheckoutProtection;
}): string {
  const copy = COPY[input.locale] ?? COPY.en;
  const renewal = copy.renewal[input.cadence];
  const { protection } = input;
  const message =
    protection.kind === 'trial'
      ? copy.trial(protection.days, renewal)
      : protection.kind === 'trial_no_card'
        ? copy.trialNoCard(protection.days, renewal)
        : protection.kind === 'money_back'
          ? copy.moneyBack(protection.days, renewal)
          : copy.none(renewal);
  // Never let a long translation fail the checkout: Stripe rejects the whole
  // session over an oversized message. Every string above is far under the cap;
  // this is the backstop, not the plan.
  return message.length <= STRIPE_CUSTOM_TEXT_MAX
    ? message
    : `${message.slice(0, STRIPE_CUSTOM_TEXT_MAX - 1)}…`;
}
