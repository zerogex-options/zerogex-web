# Qu'est-ce qu'un Put Wall ? La concentration de gamma sur les puts, expliquée
> **Note méthodologique.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. L’inversion du terme de pin d’EOD Pressure reste donc une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.

*Le Put Wall en clair — ce que c'est, pourquoi le prix y réagit souvent, pourquoi la couverture modélisée de put vendu n'en fait pas un plancher mécanique, en quoi il diffère du Call Wall, ce que signifie une cassure, et où trouver le Put Wall du jour pour le SPX, le SPY, le QQQ et le NDX.*

---

## Qu'est-ce qu'un Put Wall ?

Un **Put Wall** est le strike sous le prix actuel où l'exposition en gamma du côté des puts est la plus concentrée dans la chaîne d'options. Les traders le surveillent comme la borne basse de la fourchette avec laquelle le positionnement actuel est le plus cohérent — le strike où une baisse a le plus de chances de rencontrer une réaction issue de la couverture, de la liquidité et du reste du flux qui se rassemble autour d'un strike chargé.

Plus précisément : le Put Wall est le strike au spot ou en dessous dont la magnitude de gamma put non signée est la plus grande dans la chaîne d'options retenue. ZeroGEX classe les strikes à partir de la gamma modélisée multipliée par l'open interest officiel, puis applique le filtre du côté du spot. C'est une référence structurelle, pas la promesse d'un rebond.

Sous la convention traditionnelle de ZeroGEX (calls positifs, puts négatifs), l'inventaire de puts à ce strike correspond à une **gamma dealer modélisée localement négative**. Pour un dealer couvert en delta et vendeur d'un put, une baisse du prix rend la position optionnelle plus positive en delta ; maintenir la couverture impose en général de vendre davantage de sous-jacent. Cet ajustement local peut renforcer la baisse. Le Put Wall n'est donc pas un plancher défendu mécaniquement par les dealers, ni l'image miroir d'un Call Wall positif.

## Comment ZeroGEX modélise le positionnement des dealers

Les données publiques de la chaîne d'options ne révèlent pas l'inventaire complet, long et court, des dealers. ZeroGEX attribue donc une exposition modélisée positive aux calls et négative aux puts, ce qui correspond globalement à des dealers nets acheteurs des calls vendus par les clients et nets vendeurs des puts achetés par les clients. La convention est utile pour comparer la structure de la chaîne, mais ce n'est pas une observation directe de l'inventaire des dealers ; le positionnement réel peut différer.

Le Net GEX modélisé reste :

```text
Net GEX modélisé = Call GEX - Put GEX
```

Les calls longs et les puts longs ont chacun une gamma positive ; les calls vendus et les puts vendus ont chacun une gamma négative. Le signe négatif des puts ci-dessus vient de la position supposée du dealer, pas d'une gamma intrinsèquement négative des puts.

## Pourquoi le Put Wall coïncide souvent avec un support

Un Put Wall peut coïncider avec un support observé en raison du profil de gamma complet, de la liquidité, de la monétisation des puts, du comportement des clients, d'une demande systématique ou d'autres flux de marché. Une gamma call modélisée positive ailleurs peut aussi l'emporter sur la gamma put modélisée négative au niveau du wall, laissant le Net GEX agrégé positif. Mais une gamma agrégée positive ne prouve pas que les achats des dealers soient concentrés au Put Wall.

Traitez le niveau comme :

- une forte concentration de gamma put ;
- une référence possible de liquidité et de positionnement ;
- un niveau qui peut empiriquement se comporter comme un support ; et
- un niveau dont le comportement dépend de la gamma agrégée et locale ainsi que du flux environnant.

## Put Wall et Call Wall

Les deux walls se construisent de la même façon de part et d'autre du spot, et c'est là que la symétrie s'arrête.

| | Put Wall | Call Wall |
|---|---|---|
| Côté du spot | Au spot ou en dessous | Au spot ou au-dessus |
| Classé par | Plus grande magnitude de gamma put (gamma modélisée × open interest) | Plus grande magnitude de gamma call (gamma modélisée × open interest) |
| Signe dealer modélisé | Négatif — dealers modélisés vendeurs des puts achetés par les clients | Positif — dealers modélisés acheteurs des calls vendus par les clients |
| Lecture courante | Borne basse de la fourchette de positionnement ; peut coïncider avec un support | Borne haute de la fourchette de positionnement ; peut coïncider avec une résistance ou un pinning |
| Couverture locale, isolée | Une baisse peut appeler davantage de ventes, ce qui peut renforcer le mouvement | Une hausse peut appeler des ventes, ce qui peut freiner le mouvement |
| En cas de cassure | La référence a échoué ou migré ; en gamma négative le mouvement peut s'accélérer | La référence a échoué ou migré ; souvent lue comme un déplacement du positionnement |

Call Wall et Put Wall ne sont pas mécaniquement symétriques. Un Call Wall est le strike au spot ou au-dessus dont la magnitude de gamma call est la plus grande ; un Put Wall utilise la magnitude de gamma put sous le spot. Le type d'option ne détermine à lui seul ni résistance, ni support, ni attraction, ni accélération. La comparaison complète se trouve dans [Qu'est-ce qu'un Call Wall ?](/education/what-is-a-call-wall) et [Gamma Walls Explained](/education/gamma-walls-explained).

## Put Wall, gamma flip et max pain

Trois niveaux que l'on confond souvent :

- Le **Put Wall** est une *concentration* — le strike le plus dense en gamma put sous le spot.
- Le [gamma flip](/education/how-to-read-a-gamma-flip), ou [niveau de gamma zéro](/education/zero-gamma-level-explained), est une *ligne de régime* — le prix où la gamma dealer nette modélisée change de signe. Il détermine si la couverture près des walls tend à amortir les mouvements ou à les amplifier. Le flip se situe fréquemment au-dessus du Put Wall, si bien que le prix peut casser le Put Wall tout en restant en gamma positive, ou le tenir alors qu'il est déjà en gamma négative.
- Le [max pain](/education/max-pain-explained) est un calcul de *valeur à l'échéance* — le strike où la valeur expirante des détenteurs d'options est minimisée. Ce n'est pas une concentration de gamma et il est souvent loin des deux walls.

Lire le Put Wall sans le flip est l'erreur la plus fréquente sur cette page. Le wall vous dit où le positionnement est dense ; le flip vous dit ce que ce positionnement dense est susceptible de faire.

## Pourquoi un wall peut migrer en séance

L'open interest officiel est généralement mis à jour après compensation, et non en continu pendant la séance. Les walls de ZeroGEX peuvent malgré tout migrer en séance, parce que le spot, le temps restant jusqu'à l'échéance et la volatilité implicite modifient la gamma modélisée de chaque strike. Le classement relatif peut changer, un strike peut passer d'un côté du spot à l'autre, ou un autre strike à open interest inchangé peut devenir le maximum.

Le calcul du wall n'établit pas que du volume frais a ouvert de nouvelles positions. Le volume ne distingue pas l'activité d'ouverture de celle de clôture, et il ne constitue pas un open interest intraday vérifié. À l'approche de l'échéance, la gamma se concentre de plus en plus près du strike à la monnaie : la gamma ATM peut fortement augmenter, tandis que la gamma des strikes nettement dans ou hors de la monnaie tend vers zéro. Cette revalorisation est différente d'une clôture de contrats ou d'une mise à jour de l'open interest officiel.

## Ce qui se passe quand le Put Wall casse

Une cassure sous le Put Wall est une information, pas un verdict. Lisez-la à travers quatre questions :

1. **Quel régime était en vigueur ?** Au-dessus du gamma flip, la couverture agrégée tend à freiner la baisse, et une cassure s'arrête plus souvent à la concentration de puts suivante. Sous le flip, le réflexe accompagne le mouvement et une cassure peut s'accélérer — la couverture locale de put vendu décrite plus haut est désormais alignée avec le livre global.
2. **Le wall a-t-il migré ou échoué ?** Un wall qui s'est reclassé sur un strike plus bas lorsque les paramètres ont changé n'a pas été « cassé » ; la référence s'est déplacée. Comparez le strike du wall avant et après la cassure.
3. **Le flux l'a-t-il submergé ?** Les gros titres macro, les rééquilibrages d'indices et les ordres de grande taille apportent un flux qui écrase la couverture. Une cassure sur ce type de tape dit peu de chose du wall.
4. **Le gamma flip a-t-il été franchi ?** Une cassure peut signifier que la référence a échoué, que le flux environnant a dominé, que la gamma locale s'est affaiblie ou que le wall a migré. Seul un franchissement du Gamma Flip calculé — ou un véritable changement de signe du Net GEX modélisé — étaye l'affirmation d'un changement de régime de gamma.

Après une cassure, le strike suivant le plus chargé en gamma put en dessous devient le nouveau Put Wall au prochain instantané. C'est ainsi que le niveau « descend par paliers » au cours d'une séance en tendance.

## Une lecture pratique

Supposons que le SPX soit à 5 830, le Put Wall à 5 790, le Call Wall à 5 850 et le Net GEX modélisé positif. Le Put Wall identifie la plus grande magnitude de gamma put sous le spot. Il n'identifie **pas** à lui seul une zone d'achat. Un trader peut observer si la liquidité absorbe les ventes à ce niveau, si le profil de gamma agrégé reste stable, si le wall migre lorsque les paramètres changent, et si le flux directionnel confirme ou submerge le niveau.

Supposons maintenant que le SPX glisse à 5 785 une heure plus tard et que le gamma flip, publié à 5 815, ait été franchi. Deux choses ont changé en même temps : la référence du Put Wall a échoué, et le régime modélisé est devenu négatif. C'est la seconde qui compte pour la transaction suivante — le réflexe de couverture qui aurait pu freiner la baisse est désormais modélisé comme l'accompagnant, et la concentration de puts suivante en dessous est la nouvelle référence, pas un objectif de rebond.

## Où trouver le Put Wall du jour

ZeroGEX publie le Put Wall — avec le Call Wall, le gamma flip, le max pain et le Net GEX — gratuitement et avec environ 15 minutes de différé, pour [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) et [NQ](/nq-gamma-levels). Chaque page se rafraîchit au fil de la séance et affiche l'heure de l'instantané à côté de chaque niveau. Pour tracer le niveau sur votre propre graphique, l'[indicateur TradingView](/tradingview-indicator) et l'[étude thinkorswim](/thinkorswim-indicator) gratuits dessinent le Put Wall en ligne horizontale ; la valeur en direct, rafraîchie en moins d'une minute, se trouve dans le dashboard ZeroGEX.

Deux habitudes rendent le chiffre utile plutôt que décoratif : notez l'heure de l'instantané (un Put Wall du matin lu face à un tape de l'après-midi, ce n'est plus le même livre), et lisez-le avec le gamma flip sur le même écran.

## À retenir

> Le Put Wall est une concentration modélisée de gamma put et une référence structurelle utile. Il peut coïncider avec un support, mais le support n'est pas une conséquence directe de la couverture modélisée de put vendu du dealer à ce strike.

Consultez les walls modélisés du jour sur [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) et [NDX](/ndx-gamma-levels), ou comparez le cadre plus large dans [Gamma Walls Explained](/education/gamma-walls-explained).

Contenu éducatif uniquement — rien de ce qui précède n'est une recommandation de trading.
