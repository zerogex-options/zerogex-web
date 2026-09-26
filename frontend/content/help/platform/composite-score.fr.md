# Composite Score

*La lecture combinée du **régime** de marché actuel - comment elle est construite, pourquoi ce n'est pas un appel directionnel, et comment l'utiliser comme filtre plutôt que comme prévision.*

---

## Qu'est-ce que le Composite Score

Le Composite Score - en interne **MSI**, le Market State Index - est le **résumé en un seul nombre du régime actuel de la structure d'options** sur le symbole actif. Il répond à une seule question : *le tape est-il susceptible de suivre une tendance, ou de hacher (chop) ?*

Il se situe sur une **échelle de 0 à 100, où 50 est neutre.** Ce n'est **pas** un score directionnel - il ne vous dit pas haussier vs baissier. Un MSI élevé signifie que les tendances ont tendance à *se prolonger* ; un MSI bas signifie que le tape est *figé ou haché*. Pour la direction, consultez le [Trade Bias](/trade-bias) - c'est la lecture signée, haussier vs baissier.

> **Un MSI élevé ne signifie pas « haussier ». Il signifie que les tendances peuvent se prolonger.**
> **Un MSI bas ne signifie pas « baissier ». Il signifie que les tendances ont peu de chances de fonctionner.**

## Les bandes de régime

| Score | Régime | Ce que cela signifie |
| --- | --- | --- |
| ≥ 70 | **Trend / Expansion** | Le plus grand parcours ultérieur des quatre bandes, historiquement |
| 40 - 70 | **Controlled Trend** | Parcours ultérieur supérieur à la moyenne |
| 20 - 40 | **Chop / Range** | Parcours ultérieur inférieur à la moyenne |
| < 20 | **Compression** | Le plus faible parcours ultérieur des quatre bandes, historiquement |

Les bandes sont ordonnées selon le parcours ultérieur mesuré : les lectures de la bande supérieure ont historiquement été suivies de l'amplitude la plus large, celles de la bande inférieure de la plus étroite. Cet ordre tient sur tous les horizons testés, mais l'effet est modéré - il déplace les probabilités, il ne les détermine pas.

Une réserve que nous préférons énoncer plutôt que masquer : le score n'est pas une lecture de régime pure. Deux de ses six composantes mesurent la *direction* du flux d'options plutôt que la distance parcourue par le prix, et elles entrent dans le score de façon signée. En pratique, un tape fortement baissier peut tirer le score vers les bandes basses même si la structure d'options n'a pas changé. Nous séparons les deux lectures ; d'ici là, considérez un score bas pendant une forte baisse comme un signal en partie directionnel, et non comme une pure prévision d'amplitude.

## Comment il est construit

Le MSI combine **six composantes indépendantes**, chacune notée sur une ligne −1…+1 et pondérée dans un budget de points totalisant 100 :

| Composante | Points | Lecture |
| --- | --- | --- |
| Gamma Anchor | 30 | Proximité du gamma flip, densité de gamma locale, strike de max-gamma - figé vs libre |
| Order Flow Imbalance | 19 | Premium call vs put du smart money - *directionnelle* |
| Dealer Delta Pressure | 17 | Direction de hedge forcé des dealers - *directionnelle* |
| Net GEX Sign | 16 | Dealers long gamma (amortit les mouvements) vs short gamma (amplifie) |
| Put/Call Ratio | 12 | Proxy de fragilité structurelle |
| Volatility Regime | 6 | Vol en direct vs le pivot de vol 20 |

Les composantes sont additionnées sur la ligne de base neutre à 50 via un mélange à saturation douce (tanh), de sorte qu'aucune entrée ne peut à elle seule dominer la jauge. **Environ deux tiers du poids sont de la structure sans direction** (Gamma Anchor, Net GEX Sign, Put/Call, Vol) - celles-ci poussent vers la *tendance* ou le *chop*, pas vers le haut ou le bas. Seules Order Flow Imbalance et Dealer Delta sont réellement directionnelles, ce qui explique qu'un tape fortement unilatéral puisse infléchir le score même si la jauge reste une lecture de régime.

Pour chaque composante, **+1 plaide pour un régime tradable / de tendance ; −1 plaide pour le chop / le figement / le retournement.**

Ces six composantes forment toute la recette : les signaux Basic et Advanced ne sont pas des entrées du MSI. (La composante Dealer Delta Pressure utilise la même lecture du delta net des dealers que le signal Basic du même nom.)

## La jauge MSI

La page Composite Score affiche :

- La **jauge MSI** - le score sur un arc 0-100. Les segments de l'arc sont colorés par *bande de régime* ; l'aiguille, le nombre et le label de régime prennent la couleur de l'Implied bias (ci-dessous).
- Le **label de régime** - Trend / Expansion, Controlled Trend, Chop / Range, ou Compression.
- L'**Implied bias** - une direction superposée, uniquement pour la couleur. Il combine le mouvement du sous-jacent sur environ les 30 dernières minutes avec le score : au-dessus de 50, il suggère que le mouvement actuel se poursuit, en dessous de 50, un retournement. Vert signifie haussier implicite, rouge baissier implicite, neutre quand le prix est plat ou que le score est proche de 50. Le nombre lui-même reste une jauge de régime.
- Le **Δ depuis l'ouverture** et le **Δ des 5 dernières min** - de combien le score de régime a bougé (vers la tendance si positif, vers le chop si négatif). Ce sont des indicateurs de momentum du régime, pas de direction.
- La barre **Component Contributions** - la poussée signée de chaque composante autour de la ligne de base à 50 : à droite (vert) vers « tendance », à gauche (rouge) vers « chop / retournement ». En dessous, une carte par composante affiche son score −1…+1, sa contribution en points et ses points maximum.
- Un graphique **Intraday Trend** du score sur la session, avec les bandes de régime ombrées. Survolez n'importe quel point pour voir l'heure, le score, le régime et les trois principales composantes qui l'expliquent.

Sur ES et NQ, la page indique que le score est dérivé des options SPX ou NDX - les futures n'ont pas de chaîne d'options propre.

## Interpréter le composite

Une règle simple - lisez-la comme *le degré de confiance à accorder à une tendance*, et prenez la direction depuis le Trade Bias :

| Composite | Lecture |
| --- | --- |
| ≥ 70 | Régime de tendance - les tendances dans le biais dominant peuvent se prolonger ; appuyez avec la tendance |
| 40 - 70 | Tendance contrôlée - un edge réel mais modéré ; réduisez la taille |
| 20 - 40 | Chop / range - fadez les extrêmes, ne courez pas après les breakouts, privilégiez le risque défini |
| < 20 | Compression - historiquement le plus faible parcours ultérieur de toutes les bandes ; ne comptez pas sur la poursuite des breakouts |

Les extrêmes - le haut et le bas - sont les plus utiles. La zone médiane (~40-60) est une zone « pas de régime marqué » - n'y forcez pas un trade de tendance.

## Comment l'utiliser

Trois schémas :

1. **Comme cadran de conviction sur la direction.** Le Trade Bias vous donne le côté ; le MSI vous dit avec quelle force appuyer. Biais long + MSI 75 → appuyez. Biais long + MSI 25 → achetez le creux en petite taille, fadez les extrêmes, ne courez pas après.
2. **Comme filtre de chop.** Ne mettez pas en place de trades de tendance / breakout quand le MSI est bas (< 40) - le tape est haché ou en retour à la moyenne *quelle que soit la direction*. Un score bas n'est pas un signal pour passer short.
3. **Comme confirmateur de régime.** Les lectures du MSI *ont tendance à* être plus fortes et plus persistantes lors des sessions en gamma négatif, ce qui concorde avec le comportement plus directionnel que ces régimes tendent à montrer.

## Ce qu'il n'est pas

Le composite **n'est pas un signal de trading**, et **ce n'est pas un appel directionnel.** Il vous dit quel *type* de tape vous avez en face - tendance vs chop ; il ne vous dit pas dans quel sens, quel horizon temporel utiliser, ni où placer votre stop. Associez-le au Trade Bias (direction) et aux signaux individuels (déclencheurs).

## Pourquoi le composite peut basculer rapidement

Deux raisons :

- Un franchissement du gamma flip peut faire bouger fortement les composantes structurelles (Gamma Anchor, Net GEX Sign), déplaçant rapidement la lecture de régime.
- Un changement brusque du flux smart-money ou du delta des dealers fait bouger les deux composantes directionnelles suffisamment pour infléchir le mélange.

Le graphique Intraday Trend rend ces changements par paliers visibles - repérez les discontinuités.

## Habitudes de traders qui ont fait leurs preuves

- Lisez le MSI à l'ouverture ainsi qu'à 11h00 / 12h30 / 14h30 ET comme points de contrôle.
- Traitez le MSI comme la **taille** de position, et le Trade Bias comme la **direction** de position.
- Traitez les scores entre ~40 et ~60 comme « pas de régime marqué - attendez » plutôt que comme une direction.

## Note sur les niveaux

La page Composite Score est réservée à l'offre Pro. Avec Basic, vous voyez tout de même le MSI : la section Signaux Propriétaires du Tableau de bord principal affiche le score et sa bande de régime, et Mon tableau de bord propose un widget Composite Score.

## Voir aussi

- [Trade Bias](/trade-bias) - la lecture signée, directionnelle (Pro)
- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Signaux : expliqués](/guides/signals-explained)
