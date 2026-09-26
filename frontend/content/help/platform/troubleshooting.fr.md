# Dépannage

*La liste essentielle - problèmes de connexion, données manquantes, graphiques obsolètes, problèmes de paiement, caches du navigateur, et quand contacter le support.*

---

## Impossible de se connecter

**Vous avez oublié votre mot de passe.** Utilisez [Mot de passe oublié](/forgot-password). Un lien de réinitialisation est envoyé par e-mail ; cliquez dessus et définissez-en un nouveau. Le lien ne fonctionne qu'une fois et expire au bout de 30 minutes. Si l'e-mail n'arrive pas, vérifiez les spams.

**Vous vous êtes inscrit avec Google ou Apple et n'avez pas de mot de passe.** Connectez-vous avec le fournisseur que vous avez utilisé. Depuis la page Compte, vous pourrez ensuite définir un mot de passe pour une utilisation future.

**Vous êtes connecté, mais votre formule n'apparaît pas.** Vous vous êtes probablement connecté avec une autre adresse e-mail que celle de votre abonnement - par exemple un autre compte Google -, ce qui crée un compte distinct. Déconnectez-vous et reconnectez-vous avec l'adresse d'origine, ou écrivez à [support@zerogex.io](mailto:support@zerogex.io) - nous pouvons rechercher le compte.

**Une invite de vérification Google ou Apple ne disparaît pas.** Cette invite vient du fournisseur - ZeroGEX n'a pas d'étape de double authentification propre. Reconnectez-vous depuis une fenêtre de navigation privée. Si le problème persiste, écrivez au support.

## Données manquantes ou obsolètes

**Le badge de session indique Fermé.** C'est la réponse - les marchés sont fermés. Les dernières valeurs calculées sont affichées.

**Un panneau est vide ou affiche zéro.** C'est généralement une question de fenêtre de séance : EOD Pressure n'est actif que de 14 h 30 ET jusqu'à la clôture, et 0DTE Position Imbalance uniquement pendant la séance régulière. Les deux pages l'indiquent à l'écran tant qu'elles sont inactives.

**Les valeurs semblent figées.** Survolez le prix dans l'en-tête pour voir quand la dernière cotation est arrivée, ou regardez l'heure de « Dernière mise à jour » en bas du Tableau de bord principal. Si elle date de plus de quelques minutes pendant les heures normales, rechargez la page en forçant l'actualisation (Cmd+Shift+R / Ctrl+Shift+R). Les chiffres de positionnement des dealers sont recalculés environ une fois par minute : de courtes pauses entre deux changements sont donc normales.

**Le signal score affiche 0.** Cela signifie généralement « aucune lecture », et non « neutre ». Voir [Lire la ligne de score de -100 à +100](/help/platform/score-line).

## Paiements

**La carte a été refusée.** Mettez à jour le mode de paiement dans le portail de facturation Stripe (accessible depuis votre page [Compte](/account)). Les refus les plus courants sont dus à des cartes expirées, des adresses non correspondantes ou des restrictions régionales.

**L'abonnement indique « en retard de paiement ».** Stripe retente la charge. Mettez à jour le mode de paiement, ou réglez la facture en attente via **Ouvrir le portail de facturation** sur votre page Compte, pour résoudre le problème. Les fonctionnalités payantes restent actives pendant un court délai de grâce, le temps des nouvelles tentatives.

**La facture est plus élevée que prévu.** Ouvrez la facture dans le portail - les postes sont détaillés. Surprises courantes : une montée de niveau en cours de période est calculée au prorata - vous recevez un crédit pour la partie non utilisée de la période en cours, plus le montant du nouveau forfait, appliqué à votre **prochaine facture** plutôt que facturé immédiatement. Quitter l'essai gratuit de Basic pour Pro ou pour une période de facturation plus longue facture la nouvelle formule le jour même.

**L'annulation n'a pas abouti.** L'annulation prend effet à la fin de la période de facturation. Jusque-là, vous conservez l'accès payant. Le portail et votre page Compte affichent la date de fin prévue.

## Niveau et accès

**Une page vous envoie vers Pricing ou vers un écran de déverrouillage au lieu de s'ouvrir.** Cette page nécessite un niveau que vous n'avez pas actuellement. L'écran de déverrouillage indique la formule qui l'inclut, et [Pricing](/pricing) présente le détail complet.

**Vous avez effectué une mise à niveau mais une page reste verrouillée.** Rechargez en forçant l'actualisation pour rafraîchir la session. Si elle reste verrouillée, déconnectez-vous puis reconnectez-vous. Si elle reste toujours verrouillée, écrivez au support.

## Navigateur

**La page est vide.** Une extension de navigateur bloque probablement les scripts. Essayez une fenêtre de navigation privée avec les extensions désactivées. Si cela fonctionne, identifiez l'extension en les désactivant une par une.

**Les graphiques s'affichent avec des couleurs inattendues.** Vérifiez le menu des palettes à côté de l'icône soleil/lune dans l'en-tête - une autre palette change les couleurs de tous les graphiques. Si la palette est la bonne, basculez le thème une fois (icône soleil/lune) ; le rechargement suivant s'affichera correctement.

**Les cookies de connexion ne persistent pas.** Vous êtes peut-être dans un mode de confidentialité stricte du navigateur (Brave shields en mode agressif, Safari avec « Empêcher le suivi intersite », certains conteneurs Firefox). Ajoutez `zerogex.io` à la liste d'autorisation des cookies, ou reconnectez-vous à chaque session.

## Graphiques

**Un graphique est vide alors que d'autres affichent des données.** La cause la plus fréquente est une restriction de niveau - le graphique appartient à un niveau que vous n'avez pas, et les panneaux réservés à Pro affichent une invitation à passer à Pro à sa place. Parfois, le signal sous-jacent est intentionnellement inactif (sa fenêtre n'est pas ouverte).

**Les infobulles au survol ne s'affichent pas.** C'est un appareil tactile. Touchez le graphique ou faites un appui long, ou passez à un ordinateur de bureau.

## Mobile

**La mise en page paraît compressée.** ZeroGEX est conçu pour le bureau. La mise en page mobile convient pour la surveillance ; les pages complexes à plusieurs graphiques supposent davantage d'espace horizontal.

**La page ne défile pas quand votre doigt est sur un graphique.** Faites glisser vers le haut ou vers le bas - les graphiques ne captent que les glissements latéraux (pour se déplacer dans le temps), donc un glissement vertical fait défiler la page.

## Quand écrire au support

Après avoir essayé les points pertinents ci-dessus. Incluez :

- L'URL de la page sur laquelle vous étiez.
- Une capture d'écran si pertinent.
- Navigateur, système d'exploitation et approximativement quand cela s'est produit (avec fuseau horaire).
- L'e-mail de votre compte.

Écrivez à [support@zerogex.io](mailto:support@zerogex.io). Nous répondons rapidement - généralement le jour de trading même.

## Voir aussi

- [Streaming et performance](/help/platform/streaming-and-performance)
- [Paramètres du compte](/help/platform/account)
- [Facturation et portail Stripe](/help/platform/billing)
- [FAQ](/help/faqs)
