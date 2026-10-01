# Pourquoi notre prix de futures peut différer de celui d'une autre plateforme

*Pourquoi une cotation ES ou NQ ici peut se situer à quelques centaines de points du même ticker sur un autre graphique - et pourquoi les deux chiffres sont justes.*

---

**Réponse courte :** nous cotons peut-être un mois de contrat différent de celui du graphique auquel tu te compares. Les deux chiffres sont corrects. Ce sont des instruments différents.

## Les futures se négocient comme des contrats datés

ES et NQ n'ont pas un prix unique. Ils se négocient comme des contrats distincts à échéance en mars, juin, septembre et décembre, et plusieurs d'entre eux se traitent en même temps, à des prix différents.

Ce n'est pas une particularité de nos données : c'est la façon dont la bourse les liste. Un future S&P 500 qui règle dans trois mois et un qui règle la semaine prochaine sont deux contrats distincts avec deux carnets d'ordres distincts, et rien ne force leurs prix à converger avant l'échéance du plus proche.

Nous cotons le contrat qui porte le volume - celui qui se traite activement.

## Les contrats roulent chaque trimestre

Environ une semaine avant l'échéance d'un contrat, le volume de négociation migre vers le suivant. Les fournisseurs de données basculent leurs flux à ce moment-là - mais **pas tous le même jour**. Chacun choisit son propre déclencheur : un nombre fixe de jours avant l'échéance, un croisement de volume ou de positions ouvertes, ou une règle de calendrier fixée il y a des années.

Pendant la semaine environ qui sépare la bascule d'un fournisseur de celle d'un autre, deux plateformes affichant toutes les deux « NQ » montrent des contrats différents. Aucune n'est en panne. Elles répondent simplement à des questions légèrement différentes sur ce que « NQ » veut dire aujourd'hui.

C'est toute la cause de l'écart, et c'est pourquoi nous ne publions pas une date de roulement unique : il n'en existe pas.

## L'écart, c'est le carry

Un contrat qui règle dans trois mois vaut plus qu'un contrat qui règle cette semaine. La différence correspond au coût de financement de la position jusque-là, moins les dividendes auxquels tu renonces en détenant des futures plutôt que les actions.

Sur un roulement trimestriel, cela représente typiquement environ **1 % sur NQ** et **0,8 % sur ES**. C'est plus élevé sur NQ parce que le Nasdaq-100 verse moins de dividendes que le S&P 500, son carry est donc plus important.

Sur NQ, cela fait quelques centaines de points - de quoi ressembler à un flux défaillant, et c'est exactement pour cela que nous nommons le contrat directement au lieu de te laisser le déduire.

Le même calcul explique une marche d'escalier sur un graphique de plusieurs jours. Une plage qui traverse un roulement contient réellement deux contrats : le prix saute là où l'un s'arrête et où le suivant commence. Cette marche, c'est du carry, pas un mouvement de marché, et les graphiques qui franchissent un roulement le signalent.

## Comment vérifier

1. Survole le badge de contrat sur n'importe quelle vue ES ou NQ, touche-le ou place le focus clavier dessus. Il nomme le contrat exact que nous cotons et la date de son échéance.
2. Règle ton autre plateforme sur ce même contrat.
3. Les prix devraient s'aligner.

Si ton autre flux est différé - beaucoup de flux gratuits ont 10-15 minutes de retard -, il restera un petit écart dû au retard lui-même. Celui-là se compte en quelques points, pas en quelques centaines.

## Quand cela se résorbe

Une fois l'ancien contrat échu, toutes les plateformes sont sur le nouveau et la différence disparaît. Elle revient au roulement trimestriel suivant, et se comporte de la même manière chaque fois.

## Est-ce que cela affecte les niveaux des dealers ?

Non. Le gamma flip, les walls, le max pain et le reste sont calculés à partir des chaînes d'options SPX et NDX, puis projetés sur l'axe de prix du future en utilisant le carry théorique du contrat que nous cotons. Lors d'un roulement, la projection passe au carry du nouveau contrat en même temps que le prix : les niveaux suivent donc toujours le contrat que nous cotons, sans aucun décalage de base à configurer. Comme le carry correspond à la juste valeur, les niveaux peuvent être légèrement décalés quand les futures se traitent au-dessus ou en dessous de celle-ci. Voir [Couverture des données et fréquence de mise à jour](/help/platform/data-coverage) pour la façon dont ES et NQ sont servis.

## Toujours pas d'accord ?

Si les deux côtés sont sur le même contrat et que les prix diffèrent encore plus que ce que le retard explique, il s'agit d'autre chose. Écris-nous à [support@zerogex.io](mailto:support@zerogex.io) avec une capture d'écran et l'horodatage.

## Voir aussi

- [Couverture des données et fréquence de mise à jour](/help/platform/data-coverage)
- [Dépannage](/help/platform/troubleshooting)
- [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts)
