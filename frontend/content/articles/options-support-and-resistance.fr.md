# Comment identifier le support et la résistance à partir du positionnement en options

*Le support et la résistance classiques relèvent surtout de la psychologie - lignes tracées, swings précédents, chiffres ronds. Le support et la résistance basés sur les options relèvent de la mécanique - un positionnement réel qui génère des flux de couverture réels. Voici comment les identifier et les lire en temps réel.*

---

## Deux types de support et de résistance

La boîte à outils S/R du trader particulier est surtout dérivée du graphique : plus hauts et plus bas de swing précédents, lignes de tendance, chiffres ronds, moyennes mobiles. Elles fonctionnent - parfois - parce qu'assez de traders les observent pour qu'elles deviennent autoréalisatrices. Le mécanisme est une convergence psychologique.

Le support et la résistance basés sur les options sont différents. Ils ne découlent pas de l'historique des prix, mais du positionnement actuel en options. Le mécanisme est structurel : des flux de couverture modélisés des dealers, qui tendent à se déclencher lorsque le prix approche de strikes concentrés. Une grande partie de cette couverture est systématique plutôt que discrétionnaire - si bien que, lorsque le signe du gamma modélisé des dealers s'aligne, ces flux peuvent agir comme de l'offre près de la résistance et de la demande près du support.

Lorsque le S/R graphique et le S/R basé sur les options concordent, le niveau tend à être plus fiable. Lorsqu'ils divergent, la lecture basée sur les options pèse souvent davantage - car le niveau graphique relève de l'opinion, tandis que le niveau options repose sur un flux de couverture dicté par le positionnement.

Cet article présente le workflow pratique pour identifier le S/R basé sur les options, le lire en temps réel, et savoir à quoi s'attendre quand le prix le teste. Pour le cadre gamma plus large, voir le [pilier Exposition Gamma](/education/gamma-exposure-explained).

---

## Les quatre types de S/R basés sur les options

Les libellés ci-dessous - call wall comme résistance, put wall comme support - décrivent dans quel sens penche la couverture modélisée dans un régime de *gamma positif*. Ce ne sont pas des propriétés fixes du strike : le type d'option ne détermine pas à lui seul la direction, et la couverture peut au contraire accompagner un mouvement quand le signe du gamma modélisé des dealers ou le flux environnant change.

### 1. Les call walls (résistance)

Le **call wall** est le strike au-dessus du spot présentant l'exposition gamma call la plus lourde. Selon la convention traditionnelle, les dealers sont modélisés longs de cet inventaire, si bien que, dans un régime long gamma, ils tendent à vendre dans les rallyes qui approchent du wall. Cette vente peut agir comme une résistance structurelle.

Lecture pratique : dans un régime de gamma positif, la couverture autour du call wall s'oppose à un rallye ; dans un régime de gamma négatif, elle l'accompagne, de sorte que, si le wall cède, il peut devenir un accélérateur de breakout. Le régime change ce comportement, pas la fréquence à laquelle le wall cède : selon nos mesures, les walls du S&P ont tenu environ deux fois sur trois dans l'heure, d'un côté comme de l'autre du flip.

### 2. Les put walls (support)

Le **put wall** est le strike en dessous du spot présentant l'exposition gamma put la plus lourde. Quand le gamma net est modélisé positif, le book agrégé des dealers tend à acheter dans les selloffs qui approchent du wall. Cet achat net peut agir comme un support structurel - notez que ce support provient du signe positif du gamma net, pas du fait que le strike soit constitué de puts (selon la convention, les dealers sont modélisés short de ces puts).

Même dépendance au régime que pour le call wall - en gamma négatif, un put wall qui cède peut devenir un point de glissement (slippage) à la baisse.

La mécanique des walls dans les deux régimes est expliquée dans [Les gamma walls expliqués](/education/gamma-walls-explained).

### 3. Le gamma magnet (attraction vers le pin)

Le **gamma magnet** est le strike présentant la plus forte concentration de gamma en valeur absolue. Il n'est pas directionnel - dans un régime long gamma, il tend à attirer le prix vers lui, et en short gamma, il tend à le relâcher. Quand l'attraction est active, il peut agir à la fois comme support et comme résistance : le prix au-dessus peut être tiré vers le bas, vers lui ; le prix en dessous peut être tiré vers le haut.

Le magnet tend à peser le plus à l'approche de l'échéance, lorsque les options expirant le jour même dominent le profil gamma. Le comportement de pin en fin de journée peut provenir de ce strike, même si le pinning reste probabiliste - la liquidité, le comportement des traders et la mécanique de l'échéance y contribuent aussi, et une forte concentration ne prouve pas à elle seule que les dealers y sont long gamma.

### 4. Le gamma flip (ligne de régime)

Le **gamma flip** n'est pas du S/R au sens traditionnel - c'est la frontière de régime, un passage par zéro du profil de gamma *modélisé* des dealers. Mais il peut fonctionner comme une ligne de support/résistance souple, car le prix marque souvent une pause ou s'inverse brièvement autour de lui (le réflexe modélisé des dealers change de signe près de ce prix). Au-dessus du flip, le réflexe modélisé est de fader ; en dessous, de suivre (chase) - même si ce passage par zéro est une estimation du modèle, et le comportement réalisé dépend toujours du flux, de la liquidité et de la volatilité.

Voir [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip) pour la méthode.

---

## Pourquoi le SPY se retourne-t-il à ces niveaux ?

Les retournements qui semblent aléatoires sur un graphique du SPY - le prix court jusqu'à un niveau qui n'était ni un swing précédent ni un chiffre rond, s'arrête net, puis se défait - correspondent généralement à l'un de ces quatre niveaux qui joue son rôle. Au **call wall**, les dealers modélisés longs sur le strike vendent dans le rallye pour rester couverts, ajoutant une offre qui plafonne le mouvement. Au **put wall**, un book net long gamma achète le selloff, ajoutant du support. Au **gamma magnet**, le réflexe de couverture modélisé ramène le prix vers le strike. Au **gamma flip**, ce réflexe change de signe et le prix marque souvent une pause en le franchissant. Aucun de ces niveaux n'apparaît sur le graphique des prix - ils se trouvent sur la chaîne d'options - c'est pourquoi le retournement semble venir de nulle part tant que vous ne le rapportez pas au positionnement. Selon nos mesures, qu'un wall absorbe le mouvement ou se fasse enfoncer ne dépendait pas du régime - les walls du S&P ont tenu environ deux fois sur trois dans l'heure, d'un côté comme de l'autre du flip. Ce que le régime change, c'est la couverture autour du niveau ; lisez donc d'abord le flip : en long gamma, la couverture s'oppose à un rallye vers le call wall ; en short gamma, elle renforce le mouvement une fois que ce wall a cédé.

---

## Pourquoi le S/R basé sur les options est plus robuste que le S/R graphique

Trois raisons :

1. **C'est systématique, pas choisi.** Un trader peut décider de défendre ou non une ligne de tendance. La couverture gamma des dealers est largement systématique - les desks gèrent une exposition agrégée plutôt que d'agir selon une opinion - si bien que le flux tend à se produire, que le dealer y croie ou non. (Les desks couvrent des portefeuilles et peuvent utiliser des bandes de couverture ; c'est donc une tendance, pas un ordre garanti en continu.)

2. **C'est proportionnel au positionnement, pas à l'attention.** Une ligne de tendance se renforce à mesure qu'elle attire les regards ; un wall reflète davantage d'open interest. Plus la concentration modélisée est importante, plus le flux de couverture potentiel est important lorsque le prix s'en approche. La relation repose sur le positionnement, pas sur le sentiment.

3. **C'est recalculé.** Le spot, le temps et la volatilité implicite revalorisent le gamma à chaque strike, si bien qu'un autre strike à OI inchangé peut devenir le wall en cours de séance. L'OI officiel est généralement mis à jour après compensation ; un wall qui migre ne prouve pas que de nouvelles positions y ont été ouvertes.

Cela dit, le S/R basé sur les options n'est pas infaillible. C'est une inclinaison probabiliste. Les chocs macro et les événements catalyseurs le contredisent régulièrement, et un changement de régime modifie ce que fait la couverture. L'avantage, c'est que cette inclinaison est *fondée* - quand ça fonctionne, ça fonctionne pour une raison vérifiable.

---

## Comment identifier les niveaux en temps réel

Un workflow court :

1. **Repérez d'abord le gamma flip.** Il indique dans quel régime vous vous trouvez. Le flip lui-même est aussi un niveau souple à surveiller.
2. **Identifiez le call wall et le put wall.** Ils donnent la fourchette structurelle - les limites près desquelles la couverture des dealers s'oppose au mouvement (en régime long gamma) ou renforce un mouvement qui les franchit (en régime short gamma).
3. **Identifiez le gamma magnet.** Souvent le strike 0DTE le plus lourd. Le magnet indique où le prix est attiré à l'intérieur de la fourchette des walls.
4. **Vérifiez la migration.** Un wall qui vient de sauter n'est pas la même référence qu'un wall stable depuis des heures : un wall qui migre poursuit le prix, donc le niveau que vous surveillez s'est déplacé. Selon nos mesures, ni l'ancienneté d'un wall ni sa migration ne permettaient de prédire s'il allait céder.
5. **Recoupez avec le S/R graphique.** Là où le niveau structurel s'aligne avec un niveau graphique (chiffre rond, swing précédent, moyenne mobile clé), la convergence peut rendre le niveau plus net.

---

## Quand le niveau structurel tient

Sur les 737 tests de walls que nous avons mesurés, les walls du S&P ont tenu environ deux fois sur trois dans l'heure suivant le test, et ceux du Nasdaq environ une fois sur deux ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)). Les conditions que les traders vérifient habituellement n'ont pas fait mieux que ce taux de base :

- Si le spot se trouvait dans un **régime de gamma positif** (au-dessus du flip) ou dans un régime de gamma négatif.
- Si le Net GEX était **substantiel et stable** ou s'il se dégradait.
- Si le wall **migrait** avec le prix.
- Si le flux au strike du wall **accélérait** ou décélérait.
- Depuis combien de temps le wall était en place, et combien de fois il avait été testé.

L'estimation a priori honnête pour n'importe quel wall reste donc le taux de base de son indice, pas une checklist.

## Quand le niveau structurel cède

Ce que le régime change, c'est ce que fait la couverture quand un niveau cède :

- Dans un **régime de gamma positif**, la couverture s'oppose au mouvement, si bien qu'une cassure est moins portée par la couverture.
- Dans un **régime de gamma négatif**, les dealers poursuivent le prix au lieu de le contrer, de sorte que leur couverture renforce la cassure.
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
- **Net GEX :** +1,1 Md$, stable (une estimation modélisée du gamma des dealers selon la convention traditionnelle d'open interest call-positif / put-négatif, et non un inventaire observé des dealers)

La lecture structurelle composite :

- Le call wall et la résistance graphique concordent près de 583 - la zone de résistance à plus forte confiance se situe exactement là où les traders graphiques la voient, mais le positionnement modélisé place le wall à 583,50, pas au chiffre rond de 583.
- Le put wall et le support graphique concordent également près de 580 - une lecture de support plus solide à ce niveau.
- Le gamma magnet à 581,00 signifie que le prix peut subir une attraction structurelle vers à peu près l'endroit où il se trouve actuellement. Tant que le gamma reste positif, la couverture s'oppose aux mouvements dans les deux sens.
- Le flip à 580,80 signifie qu'une chute sous 580,80 ferait basculer le régime modélisé ; si cela se produit d'abord et que le put wall à 580 cède ensuite, la couverture renforce le mouvement au lieu de l'amortir.

La lecture : la couverture modélisée s'oppose aux mouvements vers l'une ou l'autre borne de la fourchette 581-583,50, mais chaque wall reste un pari sur le taux de base - selon nos mesures, les walls du SPY ont tenu environ deux fois sur trois dans l'heure, quel que soit le côté du flip où se trouvait le prix. La lecture structurelle vous apporte l'emplacement des niveaux et ce que fait la couverture autour d'eux ; elle ne vous dit pas lequel va céder.

---

## Erreurs d'interprétation courantes

- **« C'est au niveau du plus haut de swing précédent, donc c'est une résistance. »** Parfois. Parfois le niveau structurel réel est 30 cents plus haut ou plus bas - et le mouvement qui a « cassé » la résistance graphique était toujours destiné à s'étendre jusqu'au vrai wall.
- **« Le put wall est à 580, donc 580 va tenir. »** Pas de façon fiable, dans aucun des deux régimes : selon nos mesures, les walls du S&P ont cédé dans l'heure lors d'environ un test sur trois, en long gamma comme en short gamma. Ce que le régime change, c'est la suite - en short gamma, un put wall qui cède peut devenir un point de glissement.
- **« Le S/R basé sur les options ne fonctionne pas. »** Il localise un positionnement réel, et selon nos mesures, les walls du S&P ont tenu environ deux fois sur trois dans l'heure. Ce qu'il ne vous donne pas, c'est un moyen de savoir à l'avance quel wall va céder : le régime, le Net GEX, la migration et le flux au strike ne l'ont pas permis.

---

## À retenir

> Le support et la résistance basés sur les options relèvent de la mécanique, pas de la psychologie. Ils identifient les niveaux où la couverture des dealers est la plus susceptible de se déclencher - et le régime modélisé vous indique si ce flux tend à absorber le mouvement ou à l'amplifier.

La discipline consiste à lire d'abord la carte structurelle, à la recouper avec les niveaux graphiques pour vérifier la convergence, puis à vérifier le régime avant de décider quoi faire du niveau. L'essentiel du « bruit » apparent dans le S/R graphique retail correspond à l'écart entre l'endroit où les graphiques indiquent que le niveau se trouve et l'endroit où le positionnement le place réellement.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le call wall, le put wall, le gamma flip et le gamma magnet du jour pour SPY, SPX, QQQ et NDX - les quatre niveaux structurels qui pilotent l'essentiel du S/R basé sur les options - la vue gratuite gamma-levels de ZeroGEX les affiche.
