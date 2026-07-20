# Facturation et portail Stripe

*Comment fonctionne la facturation via Stripe, la différence entre mensuel et annuel, le changement de niveau, les moyens de paiement et les factures.*

---

## Comment fonctionne la facturation

ZeroGEX facture via **Stripe**. Nous ne voyons ni ne stockons les informations de votre carte de paiement — Stripe s'occupe entièrement de cela. Chaque action de facturation s'effectue dans le portail de facturation hébergé par Stripe, accessible depuis votre page [Account](/account).

## Formules et périodicités

Deux niveaux — **Basic** et **Pro** — chacun disponible en **mensuel** ou en **annuel**.

- La formule annuelle est proposée à un tarif réduit par rapport au mensuel. Le taux exact figure sur la page [Pricing](/pricing).
- Le changement entre périodicités est pris en charge via le portail.

## Essai gratuit

Lorsque vous activez une formule payante, vous bénéficiez d'une période d'essai gratuite (la durée est indiquée sur la page Pricing). À la fin de l'essai, l'abonnement se poursuit automatiquement au tarif auquel vous vous êtes inscrit — sans étape de confirmation supplémentaire.

Pour empêcher ce renouvellement automatique : annulez dans le portail avant la fin de l'essai. Vous conservez l'accès jusqu'à la fin de l'essai.

## Comment gérer votre abonnement

1. Ouvrez [Account](/account).
2. Cliquez sur "Manage subscription" — cela ouvre le portail Stripe dans un nouvel onglet.
3. Depuis le portail, vous pouvez :
   - Changer de niveau (Basic ↔ Pro)
   - Changer de périodicité (mensuel ↔ annuel)
   - Mettre à jour le moyen de paiement
   - Consulter et télécharger les factures
   - Annuler l'abonnement

## Montées et descentes de niveau

- **Montée de niveau (Basic → Pro)** — un prorata est appliqué. L'accès au niveau est mis à jour instantanément ; la différence calculée au prorata (un crédit pour le temps non utilisé plus le montant du nouveau niveau) apparaît sur votre **prochaine facture** au lieu d'être facturée immédiatement.
- **Descente de niveau (Pro → Basic)** — le changement prend effet à la fin de la période de facturation en cours. Vous conservez les fonctionnalités Pro jusque-là.
- **Changement de périodicité** — le passage de mensuel à annuel s'applique immédiatement (avec prorata sur votre prochaine facture) ; le passage d'annuel à mensuel prend effet à la fin de la période en cours, comme une descente de niveau.

## Annulation

- L'annulation prend effet à la **fin de la période de facturation en cours**. Vous conservez l'accès payant jusque-là.
- Une fois la période terminée, votre niveau revient à Public. Votre compte n'est pas supprimé ; votre progression pédagogique, vos données de parrainage et vos paramètres enregistrés sont conservés.
- Vous pouvez vous réabonner à tout moment.

## Moyens de paiement

Stripe prend en charge les cartes, Apple Pay, Google Pay et (dans la plupart des régions) les virements bancaires. Gérez-les tous depuis le portail.

## Factures et reçus

Chaque prélèvement génère une facture Stripe. Le portail répertorie toutes les factures passées avec des liens de téléchargement en PDF. Les reçus sont également envoyés automatiquement par e-mail.

## Paiements échoués

Si un prélèvement échoue, Stripe effectue automatiquement de nouvelles tentatives sur plusieurs jours. Pendant cette période de nouvelles tentatives, votre abonnement est à l'état "past due" — les fonctionnalités payantes restent temporairement disponibles. Si toutes les tentatives échouent, l'abonnement est annulé et le niveau revient en arrière.

Les causes d'échec les plus courantes : carte expirée, non-concordance lors de la vérification d'adresse, restrictions régionales. Mettez à jour le moyen de paiement dans le portail pour résoudre le problème.

## Remboursements

Notre page [Pricing](/pricing) détaille la politique de remboursement et d'annulation. En bref : les abonnements sont facturés à l'avance et ne sont pas remboursés au prorata en cas d'annulation, mais l'essai est sans condition — annulez avant qu'il ne se termine et vous ne serez jamais facturé.

Pour les cas particuliers, écrivez à [support@zerogex.io](mailto:support@zerogex.io).

## Passage du mensuel à l'annuel

La plupart des utilisateurs franchissent le pas vers le troisième mois — le calcul joue en votre faveur. Le portail gère le changement : il s'applique immédiatement, et le prorata (un crédit pour la partie non utilisée du mois en cours plus le montant annuel) apparaît sur votre prochaine facture. Si vous êtes encore en période d'essai gratuite, le changement conserve l'essai — vous ne serez facturé qu'à sa fin, puis au tarif annuel.

## Codes promo et coupons

Les coupons promotionnels s'appliquent au moment du paiement. Si une promotion est active, la page Pricing affiche le tarif après application du coupon ; sinon, le tarif plein.

Le **tarif founding-member** est un parcours distinct, réservé sur invitation — consultez la page [/founding](/founding) si vous disposez du code d'accès.

## Voir aussi

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
