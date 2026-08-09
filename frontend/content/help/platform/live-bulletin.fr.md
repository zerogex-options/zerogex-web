# Utiliser le Live Bulletin

*Un instantané en direct et prêt à partager du positionnement gamma des dealers, pour le symbole que vous suivez.*

---

## Ce qu'est le Live Bulletin

Le Live Bulletin est une **carte de positionnement gamma en direct**, pour un sous-jacent à la fois. Choisissez un symbole et il récupère l'instantané de positionnement actuel directement depuis le backend et le présente sur une seule carte : le régime gamma, les niveaux clés (gamma flip, call wall, put wall, max pain), le Net GEX, le ratio put/call, une bande de fourchette attendue (expected range), et une carte de positionnement qui situe le spot par rapport à ces niveaux.

Elle est conçue pour être lue d'un coup d'œil — et pour être partagée. Vous pouvez ajuster le titre et le résumé, puis télécharger ou copier un PNG net de la carte pour vos notes, un chat de trading ou les réseaux sociaux.

## Ce que contient la carte

- **Badge de régime gamma** — positif (dealers longs en gamma ; marché ancré, faible volatilité), négatif (dealers courts en gamma ; marché en tendance, forte volatilité), au niveau du flip (transition), ou non résolu lorsque la chaîne est trop mince pour déterminer un flip de façon fiable.
- **Titre + résumé** — une lecture en langage clair générée automatiquement à partir des chiffres en direct : la posture des dealers, la position du spot par rapport au flip, le corridor entre les walls, et ce que le régime implique pour la tape. Modifiable — voir ci-dessous.
- **Spot** — le prix du sous-jacent et sa variation du jour. Lorsqu'un indice cash est en dehors de sa séance (p. ex. le SPX pendant la nuit), le spot est **implicite depuis les futures** (ES/NQ) et clairement signalé comme tel — jamais affiché comme une cotation cash en direct.
- **Grille de métriques** — Gamma Flip, Net GEX, ratio Put/Call, Call Wall, Put Wall et Max Pain.
- **Expected Range** — une bande de mouvement implicite à 1σ (~68 %) pour l'horizon choisi, dérivée du VIX (SPX/SPY) ou du VXN (QQQ/NDX), avec une note sur la position des walls des dealers par rapport à cette bande.
- **Carte de positionnement** — put wall, gamma flip, spot et call wall placés sur un même axe de prix, avec la bande de fourchette attendue ombrée, pour voir d'un coup d'œil où se situe le prix parmi les aimants.

## Contrôles

- **Sous-jacent** — SPX, SPY, QQQ ou NDX.
- **Horizon de la fourchette attendue** — Daily, Weekly ou Monthly. « Daily » correspond à une séance de trading de volatilité implicite (l'Expected Daily Range), pas à un jour calendaire ; Weekly correspond à 5 séances, Monthly à ~21. Si l'indice de volatilité implicite est indisponible, la bande est masquée plutôt qu'estimée.
- **Titre / Résumé** — le texte généré automatiquement est un point de départ ; modifiez l'un ou l'autre champ et la carte se met à jour en direct. « Reset to auto » restaure le texte généré.
- **Download PNG / Copy to clipboard** — exportez la carte sous forme d'image prête à partager (la carte porte un filigrane zerogex.io).

## Comment elle se met à jour

La carte est **en direct**. Elle interroge le backend tout au long de la séance — le spot toutes les quelques secondes, le résumé et le profil gamma toutes les ~10 secondes, la jauge de volatilité toutes les ~30 secondes — de sorte que les niveaux, le régime, la bande de fourchette attendue et la lecture générée automatiquement se rafraîchissent à mesure que les conditions changent. Les niveaux de gamma des dealers eux-mêmes sont recalculés par le moteur d'analytique selon un cycle d'environ une minute pendant la séance régulière, de sorte que les walls, le flip et le max pain peuvent évoluer en intraday à mesure que le spot et le positionnement évoluent. Un horodatage « as of » (ET) sur la carte vous indique la fraîcheur de l'instantané.

## Quand elle est la plus utile

- **Avant l'ouverture** — une lecture rapide de la position des walls, du flip et de la fourchette attendue à l'approche de la séance, avec le spot implicite depuis les futures tant que l'indice cash est encore fermé.
- **Autour des niveaux majeurs** — jetez un œil à la carte de positionnement quand le prix approche du flip, du call wall ou du put wall.
- **Pour partager une lecture** — exportez la carte quand vous voulez transmettre à quelqu'un l'image du positionnement gamma du jour sans faire une capture de toute l'application.

## Ce que ce n'est pas

Le Live Bulletin **n'est pas un flux de signaux de trading**. C'est un instantané de positionnement/contexte — il vous montre *où* se situe le gamma des dealers et quel régime cela implique, pas *quand* agir. Pour les signaux et les déclenchements, utilisez les dashboards Basic et Advanced Signals ainsi que les [Signal Alerts](/help/platform/alerts) ; pour une lecture directionnelle, consultez le Trade Bias et le [Composite Score](/help/platform/composite-score).

## Visibilité par niveau

Le Live Bulletin est une fonctionnalité **Basic** — incluse dans Basic et Pro. Les signaux Advanced vers lesquels il vous oriente sont réservés séparément au niveau Pro.

## Le miroir admin

Il existe une version admin sans filigrane de la même carte, utilisée pour les captures d'écran et les démonstrations. Il s'agit d'un chemin strictement interne.

## Voir aussi

- [Lire le Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Max Pain](/help/platform/max-pain)
