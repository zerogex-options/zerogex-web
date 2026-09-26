# Streaming et performance

*Comment les mises à jour en temps réel arrivent jusqu'à votre navigateur, que faire si une page semble figée, et les solutions les plus simples en cas de connexion lente.*

---

## Comment fonctionnent les mises à jour en direct

Chaque page se tient à jour d'elle-même - rien à recharger. Le prix dans l'en-tête se met à jour environ une fois par seconde, et chaque panneau récupère de nouveaux chiffres à son propre rythme, toutes les quelques secondes pour la plupart des éléments. Les données commencent à arriver dès le chargement de la page.

Si une requête échoue, la page continue d'afficher les dernières valeurs valides et réessaie au cycle suivant. Les pages Score composite et Trade Bias affichent en plus un indicateur en direct, avec un avertissement "Reconnecting…" si les mises à jour cessent d'arriver.

## Ce que "en direct" signifie vraiment

Les pages vérifient les nouveaux chiffres toutes les quelques secondes, mais chaque chiffre ne change qu'au rythme de son calcul :

| Élément | À quelle fréquence il change |
| --- | --- |
| Cotation de prix | Environ chaque seconde |
| Positionnement des dealers (GEX, walls, flip, max pain) | Recalculé environ une fois par minute |
| Scores de signaux et Score composite | Environ une fois par minute ; les pages de signaux vérifient toutes les 5 secondes |
| Flux d'options | Barres de cinq minutes |
| Jauges de volatilité (VIX / VXN) | Barres de cinq minutes |

Lorsque la page est dans un onglet en arrière-plan, le navigateur peut limiter les mises à jour. Remettez l'onglet au premier plan et les mises à jour reprennent immédiatement.

## Quand une page semble figée

Les causes les plus fréquentes, par ordre de fréquence observée :

1. **L'onglet est resté en arrière-plan pendant des heures.** Les mises à jour se sont peut-être interrompues. Rechargez la page.
2. **Vous êtes sur une connexion lente.** Les requêtes s'accumulent ; la donnée la plus récente finit par s'imposer, mais les mises à jour paraissent lentes. Changez de réseau ou fermez d'autres onglets gourmands.
3. **Un bloqueur de publicités ou une extension interfère.** Certains bloqueurs trop agressifs bloquent les requêtes en arrière-plan qui récupèrent les données fraîches. Essayez en fenêtre privée avec les extensions désactivées.
4. **Le marché est fermé.** Le badge de session l'indique. Les dernières valeurs calculées sont affichées.

## Que vérifier en premier

Quand quelque chose semble anormal, le diagnostic en trois étapes :

1. Regardez le **badge de session** - le marché est-il ouvert ?
2. Survolez le **prix dans l'en-tête** - son heure "as of" est-elle récente ?
3. Forcez le rechargement de la page (Cmd+Shift+R ou Ctrl+Shift+R).

Cela couvre la plupart des situations où "quelque chose semble cassé".

## Conseils de performance

### Utilisez un navigateur récent

ZeroGEX est conçu pour les versions actuelles de Chrome, Edge, Firefox et Safari. Si quelque chose ne fonctionne pas bien dans un navigateur ancien, mettez-le d'abord à jour.

### Fermez les autres onglets gourmands

Le tableau de bord met à jour plusieurs graphiques en direct. Si vous avez un onglet YouTube en streaming et trois fenêtres TradingView ouvertes, le navigateur doit partager le CPU entre tout cela. Fermez ce dont vous n'avez pas besoin.

### Désactivez les extensions inutiles

Les extensions de confidentialité et de blocage de publicités posent généralement peu de problèmes. Les bloqueurs de scripts agressifs (NoScript avec des réglages par défaut restrictifs) nécessitent que les domaines de ZeroGEX soient ajoutés à une liste blanche.

### Changer de symbole est plus lourd que changer de période

Changer de symbole recharge les données de tous les panneaux de la page ; changer la période d'un graphique ne recharge que ce graphique.

## Mobile

ZeroGEX fonctionne sur téléphone - chaque page est responsive - mais la plateforme est **conçue pour le bureau**. La densité des graphiques suppose un écran de plus de 1024px de large. Sur téléphone, les graphiques s'adaptent à l'écran et affichent moins d'étiquettes ; toutes les données sont présentes, mais la mise en page est plus dense. Faites glisser vers le haut ou vers le bas pour faire défiler la page - les graphiques ne réagissent qu'aux glissements latéraux.

## Quand contacter le support par e-mail

Si la plateforme elle-même semble bloquée (et non votre connexion ou un onglet figé) et que les rechargements forcés n'y changent rien, envoyez un e-mail à [support@zerogex.io](mailto:support@zerogex.io) avec :

- La page sur laquelle vous étiez
- L'heure à laquelle c'est arrivé (avec le fuseau horaire)
- Votre navigateur et votre système d'exploitation

Nos journaux sont horodatés de notre côté - cela suffit pour retracer le problème.

## Voir aussi

- [Dépannage](/help/platform/troubleshooting)
- [Couverture des données et actualisation](/help/platform/data-coverage)
