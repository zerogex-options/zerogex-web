# Qu'est-ce qu'un Call Wall ? Comment les Dealers Défendent le Haut du Marché
> **Note méthodologique.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. Qu’en gamma négatif le terme de pin d’EOD Pressure suive le mouvement récent est une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.


*Le call wall est le strike où se concentre le gamma des dealers côté call - le niveau que les dealers ont tendance à défendre à la hausse. Voici ce qu'est un call wall, pourquoi il plafonne les rallyes, comment il migre, et pourquoi une cassure nette au-dessus signale souvent que le régime lui-même est en train de basculer.*

---

## Qu'est-ce qu'un call wall ?

Un **call wall** est le strike au-dessus du spot qui porte la plus forte concentration d'exposition gamma des dealers côté call sur la chaîne d'options. C'est le niveau de prix où les flux de couverture des dealers sont les plus susceptibles de *s'opposer à un rallye* - c'est pourquoi les traders considèrent le call wall comme le plafond structurel de l'actuelle fourchette de positionnement des dealers.

La signification du call wall, en une phrase : ce n'est ni un chiffre rond ni une ligne sur un graphique - c'est un positionnement réel, l'open interest pondéré par le gamma que porte chaque contrat. Le strike unique où ce gamma call est le plus dense au-dessus du prix actuel, c'est le call wall.

Le [Put Wall](/education/what-is-a-put-wall) correspond à la plus grande magnitude de gamma put sous le spot, mais ce n'est pas un miroir mécanique : selon la convention, l'inventaire de puts à ce strike est modélisé comme un gamma négatif. Les deux walls sont des références structurelles dont le comportement dépend du profil complet et du flux. Cet article traite spécifiquement du call wall - ce qu'il est, pourquoi il agit comme une résistance, comment il se déplace, et quand une cassure au travers compte réellement. Pour la vue d'ensemble, associez-le à [Gamma Walls Explained](/education/gamma-walls-explained) et à l'[article pilier sur le Gamma Exposure](/education/gamma-exposure-explained).

---

## Pourquoi le call wall agit comme une résistance

Le mécanisme, c'est la couverture des dealers. Dans un régime de **gamma positif** - spot au-dessus du [gamma flip](/education/how-to-read-a-gamma-flip) - les dealers sont nets longs en gamma, et les desks qui détiennent les calls lourds au strike du call wall sont longs sur ces calls (les clients les ont vendus en overwriting). Pour rester delta-neutres, ils doivent **vendre** le sous-jacent à mesure que le prix monte vers le strike, car une position long call voit son delta devenir de plus en plus positif à mesure que le marché grimpe.

C'est cette vente qui peut créer la résistance. À mesure que le prix se rapproche d'un strike call dense, le réflexe de couverture tend à s'intensifier - un petit mouvement à la hausse peut appeler une vente de couverture relativement plus importante en sens inverse. Les envolées sont vendues, et l'avancée peut caler. Pas parce que le chiffre serait magique, mais parce que la couverture modélisée s'oppose au mouvement.

Quelques conséquences de ce mécanisme :

- Le call wall est une **résistance probabiliste**, pas un plafond rigide. Un flux directionnel réel le traverse régulièrement.
- Il pèse le plus fort dans un régime de gamma positif et sur les strikes à gamma relatif élevé.
- C'est un indice structurel, pas une garantie - un catalyseur puissant peut le pulvériser en quelques secondes.

---

## Call wall vs. put wall

Les deux walls sont des opposés symétriques :

|Wall|Où|Couverture modélisée du dealer en gamma positif|Comportement dans ce régime|
|---|---|---|---|
|Call wall|Gamma call le plus lourd au-dessus du spot|Tend à vendre à mesure que le prix monte vers lui|Peut agir comme résistance / plafond|
|Put wall|Plus grande magnitude de gamma put sous le spot|Gamma dealer modélisé localement négatif|Peut coïncider avec un support ou une accélération selon le profil complet et le flux|

Aucun des deux n'est directionnel en soi, et le type d'option ne détermine pas à lui seul le comportement. Le call wall n'est pas un "signal de vente" - c'est un niveau de concentration dont l'effet dépend du côté du gamma flip où l'on se trouve. Au-dessus du flip, la couverture autour du call wall s'oppose à un rallye. En dessous, en gamma négatif, la couverture accompagne le mouvement, si bien que le même strike peut s'inverser, passant de plafond à accélérateur de breakout s'il cède. Le côté du flip change ce comportement, pas la fréquence à laquelle le wall cède.

---

## Comment le call wall migre - et pourquoi un wall qui poursuit le prix compte

Le call wall est une lecture en direct qui se déplace au fil de la séance pour trois raisons :

1. **Rééquilibrage de l'OI.** Un afflux de volume call sur un strike plus élevé peut déplacer la plus forte concentration vers le haut. Le wall est toujours le strike le plus dense *actuellement*, pas celui de ce matin.
2. **Migration avec le prix.** À mesure que le prix teste le call wall, dealers et traders peuvent bâtir de l'OI call frais juste au-dessus, poussant ainsi le wall plus haut. Un wall qui *suit* le prix est structurellement différent d'un wall qui *tient*.
3. **Décroissance liée à l'échéance.** Sur les chaînes fortement pondérées en 0DTE, les contrats qui ont bâti le wall peuvent expirer en milieu d'après-midi, amincissant le plafond.

La migration est en elle-même une information. Si le call wall continue de dériver vers le haut à mesure que le prix approche, le wall poursuit le prix - le strike que vous surveilliez n'est plus le plus lourd, donc le niveau défendu s'est déplacé. Elle ne constitue pas, à elle seule, le signe que le breakout va durer : selon nos mesures, le fait qu'un wall migre ou non avec le prix ne permettait pas de prédire s'il allait céder.

---

## Quand une cassure au-dessus du call wall compte

Comme les dealers défendent le call wall en gamma positif, une cassure *décisive* au-dessus de celui-ci est l'un des événements structurels les plus significatifs du tape. Cela signifie généralement l'une de deux choses :

- **Le wall était en migration**, et le prix a simplement suivi un plafond qui montait déjà - moins significatif, souvent une simple continuation de tendance.
- **Le wall était statique et le prix l'a franchi quand même** - un signe que la couverture qui plafonnait le mouvement a été débordée, et fréquemment que le régime de gamma lui-même est en train de basculer. Une fois que le spot pousse au-dessus d'un call wall qui tenait et entre dans une zone de gamma plus mince, le réflexe des dealers peut s'inverser, passant de la vente des rallyes à leur poursuite - c'est ainsi qu'un tape figé devient un tape rapide.

La lecture, dans l'ordre : le wall tient-il ou poursuit-il le prix, et le Net GEX soutient-il le plafond ou s'affaiblit-il ? Une cassure avec un Net GEX en contraction n'a rien à voir avec une cassure vers un gamma positif qui se renforce.

---

## Un exemple chiffré

Supposons que SPX soit à 5 830 et que le carnet affiche :

- **Call Wall :** 5 850 (+0,34 % par rapport au spot)
- **Put Wall :** 5 790 (−0,69 % par rapport au spot)
- **Gamma Flip :** 5 810
- **Net GEX :** +1,5 Md$

Le Net GEX est une estimation modélisée du gamma des dealers, calculée selon la convention traditionnelle d'open interest call-positif / put-négatif, et non un inventaire observé des dealers. Le spot est au-dessus du flip, il s'agit donc d'une séance en gamma long, et 5 850 est le niveau que les dealers sont censés défendre selon le modèle. Un rallye vers ce niveau se heurte à une couverture qui s'oppose au mouvement, mais cela ne rend pas 5 850 plus susceptible de tenir que ne l'indique le taux de base : selon nos mesures, les walls du SPX ont tenu environ deux fois sur trois dans l'heure, d'un côté comme de l'autre du flip. Supposons maintenant que le prix presse 5 848 et que le call wall remonte à 5 855. Cette migration est une donnée - le niveau défendu est monté - mais selon nos mesures, la migration ne permettait pas de prédire si un wall allait céder. Si à l'inverse 5 850 tient bon et que le prix finit par le trancher avec un flux important, il faut le traiter comme un possible changement de régime, pas comme un simple tick de plus vers le haut.

---

## Comment trouver le call wall du jour

ZeroGEX publie le call wall actuel - avec le put wall, le gamma flip, le max pain et le Net GEX - pour les quatre produits indiciels les plus échangés, gratuitement et avec environ 15 minutes de délai : consultez le call wall du jour sur [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) et [NDX](/ndx-gamma-levels). Pour la version en direct qui montre le wall migrer en temps réel, ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte).

---

## À retenir

> Le call wall est un positionnement réel - le strike où la couverture des dealers est la plus concentrée côté hausse. La fréquence à laquelle il plafonne un rallye est un taux de base propre à l'indice et ne dépend pas du régime ; le régime détermine si la couverture s'oppose à une cassure ou l'alimente. Une cassure nette d'un wall qui *tenait* est souvent le premier signe que le régime bascule. Lisez d'abord le régime, puis le wall, puis la migration du wall.

Contenu à visée uniquement éducative - rien de ce qui précède ne constitue une recommandation de trading.

---

Vous voulez le voir en temps réel ? Consultez dès aujourd'hui les **call walls SPX / SPY / QQQ / NDX** sur ZeroGEX - les pages gratuites de niveaux gamma de [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) et [NDX](/ndx-gamma-levels) tracent le call wall à côté du [put wall](/education/what-is-a-put-wall), du [gamma flip](/education/how-to-read-a-gamma-flip) et du Net GEX. Pour la lecture en direct pendant que le wall migre, ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte).
