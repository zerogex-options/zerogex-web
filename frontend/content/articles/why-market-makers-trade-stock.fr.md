# Pourquoi les market makers sont contraints de trader l'action

*Quand les market makers tradent l'action, ce n'est souvent pas parce qu'ils ont un avis directionnel. C'est parce que le delta des options qu'ils détiennent ne cesse de changer — et à mesure qu'il change, ils doivent généralement ajuster la couverture sur le sous-jacent pour rester quasi plats. Ce flux de couverture est l'une des sources d'order flow les plus structurellement estimables du marché.*

> **À retenir**
> En général, les dealers ne se couvrent pas parce qu'ils sont devenus haussiers ou baissiers. Ils se couvrent parce que le risque de leur portefeuille d'options a changé. Comprendre ce qui fait varier ce risque aide à expliquer où une pression de couverture peut apparaître sur le marché.

---

## Le métier du dealer, c'est de rester neutre

Un market maker qui vous vend une call ne cherche généralement pas à exprimer un avis baissier. Il veut le spread — les quelques centimes entre le bid et l'ask — et souhaite généralement garder son exposition directionnelle proche du neutre. Vendre la call le laisse short en delta, donc il achète de l'action en face jusqu'à ce que la position soit approximativement delta-neutre. C'est le delta-hedging, et c'est une composante centrale du modèle économique d'un dealer d'options : stocker l'option, neutraliser la direction, encaisser l'edge.

Le problème, c'est qu'être « plat » n'est pas un endroit où l'on arrive une bonne fois pour toutes. C'est un endroit où le dealer revient sans cesse, tout au long de la séance, parce que le delta d'un book d'options reste rarement immobile. Et voici la partie qui compte pour quiconque lit le flow : quand ce delta bouge, la couverture qui en résulte est généralement dictée par la gestion du risque plutôt que par un avis directionnel. Aucune conviction, aucun pari sur le marché — le risque du book a changé, donc le dealer doit généralement ajuster. *Quand* et *comment* il le fait relève de son appréciation. La direction probable et la taille approximative de cet ajustement sont les parties les plus estimables.

Cette distinction — dicté par le risque contre discrétionnaire — explique pourquoi le hedging des dealers est lisible. Le flow discrétionnaire est une supposition sur ce qu'un trader *veut* faire. Le flow de couverture est une estimation de ce qu'un dealer aura vraisemblablement *besoin* de faire pour rester quasi plat. L'un dépend de l'intention du trader. L'autre est contraint par la mécanique du portefeuille.

---

## Le delta est une cible mobile, pas un chiffre fixe

Le delta est le ratio de couverture : combien d'actions compensent un contrat d'option. Une call avec un delta de 0,40 se comporte, à l'instant présent, comme 40 actions longues par contrat. Vendez 100 de ces contrats et vous êtes short de 4 000 deltas ; achetez 4 000 actions et vous êtes plat.

Mais 0,40 est une photographie, pas une constante. Cette même call aura un delta différent demain même si l'action ne bouge jamais, un delta différent si la volatilité implicite recule, et un delta très différent si l'action monte de 1%. Le dealer s'est couvert à 0,40. Dès que le delta dérive à 0,44, le book se retrouve short d'environ 400 deltas qu'il n'avait pas prévus, et le dealer achètera généralement environ 400 actions supplémentaires pour se rapprocher de nouveau de plat.

La couverture, ce sont donc en réalité deux tâches, pas une. D'abord le dealer neutralise le niveau *actuel* du delta du book — le trade unique qui rend la position quasi plate. Vient ensuite la tâche continue : à mesure que de nouvelles options se traitent et que le spot, le temps et la vol font bouger ce delta, le dealer rééquilibre pour rester quasi plat. La couverture initiale est établie au moment où la position est mise en place. Ce qui apparaît sur le tape, c'est ce flux incessant de re-hedges qui poursuivent le delta au fil de sa dérive. Comprendre ce qui fait bouger le delta, c'est comprendre d'où vient la pression de couverture.

---

## L'action déjà détenue par le dealer vous en dit moins que vous ne le pensez

Voici un piège qu'il vaut mieux éviter dès le départ, car il plombe beaucoup d'analyses naïves du positionnement des dealers.

On pourrait penser que la bonne façon d'évaluer la pression des dealers consiste à additionner tout le delta du book — le delta de chaque contrat multiplié par son open interest — et à appeler ça « l'exposition du dealer ». Ça semble juste. C'est le cousin naturel de la gamma exposure. Mais cela repose sur une hypothèse cachée, et cela mesure souvent la mauvaise chose pour estimer la pression de couverture future.

Commençons par l'hypothèse. L'open interest vous dit qu'un contrat existe ; il ne vous dit pas si un dealer y est long ou short. Les inventaires des dealers ne sont pas divulgués publiquement sous une forme complète et en temps réel, si bien que tout chiffre de « delta du dealer » doit être déduit d'un modèle de qui détient probablement quoi — une estimation raisonnable, mais une estimation. Admettons maintenant l'estimation et regardons ce que le *niveau* du delta mesure vraiment. Les actions qu'un dealer détient en face de ses options ont chacune un delta exactement égal à 1,00, mises en place *spécifiquement pour annuler* le delta de l'option. Par construction, le delta net d'un dealer bien couvert se situe près de zéro — le delta de l'option et le delta de l'action se compensent largement. Donc un chiffre qui additionne le niveau du delta des options décrit précisément l'exposition que les dealers s'efforcent le plus d'aplatir, tout en ignorant les actions détenues en face.

Ce que le niveau ignore, c'est l'ampleur avec laquelle ce delta est sur le point de *bouger*. L'action a un delta de 1 qui ne change pas, de sorte qu'une couverture statique en actions ne peut pas neutraliser les variations futures du delta des options. La pression de couverture future vient des variations du delta estimé du portefeuille du dealer, et non de l'addition du delta présent dans le book aujourd'hui. Cette dérive — la part qu'une couverture statique en actions ne peut pas absorber entièrement à l'avance — c'est là que naît une grande partie du flux de recouverture. (Nous avons écrit un article entier sur les raisons pour lesquelles le chiffre du niveau de delta est un piège et pourquoi nous refusons de le publier — voir [Pourquoi nous ne publions pas le DEX](/education/why-we-dont-publish-dex).)

---

## Trois forces font bouger le delta, et le dealer est exposé aux trois

Entre maintenant et l'échéance, trois variables dominent la façon dont le delta d'un book d'options bouge en intraday, et un dealer n'a guère de contrôle sur aucune d'elles :

- **Le prix spot.** Quand l'action bouge, le delta de chaque option bouge avec elle. La sensibilité du delta au spot, c'est le **gamma**. C'est la composante réactive — elle réagit quand le prix bouge, et son effet peut être important et immédiat.
- **Le temps.** À mesure que l'échéance approche, le delta dérive même lorsque le spot est figé : les options out-of-the-money glissent vers un delta de 0, les options in-the-money grimpent vers un delta de 1. La sensibilité du delta au temps, c'est le **charm**. Il tourne en continu, que quelque chose se passe ou non.
- **La volatilité implicite.** Quand la peur intégrée par le marché monte ou descend, le delta se déplace alors même que le spot reste parfaitement immobile. La sensibilité du delta à la vol, c'est le **vanna**. Une réinitialisation de la vol peut faire fortement bouger le delta du book sans le moindre tick sur le prix.

Le prix, l'horloge et la peur. Ce sont les trois grands leviers, et le dealer est exposé aux trois. Quand l'un d'eux bouge, il tire le delta du book hors de sa couverture et crée une pression pour ajuster la couverture sur l'action. Ce ne sont pas les *seuls* facteurs — les taux d'intérêt, les dividendes, les déformations de la surface de volatilité, les hypothèses de financement et les nouveaux trades d'options qui arrivent dans le book font eux aussi bouger le delta —, mais en intraday ils sont généralement de second ordre face au spot, au temps et à la vol. L'effet combiné, c'est ce que nous appelons **Forced Flow** : une estimation des actions qu'un dealer devra généralement acheter ou vendre pour rester couvert à mesure que le spot, le temps et la vol évoluent.

---

## Ce que cela représente en dollars

L'abstraction devient concrète dès l'instant où on lui attribue une taille.

Disons que le book des dealers sur SPY est estimé positionné de telle sorte qu'un mouvement de 1% du sous-jacent modifie le delta agrégé des dealers d'environ 1 million d'actions. La couverture correspond à cette variation d'actions multipliée par le prix de l'action : avec SPY à $560, cela donne 1 000 000 × $560 ≈ **560 millions de dollars**. Selon les hypothèses du modèle, cela représente environ 560 millions de dollars de demande de couverture potentielle — des actions qui devraient généralement changer de mains pour maintenir le book quasi plat, avant même qu'un seul trader discrétionnaire ne se soit forgé une opinion. Dans un régime de gamma courte, les dealers achètent généralement dans la force et vendent dans la faiblesse, de sorte que ce flux tend à pousser *dans le sens* du mouvement, élargissant l'amplitude. Dans un régime de gamma longue, il s'oppose au mouvement et le comprime. Même mécanique, signe opposé, un tape très différent.

Le charm et le vanna portent leurs propres étiquettes en dollars. Lors d'une lourde journée de 0DTE, la seule décroissance temporelle peut impliquer des dizaines de millions d'actions à couvrir d'ici la clôture — même si la direction dépend de la façon dont le book est estimé positionné, et pas seulement de l'horloge. Une baisse de deux points de la vol implicite après une publication du CPI calme peut impliquer une couverture de taille comparable ; qu'elle se traduise par des achats ou des ventes dépend là encore du signe du vanna estimé du book. Rien de tout cela n'est un pari sur le marché. Tout cela, c'est le book que l'on rééquilibre pour revenir vers plat.

---

## Pourquoi le Forced Flow est le flow qui mérite d'être lu

La majeure partie de l'order flow est un brouillard d'intentions concurrentes. Quelqu'un achète, quelqu'un vend, et vous devinez le motif. Le hedging des dealers est différent par nature : c'est un flux persistant, façonné par le positionnement et les trois variables évoquées plus haut plutôt que par l'avis de quiconque. Cela le rend généralement plus estimable que le flow discrétionnaire. Si le spot bouge de 1%, le hedging lié au gamma tend à réagir. À mesure que l'horloge approche de la clôture, le hedging piloté par le charm tend à s'accumuler. Si la vol baisse de deux points, une pression de couverture liée au vanna peut suivre — dans une direction fixée par le positionnement estimé du book. La nécessité de gérer le risque est mécanique, même si le timing et l'exécution restent discrétionnaires.

C'est ce que le reste de cette série développe. [Le delta et ses trois enfants](/education/delta-and-its-three-children) décompose le gamma, le charm et le vanna comme les trois dérivées du delta. [Charm : l'horloge est un trader](/education/charm-the-clock-is-a-trader) montre comment la seule décroissance temporelle peut alimenter un flow estimable vers la clôture, modélisable des heures à l'avance. [Vanna : quand la peur s'estompe, les dealers achètent](/education/vanna-when-fear-fades) explique la dynamique de la compression de vol. Et la page en direct [Forced Flow](/forced-flow) reprice l'ensemble du book sous n'importe quel scénario de spot/temps/vol, afin que vous puissiez voir la pression de couverture estimée avant qu'elle ne parvienne éventuellement au tape.

Le hedging des dealers n'est pas parfaitement prévisible. Les inventaires ne sont pas publics, le positionnement doit être déduit, et le timing comme l'exécution de toute couverture restent à l'appréciation du dealer.

Mais parce qu'il est dicté par le risque de portefeuille et non par un avis discrétionnaire, il constitue l'une des sources de pression potentielle à l'achat et à la vente les plus structurellement estimables des marchés modernes. Le but de Forced Flow n'est pas de prédire l'ordre exact avant qu'il ne s'imprime. C'est d'estimer où le hedging des dealers peut renforcer, freiner ou infléchir le mouvement du marché à mesure que le prix, le temps et la volatilité évoluent.

Contenu purement éducatif — rien de ce qui précède ne constitue une recommandation de trading.
