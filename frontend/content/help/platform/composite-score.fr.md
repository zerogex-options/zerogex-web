# Composite Score

*La lecture combinée du **régime** de marché actuel — comment elle est construite, pourquoi ce n'est pas un appel directionnel, et comment l'utiliser comme filtre plutôt que comme prévision.*

---

## Qu'est-ce que le Composite Score

Le Composite Score — en interne **MSI**, le Market State Index — est le **résumé en un seul nombre du régime actuel de la structure d'options** sur le symbole actif. Il répond à une seule question : *le tape est-il susceptible de suivre une tendance, ou de hacher (chop) ?*

Il se situe sur une **échelle de 0 à 100, où 50 est neutre.** Ce n'est **pas** un score directionnel — il ne vous dit pas haussier vs baissier. Un MSI élevé signifie que les tendances ont tendance à *se prolonger* ; un MSI bas signifie que le tape est *figé, haché ou fragile*. Pour la direction, consultez le [Trade Bias](/help/platform/trade-bias) — c'est la lecture signée, haussier vs baissier.

> **Un MSI élevé ne signifie pas « haussier ». Il signifie que les tendances peuvent se prolonger.**
> **Un MSI bas ne signifie pas « baissier ». Il signifie que les tendances ont peu de chances de fonctionner.**

## Les bandes de régime

| Score | Régime | Ce que cela signifie |
| --- | --- | --- |
| ≥ 70 | **Trend / Expansion** | Régime directionnel fort — privilégiez les trades dans le biais dominant |
| 40 – 70 | **Controlled Trend** | Edge directionnel modéré — tradez avec une taille réduite |
| 20 – 40 | **Chop / Range** | Marché en range — fadez les extrêmes, évitez les trades de tendance |
| < 20 | **High-Risk Reversal** | Retour à la moyenne uniquement — risque de mouvement extrême élevé, tape fragile |

Notez que les bandes portent sur le *régime*, pas sur la *direction*. Un tape haché se lit **20–40 que le marché dérive vers le haut ou vers le bas.** C'est voulu — un score bas dans un marché en hausse n'est pas une contradiction, c'est la jauge qui vous dit que le mouvement a peu de chances de suivre une tendance nette.

## Comment il est construit

Le MSI combine **six composantes indépendantes**, chacune notée sur une ligne −1…+1 et pondérée dans un budget de points totalisant 100 :

| Composante | Points | Lecture |
| --- | --- | --- |
| Gamma Anchor | 30 | Proximité du gamma flip, densité de gamma locale, strike de max-gamma — figé vs libre |
| Order Flow Imbalance | 19 | Premium call vs put du smart money — *la seule entrée directionnelle* |
| Dealer Delta Pressure | 17 | Direction de hedge forcé des dealers |
| Net GEX Sign | 16 | Dealers long gamma (amortit les mouvements) vs short gamma (amplifie) |
| Put/Call Ratio | 12 | Proxy de fragilité structurelle |
| Volatility Regime | 6 | Vol en direct vs le pivot de vol 20 |

Les composantes sont additionnées sur la ligne de base neutre à 50 via un mélange à saturation douce (tanh), de sorte qu'aucune entrée ne peut à elle seule dominer la jauge. **Environ deux tiers du poids sont de la structure sans direction** (Gamma Anchor, Net GEX Sign, Put/Call, Vol) — celles-ci poussent vers la *tendance* ou le *chop*, pas vers le haut ou le bas. Seules Order Flow Imbalance et Dealer Delta sont réellement directionnelles, ce qui explique qu'un tape fortement unilatéral puisse infléchir le score même si la jauge reste une lecture de régime.

Pour chaque composante, **+1 plaide pour un régime tradable / de tendance ; −1 plaide pour le chop / le figement / le retournement.**

## La jauge MSI

La page Composite Score affiche :

- La **jauge MSI** — le score sur l'arc 0–100, coloré par *bande de régime* (pas par haussier/baissier).
- Le **label de régime** — Trend / Expansion, Controlled Trend, Chop / Range, ou High-Risk Reversal.
- Le panneau des **composantes contributrices** — la poussée actuelle de chaque entrée, à droite pour « tendance », à gauche pour « chop / retournement », triée par amplitude.
- Le **Δ depuis l'ouverture** et le **Δ des 5 dernières min** — de combien le score de régime a bougé (vers la tendance si positif, vers le chop si négatif). Ce sont des indicateurs de momentum du régime, pas de direction.
- Un **sparkline** du score sur la session.

## Interpréter le composite

Une règle simple — lisez-la comme *le degré de confiance à accorder à une tendance*, et prenez la direction depuis le Trade Bias :

| Composite | Lecture |
| --- | --- |
| ≥ 70 | Régime de tendance — les tendances dans le biais dominant peuvent se prolonger ; appuyez avec la tendance |
| 40 – 70 | Tendance contrôlée — un edge réel mais modéré ; réduisez la taille |
| 20 – 40 | Chop / range — fadez les extrêmes, ne courez pas après les breakouts, privilégiez le risque défini |
| < 20 | Fragile / fort risque de retournement — retour à la moyenne uniquement, attendez-vous à des breakouts qui échouent |

Les extrêmes — le haut et le bas — sont les plus utiles. La zone médiane (~40–60) est une zone « pas de régime marqué » — n'y forcez pas un trade de tendance.

## Comment l'utiliser

Trois schémas :

1. **Comme cadran de conviction sur la direction.** Le Trade Bias vous donne le côté ; le MSI vous dit avec quelle force appuyer. Biais long + MSI 75 → appuyez. Biais long + MSI 25 → achetez le creux en petite taille, fadez les extrêmes, ne courez pas après.
2. **Comme filtre de chop.** Ne mettez pas en place de trades de tendance / breakout quand le MSI est bas (< 40) — le tape est haché ou en retour à la moyenne *quelle que soit la direction*. Un score bas n'est pas un signal pour passer short.
3. **Comme confirmateur de régime.** Les lectures du MSI *ont tendance à* être plus fortes et plus persistantes lors des sessions en gamma négatif, ce qui concorde avec le comportement plus directionnel que ces régimes tendent à montrer.

## Ce qu'il n'est pas

Le composite **n'est pas un signal de trading**, et **ce n'est pas un appel directionnel.** Il vous dit quel *type* de tape vous avez en face — tendance vs chop ; il ne vous dit pas dans quel sens, quel horizon temporel utiliser, ni où placer votre stop. Associez-le au Trade Bias (direction) et aux signaux individuels (déclencheurs).

## Pourquoi le composite peut basculer rapidement

Deux raisons :

- Un franchissement du gamma flip peut faire bouger fortement les composantes structurelles (Gamma Anchor, Net GEX Sign), déplaçant rapidement la lecture de régime.
- Un changement brusque du flux smart-money fait bouger la seule composante directionnelle suffisamment pour infléchir le mélange.

Le sparkline rend ces changements par paliers visibles — repérez les discontinuités.

## Habitudes de traders qui ont fait leurs preuves

- Lisez le MSI à l'ouverture ainsi qu'à 11h00 / 12h30 / 14h30 ET comme points de contrôle.
- Traitez le MSI comme la **taille** de position, et le Trade Bias comme la **direction** de position.
- Traitez les scores entre ~40 et ~60 comme « pas de régime marqué — attendez » plutôt que comme une direction.

## Note sur les niveaux

La page Composite Score est réservée à l'offre Pro. La jauge MSI apparaît également sur le Dashboard pour tous les niveaux payants.

## Voir aussi

- [Trade Bias](/help/platform/trade-bias) — la lecture signée, directionnelle
- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Signaux : expliqués](/guides/signals-explained)
