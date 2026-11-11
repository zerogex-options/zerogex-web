# Les gamma walls expliqués : ce qu'est un gamma wall et comment le prix réagit

*Les gamma walls sont les niveaux les plus surveillés dans l'analyse du positionnement des dealers. Ce qu'est un gamma wall, ce que fait chaque wall dans chaque régime, ce que vous dit l'écart qui les sépare, comment ils se comportent à l'approche de l'échéance du jour, et quand la lecture tient ou cède.*

---

## Qu'est-ce qu'un gamma wall ?

Un **gamma wall** est un strike de la chaîne d'options où l'exposition gamma modélisée des dealers est fortement concentrée. Le positionnement en options y est inhabituellement dense, si bien que la couverture que les dealers sont susceptibles d'effectuer autour de ce niveau peut être plus importante qu'aux strikes voisins. Il y en a deux : le **call wall**, la plus forte concentration de gamma call au-dessus du spot, et le **put wall**, la plus forte concentration de gamma put en dessous. Ensemble, ils encadrent le spot, et les traders les lisent souvent comme les bornes extérieures de la fourchette la plus cohérente avec le positionnement actuel.

Un wall est dérivé de l'open interest, contrat par contrat, pondéré par le gamma que porte chaque contrat. Ce n'est ni une moyenne mobile, ni une ligne de tendance, ni un chiffre rond.

Aucun des deux walls n'est un support ou une résistance par construction. Rien n'oblige qui que ce soit à traiter à un strike, et la couverture n'est qu'une source de flux d'ordres parmi bien d'autres. Ce que fait la couverture à un wall dépend du *signe* du gamma modélisé des dealers et du flux qui l'entoure, pas du fait que les contrats qui s'y trouvent soient des calls ou des puts. La façon défendable de le voir : un wall marque l'endroit où une réaction est plus probable qu'à un strike pris au hasard, et à lui seul il ne dit rien de la direction.

Le reste de cette page en constitue le volet pratique, c'est-à-dire les éléments qui déterminent si le niveau est utile un jour donné : ce que fait chaque wall dans chaque régime, ce que vous dit la distance qui les sépare, comment ils se comportent à l'approche de l'échéance du jour, comment ils migrent, et à quelle fréquence les walls tiennent ou cèdent réellement. Pour le contexte de régime qui sous-tend tout cela, associez cette lecture à [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip) et au [pilier plus large sur le Gamma Exposure](/education/gamma-exposure-explained).

---

## Qu'est-ce qu'un call wall ?

Le call wall est le strike au-dessus du spot qui porte la plus forte exposition gamma sur les calls. Selon la convention traditionnelle, les dealers sont *modélisés* comme longs de ces calls, si bien qu'en régime de gamma positif ils tendent à vendre dans les rallyes qui s'approchent du wall - en se délestant du delta positif qu'ils accumulent à mesure que le prix monte vers celui-ci. Ce réflexe de couverture peut faire pression contre le rallye.

En pratique, le call wall agit souvent comme une **résistance** - non pas parce que le niveau serait magique, ni simplement parce qu'il s'agit d'un strike call. Dans des conditions de gamma positif, le flux de couverture modélisé autour de lui tend à s'opposer au mouvement ; changez le signe du gamma, et cette couverture accompagne au contraire le mouvement.

À savoir :

- Le wall est la concentration *actuellement* la plus lourde. À mesure que l'OI évolue, le wall se déplace.
- Dans les régimes long gamma (spot au-dessus du gamma flip), la couverture autour du wall s'oppose à un rallye. Dans les régimes short gamma, elle l'accompagne, de sorte que, si le niveau cède, il peut passer du rôle de résistance à celui d'accélérateur de breakout. Le régime change ce comportement, pas la fréquence à laquelle le wall cède.
- Un call wall est une inclinaison **probabiliste**, pas un plafond rigide. Un flux réel peut le percer.

---

## Qu'est-ce qu'un put wall ?

Le put wall est le strike en dessous du spot qui porte la plus forte exposition gamma sur les puts. Quand le book net est modélisé comme long gamma (un régime de Net GEX positif), la couverture agrégée des dealers tend à acheter la faiblesse et à vendre la force - de sorte qu'à mesure que le prix chute vers un strike put dense, ce réflexe d'achat sur repli peut s'opposer au selloff. Ce comportement provient toutefois du signe du gamma *net*, pas du fait que le strike soit constitué de puts.

En pratique, le put wall agit souvent comme un **support**. Comme pour le call wall, que la couverture autour de lui amortisse une baisse, ancre le prix ou accélère une cassure dépend du signe du gamma modélisé des dealers et du flux environnant - pas du type d'option.

À savoir :

- Le wall est dynamique. Un OI important qui s'éteint à l'approche de l'échéance peut effacer un put wall d'ici la mi-journée.
- Dans un régime short gamma, le comportement des dealers s'inverse - la couverture cesse d'absorber la faiblesse, et si le put wall cède, il peut devenir un point de glissement (slippage) à la baisse.
- Un put wall est une inclinaison. Chocs macro, expansion de la volatilité et réajustements de la chaîne peuvent tous prendre le pas sur la lecture structurelle.

---

## Pourquoi le prix réagit aux gamma walls

Le mécanisme est la couverture des dealers, pas la psychologie. La façon la plus claire de le voir :

Dans un régime de **gamma positif**, les dealers tendent à se couvrir *contre* le mouvement du prix. Ils vendent quand le prix monte et achètent quand il baisse. Près d'un wall, ce réflexe peut s'intensifier, car la concentration de gamma y est localement importante - un petit mouvement vers le wall peut appeler un trade de couverture relativement plus important en sens inverse. Cela suppose que le signe du gamma modélisé des dealers se maintienne autour de ce strike, ce qui explique pourquoi un même wall peut se comporter différemment quand le flux environnant ou le signe net change.

Dans un régime de **gamma négatif**, le réflexe s'inverse. Les dealers tendent à se couvrir *dans le même sens* que le mouvement du prix. Le même wall qui ancrait le prix en long gamma peut devenir un vecteur de breakout - une fois que le prix le franchit, le trade de couverture renforce le mouvement au lieu de l'atténuer.

Un gamma wall n'est pas une propriété fixe de la chaîne. C'est un *niveau* fixe dont l'effet de couverture dépend du **régime qui l'entoure** - ce qui est précisément ce qu'indique le gamma flip. Ce que le régime ne décide pas, c'est si le wall tient : sur les 737 tests de walls que nous avons mesurés, les walls du S&P ont tenu environ deux fois sur trois dans l'heure et ceux du Nasdaq environ une fois sur deux, d'un côté comme de l'autre du flip ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)).

---

## Gamma walls, gamma flip et max pain

Ces trois niveaux sont construits différemment et répondent à des questions différentes :

- Le **gamma flip** est l'endroit où le gamma modélisé des dealers change de signe. Il fixe le régime qui décide si la couverture autour des walls s'oppose à un mouvement ou le renforce. Voir [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip)
- Le **max pain** est un calcul de valeur à l'échéance : le strike auquel les options ouvertes sur cette échéance porteraient la plus faible valeur intrinsèque totale. Ce n'est pas une concentration de gamma, il peut donc se situer bien à l'écart de l'un comme de l'autre wall. Voir [Le Max Pain expliqué](/education/max-pain-explained).
- Les **walls** sont les deux strikes les plus denses en gamma de part et d'autre du spot.

---

## Ce que vous dit la distance entre les walls

Les deux walls portent davantage d'information ensemble que chacun pris isolément. L'écart qui les sépare correspond à la fourchette la plus cohérente avec le positionnement actuel, et sa forme se lit de deux façons.

**Largeur.** Une fourchette de walls étroite signifie que le gamma est concentré près du spot des deux côtés. En régime de gamma positif, c'est la configuration classique de pinning - la couverture s'oppose aux mouvements dans les deux sens. Une fourchette large signifie que les strikes denses les plus proches sont éloignés, donc il y a moins de couverture concentrée entre les deux et le prix peut parcourir plus de chemin avant d'en rencontrer.

**Asymétrie.** Le spot se situe rarement au milieu. Quand un wall est bien plus proche que l'autre, le wall proche est le niveau qui est réellement testé et le lointain n'est surtout qu'un contexte. Un spot à 0,3 % sous le call wall et à 1,4 % au-dessus du put wall, ce n'est pas la même journée qu'un spot à mi-chemin entre les deux : le premier comporte un point de décision à court terme, le second non.

Le piège est de lire la largeur ou l'asymétrie sans le régime. Les deux lectures ci-dessus supposent un gamma positif. Sous le flip, cette même fourchette étroite n'est pas un pin - c'est une courte distance entre deux niveaux, et la couverture renforcera un mouvement qui franchit l'un ou l'autre. Pour appliquer les trois lectures - largeur, asymétrie et régime - au marché du jour, consultez le [gamma flip, le call wall et le put wall actuels du SPX](/spx-gamma-levels).

---

## Comment les gamma walls se déplacent en séance

Les walls ne sont pas annoncés à l'ouverture pour tenir jusqu'à la clôture. Ils migrent, pour deux raisons distinctes. Entre les séances, l'open interest change à mesure que des positions s'ouvrent et se ferment, et les chiffres officiels sont mis à jour après compensation. En cours de séance, cet open interest restant fixe, le classement des strikes évolue tout de même à mesure que le gamma porté par chaque contrat se revalorise. Trois schémas courants :

1. **Revalorisation du gamma.** Le spot, le temps restant jusqu'à l'échéance et la volatilité implicite modifient le gamma modélisé de chaque strike et peuvent changer le classement même lorsque l'OI officiel reste inchangé.
2. **Éligibilité selon le côté du spot.** Un strike peut passer d'un côté du spot à l'autre, tandis qu'un autre strike à OI inchangé devient la plus grande concentration éligible. L'OI officiel est généralement mis à jour après compensation ; la migration intraday d'un wall n'établit pas que des clients ont ouvert des positions sur le nouveau strike.
3. **Concentration à l'approche de l'échéance.** Le gamma ATM peut fortement augmenter tandis que celui des strikes nettement ITM ou OTM tend vers zéro, ce qui modifie le classement. Cette revalorisation est distincte de la clôture de positions et de la mise à jour de l'OI officiel après compensation.

Un wall peut aussi se déplacer uniquement parce que le spot, le temps et la volatilité implicite bougent - le strike portant le plus d'exposition modélisée change même quand le positionnement, lui, ne change pas. Un gamma wall est le strike le plus chargé en gamma modélisé *à cet instant*. Traitez-le comme une lecture en direct, pas comme une ligne fixe.

---

## Les gamma walls à l'approche de l'échéance du jour

Le 0DTE est le terrain où le comportement des walls est le plus extrême, dans les deux sens.

Le gamma sur une chaîne du jour même est très important près du spot et décroît rapidement en s'en éloignant, si bien que les walls se collent au prix et que la concentration qui s'y trouve est bien plus lourde que sur une chaîne à échéance plus longue. Quand le régime le permet, cela produit le pinning le plus fort que vous ayez des chances d'observer - un prix qui avance péniblement dans une bande étroite entre deux walls distants de quelques points seulement.

Cette même concentration rend ces walls instables. Comme le gamma 0DTE se revalorise brutalement à mesure que le spot bouge et que l'horloge tourne, un wall 0DTE peut migrer plusieurs fois en une heure sans qu'une seule position nouvelle soit ouverte. Les walls peuvent aussi disparaître : à mesure que des strikes passent nettement dans ou hors de la monnaie, leur gamma modélisé tend vers zéro et le classement se réorganise autour de ce qui reste près du spot.

Deux conséquences pratiques. Une lecture de wall 0DTE a une durée de vie bien plus courte que la même lecture sur une chaîne mensuelle - des minutes plutôt que des heures. Et une fois que le prix a franchi un wall 0DTE en régime de gamma négatif, il reste souvent peu de gamma dense entre celui-ci et le niveau suivant, ce qui explique en partie pourquoi les cassures de fin de séance les jours d'échéance peuvent aller si loin, si vite.

---

## Quand les walls tiennent et quand ils cèdent

Les walls ne sont pas des prédictions, et nous avons mesuré à quelle fréquence ils cèdent. Sur 737 tests de walls observés sur SPY, SPX, QQQ et NDX pendant dix semaines en 2026, les walls du S&P ont tenu environ deux fois sur trois dans l'heure suivant le test et ceux du Nasdaq environ une fois sur deux ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)). Ce taux de base propre à l'indice est la meilleure estimation a priori dont on dispose, et aucune des conditions auxquelles les traders ont habituellement recours n'a fait mieux :

**Conditions testées qui n'ont pas permis de prédire une cassure :**

- Le côté du flip où se trouvait le spot - gamma positif ou négatif.
- La taille du wall, sa part du book et son rang par rapport à son propre historique. Les walls plus gros ont cédé un peu moins souvent, mais l'écart était trop faible pour se distinguer du bruit.
- Le Net GEX, sa trajectoire et la distance au flip.
- La migration éventuelle du wall avec le prix, et le renforcement ou la consommation de son gamma.
- Le flux signé au strike du wall, son éventuelle accélération, et la volatilité réalisée.
- L'ancienneté du wall, le nombre de fois où il avait été testé, et l'heure de la journée.

**Ce que le régime change, en revanche :**

- En gamma positif (au-dessus du flip), la couverture modélisée s'oppose à un mouvement vers le wall, ce qui peut le ralentir ou ancrer le prix près du strike.
- En gamma négatif (sous le flip), la couverture modélisée accompagne le mouvement, de sorte que, si le wall cède, la couverture renforce la cassure au lieu de l'atténuer.

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
- **Net GEX :** +1,5 Md$
- **Gamma Flip :** 5 810

Le Net GEX est ici une estimation modélisée du gamma des dealers, calculée selon la convention traditionnelle d'open interest call-positif / put-négatif ; l'inventaire réel des dealers n'est pas directement observable à partir des données publiques de la chaîne d'options. La lecture structurelle : le spot est confortablement au-dessus du flip (régime long gamma), la fourchette des walls est asymétrique - bien plus proche du call wall que du put wall - et le Net GEX est sain. Ce que cela vous dit : le call wall est le test le plus proche, et un rallye vers ce niveau se heurte à une couverture qui, d'après le modèle, s'oppose au mouvement. Ce que cela ne vous dit pas, c'est si 5 850 va tenir. Selon nos mesures, les walls du SPX ont tenu environ deux fois sur trois dans l'heure, quel que soit le côté du flip où se trouvait le prix. Une chute sous 5 810 changerait le mécanisme, pas ces probabilités : la couverture se mettrait à renforcer les mouvements au lieu de les amortir.

![Graphique GEX walls de ZeroGEX mettant en évidence le call wall et le put wall sur le profil gamma strike par strike](/blog/zerogex-walls-chart.png)

Imaginez maintenant que le call wall migre à la hausse jusqu'à 5 855 pendant que le prix sonde 5 848. Cette migration est une donnée - le strike que vous surveilliez n'est plus le plus lourd, donc le niveau contre lequel vous tradez s'est déplacé. Elle ne constitue pas, à elle seule, le signe que la cassure va durer : selon nos mesures, le fait qu'un wall migre ou non avec le prix ne permettait pas de prédire s'il allait céder.

---

## Idées reçues courantes

Quelques pièges :

- **« Les walls sont des supports/résistances durs. »** Ce sont des inclinaisons structurelles. Un flux réel les brise régulièrement : selon nos mesures, environ un test sur trois dans l'heure pour les walls du S&P, et environ un sur deux pour ceux du Nasdaq.
- **« Le strike avec le plus gros open interest est toujours le wall. »** Les walls sont pondérés par l'exposition gamma, pas par l'OI brut. Un strike proche de l'ATM peut dominer un strike très OTM avec deux fois plus d'open interest.
- **« Les walls sont statiques pendant la séance. »** Ils migrent. Un wall qui n'a pas bougé en deux heures est une lecture ; un wall qui a dérivé avec le prix à trois reprises en est une tout autre.
- **« Les walls fonctionnent de la même façon quel que soit le régime. »** La couverture, non : elle s'oppose à un mouvement vers le wall en gamma positif, et renforce un mouvement qui le franchit en gamma négatif. Selon nos mesures, la fréquence à laquelle les walls ont cédé n'a pas varié avec le régime ; ce qui change, c'est ce que fait la couverture autour de la cassure.
- **« Le call wall est haussier, le put wall est baissier. »** Aucun des deux n'est directionnel, et le type d'option ne détermine pas à lui seul le comportement. Ce sont des niveaux de concentration de gamma dont l'effet dépend du signe du gamma modélisé des dealers et du flux environnant - autrement dit, du côté du flip où l'on se trouve.

---

## À retenir

> Les gamma walls représentent un positionnement réel, pas de la psychologie. Ils dessinent la fourchette structurelle, et le gamma flip vous dit si la couverture autour de ces walls s'oppose aux mouvements ou les renforce. Qu'un wall donné tienne ou non relève d'un taux de base, pas d'une lecture : environ deux tests sur trois dans l'heure pour les walls du S&P, environ un sur deux pour ceux du Nasdaq.

Lisez d'abord le régime. Lisez ensuite le wall. Lisez en troisième lieu la migration du wall. Cette séquence vous dit ce que fait la couverture des dealers autour du niveau - c'est la différence entre fader un rallye que le book du dealer fade avec vous, et fader un rallye que ce même book de dealer s'apprête à poursuivre. Elle ne vous dit pas si ce wall en particulier va tenir ; pour cela, le taux de base de l'indice est le meilleur repère que nous ayons mesuré.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le call wall et le put wall du jour, [les niveaux gamma gratuits de ZeroGEX](/gex-levels) affichent les deux pour SPX, SPY, QQQ, NDX, ES et NQ aux côtés du gamma flip et du net GEX, avec un décalage d'environ 15 minutes ; les formules payantes les affichent [sur le tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte). Pour une vue d'ensemble plus large des outils de gamma exposure, consultez [le guide des meilleurs outils GEX](/education/best-gex-tools).
