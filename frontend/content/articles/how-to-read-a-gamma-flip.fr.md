# Qu'est-ce qu'un gamma flip ? Le niveau de gamma flip expliqué

*Le gamma flip expliqué sans flou artistique - ce qu'est réellement ce niveau, comment on le détermine, ce qui change au-dessus et en dessous, et comment le lire en intraday.*

---

## Pourquoi le gamma flip est important

La plupart des traders lisent l'action des prix par rapport aux supports et résistances. Le gamma flip est autre chose : c'est une **frontière de régime**, pas un objectif. Lorsque le spot est au-dessus du flip, la mécanique de couverture des dealers tend à *amortir* la volatilité. Lorsqu'il est en dessous, cette même mécanique tend à l'*amplifier*. Les setups qui fonctionnent dans un régime sont généralement les mauvais setups dans l'autre - et reconnaître dans quel régime on se trouve constitue l'essentiel de l'avantage.

Cet article propose la lecture orientée trader. Nous verrons ce qu'est réellement le niveau du flip, ce qui change lorsque le spot le franchit, et comment l'utiliser au cours d'une séance. Pour approfondir la structure de marché sous-jacente, commencez par le [pilier Gamma Exposure](/education/gamma-exposure-explained) ; pour la méthodologie de calcul, consultez le [guide de calcul du Gamma Flip](/guides/gamma-flip-calculation-before-vs-after).

---

## Qu'est-ce qu'un gamma flip ?

Le gamma flip est le niveau de prix auquel l'exposition gamma agrégée *modélisée* des dealers passe par zéro. Au-dessus du flip, selon le modèle, les dealers sont net long gamma ; en dessous, net short. Ce n'est pas un strike fixe - c'est le niveau de spot auquel le profil de gamma modélisé change de signe, et à mesure que la chaîne se repondère au fil de la journée, ce prix se déplace. Le même niveau est aussi appelé [niveau de gamma zéro](/education/zero-gamma-level-explained) : « gamma zéro » désigne la valeur, « gamma flip » désigne le changement de signe. Comme il est issu d'un modèle, il dépend de la convention de signe et des choix de modélisation qui le sous-tendent (quelles échéances, comment elles sont pondérées, les données d'entrée d'IV et d'open interest), et il peut parfois être non unique, absent ou ambigu.

Quelques points à préciser :

- Le flip est un **niveau, pas un wall.** Il n'oppose pas de résistance au prix comme pourrait le faire un strike call ou put très chargé. Il marque un point d'inflexion comportemental, pas une barrière structurelle.
- C'est un **indicateur de régime, pas un indicateur directionnel.** Un spot au-dessus du flip n'est pas haussier. Un spot en dessous n'est pas baissier. Le régime renseigne sur le *caractère de la volatilité* réalisée, pas sur la direction.
- Il est **dynamique.** À mesure que l'open interest tourne, que les échéances arrivent à expiration et que de nouveaux flux frappent le carnet, le flip dérive. Un flip obsolète est un flip trompeur.

Traitez-le comme un météorologue traite un front atmosphérique - savoir de quel côté vous vous trouvez indique quel type de temps attendre, pas où va se diriger la tempête.

Certaines plateformes appellent cette ligne le [niveau de gamma zéro](/education/zero-gamma-level-explained) ; cet article traite de ce nom et de la façon dont le passage par zéro est déterminé.

---

## Que se passe-t-il au-dessus du gamma flip ?

Au-dessus du flip, les dealers sont modélisés net long gamma. Pour rester delta-neutres, ils tendent à vendre dans la force et à acheter dans la faiblesse. Ce réflexe de couverture pousse *contre* les mouvements directionnels plutôt que dans leur sens.

Conséquences pratiques observées par les traders sur le tape :

- **La volatilité réalisée tend à se comprimer.** La couverture s'oppose aux poussées dans un sens comme dans l'autre, y compris aux poussées vers les walls.
- **Le pin behavior devient plus probable.** Le prix tend à graviter vers les strikes à forte concentration de gamma, particulièrement à l'approche de la clôture.
- **Les setups de mean-reversion ont la couverture de leur côté.** Fader les rallyes vers un [call wall](/education/gamma-walls-explained), acheter les creux près d'un put wall, et les structures short-premium s'appuient tous sur le réflexe amortisseur.
- **Le trend-following a la couverture contre lui.** Un breakout qui paraît propre sur un graphique 5 minutes se heurte à un carnet de dealers qui penche dans l'autre sens.

Rien de tout cela n'est une garantie. Des chocs macro, la mécanique d'OpEx, ou un flip-cross à la baisse peuvent renverser le régime en cours de séance. Comme tendance de base, cependant, le comportement au-dessus du flip penche vers le calme. Ce que le régime ne change pas, c'est la fréquence à laquelle les walls cèdent : sur les 737 tests de walls que nous avons mesurés, les walls du S&P ont tenu environ deux fois sur trois dans l'heure, des deux côtés du flip ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)).

---

## Que se passe-t-il en dessous du gamma flip ?

En dessous du flip, les dealers sont modélisés net short gamma. Pour rester delta-neutres, ils tendent désormais à acheter dans la force et à vendre dans la faiblesse. Ce réflexe de couverture pousse *dans le sens* des mouvements directionnels, et non contre eux.

Conséquences pratiques :

- **La volatilité réalisée tend à s'étendre.** Une cassure qui se produit bel et bien est portée par la couverture ; les selloffs peuvent s'accélérer.
- **Le pin behavior s'effondre.** Les strikes qui aimantaient le prix au-dessus du flip commencent à le relâcher.
- **La continuation de tendance a la couverture de son côté.** Le momentum peut se prolonger plutôt que s'estomper.
- **Le mean-reversion devient dangereux.** Attraper un couteau qui tombe dans un régime de gamma négatif profond peut aggraver les pertes, car le réflexe du dealer sur lequel vous compteriez (acheter dans la faiblesse) est précisément celui qui vient de s'inverser.

C'est également une tendance probabiliste, pas une prévision. Un seul titre rassurant peut calmer le tape au sein du même régime. Mais savoir qu'on est en territoire short-gamma devrait changer les trades pris et - plus important encore - ceux évités.

---

## Comment agir sur le gamma flip en intraday

Lire le gamma flip en temps réel repose sur un court ensemble d'habitudes :

1. **Vérifiez d'abord le régime.** Avant tout setup, sachez si le spot est au-dessus ou en dessous du flip. Cette seule lecture vous indique si la couverture joue avec vous ou contre vous. Pour le S&P 500, comparez le spot au [gamma flip SPX du jour](/spx-gamma-levels).
2. **Surveillez la distance au flip.** Un spot nettement éloigné du flip, avec une marge confortable, correspond à une lecture de régime stable. Un spot coincé à quelques dixièmes de pourcent correspond à un régime contesté - les deux côtés du carnet sont partiellement actifs, et le comportement est instable. Réduisez la taille ou restez à l'écart.
3. **Surveillez la migration.** Les niveaux de flip se déplacent à mesure que le positionnement se rééquilibre. Un flip qui dérive vers le haut en même temps que le prix a une signification différente de celui qui reste ancré pendant que le prix se rapproche de lui.
4. **Associez le flip aux walls.** Le flip indique le régime ; le [call wall et le put wall](/education/gamma-walls-explained) indiquent les limites structurelles à l'intérieur de ce régime. Lisez-les ensemble.
5. **Respectez la concentration 0DTE.** Lorsque les échéances du jour même dominent la chaîne, le flip devient particulièrement réactif. Voir [Le positionnement des dealers en 0DTE expliqué](/education/0dte-dealer-positioning-explained) pour les lectures spécifiques à chaque régime.

La discipline consiste à utiliser le flip comme **filtre**, pas comme signal. Il indique quel plan de jeu suivre ; l'entrée doit toujours venir d'ailleurs.

---

## Lire le gamma flip sur ZeroGEX

Le tableau de bord ZeroGEX présente le flip à deux endroits :

- La **carte de métrique Gamma Flip** affiche le niveau actuel du flip ainsi que la distance en direct, en dollars et en pourcentage, par rapport au spot.
- Le **graphique du profil de gamma des dealers** trace la courbe à travers les strikes, avec le passage à zéro - le flip - directement visible.

![Carte Gamma Flip du tableau de bord ZeroGEX montrant le spot du SPX au-dessus du flip, avec la distance en direct](/blog/zerogex-gamma-flip-card.png)

Un exemple concret. Supposons que le SPX se négocie à 5 830 et que le tableau de bord affiche :

- **Net GEX :** +1,2 Md$
- **Gamma Flip :** 5 815
- **Distance :** +15 / +0,26 %

La lecture : le spot est en territoire long-gamma modélisé, confortablement au-dessus du flip. Le chiffre principal de Net GEX - le gamma estimé des dealers selon la convention traditionnelle call-positif / put-négatif, et non un inventaire observé - est cohérent avec le régime : positif, car il s'agit de la valeur de cette même courbe de gamma modélisée évaluée au niveau du spot, et dans ce carnet, cette courbe devient positive au-dessus du flip. (Cette cohérence de signe est structurelle à la façon dont ZeroGEX calcule le profil.) Tendance pratique : volatilité amortie, couverture qui s'oppose aux breakouts, pin behavior vers les strikes à fort gamma en jeu à l'approche de la clôture.

![Graphique du profil de gamma des dealers ZeroGEX, avec la ligne du gamma flip marquée et le spot au-dessus](/blog/zerogex-strike-profile-flip.png)

Imaginez maintenant le même tableau de bord 30 minutes plus tard : SPX à 5 810, gamma flip à 5 818. Le spot est passé en dessous, et le flip a en réalité dérivé vers le haut, vers l'endroit où se trouvait le spot. Le franchissement du flip modélisé suggère que la tendance agrégée de la couverture a changé de signe - un trader qui fadait les rallyes au-dessus du flip devrait se montrer bien plus prudent avant de fader le prochain selloff, même si le comportement réalisé dépend toujours du flux, de la liquidité, de la volatilité et des catalyseurs, et pas du flip seul.

---

## Erreurs courantes dans la lecture du gamma flip

Quelques schémas qui piègent les traders :

- **Traiter le flip comme un support ou une résistance.** C'est une ligne de régime, pas un niveau contre lequel trader. Acheter la faiblesse *vers* le flip depuis le haut est un trade structurellement différent de l'acheter depuis le bas.
- **Ignorer à quel point il est dynamique.** Le flip peut se déplacer de plusieurs points en quelques heures à mesure que le positionnement évolue. Lire le flip d'hier sur le tape d'aujourd'hui, c'est lire un carnet obsolète.
- **Confondre la proximité avec une confirmation.** Un spot situé *exactement sur* le flip est l'état le moins informatif, pas le plus informatif. Les contributions de gamma modélisées positives et négatives se compensent à peu près ; la tendance nette de la couverture est faible et peut changer de signe sous l'effet de petites variations des données d'entrée.
- **Lire le flip sans vérifier l'ampleur du Net GEX.** Un flip avec 2 Md$ de gamma dealer au-dessus est un régime bien plus tranché qu'un flip avec 200 M$. L'ampleur compte autant que le signe.
- **Confondre le flip avec le max pain.** Le max pain est un strike de géométrie des paiements - celui où le paiement aux détenteurs d'options est minimisé à l'échéance - et non une force de couverture. Le flip est une ligne de régime de couverture modélisée, fondée sur le gamma des dealers. Ils divergent souvent, et répondent à des questions différentes.

---

## À retenir

> Au-dessus du flip règne généralement un régime long-gamma, qui amortit la volatilité. En dessous règne généralement un régime short-gamma, qui l'amplifie. Un spot situé sur le flip est contesté, pas neutre.

Utilisé comme filtre - et non comme signal - le gamma flip est ce qui se rapproche le plus, dans l'analyse du positionnement des dealers, d'une lecture unique et durable. Il ne dira pas dans quelle direction va le marché. Il indiquera quels trades ont le réflexe du dealer pour eux, et lesquels vont à son encontre.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Pour voir le gamma flip du jour, [les pages gratuites de niveaux gamma de ZeroGEX](/spx-gamma-levels) l'affichent aux côtés du Net GEX, des call et put walls, et du graphique du profil de gamma des dealers, avec un décalage d'environ 15 minutes ; les formules payantes l'affichent [sur le tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte). Pour une comparaison de la façon dont différentes plateformes calculent et présentent cette lecture, voir [le guide des meilleurs outils GEX](/education/best-gex-tools).
