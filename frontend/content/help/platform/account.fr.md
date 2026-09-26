# Paramètres du compte

*Email, mot de passe, fournisseurs de connexion liés (Google/Apple), niveau et statut de l'abonnement, et comment les gérer en toute sécurité.*

---

## À quoi sert la page Compte

La page [Compte](/account) est le point central pour tout ce qui concerne l'utilisateur - votre email, votre abonnement, vos méthodes de connexion, les notifications, le panneau de parrainage et la suppression du compte.

## L'en-tête

Affiche votre email et votre niveau (Public, Basic, Pro ou Admin). En dessous de Pro, un bouton **Passer au niveau supérieur** à côté de votre niveau vous mène à [Pricing](/pricing). Si votre email n'est pas encore vérifié, un bandeau en haut de la page vous le signale.

## Email et vérification

- L'adresse email avec laquelle vous vous êtes inscrit est l'identifiant de votre compte. Elle ne peut être modifiée qu'en passant par le support.
- Les nouveaux comptes doivent vérifier leur email - un lien de vérification est envoyé lors de l'inscription et expire au bout de 24 heures. Tant que l'email n'est pas vérifié, vous ne pouvez ni démarrer un essai ni vous abonner.
- Si vous n'avez pas reçu le message d'origine, cliquez sur **Resend** dans le bandeau de vérification en haut de la page Compte.

## Mot de passe

- Définissez un mot de passe si vous vous êtes inscrit avec Google ou Apple et souhaitez avoir une solution de secours. Dans Méthodes de connexion, le bouton **Définir le mot de passe** apparaît pour les comptes sans mot de passe.
- Pour changer un mot de passe existant, cliquez sur **Réinitialiser le mot de passe** - nous vous envoyons par email un lien pour en définir un nouveau.
- La longueur minimale est de 12 caractères.
- Utilisez un gestionnaire de mots de passe. Nous n'imposons pas de règles de complexité - la longueur et l'unicité comptent plus que la variété des caractères.

## Fournisseurs de connexion liés

Vous pouvez lier **Google** et **Apple** au même compte. La section Méthodes de connexion indique quels fournisseurs sont connectés. Si Apple affiche « Bientôt disponible », la connexion avec Apple n'est pas encore activée.

- **Lier un nouveau fournisseur** - cliquez sur **Connecter** à côté de celui-ci, ou connectez-vous une fois avec le fournisseur ; le système le lie automatiquement à votre compte existant si l'email correspond.
- **Délier un fournisseur** - cliquez sur **Déconnecter**. C'est possible uniquement si vous disposez d'au moins un autre moyen de connexion (un autre fournisseur OU un mot de passe). La page applique cette règle pour éviter que vous ne soyez bloqué hors de votre compte.

## Niveau et abonnement

- Votre niveau actuel est affiché en haut de la page.
- **Gérer l'abonnement**, dans la section Abonnement, ouvre le portail de facturation hébergé par Stripe. Changements de plan, moyens de paiement, factures et résiliation se gèrent tous là.
- Vous pouvez aussi résilier via le lien **Cancel subscription** sous ce bouton, qui vous propose à la place une pause d'un à trois mois si une interruption vous suffit.
- Si un paiement échoue, la section vous le signale et le bouton devient **Ouvrir le portail de facturation**, où vous pouvez régler la facture en attente avec n'importe quelle carte ou mettre à jour votre moyen de paiement.
- Dans les 7 jours suivant votre premier paiement pour une formule couverte par la garantie satisfait ou remboursé de 7 jours (Pro, ou toute formule trimestrielle ou annuelle), cliquez sur **Demander un remboursement intégral** sur la page Compte. L'accès prend fin dès l'émission du remboursement ; un remboursement par client.

Pour la procédure détaillée, consultez [Facturation et portail Stripe](/help/platform/billing).

## Accès API (Pro)

Avec Pro, la section **API Access** vous permet de créer et de révoquer des clés API personnelles. Les clés sont révoquées automatiquement si votre formule passe en dessous de Pro. Consultez [Accès API et clés (Pro)](/help/platform/api-access).

## Notifications

**Gérer les notifications** ouvre une page consacrée aux bots TradeWorkz™ que vous suivez, où vous choisissez comment chacun vous joint : dans l'application, par email ou par webhook.

## Réseaux sociaux

Vous pouvez ajouter, si vous le souhaitez, votre **identifiant X (anciennement Twitter)** dans la section Réseaux sociaux afin que l'équipe ZeroGEX puisse vous y contacter. Ce n'est jamais obligatoire - cela ne vous est pas demandé à l'inscription, et vous pouvez l'ajouter, le modifier ou le supprimer à tout moment depuis votre compte.

- Saisissez l'identifiant avec ou sans le `@` initial - 1 à 15 caractères, uniquement des lettres, des chiffres et des underscores.
- Videz le champ et enregistrez pour supprimer un identifiant précédemment ajouté.

## Panneau de parrainage

Si le programme de parrainage est en cours, la section **Parrainer un ami** affiche :

- Votre lien de parrainage, avec un bouton **Copier le lien**
- **Inscrits** - le nombre de personnes inscrites via votre lien (survolez pour voir leurs adresses email)
- **Abonnés** - combien d'entre elles ont souscrit une formule payante (survolez pour voir qui)
- **Mois gratuits gagnés**
- **Mois accumulés** - des mois gratuits en attente, appliqués lors de votre prochain abonnement (affiché uniquement si vous en avez)
- Le crédit qui sera appliqué à votre prochaine facture, le cas échéant

Pour les règles du programme, consultez [Parrainage](/help/platform/referrals).

## Se déconnecter

Ouvrez le menu du profil dans l'en-tête et choisissez **Se déconnecter** (sur téléphone, **Se déconnecter** se trouve dans le menu). Cela efface le cookie de session. Reconnectez-vous depuis [/login](/login).

## Supprimer votre compte

Descendez jusqu'à **Delete account**, en bas de la page Compte, cliquez sur **Delete my account**, tapez DELETE, puis cliquez sur **Permanently delete account**. La suppression annule immédiatement tout abonnement actif, vous déconnecte, révoque vos clés API et arrête tous nos emails. Elle ne peut pas être annulée depuis la page - pour retrouver l'accès ensuite, écrivez à [support@zerogex.io](mailto:support@zerogex.io). Notre politique de [Privacy](/privacy) explique comment les données du compte sont traitées.

## Voir aussi

- [Facturation et portail Stripe](/help/platform/billing)
- [Parrainage](/help/platform/referrals)
- [Préférences email](/help/platform/email-preferences)
