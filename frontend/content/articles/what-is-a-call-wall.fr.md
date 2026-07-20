# Qu'est-ce qu'un Call Wall ? Comment les Dealers Défendent le Haut du Marché

*Le call wall est le strike où se concentre le gamma des dealers côté call — le niveau que les dealers ont tendance à défendre à la hausse. Voici ce qu'est un call wall, pourquoi il plafonne les rallyes, comment il migre, et pourquoi une cassure nette au-dessus signale souvent que le régime lui-même est en train de basculer.*

---

## Qu'est-ce qu'un call wall ?

Un **call wall** est le strike au-dessus du spot qui porte la plus forte concentration d'exposition gamma des dealers côté call sur la chaîne d'options. C'est le niveau de prix où les flux de couverture des dealers sont les plus susceptibles de *s'opposer à un rallye* — c'est pourquoi les traders considèrent le call wall comme le plafond structurel de l'actuelle fourchette de positionnement des dealers.

La signification du call wall, en une phrase : ce n'est ni un chiffre rond ni une ligne sur un graphique — c'est un positionnement réel, l'open interest pondéré par le gamma que porte chaque contrat. Le strike unique où ce gamma call est le plus dense au-dessus du prix actuel, c'est le call wall.

Son miroir sous le spot est le [put wall](/education/what-is-a-put-wall), le strike au gamma put le plus lourd, qui tend à servir de plancher à la baisse. Ensemble, les deux walls dessinent la fourchette que la mécanique de couverture des dealers défend. Cet article traite spécifiquement du call wall — ce qu'il est, pourquoi il agit comme une résistance, comment il se déplace, et quand une cassure au travers compte réellement. Pour la vue d'ensemble, associez-le à [Gamma Walls Explained](/education/gamma-walls-explained) et à l'[article pilier sur le Gamma Exposure](/education/gamma-exposure-explained).

---

## Pourquoi le call wall agit comme une résistance

Le mécanisme, c'est la couverture des dealers. Dans un régime de **gamma positif** — spot au-dessus du [gamma flip](/education/how-to-read-a-gamma-flip) — les dealers sont nets longs en gamma, et les desks qui détiennent les calls lourds au strike du call wall sont short sur ces calls. Pour rester delta-neutres, ils doivent **vendre** le sous-jacent à mesure que le prix monte vers le strike, car une position short call voit son delta devenir de plus en plus négatif à mesure que le marché grimpe.

Cette vente, c'est la résistance. À mesure que le prix se rapproche d'un strike call dense, le réflexe de couverture s'intensifie — un petit mouvement à la hausse impose une vente de couverture relativement plus importante en sens inverse. Les envolées sont vendues, et l'avancée cale. Pas parce que le chiffre serait magique, mais parce que la couverture est mécanique.

Quelques conséquences de ce mécanisme :

- Le call wall est une **résistance probabiliste**, pas un plafond rigide. Un flux directionnel réel le traverse régulièrement.
- Il pèse le plus fort dans un régime de gamma positif et sur les strikes à gamma relatif élevé.
- C'est un indice structurel, pas une garantie — un catalyseur puissant peut le pulvériser en quelques secondes.

---

## Call wall vs. put wall

Les deux walls sont des opposés symétriques :

|Wall|Où|Couverture du dealer en gamma positif|Comportement typique|
|---|---|---|---|
|Call wall|Gamma call le plus lourd au-dessus du spot|Vend à mesure que le prix monte vers lui|Résistance / plafond haussier|
|Put wall|Gamma put le plus lourd sous le spot|Achète à mesure que le prix baisse vers lui|Support / plancher baissier|

Aucun des deux n'est directionnel en soi. Le call wall n'est pas un "signal de vente" — c'est un niveau de concentration dont l'effet dépend du côté du gamma flip où l'on se trouve. Au-dessus du flip, le call wall plafonne. En dessous, en gamma négatif, le même strike peut s'inverser, passant de plafond à accélérateur de breakout.

---

## Comment le call wall migre — et pourquoi un wall qui poursuit le prix compte

Le call wall est une lecture en direct qui se déplace au fil de la séance pour trois raisons :

1. **Rééquilibrage de l'OI.** Un afflux de volume call sur un strike plus élevé peut déplacer la plus forte concentration vers le haut. Le wall est toujours le strike le plus dense *actuellement*, pas celui de ce matin.
2. **Migration avec le prix.** À mesure que le prix teste le call wall, dealers et traders peuvent bâtir de l'OI call frais juste au-dessus, poussant ainsi le wall plus haut. Un wall qui *suit* le prix est structurellement différent d'un wall qui *tient*.
3. **Décroissance liée à l'échéance.** Sur les chaînes fortement pondérées en 0DTE, les contrats qui ont bâti le wall peuvent expirer en milieu d'après-midi, amincissant le plafond.

La migration elle-même est le signal. Si le call wall continue de dériver vers le haut à mesure que le prix approche, la thèse du "vendre l'envolée" est faible — le wall poursuit le prix, et le breakout est plus crédible qu'un wall statique ne le laisserait penser.

---

## Quand une cassure au-dessus du call wall compte

Comme les dealers défendent le call wall en gamma positif, une cassure *décisive* au-dessus de celui-ci est l'un des événements structurels les plus significatifs du tape. Cela signifie généralement l'une de deux choses :

- **Le wall était en migration**, et le prix a simplement suivi un plafond qui montait déjà — moins significatif, souvent une simple continuation de tendance.
- **Le wall était statique et le prix l'a franchi quand même** — un signe que la couverture qui plafonnait le mouvement a été débordée, et fréquemment que le régime de gamma lui-même est en train de basculer. Une fois que le spot pousse au-dessus d'un call wall qui tenait et entre dans une zone de gamma plus mince, le réflexe des dealers peut s'inverser, passant de la vente des rallyes à leur poursuite — c'est ainsi qu'un tape figé devient un tape rapide.

La lecture, dans l'ordre : le wall tient-il ou poursuit-il le prix, et le Net GEX soutient-il le plafond ou s'affaiblit-il ? Une cassure avec un Net GEX en contraction n'a rien à voir avec une cassure vers un gamma positif qui se renforce.

---

## Un exemple chiffré

Supposons que SPX soit à 5 830 et que le carnet affiche :

- **Call Wall :** 5 850 (+0,34 % par rapport au spot)
- **Put Wall :** 5 790 (−0,69 % par rapport au spot)
- **Gamma Flip :** 5 810
- **Net GEX :** +1,5 Md$

Le spot est au-dessus du flip, il s'agit donc d'une séance en gamma long, et 5 850 est le niveau que les dealers sont positionnés pour défendre. La tendance : les rallyes vers 5 850 constituent la zone de *fade* la plus probable, et la dérive vers ce niveau est le chemin de moindre résistance tant que le gamma positif tient. Supposons maintenant que le prix presse 5 848 et que le call wall remonte à 5 855. Cette migration est une donnée — le wall poursuit le prix, le fade s'affaiblit, et une poussée au-delà de 5 850 est plus crédible qu'il y a quelques instants. Si à l'inverse 5 850 tient bon et que le prix finit par le trancher avec un flux important, il faut le traiter comme un possible changement de régime, pas comme un simple tick de plus vers le haut.

---

## Comment trouver le call wall du jour

ZeroGEX publie le call wall actuel — avec le put wall, le gamma flip, le max pain et le Net GEX — pour les trois produits indiciels les plus échangés, gratuitement et avec environ 15 minutes de délai : consultez le call wall du jour sur [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels). Pour la version en direct qui montre le wall migrer en temps réel, ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte).

---

## À retenir

> Le call wall est un positionnement réel — le strike où la couverture des dealers est la plus susceptible de plafonner le haut du marché. Mais il ne plafonne que tant que le spot est en gamma positif, et une cassure nette d'un wall qui *tenait* est souvent le premier signe que le régime bascule. Lisez d'abord le régime, puis le wall, puis la migration du wall.

Contenu à visée uniquement éducative — rien de ce qui précède ne constitue une recommandation de trading.

---

Vous voulez le voir en temps réel ? Consultez dès aujourd'hui les **call walls SPX / SPY / QQQ** sur ZeroGEX — les pages gratuites de niveaux gamma de [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels) tracent le call wall à côté du [put wall](/education/what-is-a-put-wall), du [gamma flip](/education/how-to-read-a-gamma-flip) et du Net GEX. Pour la lecture en direct pendant que le wall migre, ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte).
