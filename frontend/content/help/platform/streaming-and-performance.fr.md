# Streaming et performance

*Comment les mises à jour en temps réel arrivent jusqu'à votre navigateur, que faire si une page semble figée, et les solutions les plus simples en cas de connexion lente.*

---

## Comment fonctionne le streaming

ZeroGEX envoie des données en direct à votre navigateur via une connexion persistante — ouvrez le tableau de bord et les données commencent à affluer moins d'une seconde après le chargement de la page. Il n'y a pas de polling côté client.

La connexion se renouvelle automatiquement en cas de coupure. Si un renouvellement échoue de manière répétée, l'interface affiche une étiquette "Reconnexion…" et lance une nouvelle tentative avec backoff.

## Ce que "en direct" signifie vraiment

| Élément | Fréquence de mise à jour |
| --- | --- |
| Cotation de prix | ~1 seconde |
| Flow / tape | ~1 seconde |
| Scores de signaux | 1 à 5 secondes selon le signal |
| Surface GEX | 5 à 15 secondes (goulot d'étranglement : snapshot de la chain) |
| Composite Score | ~5 secondes |

Lorsque la page est dans un onglet en arrière-plan, le navigateur peut limiter les mises à jour. Remettez l'onglet au premier plan et les mises à jour reprennent immédiatement.

## Quand une page semble figée

Les causes les plus fréquentes, par ordre de fréquence observée :

1. **L'onglet est resté en arrière-plan pendant des heures.** La connexion s'est peut-être coupée. Rechargez la page.
2. **Vous êtes sur une connexion lente.** Les messages WebSocket s'accumulent ; la donnée la plus récente finit par s'imposer, mais les mises à jour paraissent lentes. Changez de réseau ou fermez d'autres onglets gourmands.
3. **Un bloqueur de publicités ou une extension interfère.** Certains bloqueurs trop agressifs rejettent les frames WebSocket. Essayez en fenêtre privée avec les extensions désactivées.
4. **Le marché est fermé.** Le badge de session l'indique. Les dernières valeurs calculées sont affichées.

## Que vérifier en premier

Quand quelque chose semble anormal, le diagnostic en quatre étapes :

1. Regardez le **badge de session** — le marché est-il ouvert ?
2. Regardez la **tuile de prix** — l'horodatage est-il récent ?
3. Regardez l'**indicateur de connexion** dans l'en-tête — est-il vert ?
4. Forcez le rechargement de la page (Cmd+Shift+R ou Ctrl+Shift+R).

Cela couvre environ 95 % des situations où "quelque chose semble cassé".

## Conseils de performance

### Utilisez un navigateur récent

ZeroGEX est conçu pour les versions evergreen de Chrome, Edge, Firefox et Safari (Tech Preview). Les versions plus anciennes de navigateurs fonctionneront techniquement, mais ne bénéficieront pas des optimisations de performance.

### Fermez les autres onglets gourmands

Le tableau de bord diffuse plusieurs graphiques en direct. Si vous avez un onglet YouTube en streaming et trois fenêtres TradingView ouvertes, le navigateur doit partager le CPU entre tout cela. Fermez ce dont vous n'avez pas besoin.

### Désactivez les extensions inutiles

Les extensions de confidentialité et de blocage de publicités posent généralement peu de problèmes. Les bloqueurs de scripts agressifs (NoScript avec des réglages par défaut restrictifs) nécessitent que les domaines de ZeroGEX soient ajoutés à une liste blanche.

### Le mode clair est légèrement plus rapide

Le thème clair se rend légèrement plus vite que le thème sombre sur la plupart des configurations, en raison de la façon dont les ombres et les teintes sont composées. C'est marginal — mais utile à savoir si vous êtes sur un appareil peu puissant.

### Changer de symbole est plus lourd que changer de période

Changer de symbole recharge toutes les données depuis le début ; changer de période réutilise le flux sous-jacent. Si vous devez aller vite, privilégiez le sélecteur de période.

## Mobile

ZeroGEX fonctionne sur téléphone — chaque page est responsive — mais la plateforme est **conçue pour le bureau**. La densité des graphiques suppose un écran de plus de 1024px de large. Sur mobile, faites défiler horizontalement les graphiques ; toutes les données sont présentes, mais la mise en page est plus dense.

## Quand contacter le support par e-mail

Si la plateforme elle-même semble bloquée (et non votre connexion ou un onglet figé), vérifiez l'indicateur de connexion en bas à droite. S'il reste rouge après plusieurs rechargements forcés, envoyez un e-mail à [support@zerogex.io](mailto:support@zerogex.io) avec :

- La page sur laquelle vous étiez
- L'heure à laquelle c'est arrivé (avec le fuseau horaire)
- Votre navigateur et votre système d'exploitation

Nos journaux sont horodatés de notre côté — cela suffit pour retracer le problème.

## Voir aussi

- [Dépannage](/help/platform/troubleshooting)
- [Couverture des données et actualisation](/help/platform/data-coverage)
