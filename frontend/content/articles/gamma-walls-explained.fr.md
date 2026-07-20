# Les Gamma Walls expliqués : Call Wall, Put Wall et la réaction du prix

*Les gamma walls sont les niveaux les plus surveillés dans l'analyse du positionnement des dealers. Voici ce qu'est réellement un gamma wall, ce que signifient call wall et put wall, pourquoi le prix y réagit, comment ils se déplacent en cours de séance, et quand ils tiennent ou cèdent.*

---

## Qu'est-ce qu'un gamma wall ?

Un gamma wall est un strike de la chaîne d'options où l'exposition gamma des dealers se concentre fortement d'un côté du book. Les deux walls les plus surveillés sont le **call wall** — la plus forte concentration de gamma sur les calls au-dessus du spot — et le **put wall** — la plus forte concentration de gamma sur les puts en dessous du spot. Ensemble, ils dessinent la fourchette structurelle que les mécaniques de couverture des dealers tendent à défendre.

Les walls ne sont ni des moyennes mobiles ni des niveaux psychologiques. Ils émergent d'un positionnement réel : l'open interest, contrat par contrat, pondéré par le gamma que porte chaque contrat. Quand les traders demandent ce que signifient call wall et put wall, ce qu'ils demandent en réalité, c'est : *où se concentrent les flux de couverture des dealers, et comment ces flux affectent-ils le prix ?*

Cet article passe en revue ce qu'est chaque wall, pourquoi le prix a tendance à y réagir, comment ils se déplacent en intraday, et quand la thèse du wall tient ou se casse. Pour le contexte de régime qui détermine si un gamma wall *amortit* ou *amplifie* le mouvement, associez cette lecture à [Comment lire un gamma flip](/education/how-to-read-a-gamma-flip) et à l'article de fond plus large sur le [Gamma Exposure](/education/gamma-exposure-explained).

---

## Qu'est-ce qu'un call wall ?

Le call wall est le strike au-dessus du spot qui porte la plus forte exposition gamma sur les calls. Dans un régime de gamma positif, les dealers détenant un inventaire short-call doivent vendre lors des rallyes qui s'approchent du wall — se délestant du delta accumulé pendant que le prix montait vers celui-ci. Ce réflexe de couverture s'oppose au rallye.

En pratique, le call wall agit souvent comme une **résistance** dans les régimes de gamma longue — non pas parce que le niveau serait magique, mais parce que le flux de couverture qui s'active autour de lui est structurel.

À savoir :

- Le wall est la concentration *actuellement* la plus lourde. À mesure que l'OI évolue, le wall se déplace.
- Le wall agit de manière plus fiable dans les régimes de gamma longue (spot au-dessus du gamma flip). Dans les régimes de gamma courte, le même niveau peut s'inverser, passant de résistance à cible de breakout.
- Un call wall est une inclinaison **probabiliste**, pas un plafond rigide. Un flux réel peut le percer.

---

## Qu'est-ce qu'un put wall ?

Le put wall est le strike en dessous du spot avec la plus forte exposition gamma sur les puts. Dans un régime de gamma positif, les dealers détenant un inventaire short-put doivent acheter à mesure que le prix chute vers ce niveau — rachetant le delta qu'ils avaient délesté pendant la baisse. Ce réflexe s'oppose au selloff.

En pratique, le put wall agit souvent comme un **support** dans les régimes de gamma longue. Comme pour le call wall, le mécanisme est structurel, pas psychologique.

À savoir :

- Le wall est dynamique. Un OI important qui s'éteint à l'approche de l'échéance peut effacer un put wall d'ici la mi-journée.
- Dans un régime de gamma courte, le comportement des dealers s'inverse — le put wall cesse d'absorber la faiblesse et peut devenir un point de glissement (slippage) à la baisse.
- Un put wall est une inclinaison. Chocs macro, expansion de la volatilité et réajustements de la chaîne peuvent tous prendre le pas sur la lecture structurelle.

---

## Pourquoi le prix réagit aux gamma walls

Le mécanisme est la couverture des dealers, pas la psychologie. La façon la plus claire de le voir :

Dans un régime de **gamma positif**, les dealers se couvrent *contre* le mouvement du prix. Ils vendent quand le prix monte et achètent quand il baisse. Près d'un wall, ce réflexe s'intensifie car la concentration de gamma y est localement importante — un petit mouvement vers le wall force un trade de couverture relativement plus important en sens inverse.

Dans un régime de **gamma négatif**, le réflexe s'inverse. Les dealers se couvrent *dans le même sens* que le mouvement du prix. Le même wall qui ancrait le prix en gamma longue peut devenir un vecteur de breakout — une fois que le prix le franchit, le trade de couverture renforce le mouvement au lieu de l'atténuer.

C'est pourquoi les walls semblent « fonctionner » certains jours et pas d'autres. Un gamma wall n'est pas une propriété fixe de la chaîne. C'est un *niveau* fixe dont l'effet comportemental dépend du **régime qui l'entoure** — ce qui est précisément ce qu'indique le gamma flip.

---

## Comment les gamma walls se déplacent en intraday

Les walls ne sont pas annoncés à l'ouverture pour tenir jusqu'à la clôture. Ils migrent. Trois schémas courants :

1. **Rééquilibrage de l'OI.** Un volume frais sur un strike différent peut déplacer la concentration la plus lourde. En milieu de séance, un nouveau strike peut devenir le wall.
2. **Migration du wall avec le prix.** À mesure que le prix se rapproche du call wall, une nouvelle couverture peut construire de l'OI juste au-dessus, poussant de fait le wall plus haut. Un wall qui *suit* le prix est structurellement différent d'un wall qui *tient* — la thèse du trap-fade est bien plus faible quand le wall se déplace avec le mouvement.
3. **Décroissance à l'échéance.** Près des échéances du jour même — en particulier dans les chaînes riches en 0DTE — les walls peuvent disparaître en début d'après-midi à mesure que les contrats qui les avaient formés s'éteignent. Le wall en lequel vous aviez confiance à 10h30 ET peut ne plus être le wall à 14h30 ET.

Un gamma wall est le strike gamma le *plus lourd actuellement*. Traitez-le comme une lecture en direct, pas comme une ligne fixe.

---

## Quand les walls tiennent et quand ils cèdent

Les walls ne sont pas des prédictions. Ce sont des inclinaisons qui fonctionnent plus souvent lorsque les conditions structurelles les soutiennent. Une courte liste des cas où chaque côté de la lecture a plus de chances de se vérifier :

**Conditions qui rendent un wall plus susceptible de tenir :**

- Le spot est dans un régime de gamma positif (au-dessus du flip).
- Le wall se situe sur un strike avec une magnitude de gamma relative très élevée.
- Le Net GEX est significativement positif et stable.
- Le wall ne migre *pas* avec le prix.
- La volatilité réalisée se comprime en direction du niveau.

**Conditions qui rendent un wall plus susceptible de céder :**

- Le spot est dans un régime de gamma négatif (en dessous du flip).
- Le Net GEX est de faible magnitude ou se contracte rapidement.
- Le wall migre avec le prix (poursuivant le mouvement).
- Un catalyseur macro (CPI, FOMC, NFP, actualité géopolitique) survient pendant que le wall est testé.
- Le flux directionnel *s'accélère* vers le niveau au lieu de ralentir.

La plupart de ces éléments peuvent se lire en temps réel. Aucun d'entre eux n'est une prédiction. Ce sont des vérifications — quand la plupart s'alignent d'un même côté, la lecture est plus nette ; quand elles se contredisent, la lecture est faible et le bon choix est généralement de ne pas trader.

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

La lecture structurelle : le spot est confortablement au-dessus du flip (régime de gamma longue), la fourchette des walls est asymétrique — bien plus proche du call wall que du put wall — et le Net GEX est sain. Inclinaison pratique : une dérive vers le call wall est la trajectoire la plus probable, les fades de rallyes vers ce niveau constituent le setup le plus propre, et une conviction baissière nécessiterait soit un franchissement du flip sous 5 810, soit un catalyseur clair pour l'emporter sur la traction structurelle du gamma positif au-dessus.

![Graphique GEX walls de ZeroGEX mettant en évidence le call wall et le put wall sur le profil gamma strike par strike](/blog/zerogex-walls-chart.png)

Imaginez maintenant que le call wall migre à 5 855 pendant que le prix sonde 5 848. Cette migration est une donnée en soi — le wall poursuit le prix, le trap-fade est bien plus faible, et le breakout au-dessus de 5 850 est plus crédible qu'il ne le paraissait cinq minutes plus tôt. Lire le wall en mouvement, c'est l'essentiel de l'edge.

---

## Idées reçues courantes

Quelques pièges :

- **« Les walls sont des supports/résistances durs. »** Ce sont des inclinaisons structurelles. Un flux réel les brise régulièrement.
- **« Le strike avec le plus gros open interest est toujours le wall. »** Les walls sont pondérés par l'exposition gamma, pas par l'OI brut. Un strike proche de l'ATM peut dominer un strike très OTM avec deux fois plus d'open interest.
- **« Les walls sont statiques pendant la séance. »** Ils migrent. Un wall qui n'a pas bougé en deux heures est une lecture ; un wall qui a dérivé avec le prix à trois reprises en est une tout autre.
- **« Les walls fonctionnent de la même façon quel que soit le régime. »** Ce n'est pas le cas. Les walls en gamma positif absorbent. Les walls en gamma négatif libèrent.
- **« Le call wall est haussier, le put wall est baissier. »** Aucun des deux n'est directionnel. Ce sont des niveaux de concentration dont le comportement dépend du côté du flip où l'on se trouve.

---

## À retenir

> Les gamma walls représentent un positionnement réel, pas de la psychologie. Ils dessinent la fourchette structurelle — mais seuls le gamma flip et le régime qui l'entoure vous disent si ces walls absorberont les mouvements ou les libéreront.

Lisez d'abord le régime. Lisez ensuite le wall. Lisez en troisième lieu la migration du wall. Cette séquence constitue l'essentiel de l'edge structurel dans les lectures de positionnement des dealers — et c'est aussi la différence entre fader un rallye que le book du dealer fade avec vous, et fader un rallye que ce même book de dealer s'apprête à poursuivre.

Contenu éducatif uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez suivre en temps réel le [call wall et le put wall du jour](/real-time-gex-0dte), [le tableau de bord gratuit de ZeroGEX](/spx-gamma-levels) trace les deux aux côtés du gamma flip et du profil gamma du dealer qui les a produits. Pour une vue d'ensemble plus large des outils de gamma exposure, consultez [le guide des meilleurs outils GEX](/education/best-gex-tools).
