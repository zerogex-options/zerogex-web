# Les Gamma Walls expliqués : Call Wall, Put Wall et la réaction du prix
> **Note méthodologique.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. Qu’en gamma négatif le terme de pin d’EOD Pressure suive le mouvement récent est une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.


*Les gamma walls sont les niveaux les plus surveillés dans l'analyse du positionnement des dealers. Voici ce qu'est réellement un gamma wall, ce que signifient call wall et put wall, pourquoi le prix y réagit, comment ils se déplacent en cours de séance, et quand ils tiennent ou cèdent.*

---

## Qu'est-ce qu'un gamma wall ?

Un gamma wall est un strike de la chaîne d'options où l'exposition gamma des dealers se concentre fortement d'un côté du book. Les deux walls les plus surveillés sont le **call wall** - la plus forte concentration de gamma sur les calls au-dessus du spot - et le **put wall** - la plus forte concentration de gamma sur les puts en dessous du spot. Ensemble, ils dessinent la fourchette structurelle que les mécaniques de couverture des dealers tendent à défendre.

Les walls ne sont ni des moyennes mobiles ni des niveaux psychologiques. Ils émergent d'un positionnement réel : l'open interest, contrat par contrat, pondéré par le gamma que porte chaque contrat. Quand les traders demandent ce que signifient call wall et put wall, ce qu'ils demandent en réalité, c'est : *où se concentrent les flux de couverture des dealers, et comment ces flux affectent-ils le prix ?*

Cette page est le volet pratique. Elle part du principe que vous savez ce qu'est un wall et passe en revue les éléments qui déterminent si le niveau est utile un jour donné : ce que fait chaque wall dans chaque régime, ce que vous dit la distance qui les sépare, comment ils se comportent à l'approche de l'échéance du jour, comment ils migrent, et à quelle fréquence les walls tiennent ou cèdent réellement. Pour le contexte de régime qui sous-tend tout cela, associez cette lecture à [Comment lire un gamma flip](/education/how-to-read-a-gamma-flip) et à l'article de fond plus large sur le [Gamma Exposure](/education/gamma-exposure-explained).

---

## Qu'est-ce qu'un call wall ?

Le call wall est le strike au-dessus du spot qui porte la plus forte exposition gamma sur les calls. Dans un régime de gamma positif, les dealers détenant un inventaire long-call doivent vendre lors des rallyes qui s'approchent du wall - se délestant du delta positif qu'ils accumulent à mesure que le prix monte vers celui-ci. Ce réflexe de couverture s'oppose au rallye.

En pratique, le call wall agit souvent comme une **résistance** dans les régimes de gamma longue - non pas parce que le niveau serait magique, mais parce que le flux de couverture qui s'active autour de lui est structurel.

À savoir :

- Le wall est la concentration *actuellement* la plus lourde. À mesure que l'OI évolue, le wall se déplace.
- Dans les régimes de gamma longue (spot au-dessus du gamma flip), la couverture autour du wall s'oppose à un rallye. Dans les régimes de gamma courte, elle l'accompagne, de sorte que, si le niveau cède, il peut passer du rôle de résistance à celui d'accélérateur de breakout. Le régime change ce comportement, pas la fréquence à laquelle le wall cède.
- Un call wall est une inclinaison **probabiliste**, pas un plafond rigide. Un flux réel peut le percer.

---

## Qu'est-ce qu'un put wall ?

Le put wall est le strike en dessous du spot avec la plus forte exposition gamma sur les puts. Dans un régime de gamma positif, le book net des dealers est long gamma, il achète donc à mesure que le prix chute vers le wall - le miroir du réflexe du call wall, l'achat se concentrant là où la gamma des puts est la plus dense. Ce réflexe s'oppose au selloff.

En pratique, le put wall agit souvent comme un **support** dans les régimes de gamma longue. Comme pour le call wall, le mécanisme est structurel, pas psychologique.

À savoir :

- Le wall est dynamique. Un OI important qui s'éteint à l'approche de l'échéance peut effacer un put wall d'ici la mi-journée.
- Dans un régime de gamma courte, le comportement des dealers s'inverse - la couverture cesse d'absorber la faiblesse, et si le put wall cède, il peut devenir un point de glissement (slippage) à la baisse.
- Un put wall est une inclinaison. Chocs macro, expansion de la volatilité et réajustements de la chaîne peuvent tous prendre le pas sur la lecture structurelle.

---

## Pourquoi le prix réagit aux gamma walls

Le mécanisme est la couverture des dealers, pas la psychologie. La façon la plus claire de le voir :

Dans un régime de **gamma positif**, les dealers se couvrent *contre* le mouvement du prix. Ils vendent quand le prix monte et achètent quand il baisse. Près d'un wall, ce réflexe s'intensifie car la concentration de gamma y est localement importante - un petit mouvement vers le wall force un trade de couverture relativement plus important en sens inverse.

Dans un régime de **gamma négatif**, le réflexe s'inverse. Les dealers se couvrent *dans le même sens* que le mouvement du prix. Le même wall qui ancrait le prix en gamma longue peut devenir un vecteur de breakout - une fois que le prix le franchit, le trade de couverture renforce le mouvement au lieu de l'atténuer.

Un gamma wall n'est pas une propriété fixe de la chaîne. C'est un *niveau* fixe dont l'effet de couverture dépend du **régime qui l'entoure** - ce qui est précisément ce qu'indique le gamma flip. Ce que le régime ne décide pas, c'est si le wall tient : sur les 737 tests de walls que nous avons mesurés, les walls du S&P ont tenu environ deux fois sur trois dans l'heure et ceux du Nasdaq environ une fois sur deux, d'un côté comme de l'autre du flip ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)).

---

## Comment les gamma walls se déplacent en intraday

Les walls ne sont pas annoncés à l'ouverture pour tenir jusqu'à la clôture. Ils migrent. Trois schémas courants :

**Largeur.** Une fourchette de walls étroite signifie que la gamma est concentrée près du spot des deux côtés. En régime de gamma positive, c'est la configuration classique de pinning - la couverture s'oppose aux mouvements dans les deux sens. Une fourchette large signifie que les strikes denses les plus proches sont éloignés, donc il y a moins de couverture concentrée entre les deux et le prix peut parcourir plus de chemin avant d'en rencontrer.

**Asymétrie.** Le spot se situe rarement au milieu. Quand un wall est bien plus proche que l'autre, le wall proche est le niveau qui est réellement testé et le lointain n'est surtout qu'un contexte. Un spot à 0,3 % sous le call wall et à 1,4 % au-dessus du put wall, ce n'est pas la même journée qu'un spot à mi-chemin entre les deux : le premier comporte un point de décision à court terme, le second non.

Le piège est de lire la largeur ou l'asymétrie sans le régime. Les deux lectures ci-dessus supposent une gamma positive. Sous le flip, cette même fourchette étroite n'est pas un pin - c'est une courte distance entre deux niveaux, et la couverture renforcera un mouvement qui franchit l'un ou l'autre.

---

## Comment les gamma walls se déplacent en séance

Les walls ne sont pas annoncés à l'ouverture pour tenir jusqu'à la clôture. Ils migrent. Trois schémas courants :

1. **Revalorisation de la gamma.** Le spot, le temps restant jusqu'à l'échéance et la volatilité implicite modifient la gamma modélisée de chaque strike et peuvent changer le classement même lorsque l'OI officiel reste inchangé.
2. **Éligibilité selon le côté du spot.** Un strike peut passer d'un côté du spot à l'autre, tandis qu'un autre strike à OI inchangé devient la plus grande concentration éligible. L'OI officiel est généralement mis à jour après compensation ; la migration intraday d'un wall n'établit pas que des clients ont ouvert des positions sur le nouveau strike.
3. **Concentration à l'approche de l'échéance.** La gamma ATM peut fortement augmenter tandis que celle des strikes nettement ITM ou OTM tend vers zéro, ce qui modifie le classement. Cette revalorisation est distincte de la clôture de positions et de la mise à jour de l'OI officiel après compensation.

Un wall peut aussi se déplacer uniquement parce que le spot, le temps et la volatilité implicite bougent - le strike portant le plus d'exposition modélisée change même quand le positionnement, lui, ne change pas. Un gamma wall est le strike le plus chargé en gamma modélisée *à cet instant*. Traitez-le comme une lecture vivante, pas comme une ligne fixe.

---

## Les gamma walls à l'approche de l'échéance du jour

Le 0DTE est le terrain où le comportement des walls est le plus extrême, dans les deux sens.

La gamma sur une chaîne du jour même est très importante près du spot et décroît rapidement en s'en éloignant, si bien que les walls se collent au prix et que la concentration qui s'y trouve est bien plus lourde que sur une chaîne à échéance plus longue. Quand le régime le permet, cela produit le pinning le plus fort que vous ayez des chances d'observer - un prix qui broie dans une bande étroite entre deux walls distants de quelques points seulement.

Cette même concentration rend ces walls instables. Comme la gamma 0DTE se revalorise brutalement à mesure que le spot bouge et que l'horloge tourne, un wall 0DTE peut migrer plusieurs fois en une heure sans qu'une seule position nouvelle soit ouverte. Les walls peuvent aussi disparaître : dès que des strikes se retrouvent nettement dans ou hors de la monnaie, leur gamma modélisée tend vers zéro et le classement se réorganise autour de ce qui reste près du spot.

Un gamma wall est le strike gamma le *plus lourd actuellement*. Traitez-le comme une lecture en direct, pas comme une ligne fixe.

---

## Quand les walls tiennent et quand ils cèdent

Les walls ne sont pas des prédictions, et nous avons mesuré à quelle fréquence ils cèdent. Sur 737 tests de walls observés sur SPY, SPX, QQQ et NDX pendant dix semaines en 2026, les walls du S&P ont tenu environ deux fois sur trois dans l'heure suivant le test et ceux du Nasdaq environ une fois sur deux ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)). Ce taux de base propre à l'indice est la meilleure estimation a priori dont on dispose, et aucune des conditions auxquelles les traders ont habituellement recours n'a fait mieux :

**Conditions testées qui n'ont pas permis de prédire une cassure :**

- Le côté du flip où se trouvait le spot - gamma positive ou négative.
- La taille du wall, sa part du book et son rang par rapport à son propre historique. Les walls plus gros ont cédé un peu moins souvent, mais l'écart était trop faible pour se distinguer du bruit.
- Le Net GEX, sa trajectoire et la distance au flip.
- La migration éventuelle du wall avec le prix, et le renforcement ou la consommation de sa gamma.
- Le flux signé au strike du wall, son éventuelle accélération, et la volatilité réalisée.
- L'ancienneté du wall, le nombre de fois où il avait été testé, et l'heure de la journée.

**Ce que le régime change, en revanche :**

- En gamma positive (au-dessus du flip), la couverture modélisée s'oppose à un mouvement vers le wall, ce qui peut le ralentir ou ancrer le prix près du strike.
- En gamma négative (sous le flip), la couverture modélisée accompagne le mouvement, de sorte que, si le wall cède, la couverture renforce la cassure au lieu de l'atténuer.

La plupart de ces éléments peuvent se lire en temps réel, et aucun ne vous dit si ce wall précis va tenir. Un catalyseur macro (CPI, FOMC, NFP, une actualité géopolitique) qui survient pendant un test peut submerger la couverture, quel que soit le régime. Prenez le taux de base de l'indice comme estimation a priori, et le régime comme une description de ce que fait la couverture autour du niveau, pas comme une probabilité.

---

## Comment ZeroGEX affiche le call wall et le put wall

Le tableau de bord présente les walls à deux endroits :

- **Les cartes de métriques de wall** affichent les strikes actuels du call wall et du put wall, avec la distance en pourcentage par rapport au spot en direct.
- **Le graphique GEX walls** trace le profil gamma strike par strike avec les deux walls mis en évidence.

![Cartes Call Wall et Put Wall du tableau de bord ZeroGEX avec distance en pourcentage par rapport au spot](/blog/zerogex-walls-cards.png)

Un exemple concret. Supposons que le SPX soit à 5 830. Le tableau de bord affiche :

- **Call Wall :** 5 850 (+0,34 % par rapport au spot)
- **Put Wall :** 5 790 (−0,69 % par rapport au spot)
- **Net GEX :** +1,5 Md $
- **Gamma Flip :** 5 810

Le Net GEX est ici une estimation modélisée de la gamma des dealers, calculée selon la convention traditionnelle d'open interest call-positif / put-négatif ; l'inventaire réel des dealers n'est pas directement observable à partir des données publiques de la chaîne d'options. La lecture structurelle : le spot est confortablement au-dessus du flip (régime de gamma longue), la fourchette des walls est asymétrique - bien plus proche du call wall que du put wall - et le Net GEX est sain. Ce que cela vous dit : le call wall est le test le plus proche, et un rallye vers ce niveau se heurte à une couverture qui, d'après le modèle, s'oppose au mouvement. Ce que cela ne vous dit pas, c'est si 5 850 va tenir. Selon nos mesures, les walls du SPX ont tenu environ deux fois sur trois dans l'heure, quel que soit le côté du flip où se trouvait le prix. Une chute sous 5 810 changerait le mécanisme, pas ces probabilités : la couverture se mettrait à renforcer les mouvements au lieu de les amortir.

![Graphique GEX walls de ZeroGEX mettant en évidence le call wall et le put wall sur le profil gamma strike par strike](/blog/zerogex-walls-chart.png)

Imaginez maintenant que le call wall migre à la hausse jusqu'à 5 855 pendant que le prix sonde 5 848. Cette migration est une donnée - le strike que vous surveilliez n'est plus le plus lourd, donc le niveau contre lequel vous tradez s'est déplacé. Elle ne constitue pas, à elle seule, le signe que la cassure va durer : selon nos mesures, le fait qu'un wall migre ou non avec le prix ne permettait pas de prédire s'il allait céder.

---

## Idées reçues courantes

Quelques pièges :

- **« Les walls sont des supports/résistances durs. »** Ce sont des inclinaisons structurelles. Un flux réel les brise régulièrement : selon nos mesures, environ un test sur trois dans l'heure pour les walls du S&P, et environ un sur deux pour ceux du Nasdaq.
- **« Le strike avec le plus gros open interest est toujours le wall. »** Les walls sont pondérés par l'exposition gamma, pas par l'OI brut. Un strike proche de l'ATM peut dominer un strike très OTM avec deux fois plus d'open interest.
- **« Les walls sont statiques pendant la séance. »** Ils migrent. Un wall qui n'a pas bougé en deux heures est une lecture ; un wall qui a dérivé avec le prix à trois reprises en est une tout autre.
- **« Les walls fonctionnent de la même façon quel que soit le régime. »** La couverture, non : elle s'oppose à un mouvement vers le wall en gamma positive, et renforce un mouvement qui le franchit en gamma négative. Selon nos mesures, la fréquence à laquelle les walls ont cédé n'a pas varié avec le régime ; ce qui change, c'est ce que fait la couverture autour de la cassure.
- **« Le call wall est haussier, le put wall est baissier. »** Aucun des deux n'est directionnel, et le type d'option ne détermine pas à lui seul le comportement. Ce sont des niveaux de concentration de gamma dont l'effet dépend du signe de la gamma dealer modélisée et du flux environnant - autrement dit, du côté du flip où l'on se trouve.

---

## À retenir

> Les gamma walls représentent un positionnement réel, pas de la psychologie. Ils dessinent la fourchette structurelle, et le gamma flip vous dit si la couverture autour de ces walls s'oppose aux mouvements ou les renforce. Qu'un wall donné tienne ou non relève d'un taux de base, pas d'une lecture : environ deux tests sur trois dans l'heure pour les walls du S&P, environ un sur deux pour ceux du Nasdaq.

Lisez d'abord le régime. Lisez ensuite le wall. Lisez en troisième lieu la migration du wall. Cette séquence vous dit ce que fait la couverture des dealers autour du niveau - c'est la différence entre fader un rallye que le book du dealer fade avec vous, et fader un rallye que ce même book de dealer s'apprête à poursuivre. Elle ne vous dit pas si ce wall en particulier va tenir ; pour cela, le taux de base de l'indice est le meilleur repère que nous ayons mesuré.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez suivre le call wall et le put wall du jour, [les pages gratuites gamma-levels de ZeroGEX](/spx-gamma-levels) affichent les deux aux côtés du gamma flip et du profil gamma du dealer qui les a produits, avec un décalage d'environ 15 minutes ; les formules payantes les affichent [en temps réel](/real-time-gex-0dte). Pour une vue d'ensemble plus large des outils de gamma exposure, consultez [le guide des meilleurs outils GEX](/education/best-gex-tools).
