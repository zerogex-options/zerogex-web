# Gamma / VWAP Confluence expliqué - et pourquoi deux symboles peuvent diverger

*Ce que mesure le score de confluence, comment le cluster est construit, pourquoi le régime de gamma fait basculer une même image d'un fade à un breakout, et pourquoi SPX, SPY et QQQ peuvent pointer dans des sens opposés le même après-midi.*

---

## La question à laquelle il répond

Chaque niveau de positionnement des dealers répond à une question légèrement différente. Le [gamma flip](/education/how-to-read-a-gamma-flip) marque la frontière de régime. Les [walls](/education/gamma-walls-explained) marquent un gamma unilatéral concentré. [Le max pain](/education/max-pain-explained) marque un aimant de règlement. [Le Pin Strike](/education/pin-strike-explained) marque un attracteur du jour même atteignable. Le VWAP marque l'endroit où le volume de la séance s'est réellement traité.

La plupart des jours, ils sont dispersés, et vous les lisez un par un. Parfois, plusieurs tombent dans la même petite bande de prix - et c'est une autre situation, car l'accord de niveaux calculés indépendamment est plus informatif que n'importe lequel d'entre eux pris isolément.

Gamma / VWAP Confluence mesure exactement cela : **des niveaux clés s'empilent-ils ici, et que signifie la position du prix par rapport à eux ?**

C'est un score de −100 à +100. Le signe indique la direction, l'ampleur la confiance, et le régime décide de la façon de lire l'un et l'autre.

---

## Comment le cluster est construit

Le cluster part toujours de deux membres : **le gamma flip et le VWAP**. Ces deux-là forment le noyau, et c'est sur eux que la « confluence » est ancrée.

Trois autres niveaux peuvent les rejoindre s'ils sont assez proches - **le max pain, le max gamma (le GEX King) et le call wall**. Chacun est admis s'il se situe à moins de **0,15 % du point médian entre le flip et le VWAP**. C'est un test serré : sur le SPX à 7 700, cela représente environ 11 points.

Ainsi, une carte qui affiche `Members: 2` signifie que seuls le flip et le VWAP sont en jeu. `Members: 4` signifie que deux des niveaux optionnels les ont rejoints, et que la zone est réellement encombrée.

Le **niveau de confluence** est simplement la moyenne des membres retenus, quels qu'ils soient. C'est le prix par rapport auquel tout le signal est mesuré.

Chaque membre supplémentaire au-delà des deux du noyau ajoute 15 % à l'ampleur du score. Quatre membres équivalent à un multiplicateur de 1,30× sur la même géométrie - la façon dont le modèle signifie qu'un empilement de quatre niveaux mérite plus d'attention qu'un empilement de deux.

---

## Qualité : le cluster est-il serré ?

L'appartenance est une chose ; le resserrement en est une autre. L'**écart du cluster** est la distance entre le flip et le VWAP, en pourcentage du prix, et c'est lui qui détermine la **qualité du cluster** :

```
cluster_quality = 1 − (cluster_gap % ÷ 1.0%)     floored at 0.05, capped at 1.00
```

Un flip et un VWAP distants de 0,1 % donnent une qualité proche de 0,90. Un écart de 0,6 % donne environ 0,40. Au-delà de 1,0 %, la qualité tombe au plancher de 0,05.

Ce plancher compte, et il est délibéré. Plutôt que de déclarer « pas de confluence » et de renvoyer zéro, le modèle conserve une lecture fractionnaire, car un zéro strict devrait être un extrême rare plutôt qu'un résultat quotidien. La conséquence pratique : **quand la qualité est au plancher ou s'en approche, le score est minuscule même si le prix est loin du cluster.** Un score de −5 n'est pas un signal baissier faible, c'est le modèle qui vous dit que les deux niveaux d'ancrage sont très loin l'un de l'autre et qu'il n'y a pas de vrai cluster à lire.

La carte le dit directement. En dessous d'un score de ±20, elle affiche **« No confluence edge »** plutôt que de nommer une direction.

---

## Le régime décide de ce que signifie le cluster

C'est la partie qui surprend, et c'est l'idée la plus importante de cette page.

Le score part de la position du prix par rapport au cluster :

```
distance = (price − confluence level) ÷ price
```

Cette distance est mise à l'échelle de sorte qu'environ **±0,3 % sature la lecture** - au-delà, s'éloigner davantage n'ajoute rien, car le modèle ne cherche pas à mesurer jusqu'où le prix est allé, seulement de quel côté il se trouve et s'il s'est engagé.

Ensuite, le [régime de gamma](/education/what-is-negative-gamma) décide de ce que cela signifie :

- **Gamma négatif → continuation.** La couverture des dealers amplifie les mouvements. On s'attend à ce que le prix qui a quitté le cluster poursuive son mouvement. Au-dessus du cluster, la lecture est haussière ; en dessous, baissière.
- **Gamma positif → mean reversion, et le signe s'inverse.** La couverture des dealers amortit les mouvements. La même image suggère désormais que le prix est *ramené* vers le cluster. Au-dessus du cluster, la lecture est **baissière**, car le mouvement attendu est une baisse vers lui. La lecture est aussi atténuée à 70 % de son ampleur, car un fade est une affirmation plus faible qu'un breakout.

Ainsi, la même disposition de niveaux - même cluster, même côté, même distance - produit des **scores opposés** dans les deux régimes. Ce n'est pas une contradiction. C'est tout l'intérêt : dans un régime, le marché s'éloigne du niveau, et dans l'autre, il y revient.

---

## Pourquoi SPX, SPY et QQQ peuvent diverger

Cela découle directement de ce qui précède, et c'est la question qui a motivé cette page.

Deux symboles peuvent produire des scores de confluence opposés le même après-midi, tout en fonctionnant parfaitement l'un et l'autre, pour deux raisons indépendantes.

**D'abord, ils peuvent être dans des régimes de gamma différents.** SPX et SPY suivent le même indice mais portent des books d'options différents, et QQQ relève d'un tout autre indice. Chacun a son propre gamma net et son propre flip. Si l'un est en gamma négatif et l'autre en gamma positif, le signe s'inverse sur l'un et pas sur l'autre. Même tape, scores opposés.

**Ensuite, chacun a son propre cluster, à son propre emplacement.** Le niveau de confluence est construit à partir du flip de ce symbole, du VWAP de ce symbole et des walls de ce symbole. Ceux-ci ne se situent pas à la même position relative d'un symbole à l'autre. Le prix peut être au-dessus du cluster du SPX et en dessous de celui de QQQ au même moment, ce qui inverse à nouveau le signe.

Chacune de ces raisons suffit à elle seule à inverser la lecture. Les deux réunies sont chose courante.

Le conseil pratique : **n'utilisez pas le score de confluence d'un symbole pour en trader un autre.** Lisez le score de l'instrument que vous tradez. Si vous voulez recouper entre symboles, comparez directement les régimes et les clusters plutôt que les scores, car les scores intègrent déjà ces deux éléments.

---

## C'est une lecture en direct, pas un biais de séance

Le score est recalculé en continu. Ce n'est pas un pronostic du matin qui tient jusqu'à la clôture.

Quand le prix franchit le niveau de confluence, le signe bascule - et comme l'historique du score est coloré selon le signe actuel, toute la ligne change de couleur. Le tracé n'a pas changé ; sa couleur, si. Un historique qui était vert toute la matinée et qui est maintenant rouge vous montre les mêmes données sous un nouveau signe.

Cela signifie aussi que le score ne se met à jour que pendant les heures d'ouverture du marché. Une ligne plate jusque dans la soirée est la dernière valeur enregistrée, pas un signal encore actif.

Il est assez naturel de vouloir lisser la lecture pour qu'elle persiste sur toute une séance et capte des retournements plus importants. Cela la casserait. Le seul rôle du signal est de dire ce qui est vrai *maintenant* ; une version qui garderait son opinion à travers un changement de régime vous parlerait d'un marché qui n'existe plus.

---

## La cible attendue

Chaque carte publie une cible attendue, et elle n'a pas le même sens selon le régime :

- **Mean reversion :** la cible est le niveau de confluence lui-même. L'affirmation est que le prix revient vers le cluster.
- **Continuation :** la cible est projetée au-delà du prix, à deux fois la distance qu'il a déjà parcourue depuis le cluster. L'affirmation est que le mouvement se prolonge.

Deux réserves honnêtes. La cible est géométrique - elle ne varie pas avec le score, si bien qu'une carte à faible confiance peut quand même afficher une cible lointaine. Lisez-la avec le score et la qualité, pas isolément. Et en continuation, c'est une extrapolation, pas un niveau mesuré : rien dans le book d'options ne dit que le prix s'arrête là.

---

## Limites honnêtes

**Le signe des dealers est modélisé, pas observé.** Comme partout ailleurs sur la plateforme, le fait que les dealers soient longs ou shorts sur un contrat est une convention appliquée à l'open interest public, pas un fait lu sur le tape. Le régime qui pilote l'inversion de signe décrite plus haut hérite de cette hypothèse.

**Le cluster relève de l'arithmétique, pas du jugement.** Le niveau de confluence est une simple moyenne des membres retenus. Il ne pondère ni un wall selon sa taille, ni un flip selon la netteté avec laquelle il a été déterminé.

**Deux membres, c'est le plancher, pas une recommandation.** Chaque carte compte au moins le flip et le VWAP, donc `Members: 2` avec un large écart, c'est le modèle qui signale l'absence de cluster, pas qui en trouve un. Vérifiez la qualité avant de lire le signe.

**C'est une lecture de positionnement, pas une prévision.** Comme tout niveau de gamma, elle décrit ce que la couverture *tend* à faire autour d'une structure. Un catalyseur la submerge, et un niveau respecté toute la matinée cesse de compter dès que quelque chose de plus important arrive.

---

## La lecture en pratique

1. **Vérifiez d'abord la qualité et les membres.** Une qualité faible signifie qu'il n'y a pas de cluster, quoi qu'indique le signe. En dessous de ±20, la carte affiche « No confluence edge », et il faut le prendre au pied de la lettre.
2. **Vérifiez ensuite le badge de régime.** Continuation et Mean Reversion sont des trades opposés tirés de la même image, et le badge vous indique lequel le modèle retient.
3. **Lisez ensuite le signe et le niveau.** En mean reversion, le niveau de confluence est la destination. En continuation, c'est ce que le prix est en train de quitter.
4. **Lisez-le symbole par symbole.** SPX, SPY et QQQ ont chacun leur propre régime et leur propre cluster.

Vous pouvez voir le score en direct, l'empilement des niveaux et l'historique du score sur la page [Gamma / VWAP Confluence](/gamma-vwap-confluence).
