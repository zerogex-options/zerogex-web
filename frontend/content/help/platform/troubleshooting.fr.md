# Dépannage

*La liste essentielle — problèmes de connexion, données manquantes, graphiques obsolètes, problèmes de paiement, caches du navigateur, et quand contacter le support.*

---

## Impossible de se connecter

**Vous avez oublié votre mot de passe.** Utilisez [Mot de passe oublié](/forgot-password). Un lien de réinitialisation est envoyé par e-mail ; cliquez dessus et définissez-en un nouveau. Si l'e-mail n'arrive pas, vérifiez les spams.

**Vous vous êtes inscrit avec Google ou Apple et n'avez pas de mot de passe.** Connectez-vous avec le fournisseur que vous avez utilisé. Depuis la page Compte, vous pourrez ensuite définir un mot de passe pour une utilisation future.

**Le fournisseur indique « aucun compte trouvé ».** Vous vous êtes peut-être inscrit avec une autre adresse e-mail. Essayez l'autre fournisseur, ou écrivez à [support@zerogex.io](mailto:support@zerogex.io) — nous pouvons rechercher le compte.

**L'invite de double authentification ou d'appareil ne disparaît pas.** Reconnectez-vous depuis une fenêtre de navigation privée. Si le problème persiste, le support peut effacer les sessions obsolètes de votre compte.

## Données manquantes ou obsolètes

**Le badge de session indique Fermé.** C'est la réponse — les marchés sont fermés. Les dernières valeurs calculées sont affichées.

**Un graphique indique « aucune donnée ».** C'est généralement un problème de fenêtre de session (EOD Pressure en dehors de sa fenêtre, 0DTE un jour sans échéance). Survolez l'état vide — l'infobulle explique pourquoi.

**Les valeurs des tuiles semblent figées.** Vérifiez l'horodatage sur la tuile de prix. S'il date de plus de 30 secondes pendant les heures normales, rechargez la page en forçant l'actualisation (Cmd+Shift+R / Ctrl+Shift+R).

**Le signal score affiche 0.** Cela signifie généralement « aucune lecture », et non « neutre ». Voir [Lire la Score Line [-1, +1]](/help/platform/score-line).

## Paiements

**La carte a été refusée.** Mettez à jour le mode de paiement dans le portail de facturation Stripe (accessible depuis votre page [Compte](/account)). Les refus les plus courants sont dus à des cartes expirées, des adresses non correspondantes ou des restrictions régionales.

**L'abonnement indique « en retard de paiement ».** Stripe retente la charge. Mettez à jour le mode de paiement pour résoudre le problème. Les fonctionnalités payantes restent actives pendant la fenêtre de nouvelle tentative.

**La facture est plus élevée que prévu.** Ouvrez la facture dans le portail — les postes sont détaillés. Surprises courantes : un changement de forfait ou de fréquence est calculé au prorata — vous recevez un crédit pour la partie non utilisée de la période en cours, plus le montant du nouveau forfait, appliqué à votre **prochaine facture** plutôt que facturé immédiatement.

**L'annulation n'a pas abouti.** L'annulation prend effet à la fin de la période de facturation. Jusque-là, vous conservez l'accès payant. Le portail affiche la date de fin prévue.

## Niveau et accès

**Une page redirige vers /pricing au lieu de s'ouvrir.** Cette page nécessite un niveau que vous n'avez pas actuellement. [Pricing](/pricing) indique ce qui le débloque.

**Vous avez effectué une mise à niveau mais une page reste verrouillée.** Rechargez en forçant l'actualisation pour rafraîchir la session. Si elle reste verrouillée, déconnectez-vous puis reconnectez-vous. Si elle reste toujours verrouillée, écrivez au support.

## Navigateur

**La page est vide.** Une extension de navigateur bloque probablement les scripts. Essayez une fenêtre de navigation privée avec les extensions désactivées. Si cela fonctionne, identifiez l'extension en les désactivant une par une.

**Les graphiques s'affichent avec des couleurs étranges.** Décalage du cache de thème. Basculez le thème une fois (icône soleil/lune). Le rechargement suivant s'affichera correctement.

**Les cookies de connexion ne persistent pas.** Vous êtes peut-être dans un mode de confidentialité stricte du navigateur (Brave shields en mode agressif, Safari avec « Empêcher le suivi intersite », certains conteneurs Firefox). Ajoutez `zerogex.io` à la liste d'autorisation des cookies, ou reconnectez-vous à chaque session.

## Graphiques

**Un graphique est vide alors que d'autres affichent des données.** La cause la plus fréquente est une restriction de niveau — le graphique appartient à un niveau que vous n'avez pas. Parfois, le signal sous-jacent est intentionnellement inactif (sa fenêtre n'est pas ouverte). Survolez l'état vide pour l'explication.

**Les infobulles au survol ne s'affichent pas.** C'est un appareil tactile. Utilisez un appui long, ou passez à un ordinateur de bureau.

## Mobile

**La mise en page paraît compressée.** ZeroGEX est conçu pour le bureau. La mise en page mobile convient pour la surveillance ; les pages complexes à plusieurs graphiques supposent davantage d'espace horizontal.

**Le défilement se bloque pendant le glissement d'un graphique.** Touchez d'abord en dehors de la zone du graphique, puis faites défiler. Les graphiques captent intentionnellement le glissement horizontal pour le zoom/panoramique.

## Quand écrire au support

Après avoir essayé les points pertinents ci-dessus. Incluez :

- L'URL de la page sur laquelle vous étiez.
- Une capture d'écran si pertinent.
- Navigateur, système d'exploitation et approximativement quand cela s'est produit (avec fuseau horaire).
- L'e-mail de votre compte.

Écrivez à [support@zerogex.io](mailto:support@zerogex.io). Nous répondons rapidement — généralement le jour de trading même.

## Voir aussi

- [Streaming et performance](/help/platform/streaming-and-performance)
- [Paramètres du compte](/help/platform/account)
- [Facturation et portail Stripe](/help/platform/billing)
- [FAQ](/help/faqs)
