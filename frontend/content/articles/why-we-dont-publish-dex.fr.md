# Pourquoi nous ne publions pas le DEX brut comme signal de flux principal
> **Note méthodologique.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. L’inversion du terme de pin d’EOD Pressure reste donc une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.

*Ce que mesure le Delta Exposure calculé sur les seules options, ce qu'il omet, et ce à quoi il peut malgré tout servir.*

---

## L'objection, au sens étroit

Le DEX brut est une estimation modélisée de l'**exposition en delta des seules options**, généralement résumée par `Σ(delta × open interest × multiplicateur du contrat)`. Il peut décrire l'inventaire directionnel supposé de la jambe optionnelle. Parce qu'il exclut la couverture compensatrice sur le sous-jacent et qu'il mesure un niveau plutôt qu'une variation, ZeroGEX ne le considère pas comme une estimation fiable à elle seule du futur flux de couverture des dealers.

C'est une affirmation plus étroite que de dire que le DEX n'a aucun sens. La détention réelle des dealers n'est pas observable dans l'open interest public, si bien que le DEX hérite en outre de la convention de positionnement que le calcul applique.

## Un niveau n'est pas une transaction future

Un dealer peut compenser le delta des options avec des actions, des futures ou d'autres options, et peut gérer le portefeuille agrégé à l'intérieur de bandes de couverture. Le DEX brut calculé sur les seules options omet ces couvertures. Plus important encore : un niveau de delta actuel ne dit pas comment le delta va évoluer ensuite. Une demande de couverture potentielle apparaît lorsque le spot, le temps, la volatilité implicite, de nouvelles transactions ou des changements de position modifient le delta du portefeuille.

Les contrats très dans la monnaie peuvent peser lourd dans un total de delta calculé sur les seules options, parce que leur delta absolu approche un. Ce n'est pas une erreur : cela fait partie de l'estimation d'inventaire. Cela signifie en revanche qu'un total brut élevé n'identifie pas nécessairement les strikes dont la sensibilité en delta est la plus forte à court terme. La gamma, le charm et la vanna ont des profils différents selon le strike et l'échéance ; ils ne culminent pas tous universellement à la monnaie.

## Usages valables du DEX

Avec ses hypothèses énoncées clairement, le DEX peut servir de base à :

- des estimations modélisées d'inventaire directionnel sur les seules options ;
- des comparaisons de la structure de la chaîne dans le temps ;
- des analyses de scénarios ; et
- une composante à l'intérieur d'un modèle de portefeuille plus large.

Il ne devrait pas être réétiqueté en position observée des dealers ni en prévision du prochain ordre sur le sous-jacent.

## Pourquoi ZeroGEX préfère la revalorisation par scénario

Le modèle Forced Flow de ZeroGEX compare le delta modélisé du portefeuille aujourd'hui au delta modélisé sous un scénario défini de spot, de temps et de volatilité. L'écart est une estimation de la pression de couverture **potentielle**, conditionnelle à l'inventaire supposé et au scénario. Ce n'est pas une preuve que les dealers exécuteront ce montant : les portefeuilles peuvent contenir des compensations, les paramètres peuvent bouger ensemble, et les desks peuvent se couvrir avec d'autres instruments ou à d'autres moments.

> Le DEX brut peut décrire un niveau de delta supposé, sur les seules options. ZeroGEX n'utilise pas ce niveau seul comme estimation du futur flux de couverture des dealers.

Pour les concepts sous-jacents, voir [Pourquoi les market makers sont contraints de trader l'action](/education/why-market-makers-trade-stock) et [Delta et ses trois enfants](/education/delta-and-its-three-children).

Contenu éducatif uniquement — rien de ce qui précède n'est une recommandation de trading.
