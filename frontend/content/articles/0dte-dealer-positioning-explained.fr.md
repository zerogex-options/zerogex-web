# Le positionnement des dealers en 0DTE expliqué

*Les échéances du jour même dominent désormais le flux sur SPX. Cela change la manière de lire la gamma des dealers — et la manière dont il faut lire le tape pour suivre le rythme. Le positionnement des dealers en 0DTE, expliqué pour le trader intraday pragmatique.*

---

## Pourquoi 0DTE change la lecture

Le positionnement des dealers a toujours compté pour les traders d'options. Ce qui a changé ces dernières années, c'est la **domination du flux 0DTE** sur SPX et SPY. Les échéances du jour même représentent désormais une part disproportionnée de l'exposition gamma totale, et comme leur gamma est concentrée près du spot et se décompose vers la clôture, le comportement de couverture des dealers qu'elle impose est plus brutal, plus réactif et plus dépendant du régime que n'importe quelle structure de chaîne antérieure.

Si vous tradez le SPX pendant la séance cash sans lire le positionnement des dealers à travers le prisme du 0DTE, vous lisez un carnet obsolète.

Cet article est la lecture pratique de ce que signifient réellement, en temps réel, « positionnement des dealers 0DTE » et « gamma des dealers 0DTE ». Nous verrons pourquoi le bucket 0DTE compte davantage que le regroupement par échéances plus longues, ce qui change entre les régimes de gamma négative et positive spécifiquement pour le 0DTE, et comment lire le tape différemment dans chaque cas. Associez cet article à [Comment lire un gamma flip](/education/how-to-read-a-gamma-flip) pour la ligne de régime elle-même, [Les gamma walls expliqués](/education/gamma-walls-explained) pour les niveaux frontières, et le [pilier Gamma Exposure](/education/gamma-exposure-explained) pour le contexte structurel complet.

---

## Qu'est-ce que le positionnement des dealers en 0DTE ?

Le positionnement des dealers en 0DTE est l'exposition gamma agrégée que les dealers portent sur des options expirant le jour même. Mécaniquement, ce n'est pas différent de la gamma des dealers à échéances plus longues — les calls vendus à découvert par les dealers contribuent positivement à la gamma des dealers, les puts vendus à découvert y contribuent négativement, et le réflexe de couverture est le même : maintenir un delta neutre, tradant le sous-jacent à mesure que la gamma évolue.

Ce qui rend le 0DTE différent, c'est la **densité de gamma**. Les options du jour même portent leur gamma la plus élevée précisément à la monnaie, et la gamma par contrat évolue à peu près en `1/√T`. Avec `T` mesuré en fractions de jour, ce dénominateur est petit — et la gamma par contrat devient très élevée. Un strike 0DTE proche du spot peut dépasser d'un ordre de grandeur un strike mensuel au même niveau.

L'implication pratique : le bucket 0DTE dicte de façon disproportionnée la couverture intraday des dealers. Même lorsque l'open interest total est dominé par des strikes à échéances plus longues, l'exposition *pondérée par la gamma* près du spot est souvent une affaire de 0DTE.

---

## Pourquoi le positionnement des dealers compte le plus pour le 0DTE

Trois facteurs se cumulent pour le 0DTE d'une manière qui ne se produit pas de la même façon pour les échéances plus longues :

1. **Concentration de la gamma.** Les options du jour même portent une gamma très élevée à la monnaie. Les trades de couverture contre cette gamma sont importants par unité de mouvement, ce qui rend mécaniquement plus bruyante l'action du prix près du spot.
2. **Décroissance du charm.** À mesure que les options 0DTE approchent de l'expiration, leur delta dérive de manière prévisible vers 0 ou 1 selon la moneyness. Les dealers gérant un carnet delta-neutre doivent se recouvrir en continu jusqu'à la clôture. Ce flux forcé a un signe — et il est directement lisible.
3. **Physique du pin.** La même concentration de gamma qui fait beaucoup bouger les dealers 0DTE à chaque tick transforme aussi le strike 0DTE le plus lourd en aimant dans un régime de gamma longue. Le comportement de pin a tendance à être plus marqué sur le 0DTE que sur des setups pluri-journaliers.

Aucun de ces mécanismes n'est propre au 0DTE — ils s'appliquent à toute option à courte échéance. Ils sont simplement inhabituellement bruyants dans le bucket 0DTE en raison de la compression extrême de `T`.

---

## Régimes 0DTE de gamma négative

Lorsque les dealers sont nets short en gamma — typiquement lorsque le spot est sous le gamma flip — le flux 0DTE devient rapidement bruyant.

Ce que fait le réflexe :

- Un mouvement à la hausse force les dealers à *acheter*, amplifiant le mouvement.
- Un mouvement à la baisse force les dealers à *vendre*, amplifiant le mouvement.
- La volatilité intraday réalisée tend à s'accroître.
- Les walls deviennent moins fiables en tant que résistance et support — ils peuvent s'inverser en objectifs de breakout.
- Le comportement de pin près du strike 0DTE le plus lourd s'affaiblit ou s'inverse.

À quoi ressemble généralement le tape :

- Fourchettes plus larges, breakouts plus rapides.
- Mouvements de continuation plus fréquents que les retournements.
- Les entrées en mean-reversion à contre-tendance se font souvent balayer.
- Les primes des options du jour même tendent à s'élargir en intraday plutôt qu'à se comprimer.

L'inclination pratique dans un régime 0DTE à gamma courte est **d'accompagner le mouvement, pas de le contrer**. Les setups de continuation de tendance affichent généralement de meilleurs taux de réussite ; s'opposer à la tendance dans la concentration 0DTE revient à lutter structurellement contre le réflexe des dealers.

---

## Régimes 0DTE de gamma positive

Lorsque les dealers sont nets long en gamma — typiquement lorsque le spot est au-dessus du gamma flip — le flux 0DTE tend à se comprimer.

Ce que fait le réflexe :

- Un mouvement à la hausse force les dealers à *vendre*, amortissant le mouvement.
- Un mouvement à la baisse force les dealers à *acheter*, amortissant le mouvement.
- La volatilité intraday réalisée tend à se comprimer.
- Les walls se comportent davantage comme une véritable résistance et un véritable support.
- Le comportement de pin près du strike 0DTE le plus lourd se renforce à l'approche de la clôture.

À quoi ressemble généralement le tape :

- Fourchettes plus étroites, plus de chop, plus de breakouts avortés.
- Comportement d'attraction vers le strike le plus lourd, surtout après 14h00 ET.
- Les primes des options du jour même tendent à s'éroder.
- Les setups de mean-reversion affichent généralement de meilleurs taux de réussite que ceux de continuation de tendance.

L'inclination pratique dans un régime 0DTE à gamma longue est **de jouer contre le breakout, avec le pin**. Les rallyes vendus à l'approche du call wall, les achats sur repli à l'approche du put wall, et les structures à prime courte bénéficient tous du réflexe amortisseur.

---

## Comment lire le tape différemment selon le régime

Quelques habitudes qui changent entre les deux régimes :

**Dans un régime 0DTE à gamma négative :**

- Prenez plus au sérieux les breakouts de la fourchette récente, surtout lorsque le Net GEX est fortement négatif.
- Traitez les walls 0DTE comme des objectifs, pas comme des plafonds.
- Méfiez-vous des setups « ça va pinner » — le réflexe des dealers ne tire pas dans ce sens.
- Dimensionnez pour des stops plus larges ; la volatilité réalisée est structurellement plus élevée.

**Dans un régime 0DTE à gamma positive :**

- Privilégiez par défaut de vendre les mouvements vers les strikes concentrés en 0DTE.
- Traitez le strike à la gamma la plus lourde comme un aimant, surtout à l'approche de la clôture.
- Méfiez-vous des breakouts — ils échouent plus souvent.
- Des stops plus serrés sont plus raisonnables ; les fourchettes sont plus contenues.

**Dans tous les régimes :**

- Vérifiez si le spot est proche du gamma flip. Un régime contesté est le pire régime dans lequel s'engager sur l'un ou l'autre playbook.
- Vérifiez si le strike 0DTE le plus lourd est en train de migrer. Un strike lourd statique est un candidat au pin plus solide qu'un strike en migration.
- Suivez le Net GEX en tant que magnitude, pas seulement en tant que signe. Un basculement de −2 milliards de dollars à +200 millions de dollars est une lecture très différente d'un basculement de +2 milliards de dollars à +200 millions de dollars.

---

## Lire le positionnement des dealers en 0DTE sur ZeroGEX

Le dashboard fait ressortir des lectures spécifiques au 0DTE à plusieurs endroits :

- **La carte Net GEX** affiche la gamma des dealers évaluée au spot (cohérente en signe avec le flip), vous donnant la magnitude du régime actuel.
- **La heatmap GEX par strike et par DTE** décompose la gamma par bucket d'échéance afin que vous puissiez voir quelle part du positionnement du jour est portée par le 0DTE et où se situent les strikes du jour même les plus lourds.
- **Les cartes wall et flip** affichent les niveaux structurels du jour avec la distance en direct par rapport au spot.

![Heatmap GEX par strike et par DTE de ZeroGEX avec le bucket 0DTE concentré près du spot](/blog/zerogex-strike-dte-heatmap.png)

Un exemple concret. Supposons que le SPX soit à 5 825, que le Net GEX affiche −800 millions de dollars, que le gamma flip se situe à 5 840, et que la heatmap montre un strike put 0DTE lourd à 5 820 qui migre à la baisse avec le prix depuis toute la matinée. La lecture structurelle : les dealers sont short en gamma, le spot est sous le flip, et le strike 0DTE le plus lourd suit le mouvement plutôt que de le retenir.

Inclination pratique : il s'agit d'un régime à gamma courte, favorable à la continuation, le strike put en migration confirmant plutôt que résistant à la baisse. Un trader entré en séance avec un biais de mean-reversion devrait se montrer beaucoup plus prudent ici, car la structure 0DTE pointe activement dans l'autre direction. Rien de tout cela n'est un signal de trade — c'est un contexte de régime qui devrait remodeler les entrées que vous prenez au sérieux.

![Cartes Net GEX et Gamma Flip de ZeroGEX montrant une lecture intraday de gamma négative](/blog/zerogex-net-gex-flip-card.png)

---

## Erreurs courantes dans la lecture de la gamma des dealers en 0DTE

Une courte liste des façons dont le positionnement des dealers en 0DTE est mal interprété :

- **Utiliser la gamma sur l'ensemble de l'OI dans une chaîne dominée par le 0DTE.** Si l'essentiel de la gamma du jour est en 0DTE et que vous lisez la gamma agrégée sur l'OI, votre lecture moyenne un carnet proche de l'expiration avec un carnet à échéance lointaine qui n'a pas d'importance pour le tape du jour.
- **Traiter les walls comme durables dans un régime de gamma négative.** Ce n'est pas le cas. Ils deviennent des objectifs de breakout.
- **Ignorer le régime et trader le niveau.** Le spot au put wall est un trade différent au-dessus du flip et en dessous.
- **Ignorer la migration.** Un strike 0DTE lourd qui a bougé deux fois au cours de la dernière heure constitue une lecture différente d'un strike resté statique toute la matinée.
- **Traiter le comportement de pin en 0DTE comme garanti.** C'est une inclination, pas une promesse. Les catalyseurs et les chocs de flux brisent régulièrement le pin.

---

## À retenir

> Le 0DTE a changé quelle partie du carnet des dealers fait réellement bouger le tape. Le positionnement total compte ; c'est le *bucket 0DTE* qui domine la lecture intraday.

La discipline reste la même que pour toute lecture de positionnement des dealers — commencer par le régime, puis lire la structure à l'intérieur de celui-ci — mais le bucket 0DTE est désormais l'endroit où réside la majeure partie de la gamma pendant la séance cash, et l'ignorer vous met une séance de retard.

Contenu à visée éducative uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir en temps réel le positionnement des dealers en 0DTE d'aujourd'hui — le régime, les strikes du jour même les plus lourds, les walls en direct et le profil de gamma des dealers — le dashboard gratuit de ZeroGEX fait apparaître tout cela.
