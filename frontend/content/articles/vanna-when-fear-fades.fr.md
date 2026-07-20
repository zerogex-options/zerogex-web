# Vanna : quand la peur s'estompe, les dealers achètent

*Vanna est la vitesse à laquelle le delta d'une option change lorsque la volatilité implicite change. Quand la peur intégrée dans les prix se dissipe après un événement qui n'a finalement rien produit, vanna oblige les dealers à acheter des actions selon un flux lent et régulier — cette hausse "sans nouvelles" qui apparaît sur le graphique mais jamais dans les volumes.*

---

## Le flux invisible dans le tape

Il existe un type de séance que tout trader reconnaît et que peu savent expliquer : le marché flotte vers le haut toute la journée, bougie verte après bougie verte, sur des volumes qui n'ont rien de particulier et des nouvelles qui sont tout simplement inexistantes. Personne ne semble acheter, et pourtant ça continue de monter. Demandez autour de vous et vous n'obtenez que des haussements d'épaules — "melt-up", "dérive de faible volatilité", "gamma". Le véritable moteur, c'est généralement vanna, et une fois qu'on le comprend, ces séances cessent de paraître mystérieuses.

Vanna est la sensibilité du delta à la volatilité implicite — ∂Δ/∂σ. C'est le troisième des trois "enfants" du delta, aux côtés de gamma (delta face au prix) et charm (delta face au temps), présentés dans [Delta et ses trois enfants](/education/delta-and-its-three-children). Comme charm, il oblige les dealers à trader alors même que le spot est parfaitement immobile. Contrairement à charm, son déclencheur n'est pas l'horloge mais la peur : l'anticipation par le marché d'un mouvement futur, exprimée sous forme de volatilité implicite.

Voici l'analyse mécanique approfondie qui sous-tend notre explication plus large [Vanna et Charm expliqués](/education/vanna-and-charm-explained). Cet article-là situe vanna dans le tableau général des régimes de marché ; celui-ci montre exactement pourquoi une baisse de la vol se transforme en bid des dealers.

---

## Pourquoi le delta bouge quand la vol bouge

La volatilité implicite détermine la largeur de la distribution des résultats attendue par le marché. Une IV élevée signifie que le marché juge plausible un large éventail de prix ; une IV faible signifie qu'il s'attend à ce que les choses restent proches de leur niveau actuel.

Réfléchissez maintenant à ce que cela implique pour un call hors de la monnaie. Quand l'IV est élevée et la distribution large, ce strike éloigné a une réelle chance d'être atteint, donc son delta est nettement supérieur à zéro — disons 0,25. Laissez la peur se dissiper, la distribution se resserrer, et ce même strike paraît soudain beaucoup moins atteignable. Son delta tombe vers zéro — disons 0,15. Le spot n'a jamais bougé. La seule chose qui a changé, c'est l'estimation du marché quant à l'ampleur du mouvement *possible* du spot, et cela seul a suffi à repriceer le delta de l'option.

Ce déplacement, c'est vanna. Chaque option hors de la monnaie de la chaîne repricee son delta quand la vol bouge, et le delta de l'ensemble du book dérive en conséquence. Le dealer était couvert sur les deltas d'hier ; le print de vol du jour vient de les changer ; le hedge doit rattraper son retard.

---

## Pourquoi une peur qui s'estompe tend à devenir un bid

Le sens du flux de vanna dépend de la composition du book, mais le scénario type — celui qui produit la dérive reconnaissable — se déroule ainsi.

Les clients sont, en agrégat, longs en options. Ils achètent des calls pour profiter de la hausse et des puts pour se protéger, et les dealers sont short en face. Considérez les instants qui *suivent* une frayeur : la vol implicite a été poussée à la hausse en amont d'un chiffre de CPI, d'une réunion du FOMC, d'un earnings. Le risque passe. Le mouvement redouté ne se matérialise pas. La vol implicite, qui était chère, commence à se dégonfler au cours des heures et des jours suivants.

Au fur et à mesure que la vol baisse :

1. Les deltas des options hors de la monnaie sur lesquelles le dealer est short dérivent vers zéro.
2. La position nette short-delta du dealer se réduit — il est mécaniquement moins short le marché qu'il ne l'était.
3. Pour rétablir le hedge, il achète des actions.
4. La vol continue de se dégonfler, donc la dérive continue, donc les achats continuent d'affluer — petits, réguliers, toute la journée.

Cet achat constant et mécanique, c'est le vanna grind. Ce n'est pas un pari. Aucun dealer n'a décidé que le marché devait monter. La vol a baissé, les deltas ont dérivé, et le hedge a exigé des actions. Mais l'agrégat de milliers de petits achats forcés est, sur le graphique, indiscernable d'une demande authentique — c'est exactement pourquoi le tape dérive vers le haut alors que le volume indique qu'il ne se passe rien. Les achats sont réels ; ils arrivent simplement sous forme de goutte-à-goutte d'ordres limites plutôt que d'une vague d'ordres au marché, ce qui fait bouger le prix sans faire s'allumer les barres de volume.

---

## L'échelle de vanna

Comme le flux de vanna est piloté par une variable qu'on peut choquer directement, on peut le représenter sous forme d'échelle : on fige le spot et le temps, on fait varier la vol implicite point par point vers le haut et vers le bas, et on lit combien d'actions le book du dealer est contraint de trader à chaque échelon.

Le graphique en direct [Vanna Ladder](/forced-flow) fait exactement cela. À variation de vol nulle, le flux forcé est nul — rien n'a bougé, donc rien n'est contraint. Faites baisser la vol d'un point et le graphique montre l'achat forcé qu'une compression d'un point produirait ; faites-la baisser de deux points et l'achat double à peu près. Faites monter la vol et le signe s'inverse : un pic de vol force les dealers à vendre, ce qui explique en partie pourquoi la peur s'auto-alimente lors d'un selloff. L'échelle rend l'asymétrie lisible — on peut voir, avant que cela n'arrive, combien de bid vaut aujourd'hui un dégonflement de vol de deux points.

---

## Y mettre un chiffre

Supposons que le SPX soit à 5 800 le matin suivant un chiffre d'inflation calme, que la vol implicite commence à se contracter, et que le book du dealer porte le biais typique des clients longs. Le moteur repricee le book avec le spot figé à 5 800 et la vol en baisse de deux points, et trouve un delta du dealer plus élevé équivalant à 60 millions de dollars d'exposition sur l'indice. Cela représente environ **60 millions de dollars** d'achats forcés, répartis sur la séance à mesure que la vol se dégonfle réellement — un bid persistant sans aucun catalyseur qu'un titre d'actualité pourrait rapporter.

Inversez le mouvement de la vol et le même mécanisme force des ventes. Vanna, comme charm, n'a pas de direction intrinsèque ; le signe vient du book et du sens du mouvement de vol. Ce qui est fiable, c'est le *caractère* du flux : lent, régulier, invisible dans les volumes, et étroitement lié à la tendance de la vol plutôt qu'à celle du prix.

---

## Comment le lire sans le poursuivre

Vanna est un élément de contexte, pas un déclencheur. Une discipline simple :

- **Vérifiez d'abord la tendance de la vol.** Un dégonflement de l'IV sur plusieurs jours après un événement est le scénario classique de bid par vanna. Une vol en hausse inverse le flux vers la vente. Pas de tendance de vol, pas d'histoire vanna.
- **Confirmez le régime.** Le vanna grind coexiste naturellement avec un régime de gamma positif — les deux favorisent le même tape calme et absorbant. Dans un régime de gamma négatif, le même mouvement de vol peut être submergé par des réactions de prix amplifiées. Lisez d'abord [gamma](/education/gamma-exposure-explained), vanna à l'intérieur de ce cadre.
- **Attendez-vous au grind, pas à un pop.** Les achats liés à vanna sont un goutte-à-goutte. Ils produisent de la dérive, pas de la poussée. Si vous attendez une bougie vanna, vous avez mal compris le flux — il se cache dans la pente, pas dans le pic.
- **Respectez le décalage de volume.** "Ça monte sans volume" n'est pas un signal d'alarme dans un régime vanna ; c'est la signature. L'absence de volume est l'indice que les achats sont mécaniques.

Quand la frayeur qui ne vient jamais finit par passer, la peur doit bien se résorber quelque part. Elle se résorbe à travers le book du dealer, un re-hedge à la fois, et cela ressemble à un marché qui décide tranquillement de monter sans raison. Vous connaissez maintenant la raison.

Pour le pendant rythmé par l'horloge, voir [Charm : l'horloge est un trader](/education/charm-the-clock-is-a-trader), pour les fondations, voir [Pourquoi les market makers sont contraints de trader des actions](/education/why-market-makers-trade-stock), et pour voir l'échelle de vanna bouger avec le book du jour, ouvrez la page en direct [Forced Flow](/forced-flow).

Contenu à visée uniquement éducative — rien de ce qui précède ne constitue une recommandation de trading.
