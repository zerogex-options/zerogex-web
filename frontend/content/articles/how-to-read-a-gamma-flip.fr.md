# Comment lire un gamma flip

*La lecture pratique du gamma flip — ce qu'est réellement ce niveau, ce qui change au-dessus et en dessous, et comment agir en intraday. Le gamma flip expliqué sans détours.*

---

## Pourquoi le gamma flip est important

La plupart des traders lisent l'action des prix par rapport aux supports et résistances. Le gamma flip est autre chose : c'est une **frontière de régime**, pas un objectif. Lorsque le spot est au-dessus du flip, la mécanique de couverture des dealers tend à *amortir* la volatilité. Lorsqu'il est en dessous, cette même mécanique tend à l'*amplifier*. Les setups qui fonctionnent dans un régime sont généralement les mauvais setups dans l'autre — et reconnaître dans quel régime on se trouve constitue l'essentiel de l'avantage.

Cet article propose la lecture orientée trader. Nous verrons ce qu'est réellement le niveau du flip, ce qui change lorsque le spot le franchit, et comment l'utiliser au cours d'une séance. Pour approfondir la structure de marché sous-jacente, commencez par le [pilier Gamma Exposure](/education/gamma-exposure-explained) ; pour la méthodologie de calcul, consultez le [guide de calcul du Gamma Flip](/guides/gamma-flip-calculation-before-vs-after).

---

## Qu'est-ce qu'un gamma flip ?

Le gamma flip est le niveau de prix auquel l'exposition gamma agrégée des dealers traverse zéro. Au-dessus du flip, les dealers sont généralement net long gamma ; en dessous, ils sont généralement net short. Ce n'est pas un strike fixe. C'est le prix auquel le profil de gamma des dealers change de signe — et à mesure que la chaîne se repondère au fil de la journée, ce prix se déplace.

Quelques points à préciser :

- Le flip est un **niveau, pas un mur.** Il n'oppose pas de résistance au prix comme pourrait le faire un strike call ou put très chargé. Il marque un point d'inflexion comportemental, pas une barrière structurelle.
- C'est un **indicateur de régime, pas un indicateur directionnel.** Un spot au-dessus du flip n'est pas haussier. Un spot en dessous n'est pas baissier. Le régime renseigne sur le *caractère de la volatilité* réalisée, pas sur la direction.
- Il est **dynamique.** À mesure que l'open interest tourne, que les échéances arrivent à expiration et que de nouveaux flux frappent le carnet, le flip dérive. Un flip obsolète est un flip trompeur.

Traitez-le comme un météorologue traite un front atmosphérique — savoir de quel côté vous vous trouvez indique quel type de temps attendre, pas où va se diriger la tempête.

---

## Que se passe-t-il au-dessus du gamma flip ?

Au-dessus du flip, les dealers sont généralement net long gamma. Pour rester delta-neutres, ils vendent dans la force et achètent dans la faiblesse. Ce réflexe de couverture pousse *contre* les mouvements directionnels plutôt que dans leur sens.

Conséquences pratiques observées par les traders sur le tape :

- **La volatilité réalisée tend à se comprimer.** Les breakouts calent plus souvent et sont fadés.
- **Le pin behavior devient plus probable.** Le prix tend à graviter vers les strikes à forte concentration de gamma, particulièrement en clôture.
- **Les setups de mean-reversion ont un taux de réussite plus élevé.** Fader les rallyes vers un [call wall](/education/gamma-walls-explained), acheter les creux près d'un put wall, et les structures short-premium bénéficient tous du réflexe amortisseur.
- **Le trend-following a un taux de réussite plus faible.** Les breakouts qui paraissent propres sur un graphique 5 minutes échouent souvent à se prolonger.

Rien de tout cela n'est une garantie. Des chocs macro, la mécanique d'OpEx, ou un flip-cross à la baisse peuvent renverser le régime en cours de séance. Comme tendance de base, cependant, le comportement au-dessus du flip penche vers le calme.

---

## Que se passe-t-il en dessous du gamma flip ?

En dessous du flip, les dealers sont généralement net short gamma. Pour rester delta-neutres, ils achètent désormais dans la force et vendent dans la faiblesse. Ce réflexe de couverture pousse *dans le sens* des mouvements directionnels, et non contre eux.

Conséquences pratiques :

- **La volatilité réalisée tend à s'étendre.** Les breakouts ont plus de continuation ; les selloffs s'accélèrent.
- **Le pin behavior s'effondre.** Les strikes qui aimantaient le prix au-dessus du flip commencent à le relâcher.
- **La continuation de tendance a un taux de réussite plus élevé.** Le momentum tend à se prolonger plutôt qu'à s'estomper.
- **Le mean-reversion devient dangereux.** Attraper un couteau qui tombe dans un régime de gamma négative profonde tend à aggraver les pertes, car le réflexe du dealer sur lequel on comptait (acheter dans la faiblesse) est précisément celui qui vient de s'inverser.

C'est également une tendance probabiliste, pas une prévision. Un seul titre rassurant peut calmer le tape au sein du même régime. Mais savoir qu'on est en territoire short-gamma devrait changer les trades pris et — plus important encore — ceux évités.

---

## Comment agir sur le gamma flip en intraday

Lire le gamma flip en temps réel repose sur un court ensemble d'habitudes :

1. **Vérifiez d'abord le régime.** Avant tout setup, sachez si le spot est au-dessus ou en dessous du flip. Cette seule lecture filtre une part significative des mauvais trades.
2. **Surveillez la distance au flip.** Un spot nettement éloigné du flip, avec une marge confortable, correspond à une lecture de régime stable. Un spot coincé à quelques dixièmes de pourcent correspond à un régime contesté — les deux côtés du carnet sont partiellement actifs, et le comportement est instable. Réduisez la taille ou restez à l'écart.
3. **Surveillez la migration.** Les niveaux de flip se déplacent à mesure que le positionnement se rééquilibre. Un flip qui dérive vers le haut en même temps que le prix a une signification différente de celui qui reste ancré pendant que le prix se rapproche de lui.
4. **Associez le flip aux walls.** Le flip indique le régime ; le [call wall et le put wall](/education/gamma-walls-explained) indiquent les limites structurelles à l'intérieur de ce régime. Lisez-les ensemble.
5. **Respectez la concentration 0DTE.** Lorsque les échéances du jour même dominent la chaîne, le flip devient particulièrement réactif. Voir [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained) pour les lectures spécifiques à chaque régime.

La discipline consiste à utiliser le flip comme **filtre**, pas comme signal. Il indique quel plan de jeu suivre ; l'entrée doit toujours venir d'ailleurs.

---

## Lire le gamma flip sur ZeroGEX

Le tableau de bord ZeroGEX présente le flip à deux endroits :

- La **carte de métrique Gamma Flip** affiche le niveau actuel du flip ainsi que la distance en direct, en dollars et en pourcentage, par rapport au spot.
- Le **graphique du profil de gamma des dealers** trace la courbe à travers les strikes, avec le passage à zéro — le flip — directement visible.

![ZeroGEX dashboard Gamma Flip card showing SPX spot above the flip with live distance](/blog/zerogex-gamma-flip-card.png)

Un exemple concret. Supposons que le SPX se négocie à 5 830 et que le tableau de bord affiche :

- **Net GEX :** +$1.2B
- **Gamma Flip :** 5 815
- **Distance :** +15 / +0,26 %

La lecture : le spot est en territoire long-gamma, confortablement au-dessus du flip. Le chiffre principal de Net GEX est cohérent avec le régime — positif, car il s'agit de la valeur de cette même courbe de gamma des dealers évaluée au niveau du spot, et cette courbe ne devient positive qu'une fois le flip franchi vers le haut. (Cette cohérence de signe est structurelle à la façon dont ZeroGEX calcule le profil.) Tendance pratique : volatilité amortie, breakouts plus susceptibles d'être fadés, pin behavior vers les strikes à forte gamma en jeu à l'approche de la clôture.

![ZeroGEX dealer gamma profile chart with the gamma flip line marked and spot above it](/blog/zerogex-strike-profile-flip.png)

Imaginez maintenant le même tableau de bord 30 minutes plus tard : SPX à 5 810, gamma flip à 5 818. Le spot est passé en dessous, et le flip a en réalité dérivé vers le haut, vers l'endroit où se trouvait le spot. C'est le point d'inflexion structurel où le caractère intraday change — et un trader qui fadait les rallyes au-dessus du flip devrait se montrer bien plus prudent en fadant le prochain selloff au sein du nouveau régime.

---

## Erreurs courantes dans la lecture du gamma flip

Quelques schémas qui piègent les traders :

- **Traiter le flip comme un support ou une résistance.** C'est une ligne de régime, pas un niveau contre lequel trader. Acheter la faiblesse *vers* le flip depuis le haut est un trade structurellement différent de l'acheter depuis le bas.
- **Ignorer à quel point il est dynamique.** Le flip peut se déplacer de plusieurs points en quelques heures à mesure que le positionnement évolue. Lire le flip d'hier sur le tape d'aujourd'hui, c'est lire un carnet obsolète.
- **Confondre la proximité avec une confirmation.** Un spot situé *exactement sur* le flip est l'état le moins informatif, pas le plus informatif. Les deux régimes sont partiellement actifs et la lecture est faible.
- **Lire le flip sans vérifier l'ampleur du Net GEX.** Un flip avec 2 milliards de dollars de gamma dealer au-dessus est un régime bien plus tranché qu'un flip avec 200 millions. L'ampleur compte autant que le signe.
- **Confondre le flip avec le max pain.** Le max pain est une estimation de pinning à l'échéance fondée sur le payoff des détenteurs d'options. Le flip est une ligne de régime de couverture en temps réel fondée sur le gamma des dealers. Ils divergent souvent, et répondent à des questions différentes.

---

## À retenir

> Au-dessus du flip règne généralement un régime long-gamma, qui amortit la volatilité. En dessous règne généralement un régime short-gamma, qui l'amplifie. Un spot situé sur le flip est contesté, pas neutre.

Utilisé comme filtre — et non comme signal — le gamma flip est ce qui se rapproche le plus, dans l'analyse du positionnement des dealers, d'une lecture unique et durable. Il ne dira pas dans quelle direction va le marché. Il indiquera quels trades ont le réflexe du dealer pour eux, et lesquels vont à son encontre.

Contenu à visée uniquement pédagogique — rien de ce qui précède ne constitue une recommandation d'investissement.

---

Pour voir la [lecture du gamma flip du jour en temps réel](/real-time-gex-0dte), [le tableau de bord gratuit ZeroGEX](/spx-gamma-levels) l'affiche aux côtés du Net GEX, des call et put walls, et du graphique du profil de gamma des dealers. Pour une comparaison de la façon dont différentes plateformes calculent et présentent cette lecture, voir [le guide des meilleurs outils GEX](/education/best-gex-tools).
