# Utiliser le Live Bulletin

*Le flux en direct des événements de signal, des changements de régime et des flux notables.*

---

## Ce qu'est le Live Bulletin

Le Live Bulletin est votre **chronologie de la journée de trading**. Chaque fois qu'un signal se déclenche, que le régime GEX bascule, qu'un wall se déplace de façon significative, ou qu'un flux de smart money apparaît en volume notable, une entrée atterrit dans le bulletin.

Considérez-le comme la "vue newsfeed" de tout ce que ZeroGEX détecte, classée par importance et par heure.

## Ce qui atterrit dans le bulletin

Il existe cinq familles d'éléments :

- **Signal triggers** — lorsqu'un signal Advanced franchit son seuil de déclenchement.
- **Regime events** — franchissement du gamma flip, transition de régime (positif ↔ négatif).
- **Wall events** — le call wall ou le put wall se déplace de façon significative.
- **Flow notables** — pics de prime, séries de smart money, blocs inhabituels.
- **Schedule events** — ouverture du marché, ouverture de la fenêtre de pression EOD, clôture.

## Comment les éléments sont notés et classés

Chaque élément comporte :

- Un **horodatage** — le moment où il s'est produit (avec un badge "fresh" pour les éléments les plus récents)
- Une **puce de direction** — bullish, bearish ou neutral
- Un **conviction score** — la force du signal/événement

Par défaut, les éléments sont classés chronologiquement de haut en bas. Vous pouvez basculer vers un classement par importance via le menu déroulant de tri.

## Lire un élément

Chaque ligne comporte :

1. **Title** — le nom de l'événement ("EOD Pressure fired", "Trap Detection bearish", "Gamma flip crossed").
2. **Subtitle** — le contexte clé (symbole, score, niveau).
3. **Time** — relatif ("4m ago") et absolu au survol.
4. **Action** — cliquez sur "Open" pour accéder directement à la page du signal ou de la métrique concernée.

Pour les triggers, les lignes affichent également le **score qui a déclenché l'événement** et le **seuil de déclenchement**, afin que vous puissiez voir s'il s'agissait d'un événement limite ou d'un signal fort.

## Filtrage

La barre de filtres vous permet de cibler le flux par :

- **Symbol** — SPY, SPX, QQQ (par défaut, le symbole actuellement actif)
- **Signal family** — Advanced, Basic, Regime, Flow, Schedule
- **Direction** — bullish, bearish, neutral
- **Time window** — dernière heure, aujourd'hui, dernières 24h, 5 derniers jours de bourse

Les filtres se combinent entre eux. Vous pouvez cumuler symbol = SPX avec signal family = Advanced et direction = bearish pour ne faire ressortir que les triggers Advanced bearish sur SPX.

## Quand le bulletin est le plus utile

- **Le matin** — faites défiler les dernières séances pour voir ce qui s'est déclenché pendant la nuit et en pre-market.
- **Autour des niveaux majeurs** — quand le prix approche du gamma flip, du call wall ou du put wall, attendez-vous à voir apparaître de nouveaux événements.
- **Dans la dernière heure** — le signal EOD Pressure fournit souvent des lectures exploitables à partir de 14h30 ET.
- **Comme outil de journaling** — chaque signal déclenché est enregistré, ce qui fait du bulletin la piste d'audit de votre journée.

## Ce que ce n'est pas

Le Live Bulletin **n'est pas un flux de signaux de trading**. Les éléments sont des événements qui méritent votre attention ; qu'ils constituent des trades dépend de votre stratégie. Le panneau Composite Score est ce qui se rapproche le plus d'une lecture de "ce que cela signifie pour la direction", et même cela reste un filtre, pas une prévision.

## Visibilité par niveau

- Le niveau Basic voit les événements de signal Basic, les événements de régime, les événements de wall et les flow notables.
- Le niveau Pro voit en plus les triggers de signal Advanced.

Les éléments verrouillés (pour les invitations à passer au niveau supérieur) affichent une puce de verrouillage au lieu de disparaître.

## Le miroir admin

Il existe une version admin du bulletin sans filigrane, utilisée pour les captures d'écran et les démonstrations. Il s'agit d'un chemin strictement interne.

## Voir aussi

- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signal Alerts](/help/platform/alerts)
