# Qu'est-ce que le gamma zéro ? Le niveau de gamma zéro expliqué

*Le gamma zéro expliqué en termes simples - ce qu'est le niveau de gamma zéro, son lien avec le gamma flip et le net GEX, ce qui tend à changer de part et d'autre, et où voir le niveau de gamma zéro du jour pour SPX, SPY, QQQ et NDX.*

---

## Qu'est-ce que le niveau de gamma zéro ?

Le **niveau de gamma zéro** est le prix auquel l'exposition gamma modélisée des dealers passe par zéro. Au-dessus, le book d'options est modélisé comme net *positif* en gamma pour les dealers ; en dessous, net *négatif*. C'est le même niveau que la plupart des traders appellent le **gamma flip**, et les deux noms sont employés indifféremment : « gamma zéro » décrit ce qu'est le chiffre (le point où le gamma net des dealers est égal à zéro), et « gamma flip » décrit ce qui s'y passe (le signe bascule).

C'est toute la définition, et cela vaut la peine de s'en tenir à cette version simple, car on parle de ce niveau comme s'il s'agissait d'une ligne de support ou de résistance. Ce n'en est pas une. Le gamma zéro est une **frontière de régime** : il marque l'endroit où, selon le modèle, le *caractère* de la couverture des dealers change, pas l'endroit où l'on s'attend à ce que le prix s'arrête.

Quelques conséquences en découlent directement :

- C'est un **niveau de prix, pas un strike.** Le passage par zéro se situe généralement entre deux strikes, car il provient d'une courbe - le gamma modélisé des dealers évalué sur une plage de prix spot - plutôt que d'un contrat en particulier.
- Il **bouge.** À mesure que l'open interest change et que les contrats existants sont revalorisés avec le spot, le temps et la volatilité implicite, la courbe se remodèle et son passage par zéro se déplace. Le niveau de gamma zéro d'hier n'est pas le même chiffre que celui d'aujourd'hui. Consultez le [niveau de gamma zéro actuel du SPX](/spx-gamma-levels) à chaque séance plutôt que de reporter un ancien niveau.
- C'est un **résultat de modèle.** L'inventaire des dealers n'est pas directement observable, donc le niveau dépend d'une convention de signe (ZeroGEX utilise la convention traditionnelle calls positifs / puts négatifs) et des échéances et données d'entrée que le modèle inclut.

## Gamma zéro vs gamma flip vs net GEX

Trois termes étroitement liés, et leurs différences comptent plus qu'il n'y paraît :

| Terme | Ce que c'est | Unité |
|---|---|---|
| **Net GEX** | Le gamma net modélisé des dealers sur l'ensemble de la chaîne, évalué au prix spot actuel | Dollars signés (« dollar gamma »), par ex. +1,2 Md$ |
| **Niveau de gamma zéro** | Le prix spot auquel ce gamma net modélisé serait égal à zéro | Un prix, par ex. 5 815 |
| **Gamma flip** | Le même niveau, nommé d'après le changement de signe qui s'y produit | Un prix |

Le net GEX est donc une *lecture*, et le gamma zéro un *niveau*. Ce sont deux vues d'une même courbe : quand le spot est au-dessus du niveau de gamma zéro, le net GEX au spot est positif ; quand le spot est en dessous, le net GEX au spot est négatif. Si les deux semblent un jour en désaccord - un net GEX positif alors que le spot est sous le flip publié - le modèle vous signale qu'il a trouvé plus d'un passage par zéro, ou que la lecture et le niveau proviennent d'instantanés différents. Voir [Le Net GEX du SPX aujourd'hui](/education/spx-net-gamma-exposure-today) pour savoir lire le chiffre en dollars lui-même.

## Comment le niveau de gamma zéro est déterminé

La méthode rapide pour localiser le gamma zéro consiste à additionner le gamma signé strike par strike, du strike le plus bas vers le haut, et à marquer l'endroit où le total cumulé passe par zéro. C'est rapide, et c'est aussi faux plus souvent qu'il n'y paraît, car cela traite le gamma de chaque contrat comme fixe alors qu'en réalité le gamma dépend de l'endroit où se trouve le spot.

La meilleure approche - celle que ZeroGEX a adoptée - revalorise l'ensemble du book à chaque prix spot candidat, calcule le gamma net modélisé des dealers *comme si le spot s'y trouvait*, et relève l'endroit où ce profil passe par zéro. Le [guide de calcul du Gamma Flip](/guides/gamma-flip-calculation-before-vs-after) détaille les deux méthodes et explique pourquoi le profil par spot-shift est celui auquel on peut se fier.

Deux choses découlent de la meilleure méthode :

1. **Le niveau peut être absent.** Si le profil ne passe jamais par zéro près du spot - en plein cœur d'un régime, sur une chaîne mince ou unilatérale, lors d'un pic de volatilité implicite qui écrase le gamma modélisé sur toute la chaîne - il n'y a pas de niveau de gamma zéro honnête à publier, et ZeroGEX le laisse vide plutôt que d'en inventer un. Le signe du net GEX vous dit quand même dans quel régime vous vous trouvez.
2. **Il peut y en avoir plus d'un.** Une chaîne irrégulière peut produire deux croisements. ZeroGEX publie celui qui est assez proche du spot pour être tradable et adossé à un véritable open interest ; il est bon de savoir qu'un second peut se trouver plus loin.

## Ce qui tend à changer au-dessus et en dessous du gamma zéro

C'est le signe du gamma modélisé des dealers qui décide si la couverture penche *contre* les mouvements ou *avec* eux.

**Au-dessus du niveau de gamma zéro (gamma positif).** Les dealers sont modélisés net long gamma. Pour rester delta-neutres, ils tendent à vendre dans la force et à acheter dans la faiblesse, ce qui pousse contre le sens du mouvement. La volatilité réalisée tend à se comprimer, les ranges tendent à être plus serrés, et le prix tend à graviter vers les strikes lourds à l'approche de la clôture. La couverture s'oppose aux breakouts plutôt que de les alimenter.

**En dessous du niveau de gamma zéro (gamma négatif).** Les dealers sont modélisés net short gamma. Le même réflexe de couverture accompagne désormais le mouvement - acheter la force, vendre la faiblesse - et la volatilité réalisée tend à s'étendre. Les ranges s'élargissent, une cassure qui se produit bel et bien a la couverture derrière elle, et le pinning qui tenait au-dessus du niveau tend à se relâcher. [Ce que signifie le gamma négatif](/education/what-is-negative-gamma) traite ce régime en profondeur.

**Au niveau lui-même.** Un spot situé sur le gamma zéro est l'état le moins informatif, pas le plus informatif. Les contributions modélisées positives et négatives se compensent à peu près, la tendance nette de la couverture est faible, et une petite variation des données d'entrée peut faire basculer le signe. Les traders qui utilisent ce niveau traitent cette zone comme un territoire contesté plutôt que comme un signal.

Rien de tout cela n'est directionnel. Être au-dessus du gamma zéro n'est pas haussier ; être en dessous n'est pas baissier. Le niveau renseigne sur la *texture* du tape - collant ou glissant - pas sur la direction que prend le prix.

## Comment les traders utilisent le niveau de gamma zéro

Le niveau est surtout utile comme **filtre** qui détermine quel playbook est en jeu, plutôt que comme déclencheur :

1. **Lisez d'abord le régime.** Avant un setup, vérifiez si le spot est au-dessus ou en dessous du gamma zéro, et de combien.
2. **Adaptez vos tactiques au côté.** Au-dessus : fades, trades de range, patience près du [call wall et du put wall](/education/gamma-walls-explained). En dessous : momentum, breakouts, risque plus serré.
3. **Surveillez la distance et la dérive.** Un niveau éloigné du spot donne une lecture de régime stable ; un niveau à quelques dixièmes de pourcent donne une lecture contestée. Un niveau qui migre vers le prix au fil de la séance n'envoie pas le même signal qu'un niveau qui reste en place pendant que le prix s'en approche.
4. **Vérifiez l'ampleur du net GEX.** Un niveau de gamma zéro avec 2 Md$ de gamma modélisé au-dessus décrit un régime plus tranché qu'un niveau avec 200 M$. Le signe et la taille ensemble, pas le signe seul.

[Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip) en fait une routine intraday, et [Comment trader autour des niveaux de gamma flip](/education/how-to-trade-around-gamma-flip) explique ce qui change quand le spot franchit le niveau.

## Erreurs de lecture courantes

- **Traiter le gamma zéro comme un support ou une résistance.** C'est une ligne de régime. Acheter la faiblesse vers le niveau depuis le haut et acheter la faiblesse depuis le bas sont des trades structurellement différents.
- **Lire un niveau obsolète.** Le niveau de gamma zéro peut se déplacer de plusieurs points en quelques heures. Un chiffre du matin lu face au tape de l'après-midi correspond à un autre book.
- **Le confondre avec le max pain.** [Le max pain](/education/max-pain-explained) est un strike de géométrie des paiements - celui où la valeur à l'échéance pour les détenteurs d'options est minimisée. Le gamma zéro est une ligne de régime de couverture. Ils répondent à des questions différentes et divergent fréquemment.
- **S'attendre à un rebond ou à une cassure au niveau.** Le franchissement du gamma zéro par le prix change le *réflexe* modélisé de la couverture. Il ne vous dit pas, à lui seul, si le mouvement va se poursuivre.

## Le niveau de gamma zéro du jour

ZeroGEX publie le niveau de gamma zéro - sous le libellé « gamma flip » - avec le call wall, le put wall, le max pain et le net GEX, gratuitement et avec un décalage d'environ 15 minutes, pour [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) et [NQ](/nq-gamma-levels). La valeur en direct, sur toute la séance, se met à jour dans le tableau de bord. Pour distinguer ce que ZeroGEX observe de ce qu'il modélise, voir la [méthodologie](/methodology).

## À retenir

> Le gamma zéro est le prix où le gamma net modélisé des dealers est nul - le même niveau que le gamma flip. Au-dessus, la couverture tend à amortir les mouvements ; en dessous, elle tend à les amplifier. C'est une ligne de régime, pas une cible, et elle se déplace au fil de la journée.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.
