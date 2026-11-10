# Forced Flow et flux zéro expliqués : là où la couverture des dealers s'annule

*La gamma exposure vous dit quelle forme prend la couverture des dealers. Forced Flow y attache un montant en dollars et une échéance : combien d'actions le book d'options actuel obligerait les hedgers à acheter ou à vendre si le prix, le temps ou la volatilité implicite bougent. Le niveau de flux zéro transforme ce chiffre en prix : le seul niveau de spot où tout cela s'annule.*

---

## Une question que la plupart des outils gamma passent sous silence

Le Net GEX et le gamma flip décrivent la forme de la couverture des dealers. Ils vous disent si la couverture devrait s'opposer à un mouvement ou l'accompagner, et à peu près avec quelle force par point. Ce qu'ils ne vous disent pas, c'est combien d'actions sont en jeu, dans quel sens et pour quand, même si le marché ne fait rien du tout.

Ce dernier point compte plus qu'il n'y paraît. Le delta d'un book d'options change quand le prix bouge, mais aussi quand l'horloge tourne et quand la volatilité implicite se déplace. Un hedger qui veut rester delta-neutre doit trader des actions dans les trois cas. Sur un indice doté d'une grosse échéance du jour même, l'horloge seule peut rivaliser avec les deux autres dès l'après-midi.

Forced Flow pose directement cette question, et le niveau de flux zéro répond à la suivante : à quel prix le book ne devrait-il plus rien du tout d'ici la clôture ?

Voici comment il se situe par rapport aux deux autres façons dont ZeroGEX examine la couverture des dealers :

| | **Le GEX et le gamma flip** | **Hedging Flow** | **Forced Flow** |
|---|---|---|---|
| Lit | Le book en place | Les transactions du jour | Le book en place |
| Répond à | Comment la couverture réagit par point de prix | Quelle couverture les transactions du jour ont impliquée | Combien d'actions un scénario imposerait, et où cela s'annule |
| Sens dans le temps | Un instantané | En remontant la séance | Vers l'avant, jusqu'à la clôture de 16h00 ET |
| Unités | Gamma en dollars | Dollars d'actions | Dollars d'actions |

Hedging Flow et Forced Flow partagent volontairement les mêmes unités et la même convention de signe, pour pouvoir être lus côte à côte.

---

## Ce qu'est le flux forcé

Partez de la position modélisée des dealers : l'open interest sur chaque échéance et chaque strike suivis, les dealers étant supposés détenir la contrepartie du client, nets longs sur les calls et nets shorts sur les puts. C'est la même convention que celle qui sous-tend le net GEX et le gamma flip de ZeroGEX. C'est une hypothèse, pas une observation : les données d'options publiques ne montrent pas qui détient quoi, et la [page méthodologie](/methodology) explique où cette convention peut se tromper.

À partir de cette position, Forced Flow calcule deux fois le delta total du book : une fois maintenant, et une fois dans un scénario (un autre prix, plus tard dans la journée, une autre volatilité implicite, ou n'importe quelle combinaison). La différence mesure de combien la couverture a dérivé. Les actions nécessaires pour la rétablir constituent le flux forcé :

`forced flow = −(dealer delta under the scenario − dealer delta now) × scenario price`

**Positif signifie que la couverture delta-neutre achète des actions. Négatif signifie qu'elle en vend.**

Deux détails en font plus qu'un simple calcul de coin de table :

- **C'est un repricing complet.** Chaque contrat est revalorisé dans le scénario, au lieu d'être estimé en additionnant gamma, charm et vanna. Additionner les grecques est une bonne première approximation et une mauvaise réponse finale, car les trois interagissent ; [Delta et ses trois enfants](/education/delta-and-its-three-children) explique pourquoi.
- **Les grecques restent affichées, pour l'attribution.** La page décompose chaque chiffre en une part gamma (le prix), une part charm (le temps) et une part vanna (la volatilité), pour que vous voyiez ce qui le pilote. Quand un scénario est assez extrême pour que cette décomposition simple ne tombe plus juste, c'est le repricing complet qui fait foi.

L'open interest est publié une fois par jour. En intraday, le flux forcé ne change pas parce que de nouvelles positions ont été ouvertes. Il change parce que le book existant est revalorisé à mesure que le prix, le temps et la volatilité bougent.

---

## Les trois leviers

Forced Flow actionne un levier à la fois, et la page trace chacun d'eux :

- **Le prix.** La *courbe de repricing* montre le flux forcé à chaque prix situé dans un rayon d'environ 2 % autour du spot, si le sous-jacent termine la séance à ce niveau. Le temps restant jusqu'à la clôture est inclus, de sorte que la courbe montre le levier prix en plus de ce que l'horloge doit déjà.
- **Le temps, à prix constant.** *Charm Into the Close* fait avancer l'horloge de maintenant jusqu'à la cloche de 16h00, prix figé, et trace combien d'actions la seule décroissance temporelle oblige les dealers à trader en chemin. La courbe se raidit dans la dernière heure, à mesure que les options du jour même se résolvent. [Charm : l'horloge est un trader](/education/charm-the-clock-is-a-trader) en explique la mécanique.
- **La volatilité, à prix et temps constants.** Le *Vanna Ladder* déplace la volatilité implicite vers le haut et vers le bas, par pas d'un demi-point jusqu'à trois points dans chaque sens, et montre les actions que chaque déplacement imposerait à l'instant présent. [Vanna : comment la baisse de la volatilité implicite peut modifier la couverture des dealers](/education/vanna-when-fear-fades) explique pourquoi.

---

## Ce qu'est le niveau de flux zéro

La courbe de repricing montre le flux forcé à chaque prix, en supposant que le sous-jacent se trouve à ce prix à la clôture. Quelque part sur son tracé, la courbe croise zéro. Ce prix est le **niveau de flux zéro** : le spot auquel le book, porté jusqu'à la clôture, ne doit rien. Les dealers n'auraient rien à acheter ni à vendre à ce niveau pour rester couverts.

Si l'horloge n'existait pas, ce prix serait le spot lui-même : pas de mouvement, pas de recouverture. S'il se situe ailleurs, c'est à cause du temps. À prix inchangé, la décroissance temporelle doit déjà une certaine quantité d'actions d'ici la clôture. Le niveau de flux zéro correspond au mouvement de prix dont la propre couverture l'annule exactement.

### Un exemple concret

Ce sont des chiffres ronds, à titre d'illustration, pas une lecture en direct.

SPY est à 660,00 $, à deux heures de la cloche. La courbe de repricing affiche **Flow at spot : achat de 300 M$**. C'est ce que l'horloge seule doit si SPY termine exactement ici.

Près du spot, le book est long gamma : pour chaque dollar de hausse de SPY, la couverture doit vendre environ 120 M$ de SPY, et pour chaque dollar de baisse, en acheter environ 120 M$.

Donc, si SPY monte de 2,50 $ d'ici la clôture, des ventes d'environ 300 M$ dues au prix annulent les achats d'environ 300 M$ dus au temps. Le niveau de flux zéro se situe à peu près à **662,50 $**.

La règle empirique derrière ce calcul :

`distance to zero flow ≈ −(flow at spot) ÷ (forced flow per $1 of price)`

C'est une approximation du premier ordre. La page calcule le croisement exactement, en revalorisant l'ensemble du book à chaque prix de sa grille, ce qui compte quand le mouvement est important ou que le book est chargé en options du jour même.

---

## Aimant ou pivot : c'est la pente qui décide

Un niveau de flux zéro est un prix unique, mais ce qui se passe de part et d'autre dépend du sens dans lequel la courbe le traverse.

Reprenez l'exemple ci-dessus. Sous 662,50 $, les achats dus au temps l'emportent sur les ventes dues au prix, donc le book doit des achats nets. Au-dessus, c'est l'inverse : des ventes nettes. Des deux côtés, la couverture penche vers le niveau. C'est un **aimant**, un niveau de flux zéro stable.

Inversez maintenant le book pour qu'il soit short gamma près du spot : pour chaque dollar de hausse de SPY, la couverture doit *acheter* 120 M$, et supposez que l'horloge doive plutôt 300 M$ de ventes. Le même calcul place le niveau de flux zéro au même endroit, 662,50 $. Mais cette fois, en dessous, le book doit des ventes nettes, et au-dessus, des achats nets. Des deux côtés, la couverture penche *à l'écart* du niveau. C'est un **pivot**, un niveau de flux zéro instable : un fil-piège plutôt qu'un pin.

| Près du niveau, les dealers sont | Sous le niveau | Au-dessus du niveau | La couverture penche | Sur la page |
|---|---|---|---|---|
| Long gamma | Achats nets | Ventes nettes | Vers le niveau | Aimant : ligne bleue continue sur le Field |
| Short gamma | Ventes nettes | Achats nets | À l'écart du niveau | Pivot : ligne ambre discontinue sur le Field |

Le même prix peut être l'un ou l'autre. Lire un pivot comme un aimant, c'est prendre l'inclinaison exactement à l'envers, et c'est pourquoi le Field sur toute la séance trace les deux séparément. Sur la courbe de repricing, cela se voit à l'œil nu : une courbe qui traverse zéro en descendant, des achats à gauche vers les ventes à droite, est un aimant ; une courbe qui traverse zéro en montant est un pivot.

À titre de règle empirique, sous le gamma flip, le niveau de flux zéro le plus proche du spot est le plus souvent un pivot, et au-dessus, le plus souvent un aimant. C'est la pente au niveau lui-même qui décide.

« Penche vers » et « penche à l'écart » décrivent la couverture modélisée, pas une promesse sur le prix. Que le prix réagisse réellement est une question empirique, et la page la mesure au lieu de la supposer (nous y revenons plus bas).

---

## Le flux zéro n'est pas le gamma flip

La page trace quatre niveaux sur son rail, et ils répondent à quatre questions différentes :

- **Gamma flip :** le prix où le gamma net modélisé des dealers change de signe. Il marque la frontière entre le régime où la couverture amortit les mouvements (au-dessus) et celui où elle les amplifie (en dessous). Voir [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip)
- **Niveau de flux zéro :** le prix où le flux forcé total, porté jusqu'à la clôture, s'annule. Il intègre le temps au tableau, ce que ne fait pas le gamma flip.
- **Charm flip :** le prix auquel la décroissance temporelle jusqu'à la clôture change de signe. D'un côté, l'horloge impose des achats ; de l'autre, des ventes.
- **Vanna flip :** le prix auquel la couverture imposée par une hausse d'un point de la volatilité implicite change de signe.

Le gamma flip dit à quel type de couverture s'attendre. Le niveau de flux zéro dit où, compte tenu de l'horloge, cette couverture s'annule. Ils peuvent être proches ou éloignés, et l'un ne remplace pas l'autre.

---

## Comment le niveau de flux zéro se déplace au fil de la journée

L'horizon est toujours « de maintenant à la clôture de 16h00 ET du jour », si bien que le niveau de flux zéro est, par construction, une cible mobile :

- **L'horloge raccourcit l'horizon.** Le matin, le niveau intègre une séance entière de décroissance. En fin de journée, il n'intègre que ce qui reste. À 16h00, l'horizon est nul, l'horloge n'a plus rien à devoir, et le niveau se confond avec le spot. Après la cloche, il ne porte plus aucune information jusqu'à la séance suivante.
- **Le repricing remodèle la courbe.** À mesure que le prix, la volatilité implicite et le temps bougent, le delta de chaque contrat change, et avec lui la pente de la courbe et l'endroit où elle croise zéro. L'open interest reste fixe jusqu'à la publication du lendemain.
- **Le Field garde l'historique.** Le Field de la page, sur toute la séance, reconstruit le book tel qu'il était réellement à chaque instant de la séance, pour que vous puissiez voir où se situaient l'aimant et le pivot à 10h00, à midi et maintenant, face au prix réellement imprimé. À droite de « now », il prolonge le book actuel jusqu'à la clôture, sous forme de projection.

---

## Ce que ces chiffres ne sont pas

**Pas un flux observé.** Le flux forcé est un modèle de ce qu'exigerait une couverture delta-neutre, construit sur une hypothèse quant à qui détient l'open interest. ZeroGEX ne voit pas l'inventaire des dealers, et les desks réels compensent leurs positions entre plusieurs books, se couvrent avec d'autres instruments et rééquilibrent par paliers plutôt qu'en continu. Un chiffre de +300 M$ signifie que la couverture du modèle achèterait environ 300 M$. Cela ne signifie pas que quiconque le fera.

**Pas un objectif de prix.** Le niveau de flux zéro est l'endroit où la couverture modélisée s'annule. Ce n'est pas l'endroit où le prix doit aller, et un aimant ne fait pas venir le prix. La couverture est une source de flux d'ordres parmi d'autres, et un jour de catalyseur macro ou de rééquilibrage d'indice, elle est rarement la plus importante.

**Pas encore un avantage mesuré.** ZeroGEX n'a pas publié d'étude sur plusieurs séances mesurant à quelle fréquence le prix clôture près du niveau de flux zéro. Ce que la page mesure est plus restreint, et c'est présenté honnêtement :

- le Field sur toute la séance compte, au sein de la séance du jour, combien de fois le prix s'est rapproché de l'aimant (ou éloigné du pivot) d'un pas au suivant. Cela décrit aujourd'hui. Ce n'est pas une prévision pour demain ;
- le **Track Record**, en bas de la page, évalue la prévision de charm d'une séance à l'autre. Il n'évalue pas le simple signe achat ou vente, qui pour un book d'indice indique « achat » presque tous les jours et ne ferait donc que reproduire le taux de base. Il évalue si une lecture matinale du charm, plus forte ou plus faible que sa propre norme récente, penche dans le même sens que le mouvement de midi à la clôture. Il affiche le taux de réussite face à une référence naïve, avec une bande de confiance à 95 %, et ne certifie un avantage qu'après au moins 30 séances évaluées. Lisez son verdict avant de vous appuyer sur la prévision. Tant qu'il n'affiche pas **Significant at 95%**, considérez-la comme non prouvée.

---

## Lire la page Forced Flow dans l'ordre

La page est organisée comme un verdict suivi de ses preuves :

1. **The Read** réunit en une phrase le régime, le flux jusqu'à la clôture et le niveau de flux zéro, avec trois tuiles en dessous.
2. **Le Forced-Flow Rail** place le gamma flip, le charm flip, le vanna flip et le niveau de flux zéro face au spot.
3. **La courbe de repricing** montre le levier prix et l'endroit où la courbe croise zéro.
4. **Charm Into the Close** et le **Vanna Ladder** montrent les leviers temps et volatilité.
5. **Le Forced-Flow Field** montre toute la séance : le réel à gauche de « now », la projection à droite, avec l'aimant et le pivot qui le traversent et le prix réalisé par-dessus.
6. **Le Track Record** évalue la prévision de charm.

La [page d'aide Forced Flow](/help/platform/forced-flow) est la référence panneau par panneau, y compris pour quelques chiffres qui se ressemblent mais sont calculés différemment.

---

## Comment l'utiliser

Forced Flow fonctionne mieux comme contexte autour d'un niveau ou d'une idée que vous avez déjà, pas comme l'idée elle-même. Quelques combinaisons se lisent clairement :

- **Tout s'aligne.** Long gamma près du spot, un aimant quelques points au-dessus, et l'horloge qui doit des achats jusqu'à la clôture. La couverture modélisée penche dans le même sens sur chaque levier. C'est une image cohérente, qui dépend malgré tout de ce que rien de plus gros n'arrive sur le tape.
- **Un pivot près du spot.** Le niveau est un fil-piège, pas une cible. Ce qui compte, c'est de quel côté se trouve le prix, car la poussée modélisée change de sens quand le prix le franchit.
- **Les leviers divergent.** L'horloge doit des achats, mais le prix se situe juste sous un pivot où le levier prix impose des ventes. Le modèle ne donne pas de direction unique, et la lecture honnête est que la pression de couverture est mitigée.
- **En fin de journée d'échéance.** Sur un book fortement 0DTE, une grande partie du chiffre jusqu'à la clôture peut tomber dans la dernière heure, et The Read indique combien. C'est le moment où la part de l'horloge dans la couverture est la plus grande, et aussi celui où les autres flux de clôture sont les plus importants.

Associez-le à [Hedging Flow](/education/hedging-flow-explained). Forced Flow dit ce que le book imposerait dans un scénario. Hedging Flow estime ce que les transactions du jour ont réellement créé. De gros achats forcés jusqu'à la clôture avec un tape qui pousse déjà dans le même sens ne constituent pas le même setup que ce même chiffre avec un tape qui penche dans l'autre sens.

Pour les fondations, voir [Pourquoi les market makers tradent l'action](/education/why-market-makers-trade-stock), [Delta et ses trois enfants](/education/delta-and-its-three-children) et [Pourquoi nous ne publions pas le DEX](/education/why-we-dont-publish-dex). Pour voir les chiffres du jour, ouvrez la page en direct [Forced Flow](/forced-flow).

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.
