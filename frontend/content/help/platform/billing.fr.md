# Facturation et portail Stripe

*Comment fonctionne la facturation via Stripe, mensuel vs trimestriel vs annuel, l'essai gratuit et la garantie satisfait ou remboursé, le changement de niveau, les moyens de paiement et les factures.*

---

## Comment fonctionne la facturation

ZeroGEX facture via **Stripe**. Nous ne voyons ni ne stockons les informations de votre carte de paiement - Stripe s'occupe entièrement de cela. Chaque action de facturation s'effectue dans le portail de facturation hébergé par Stripe, accessible depuis votre page [Account](/account).

## Formules et périodicités

Deux niveaux - **Basic** et **Pro** - chacun disponible en **mensuel**, en **trimestriel** (facturé tous les 3 mois) ou en **annuel**.

- Plus la période de facturation est longue, moins vous payez par mois. La page [Pricing](/pricing) indique ce que facture chaque formule, avec son équivalent mensuel en dessous, ainsi qu'un tableau comparatif de ce que vous économisez par rapport à un paiement mensuel.
- Le changement entre périodicités est pris en charge via le portail.

## Essai gratuit (Basic mensuel)

Basic mensuel commence par un **essai gratuit de 7 jours** : accès complet immédiat, votre carte enregistrée, et aucun prélèvement avant la fin de l'essai. Environ 48 heures avant la fin, nous vous envoyons un rappel par e-mail avec le montant qui sera prélevé. À la fin de l'essai, l'abonnement se poursuit automatiquement au tarif auquel vous vous êtes inscrit - sans étape de confirmation supplémentaire.

Pour empêcher ce renouvellement automatique : annulez avant la fin de l'essai - dans le portail ou via **Cancel subscription** sur votre page Account. Vous conservez l'accès jusqu'à la fin de l'essai. Un essai gratuit par compte.

## Garantie satisfait ou remboursé de 7 jours (toutes les autres formules)

Pro, ainsi que toutes les formules trimestrielles et annuelles, est facturé dès la souscription - et couvert par une **garantie satisfait ou remboursé de 7 jours** au lieu d'un essai. Si la formule ne vous convient pas, ouvrez [Account](/account) dans les 7 jours suivant votre premier paiement et cliquez sur **Demander un remboursement intégral** :

- Le paiement est intégralement remboursé sur la carte utilisée (il apparaît généralement sous 5 à 10 jours ouvrés).
- Votre abonnement est annulé et l'accès payant prend fin dès l'émission du remboursement.
- La garantie est limitée à **un remboursement par client** - par compte, adresse e-mail ou carte - et ne couvre pas les renouvellements.

## Comment gérer votre abonnement

1. Ouvrez [Account](/account).
2. Cliquez sur **Gérer l'abonnement** - cela ouvre le portail de facturation Stripe.

Depuis le portail, vous pouvez :

- Changer de niveau (Basic ↔ Pro)
- Changer de périodicité (mensuel ↔ trimestriel ↔ annuel)
- Mettre à jour le moyen de paiement
- Consulter et télécharger les factures
- Annuler l'abonnement

## Montées et descentes de niveau

- **Montée de niveau (Basic → Pro)** - un prorata est appliqué. L'accès au niveau est mis à jour instantanément ; la différence calculée au prorata (un crédit pour le temps non utilisé plus le montant du nouveau niveau) apparaît sur votre **prochaine facture** au lieu d'être facturée immédiatement.
- **Descente de niveau (Pro → Basic)** - le changement prend effet à la fin de la période de facturation en cours. Vous conservez les fonctionnalités Pro jusque-là.
- **Changement de périodicité** - le passage à une période plus longue (mensuel → trimestriel → annuel) s'applique immédiatement et au prorata, avec un crédit pour la partie non utilisée de votre période en cours ; le passage à une période plus courte prend effet à la fin de la période en cours, comme une descente de niveau.
- **Pendant l'essai gratuit de Basic** - passer à Pro, ou à une facturation trimestrielle ou annuelle, met fin à l'essai et facture la nouvelle formule le jour même. Sur la page [Pricing](/pricing), vous voyez d'abord le montant exact et le confirmez ; ce paiement est couvert par la garantie satisfait ou remboursé de 7 jours.

## Annulation

- Annulez dans le portail, ou via le lien **Cancel subscription** sous Gérer l'abonnement sur votre page Account. Ce lien vous propose aussi de mettre votre abonnement en pause pendant un à trois mois à la place - aucun prélèvement et aucun accès pendant la pause, puis reprise automatique.
- L'annulation prend effet à la **fin de la période de facturation en cours**. Vous conservez l'accès payant jusque-là, et votre page Account affiche la date.
- Une fois la période terminée, votre niveau revient à Public. Votre compte n'est pas supprimé ; vos données de parrainage et vos paramètres enregistrés sont conservés.
- Vous pouvez vous réabonner à tout moment.

## Moyens de paiement

Stripe gère vos informations de paiement. Ajoutez, modifiez ou supprimez la carte enregistrée depuis le portail.

## Factures et reçus

Chaque prélèvement génère une facture Stripe. Le portail répertorie toutes les factures passées avec des liens de téléchargement en PDF. Les reçus sont également envoyés automatiquement par e-mail.

## Paiements échoués

Si un prélèvement échoue, Stripe effectue automatiquement de nouvelles tentatives sur plusieurs jours. Pendant cette période de nouvelles tentatives, votre abonnement est à l'état "past due" - les fonctionnalités payantes restent temporairement disponibles. Si toutes les tentatives échouent, l'abonnement est annulé et le niveau revient en arrière.

Votre page Account signale l'échec du paiement, et son bouton **Ouvrir le portail de facturation** vous permet de régler la facture en attente avec n'importe quelle carte - aucune nouvelle inscription n'est nécessaire. Les causes d'échec les plus courantes : carte expirée, non-concordance lors de la vérification d'adresse, restrictions régionales. Mettez à jour le moyen de paiement dans le portail pour résoudre le problème.

## Remboursements

Notre page [Pricing](/pricing) détaille la politique de remboursement et d'annulation. En bref : l'essai de Basic mensuel est sans condition - annulez avant qu'il ne se termine et vous ne serez jamais facturé - et toutes les autres formules bénéficient de la garantie satisfait ou remboursé de 7 jours décrite ci-dessus (un remboursement par client). Au-delà, les abonnements sont facturés à l'avance et ne sont pas remboursés au prorata en cas d'annulation.

Pour les cas particuliers, écrivez à [support@zerogex.io](mailto:support@zerogex.io).

## Passage à une période de facturation plus longue

Le calcul joue en votre faveur : plus la période est longue, plus l'équivalent mensuel est bas. Le portail gère le changement : il s'applique immédiatement et au prorata, avec un crédit pour la partie non utilisée de votre période en cours. Si vous êtes encore dans l'essai gratuit de Basic, le changement met fin à l'essai et facture la nouvelle formule le jour même (voir ci-dessus).

## Rappels de renouvellement

Les formules trimestrielles et annuelles se renouvellent automatiquement. Nous vous envoyons un e-mail avant - 7 jours avant pour le trimestriel, 30 jours avant pour l'annuel - avec la date et le montant, afin que vous puissiez annuler ou changer de formule dans le portail au préalable si vous le souhaitez.

## Codes promo et coupons

Les coupons promotionnels s'appliquent au moment du paiement. Si une promotion est active, la page Pricing affiche le tarif après application du coupon ; sinon, le tarif plein.

Le **tarif founding-member** était une offre de lancement réservée sur invitation ; il n'est plus ouvert aux nouveaux membres. Les membres fondateurs conservent leur tarif, et si un abonnement fondateur expire, il est réappliqué automatiquement au paiement lorsque vous choisissez à nouveau une facturation mensuelle ou annuelle.

## Voir aussi

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
