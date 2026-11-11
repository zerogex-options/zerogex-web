# Le positionnement des dealers en 0DTE expliqué

*Les options 0DTE représentent une large part de l'activité sur SPX et peuvent dominer la sensibilité gamma près du spot lors de certaines séances. Leur impact net sur les dealers reste modélisé, et non observable à partir du volume brut ou de l'OI.*

---

## Pourquoi 0DTE change la lecture

Les options 0DTE représentent une large part de l'activité de trading sur SPX et peuvent dominer la sensibilité gamma près du spot lors de certaines séances. À l'approche de l'expiration, le gamma ATM peut augmenter fortement tandis que celui des strikes devenus nettement ITM ou OTM tend vers zéro. L'impact net réel sur les dealers dépend des achats et des ventes des clients, que le volume brut et l'OI ne révèlent pas.

Isoler le 0DTE peut apporter un contexte intraday utile, car les options du jour même peuvent porter un gamma très élevé près du spot. Leur impact net réel sur la couverture des dealers dépend des achats et des ventes des clients, que le volume public brut et l'OI ne révèlent pas.

Cet article est la lecture pratique de ce que signifient réellement, en temps réel, « positionnement des dealers 0DTE » et « gamma des dealers 0DTE ». Nous verrons pourquoi le bucket 0DTE compte davantage que le regroupement par échéances plus longues, ce qui change entre les régimes de gamma négatif et positif spécifiquement pour le 0DTE, et comment lire le tape différemment dans chaque cas. Associez cet article à [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip) pour la ligne de régime elle-même, [Les gamma walls expliqués](/education/gamma-walls-explained) pour les niveaux frontières, et le [pilier Gamma Exposure](/education/gamma-exposure-explained) pour le contexte structurel complet.

---

## Qu'est-ce que le positionnement des dealers en 0DTE ?

Le positionnement des dealers en 0DTE est l'exposition gamma agrégée que les dealers portent sur des options expirant le jour même. Mécaniquement, ce n'est pas différent du gamma des dealers à échéances plus longues - selon la convention standard, les dealers sont *modélisés* comme longs des calls que les clients leur vendent en overwriting et short des puts que les clients achètent pour se protéger, de sorte que leur inventaire de calls longs contribue un gamma positif tandis que leur inventaire de puts short contribue un gamma négatif (le signe négatif est la position short modélisée, non le fait que les puts seraient à gamma négatif en eux-mêmes). Le réflexe de couverture est le même : maintenir un delta neutre, trader le sous-jacent à mesure que le gamma évolue.

> Ce signe de dealer est une convention modélisée, non un inventaire observé - le positionnement réel n'est pas directement observable à partir de l'open interest public.

Ce qui rend le 0DTE différent, c'est la **densité de gamma**. Les options du jour même portent leur gamma le plus élevé précisément à la monnaie, et le gamma par contrat évolue à peu près en `1/√T`. Avec `T` mesuré en fractions de jour, ce dénominateur est petit - et le gamma par contrat devient très élevé. Toutes choses égales par ailleurs, un contrat 0DTE à la monnaie peut porter nettement plus de gamma qu'un contrat à échéance plus longue, mais le ratio dépend de la volatilité, de la moneyness, des taux et du temps restant précis.

L'implication pratique : le bucket 0DTE peut contribuer de façon disproportionnée à la sensibilité modélisée de la couverture intraday des dealers. Même lorsque l'open interest total est dominé par des strikes à échéances plus longues, l'exposition *pondérée par le gamma* près du spot est souvent une affaire de 0DTE.

---

## Pourquoi le positionnement 0DTE peut compter en intraday

Trois facteurs se cumulent pour le 0DTE d'une manière qui ne se produit pas de la même façon pour les échéances plus longues :

1. **Concentration du gamma.** Les options du jour même portent un gamma très élevé à la monnaie. Les trades de couverture contre ce gamma sont importants par unité de mouvement, ce qui rend mécaniquement plus bruyante l'action du prix près du spot.
2. **Décroissance du charm.** À mesure que les options 0DTE approchent de l'expiration, leur delta dérive vers 0 (hors de la monnaie) ou ±1 (dans la monnaie - +1 pour les calls, −1 pour les puts), à spot et vol constants. Les dealers qui gèrent un book delta-neutre ont tendance à couvrir de nouveau cette dérive à l'approche de la clôture. Ce flux a un signe modélisé - et il est estimable à l'avance.
3. **Physique du pin.** La même concentration de gamma qui fait que le 0DTE fait beaucoup bouger les dealers à chaque tick permet aussi au strike 0DTE le plus lourd d'agir comme un aimant dans un régime long-gamma. Le comportement de pin a tendance à être plus marqué sur le 0DTE que sur des setups pluri-journaliers.

Aucun de ces mécanismes n'est propre au 0DTE - ils s'appliquent à toute option à courte échéance. Ils sont simplement inhabituellement bruyants dans le bucket 0DTE en raison de la compression extrême de `T`.

---

## Régimes 0DTE de gamma négatif

Lorsque les dealers sont nets short en gamma - typiquement lorsque le spot est sous le gamma flip - le flux 0DTE devient rapidement bruyant.

Ce que fait le réflexe :

- Un mouvement à la hausse tend à amener les dealers à *acheter*, amplifiant le mouvement.
- Un mouvement à la baisse tend à amener les dealers à *vendre*, amplifiant le mouvement.
- La volatilité intraday réalisée tend à s'accroître.
- Un wall qui cède peut s'inverser en accélérateur, la couverture renforçant la cassure.
- Le comportement de pin près du strike 0DTE le plus lourd s'affaiblit ou s'inverse.

À quoi ressemble généralement le tape :

- Fourchettes plus larges, breakouts plus rapides.
- Le risque de continuation peut être plus élevé qu'un modèle long-gamma ne le laisserait supposer.
- Les entrées en mean-reversion peuvent se heurter à un flux de couverture modélisé qui renforce le mouvement.
- Les mouvements directionnels et les variations de volatilité implicite peuvent compenser la décroissance rapide du theta ; le comportement des primes ne dépend pas du seul signe du gamma.

L'inclination pratique dans un régime 0DTE à gamma court est **d'accompagner le mouvement, pas de le contrer**. Les setups de continuation de tendance peuvent être plus cohérents avec le réflexe de couverture modélisé ; il s'agit d'une inclination conditionnelle liée à la structure de marché, pas d'une affirmation sur un taux de réussite démontré.

---

## Régimes 0DTE de gamma positif

Lorsque les dealers sont nets long en gamma - typiquement lorsque le spot est au-dessus du gamma flip - le flux 0DTE tend à se comprimer.

Ce que fait le réflexe :

- Un mouvement à la hausse tend à amener les dealers à *vendre*, amortissant le mouvement.
- Un mouvement à la baisse tend à amener les dealers à *acheter*, amortissant le mouvement.
- La volatilité intraday réalisée tend à se comprimer.
- La couverture autour des walls s'oppose aux mouvements dirigés vers eux.
- Le comportement de pin près du strike 0DTE le plus lourd se renforce à l'approche de la clôture.

À quoi ressemble généralement le tape :

- Fourchettes plus étroites et plus de chop, avec une couverture qui s'oppose aux breakouts.
- Comportement d'attraction vers le strike le plus lourd, surtout après 14h00 ET.
- La décroissance rapide du theta peut peser sur les primes des options du jour même, mais les mouvements du spot et de la volatilité implicite peuvent l'emporter.
- Les setups de mean-reversion peuvent être plus cohérents avec le réflexe de couverture modélisé que les setups de continuation de tendance.

L'inclination pratique dans un régime 0DTE à gamma long est **de jouer contre le breakout, avec le pin**. Les rallyes vendus à l'approche du call wall, les achats sur repli à l'approche du put wall, et les structures à prime courte s'appuient tous sur le réflexe amortisseur.

---

## Comment lire le tape différemment selon le régime

Quelques habitudes qui changent entre les deux régimes :

**Dans un régime 0DTE à gamma négatif :**

- Laissez plus de marge aux breakouts de la fourchette récente, surtout lorsque le Net GEX est fortement négatif : si un niveau cède, la couverture renforce le mouvement.
- Ne traitez pas les walls 0DTE comme des plafonds : si l'un d'eux cède, la couverture renforce le mouvement au lieu de s'y opposer.
- Méfiez-vous des setups « ça va pinner » - le réflexe des dealers ne tire pas dans ce sens.
- Si des mesures de volatilité indépendantes confirment une séance à fourchette plus large, dimensionnez le risque en conséquence ; le signe du gamma modélisé ne prescrit pas à lui seul un stop.

**Dans un régime 0DTE à gamma positif :**

- Attendez-vous à ce que les mouvements vers les strikes concentrés en 0DTE se heurtent à une couverture qui s'y oppose.
- Traitez le strike au gamma le plus lourd comme un aimant, surtout à l'approche de la clôture.
- Méfiez-vous des breakouts - la couverture s'y oppose, et les breakouts avortés peuvent mettre dix ou quinze minutes à se défaire.
- Des stops plus serrés sont plus raisonnables ; les fourchettes sont plus contenues.

**Dans tous les régimes :**

- Vérifiez si le spot est proche du gamma flip. Un régime contesté est le pire régime dans lequel s'engager sur l'un ou l'autre playbook.
- Vérifiez si le strike 0DTE le plus lourd est en train de migrer. Un strike lourd statique est un candidat au pin plus solide qu'un strike en migration.
- Suivez le Net GEX en tant que magnitude, pas seulement en tant que signe. Un basculement de −2 Md$ à +200 M$ est une lecture très différente d'un basculement de +2 Md$ à +200 M$.

---

## Lire le positionnement des dealers en 0DTE sur ZeroGEX

Le dashboard fait ressortir des lectures spécifiques au 0DTE à plusieurs endroits :

- **La carte Net GEX** affiche le gamma des dealers évalué au spot (cohérent en signe avec le flip), vous donnant la magnitude du régime actuel.
- **La heatmap GEX par strike et par DTE** décompose le gamma par bucket d'échéance afin que vous puissiez voir quelle part du positionnement du jour est portée par le 0DTE et où se situent les strikes du jour même les plus lourds.
- **Les cartes wall et flip** affichent les niveaux structurels du jour avec la distance en direct par rapport au spot.

![Heatmap GEX par strike et par DTE de ZeroGEX avec le bucket 0DTE concentré près du spot](/blog/zerogex-strike-dte-heatmap.png)

Un exemple concret. Supposons que le SPX soit à 5 825, que le Net GEX affiche −800 M$, que le gamma flip se situe à 5 840, et que la heatmap montre un strike put 0DTE lourd à 5 820 qui migre à la baisse avec le prix depuis toute la matinée. La lecture structurelle : les dealers sont short en gamma, le spot est sous le flip, et le strike 0DTE le plus lourd suit le mouvement plutôt que de le retenir.

Inclination pratique : il s'agit d'un régime à gamma court, favorable à la continuation, et le strike put le plus lourd migre avec le prix, si bien que le niveau sur lequel un fade s'appuierait ne cesse de se déplacer. Un trader entré en séance avec un biais de mean-reversion devrait se montrer beaucoup plus prudent ici, car la couverture accompagne le mouvement au lieu de s'y opposer. Rien de tout cela n'est un signal de trade - c'est un contexte de régime qui devrait remodeler les entrées que vous prenez au sérieux.

![Cartes Net GEX et Gamma Flip de ZeroGEX montrant une lecture intraday de gamma négatif](/blog/zerogex-net-gex-flip-card.png)

---

## Erreurs courantes dans la lecture du gamma des dealers en 0DTE

Une courte liste des façons dont le positionnement des dealers en 0DTE est mal interprété :

- **Utiliser le gamma sur l'ensemble de l'OI dans une chaîne dominée par le 0DTE.** Si l'essentiel du gamma du jour est en 0DTE et que vous lisez le gamma agrégé sur l'OI, votre lecture fait la moyenne entre un book proche de l'expiration et un book à échéance lointaine qui n'a pas d'importance pour le tape du jour.
- **Dimensionner un fade sur un wall de la même façon dans les deux régimes.** Selon nos mesures, les walls ont cédé à peu près aussi souvent dans un régime que dans l'autre, mais en gamma négatif, un wall qui cède voit la couverture renforcer la cassure, si bien qu'un fade raté peut aller beaucoup plus loin.
- **Ignorer le régime et trader le niveau.** Le spot au put wall est un trade au-dessus du flip, et un trade très différent en dessous.
- **Ignorer la migration.** Un strike 0DTE lourd qui a bougé deux fois au cours de la dernière heure constitue une lecture différente d'un strike resté statique toute la matinée.
- **Traiter le comportement de pin en 0DTE comme garanti.** C'est une inclination, pas une promesse. Les catalyseurs et les chocs de flux brisent régulièrement le pin.

---

## À retenir

> Le 0DTE a changé la partie du book modélisé des dealers qui peut compter en intraday. Le positionnement total compte, et le *bucket 0DTE* peut dominer la sensibilité près du spot lors de certaines séances.

La discipline reste la même que pour toute lecture de positionnement des dealers - commencer par le régime, puis lire la structure à l'intérieur de celui-ci - mais le bucket 0DTE peut porter une large part de la sensibilité près du spot pendant la séance cash : il faut donc l'évaluer plutôt que supposer qu'il domine.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le positionnement des dealers du jour (le régime, les call et put walls et le profil de gamma des dealers), [les pages gratuites gamma-levels de ZeroGEX](/spx-gamma-levels) l'affichent pour SPX, SPY, QQQ et NDX, avec un décalage d'environ 15 minutes. Les formules payantes affichent la même lecture [sur le tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte), et le filtre Expirations de la page Dealer Positioning isole les strikes du jour même les plus lourds.
