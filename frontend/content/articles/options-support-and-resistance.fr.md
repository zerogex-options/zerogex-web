# Comment identifier le support et la résistance à partir du positionnement en options
> **Note méthodologique.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. Qu’en gamma négatif le terme de pin d’EOD Pressure suive le mouvement récent est une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.


*Le support et la résistance classiques relèvent surtout de la psychologie - lignes tracées, swings précédents, chiffres ronds. Le support et la résistance basés sur les options relèvent de la mécanique - un positionnement réel qui génère des flux de couverture réels. Voici comment les identifier et les lire en temps réel.*

---

## Deux types de support et de résistance

La boîte à outils S/R du trader particulier est surtout dérivée du graphique : plus hauts et plus bas de swing précédents, lignes de tendance, chiffres ronds, moyennes mobiles. Elles fonctionnent - parfois - parce qu'assez de traders les observent pour qu'elles deviennent autoréalisatrices. Le mécanisme est une convergence psychologique.

Le support et la résistance basés sur les options sont différents. Ils ne découlent pas de l'historique des prix, mais du positionnement actuel en options. Le mécanisme est structurel : des flux de couverture des dealers qui se déclenchent automatiquement lorsque le prix approche de strikes concentrés. Aucune convergence n'est nécessaire - les dealers doivent se couvrir, peu importe qui observe, et leurs flux de couverture agissent comme de l'offre à la résistance et de la demande au support.

Lorsque le S/R graphique et le S/R basé sur les options concordent, le niveau est nettement plus fiable. Lorsqu'ils divergent, la lecture basée sur les options tend à l'emporter - car le niveau graphique relève de l'opinion, tandis que le niveau options est un flux contraint.

Cet article présente le workflow pratique pour identifier le S/R basé sur les options, le lire en temps réel, et savoir à quoi s'attendre quand le prix le teste. Pour le cadre gamma plus large, voir le [pilier Exposition Gamma](/education/gamma-exposure-explained).

---

## Les quatre types de S/R basés sur les options

Les libellés ci-dessous - call wall comme résistance, put wall comme support - décrivent dans quel sens penche la couverture modélisée dans un régime de *gamma positive*. Ce ne sont pas des propriétés fixes du strike : le type d'option ne détermine pas à lui seul la direction, et la couverture peut au contraire accompagner un mouvement quand le signe de la gamma dealer modélisée ou le flux environnant change.

### 1. Les call walls (résistance)

Le **call wall** est le strike au-dessus du spot présentant l'exposition gamma call la plus lourde. Dans un régime de gamma longue, les dealers qui couvrent leur inventaire long-call doivent vendre lors des rallyes qui approchent du wall. Cette vente agit comme une résistance structurelle.

Lecture pratique : dans un régime de gamma positive, la couverture autour du call wall s'oppose à un rallye ; dans un régime de gamma négative, elle l'accompagne, de sorte que, si le wall cède, il peut devenir un accélérateur de breakout. Le régime change ce comportement, pas la fréquence à laquelle le wall cède : selon nos mesures, les walls du S&P ont tenu environ deux fois sur trois dans l'heure, d'un côté comme de l'autre du flip.

### 2. Les put walls (support)

Le **put wall** est le strike en dessous du spot présentant l'exposition gamma put la plus lourde. Dans un régime de gamma longue, les dealers doivent acheter lors des selloffs qui approchent du wall pour rester neutres. Cet achat agit comme un support structurel.

Même dépendance au régime que pour le call wall - en gamma négative, un put wall qui cède peut devenir un point de glissement (slippage) à la baisse.

La mécanique des walls dans les deux régimes est expliquée dans [Gamma Walls Explained](/education/gamma-walls-explained).

### 3. Le gamma magnet (attraction vers le pin)

Le **gamma magnet** est le strike présentant la plus forte concentration gamma en valeur absolue. Il n'est pas directionnel - il attire le prix vers lui dans un régime de gamma longue et le relâche en gamma courte. Fonctionnellement, il agit simultanément comme support et résistance : le prix au-dessus est tiré vers le bas, vers lui ; le prix en dessous est tiré vers le haut.

Le magnet est le plus fort à l'approche de l'échéance, lorsque les options expirant le jour même dominent le profil gamma. Le comportement de pin en fin de journée provient généralement de ce strike.

### 4. Le gamma flip (ligne de régime)

Le **gamma flip** n'est pas du S/R au sens traditionnel - c'est la frontière de régime. Mais il fonctionne comme une ligne de support/résistance souple, car le prix tend à marquer une pause ou à s'inverser brièvement en la franchissant (le réflexe du dealer change de signe exactement à ce prix). Au-dessus du flip, le réflexe est de fader ; en dessous, de suivre (chase).

Voir [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) pour la méthode.

---

## Pourquoi le SPY se retourne-t-il à ces niveaux ?

Les retournements qui semblent aléatoires sur un graphique du SPY - le prix court jusqu'à un niveau qui n'était ni un swing précédent ni un chiffre rond, s'arrête net, puis se défait - correspondent généralement à l'un de ces quatre niveaux qui joue son rôle. Au **call wall**, les dealers modélisés longs sur le strike vendent dans le rallye pour rester couverts, ajoutant une offre qui plafonne le mouvement. Au **put wall**, un book net long gamma achète le selloff, ajoutant du support. Au **gamma magnet**, le réflexe de couverture modélisé ramène le prix vers le strike. Au **gamma flip**, ce réflexe change de signe et le prix marque souvent une pause en le franchissant. Aucun de ces niveaux n'apparaît sur le graphique des prix - ils se trouvent sur la chaîne d'options - c'est pourquoi le retournement semble venir de nulle part tant que vous ne le rapportez pas au positionnement. Selon nos mesures, qu'un wall absorbe le mouvement ou se fasse enfoncer ne dépendait pas du régime - les walls du S&P ont tenu environ deux fois sur trois dans l'heure, d'un côté comme de l'autre du flip. Ce que le régime change, c'est la couverture autour du niveau ; lisez donc d'abord le flip : en gamma longue, la couverture s'oppose à un rallye vers le call wall ; en gamma courte, elle renforce le mouvement une fois que ce wall a cédé.

---

## Pourquoi le S/R basé sur les options est plus robuste que le S/R graphique

Trois raisons :

1. **C'est contraint, pas choisi.** Un trader peut décider de défendre ou non une ligne de tendance. Un dealer doit couvrir son exposition gamma pour rester neutre - il n'y a pas d'option de retrait. Le flux de couverture se produit que le dealer y croie ou non.

2. **Ça s'échelonne avec le positionnement, pas avec l'attention.** Une ligne de tendance se renforce à mesure qu'elle attire les regards ; un wall se renforce avec davantage d'open interest. Plus le wall est grand, plus le flux structurel est important lorsque le prix s'en approche. La relation est mécanique.

3. **Ça se met à jour en temps réel.** Les lignes de tendance sont des artefacts historiques qui deviennent obsolètes à mesure que le prix évolue. Les walls se déplacent avec le positionnement - un nouvel OI qui se construit au-dessus du call wall le pousse plus haut, et la lecture structurelle se met à jour en conséquence. Le niveau que vous voyez à 10h30 ET est celui qui compte maintenant.

Cela dit, le S/R basé sur les options n'est pas infaillible. C'est une inclinaison probabiliste. Les chocs macro et les événements catalyseurs le contredisent régulièrement, et un changement de régime modifie ce que fait la couverture. L'avantage, c'est que cette inclinaison est *fondée* - quand ça fonctionne, ça fonctionne pour une raison vérifiable.

---

## Comment identifier les niveaux en temps réel

Un workflow court :

1. **Repérez d'abord le gamma flip.** Il indique dans quel régime vous vous trouvez. Le flip lui-même est aussi un niveau souple à surveiller.
2. **Identifiez le call wall et le put wall.** Ils donnent la fourchette structurelle - les limites près desquelles la couverture des dealers s'oppose au mouvement (en régime de gamma longue) ou renforce un mouvement qui les franchit (en régime de gamma courte).
3. **Identifiez le gamma magnet.** Souvent le strike 0DTE le plus lourd. Le magnet indique où le prix est attiré à l'intérieur de la fourchette des walls.
4. **Vérifiez la migration.** Un wall qui vient de sauter n'est pas la même référence qu'un wall stable depuis des heures : un wall qui migre poursuit le prix, donc le niveau que vous surveillez s'est déplacé. Selon nos mesures, ni l'ancienneté d'un wall ni sa migration ne permettaient de prédire s'il allait céder.
5. **Recoupez avec le S/R graphique.** Là où le niveau structurel s'aligne avec un niveau graphique (chiffre rond, swing précédent, moyenne mobile clé), la convergence peut rendre le niveau plus net.

---

## Quand le niveau structurel tient

Sur les 737 tests de walls que nous avons mesurés, les walls du S&P ont tenu environ deux fois sur trois dans l'heure suivant le test, et ceux du Nasdaq environ une fois sur deux ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)). Les conditions que les traders vérifient habituellement n'ont pas fait mieux que ce taux de base :

- Si le spot se trouvait dans un **régime de gamma positive** (au-dessus du flip) ou dans un régime de gamma négative.
- Si le Net GEX était **substantiel et stable** ou s'il se dégradait.
- Si le wall **migrait** avec le prix.
- Si le flux au strike du wall **accélérait** ou décélérait.
- Depuis combien de temps le wall était en place, et combien de fois il avait été testé.

L'estimation a priori honnête pour n'importe quel wall reste donc le taux de base de son indice, pas une checklist.

## Quand le niveau structurel cède

Ce que le régime change, c'est ce que fait la couverture quand un niveau cède :

- Dans un **régime de gamma positive**, la couverture s'oppose au mouvement, si bien qu'une cassure est moins portée par la couverture.
- Dans un **régime de gamma négative**, les dealers poursuivent le prix au lieu de le contrer, de sorte que leur couverture renforce la cassure.
- À mesure que le spot, le temps ou la volatilité modifient le classement des strikes, le wall peut **migrer**, et le niveau que vous surveilliez cesse d'être le strike le plus lourd.
- Un **catalyseur** qui survient pendant le test peut submerger la couverture, quel que soit le régime.

Rien de tout cela ne rend un niveau plus susceptible de céder que de tenir. Lire le régime en premier vous indique avec quel mécanisme vous tradez, pas les probabilités.

---

## Exemple chiffré

SPY se situe à 581,50. L'analyse graphique classique montre une résistance autour de 583 (plus haut de swing précédent) et un support autour de 580 (moyenne mobile à 50 jours, chiffre rond). ZeroGEX indique :

- **Call Wall :** 583,50 (proche de la résistance graphique, sans y être exactement)
- **Put Wall :** 580,00 (exactement au niveau du support graphique)
- **Gamma Flip :** 580,80 (entre le spot actuel et le put wall)
- **Gamma magnet :** 581,00 (pratiquement au niveau du spot)
- **Net GEX :** +1,1 Md$, stable

La lecture structurelle composite :

- Le call wall et la résistance graphique concordent près de 583 - la zone de résistance à plus forte confiance se situe exactement là où les traders graphiques la voient, mais le positionnement modélisé place le wall à 583,50, pas au chiffre rond de 583.
- Le put wall et le support graphique concordent également près de 580 - une lecture de support plus solide à ce niveau.
- Le gamma magnet à 581,00 signifie que le prix peut subir une attraction structurelle vers à peu près l'endroit où il se trouve actuellement. Tant que la gamma reste positive, la couverture s'oppose aux mouvements dans les deux sens.
- Le flip à 580,80 signifie qu'une chute sous 580,80 ferait basculer le régime modélisé ; si cela se produit d'abord et que le put wall à 580 cède ensuite, la couverture renforce le mouvement au lieu de l'amortir.

La lecture : la couverture modélisée s'oppose aux mouvements vers l'une ou l'autre borne de la fourchette 581-583,50, mais chaque wall reste un pari sur le taux de base - selon nos mesures, les walls du SPY ont tenu environ deux fois sur trois dans l'heure, quel que soit le côté du flip où se trouvait le prix. La lecture structurelle vous apporte l'emplacement des niveaux et ce que fait la couverture autour d'eux ; elle ne vous dit pas lequel va céder.

---

## Erreurs d'interprétation courantes

- **« C'est au niveau du plus haut de swing précédent, donc c'est une résistance. »** Parfois. Parfois le niveau structurel réel est 30 cents plus haut ou plus bas - et le mouvement qui a « cassé » la résistance graphique était toujours destiné à s'étendre jusqu'au vrai wall.
- **« Le put wall est à 580, donc 580 va tenir. »** Pas de façon fiable, dans aucun des deux régimes : selon nos mesures, les walls du S&P ont cédé dans l'heure lors d'environ un test sur trois, en gamma longue comme en gamma courte. Ce que le régime change, c'est la suite - en gamma courte, un put wall qui cède peut devenir un point de glissement.
- **« Le S/R basé sur les options ne fonctionne pas. »** Il localise un positionnement réel, et selon nos mesures, les walls du S&P ont tenu environ deux fois sur trois dans l'heure. Ce qu'il ne vous donne pas, c'est un moyen de savoir à l'avance quel wall va céder : le régime, le Net GEX, la migration et le flux au strike ne l'ont pas permis.

---

## À retenir

> Le support et la résistance basés sur les options relèvent de la mécanique, pas de la psychologie. Ils identifient les niveaux où la couverture des dealers se déclenchera réellement - et le régime indique si ce déclenchement absorbe le mouvement ou l'amplifie.

La discipline consiste à lire d'abord la carte structurelle, à la recouper avec les niveaux graphiques pour vérifier la convergence, puis à vérifier le régime avant de décider quoi faire du niveau. Une grande partie du « bruit » apparent dans le S/R graphique retail correspond à l'écart entre l'endroit où les graphiques indiquent que le niveau se trouve et l'endroit où le positionnement le place réellement.

Contenu purement éducatif - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le call wall, le put wall, le gamma flip et le gamma magnet du jour pour SPY, SPX, QQQ et NDX - les quatre niveaux structurels qui pilotent l'essentiel du S/R basé sur les options - la vue gratuite gamma-levels de ZeroGEX les affiche.
