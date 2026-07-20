# Vanna et charm expliqués pour les traders d'options

*Vanna et charm expliqués — ce qu'est chacune de ces grecques, pourquoi elles comptent pour les flux de couverture des dealers, comment vanna crée un bid persistant dans les régimes de compression de la volatilité, comment charm alimente les flux prévisibles vers la clôture, et comment elles interagissent avec le régime gamma.*

---

## Pourquoi vanna et charm méritent d'être comprises

Si vous avez déjà lu des analyses sur le positionnement des dealers, vous savez que le gamma capte l'essentiel de l'attention — et pour de bonnes raisons. C'est la grecque de premier ordre qui capture l'essentiel du flux de couverture structurel. Mais ce n'est pas la seule force à l'œuvre dans le book des dealers. Deux grecques de second ordre — **vanna** et **charm** — pilotent discrètement une part significative des flux qui se manifestent sur le tape, en particulier autour des resets de volatilité, de l'OPEX, et à l'approche de la clôture de la séance cash.

La plupart des traders qui utilisent des cadres d'analyse fondés uniquement sur le gamma lisent correctement le régime, mais passent à côté des pressions de second ordre qui s'y jouent. Un régime de compression de la volatilité avec des achats persistants pilotés par vanna se comporte différemment d'un régime où cet effet est absent. Une chaîne fortement dominée par les 0DTE à l'approche de la clôture se comporte différemment parce que la décroissance de charm force un rehedging continu. Ajouter vanna et charm à la lecture ne remplace pas le cadre gamma — cela l'affine.

Cet article explique ce qu'est chacune de ces grecques, pourquoi elles intéressent les dealers, comment les flux se manifestent sur le tape, et comment elles interagissent avec le régime gamma. Pour le cadre structurel de base, commencez par l'[article pilier sur la Gamma Exposure](/education/gamma-exposure-explained) ; pour la lecture du régime, voir [Comment lire un Gamma Flip](/education/how-to-read-a-gamma-flip) ; et pour les lectures spécifiques aux 0DTE, où la décroissance de charm est la plus marquée, voir [Le positionnement des dealers sur les 0DTE expliqué](/education/0dte-dealer-positioning-explained).

---

## Qu'est-ce que vanna en options ?

Vanna est une grecque de second ordre qui mesure la **sensibilité du delta d'une option aux variations de la volatilité implicite**. De façon équivalente — et c'est l'angle le plus utile pour l'analyse des flux des dealers — elle mesure la sensibilité du prix d'une option au mouvement conjoint du spot et de la vol.

En symboles : vanna ≈ ∂Δ/∂σ = ∂²V/∂σ∂S. C'est la dérivée croisée de la valeur de l'option par rapport au spot et à la volatilité implicite.

Ce que cela signifie concrètement : lorsque la volatilité implicite bouge, le delta de votre option bouge *même si le spot ne bouge pas*. Une baisse de l'IV réduit le delta des calls OTM et augmente (en valeur absolue) le delta des puts OTM. Une hausse de l'IV produit l'effet inverse. Quiconque détient un book d'options dont le delta dérive lorsque la vol bouge doit couvrir cette dérive — et c'est précisément là que vanna devient un flux visible sur le tape.

### Comment les dealers vivent vanna

Les dealers gèrent des books delta-neutres. Lorsque l'IV baisse, le delta de leur inventaire dérive, et ils doivent négocier le sous-jacent pour ramener le book à la neutralité. La direction de cette transaction dépend de la composition de leur book.

Le schéma canonique évoqué dans les analyses de flux :

- Les dealers sont typiquement short de calls (les clients sont net long).
- Quand l'IV baisse, le delta des calls OTM baisse.
- Un dealer short d'un call OTM avec un delta de 0,30 pourrait désormais être short du même call avec un delta de 0,25.
- Son exposition short-delta s'est réduite — il est mécaniquement moins short sur le sous-jacent.
- Pour rester delta-neutre, il doit *vendre* du sous-jacent — ou, s'il détenait du sous-jacent long en couverture, il en vend une partie.

Pris isolément, cela paraît baissier. Le cas intéressant est le cas inverse : sur un marché où l'IV a baissé pendant des jours ou des semaines (un régime de compression de la volatilité), les dealers rehedgent en continu la décroissance de vanna sur une chaîne fortement orientée vers un positionnement client acheteur de calls. L'agrégat de ces flux tend à se manifester comme un bid persistant et structurel — le « vanna grind » dont les desks de flux parlent depuis des années.

Le signe exact dépend de la composition de la chaîne. Un book dominé par des puts OTM short côté dealer se comporte différemment d'un book dominé par des calls OTM short côté dealer. L'analyse standard suppose le skew typique client-long-call / client-long-put, qui produit le résultat du vanna grind en compression de volatilité. Dans des régimes moins typiques, le signe peut s'inverser.

---

## Qu'est-ce que charm en options ?

Charm est une grecque de second ordre qui mesure la **sensibilité du delta d'une option au temps**. À mesure qu'une option se rapproche de l'échéance, son delta dérive — les options out-of-the-money décroissent vers 0, les options in-the-money dérivent vers 1 (pour les calls) ou -1 (pour les puts).

En symboles : charm = ∂Δ/∂t.

L'intuition : le delta d'une option est, grosso modo, la probabilité implicite par le marché qu'elle expire dans la monnaie. À mesure que le temps passe, cette probabilité doit converger vers 0 ou vers 1. Pour les options OTM, cette probabilité décroît vers 0 ; pour les options ITM, elle monte vers 1. Plus on se rapproche de l'échéance, plus la dérive est rapide.

### Comment les dealers vivent charm

Comme vanna, charm force le rehedging sans aucun mouvement du spot. Un dealer qui gère un book delta-neutre voit son exposition delta effective dériver uniquement du fait du passage du temps, et doit négocier le sous-jacent pour rester à plat.

Le signe directionnel du flux de couverture piloté par charm dépend de quel côté du book domine. Pour un book de dealer typique, fortement short de calls, maintenu jusqu'à la clôture sur une chaîne 0DTE :

- Les deltas des calls OTM décroissent vers 0.
- L'exposition delta short-call du dealer se réduit en valeur absolue.
- Il doit négocier le sous-jacent pour rester neutre.
- Pour une chaîne typique, la direction nette de cette couverture continue tout au long de l'après-midi produit souvent une dérive mesurable et stable dans son signe.

Cette dérive est ce que l'école d'analyse de flux « EOD pressure » cherche à lire. Le signal existe parce que la couverture pilotée par charm est mécaniquement forcée — elle ne requiert ni conviction, ni volume, ni flux directionnel. Le temps passe, les deltas bougent, les dealers rehedgent. La nature continue de ce flux est précisément ce qui le rend lisible.

---

## Pourquoi vanna et charm comptent pour la couverture des dealers

Le cadre le plus clair : le gamma est la force de couverture *réactive* — ce que font les dealers quand le prix bouge. Vanna et charm sont les forces de couverture *non pilotées par le prix* — ce que font les dealers quand la vol bouge ou que le temps passe, même avec un spot figé.

Une chronologie intraday classique illustre la différence :

- Un mouvement du spot de 0,2 % force la couverture gamma — importante et immédiate.
- Une baisse d'un point de volatilité de l'IV au cours de la matinée force la couverture vanna — faible minute par minute mais persistante.
- Huit heures de décroissance temporelle jusqu'à la clôture forcent la couverture charm — faible minute par minute mais cumulativement significative.

Les trois se produisent simultanément. Sur un tape calme, le gamma est largement silencieux (mouvements faibles), et vanna et charm deviennent le flux dominant. Sur un tape violent, le gamma domine et les flux de second ordre deviennent du bruit. La pertinence de vanna et charm dépend autant du régime de volatilité que du régime gamma.

---

## Les flux de vanna dans les régimes de compression de la volatilité

L'endroit le plus net pour observer vanna sur le tape est pendant une compression soutenue de la volatilité — typiquement les jours qui suivent un pic de volatilité qui n'a pas livré le mouvement réalisé que le marché avait pricé.

Le mécanisme :

1. L'IV est poussée à la hausse par un risque perçu (CPI, FOMC, résultats).
2. Le risque passe sans produire le mouvement réalisé pricé.
3. L'IV commence à se dégonfler sur toute la chaîne.
4. La chaîne (le book des dealers) rehedge vanna en continu tout au long de cette décroissance.
5. Pour une chaîne typique orientée vers les clients acheteurs de calls, la couverture agrégée constitue un bid persistant sur le sous-jacent.

Le flux est faible minute par minute et souvent invisible pour qui ne regarde que les barres de volume. Il est le plus visible sur les graphiques intraday sous la forme d'une tendance haussière rampante dans un tape calme qui ne correspond pas au tableau des volumes — les classiques séances « tout monte sans volume » qui suivent des publications de CPI sans surprise.

Le flux **n'est pas directionnel dans son intention**. Les dealers se couvrent, ils ne parient pas. Mais l'agrégat de ce rehedging mécanique se comporte de façon indiscernable d'un bid directionnel. Le caractère du tape qui en résulte est le signe révélateur : une dérive persistante à faible volume, une volatilité réalisée faible, aucun catalyseur évident.

Le vanna grind tend aussi à *coexister* avec un régime de gamma positif — les deux effets favorisent les mêmes conditions de régime, et tous deux renforcent le caractère absorbant et amortissant du tape. Cette coexistence explique en partie pourquoi il importe de les lire ensemble.

---

## Les flux de charm vers l'échéance et vers la clôture

L'endroit le plus net pour observer charm est celui des 90 dernières minutes de la séance cash, un jour quelconque avec un flux 0DTE significatif — ce qui est désormais la norme pour SPX.

Le mécanisme :

1. Les échéances du jour dominent la chaîne près du spot.
2. Leurs deltas décroissent rapidement à mesure que la clôture approche.
3. Les dealers rehedgent cette dérive en continu.
4. Le signe directionnel de la couverture agrégée est forcé par la composition de la chaîne.
5. Le flux tend à *s'accélérer* au fil de l'après-midi à mesure que le taux de charm augmente.

C'est pour cela qu'une grande partie de l'analyse du positionnement des dealers se concentre spécifiquement sur la fenêtre de fin d'après-midi. Le flux de charm est mécaniquement forcé, stable dans son signe pour une chaîne donnée, et le plus visible durant les 60 à 90 dernières minutes, lorsque le taux de décroissance du delta atteint son pic.

Un schéma courant : le flux de charm pointe dans une direction, l'aimant gamma se trouve dans la même direction, et le tape réalisé se comprime vers cette attraction structurelle. La lecture combinée — aimant gamma + direction charm + rampe temporelle — est ce qui produit les setups de « dérive vers la clôture » les plus nets. Rien de tout cela ne constitue en soi un signal de trading ; c'est un contexte de régime qui devrait façonner la manière dont on lit une séance.

---

## Vanna et charm à l'approche de l'OPEX

L'OPEX mensuel (troisième vendredi) et l'OPEX trimestriel (troisième vendredi de mars, juin, septembre, décembre) concentrent les deux effets :

- **La décroissance de charm est maximale** durant la dernière semaine avant l'échéance mensuelle, parce que le gamma concentré dans le bucket sur le point d'expirer y est maximal.
- **La sensibilité de vanna est élevée** car la chaîne est pleine d'options sur le point d'expirer, dont les deltas réagissent de manière brusque à la fois au spot et à la vol.

Un tape typique de semaine OPEX — pour les régimes où cet effet se manifeste — montre une dérive rampante vers les strikes lourds du lundi au mercredi, avec le flux piloté par charm qui s'accélère vers jeudi et vendredi. La vol tend à se comprimer au fil de la semaine. La lecture combinée vanna+charm produit souvent certains des setups de « dérive structurelle » les plus nets du calendrier.

C'est aussi là que la thèse « vanna + charm à l'approche de l'OPEX » est parfois poussée au-delà de son mécanisme réel. Les effets sont réels et produisent effectivement du flux structurel, mais ce ne sont pas des signaux. Ce sont des conditions de régime qui *pourraient* produire une dérive structurelle si le régime gamma la soutient. Dans un régime de gamma négatif profond, les mêmes conditions de semaine OPEX peuvent produire une volatilité réalisée explosive plutôt qu'une compression.

---

## Comment vanna et charm interagissent avec le régime gamma

Le cadre le plus utile en un mot :

- **Dans un régime de gamma positif**, les flux de vanna et de charm renforcent le caractère amortissant et favorable au pin du tape. Le vanna grind soutient la dérive, la décroissance de charm tire vers l'aimant structurel, et le réflexe absorbant de la couverture long-gamma maintient le range.
- **Dans un régime de gamma négatif**, les flux de vanna et de charm peuvent amplifier le momentum directionnel au lieu de produire une dérive. La même décroissance de charm qui aurait fixé le prix en long-gamma peut alimenter un selloff en short-gamma si le book des dealers est positionné en ce sens.

L'implication pratique : **lisez d'abord le gamma, puis lisez vanna et charm à l'intérieur de ce cadre.** Les grecques de second ordre décrivent des forces qui existent dans tous les régimes, mais leur *effet comportemental* est filtré par le réflexe gamma. Lire vanna ou charm sans lire le gamma revient à ne lire que la moitié du book.

---

## Comment lire vanna et charm en intraday

Un court workflow :

1. **Identifiez d'abord le régime gamma.** Le gamma positif soutient les lectures de dérive structurelle ; le gamma négatif les inverse.
2. **Vérifiez si la vol se comprime.** Une décroissance de l'IV sur plusieurs jours au cours de la matinée est le setup qui alimente typiquement les flux de vanna. Un pic de volatilité inverse le sens du flux.
3. **Surveillez la fenêtre de charm.** Les 90 dernières minutes sont le moment où charm est le plus marqué. Recherchez une concordance de signe entre la direction de charm et l'aimant gamma — les deux pointant dans la même direction constituent le setup le plus net.
4. **Recoupez avec les dates d'OPEX.** L'OPEX mensuel et l'OPEX trimestriel concentrent les deux flux. Traitez-les comme des amplificateurs de régime.
5. **Décomptez lors des jours de pic de volatilité.** Quand la volatilité réalisée s'étend, les flux de vanna comme de charm sont dominés par les réactions gamma. La lecture de second ordre devient du bruit.

La discipline ne consiste pas à poursuivre directement le vanna grind ou la dérive de charm — mais à les utiliser comme contexte supplémentaire qui affine la lecture du gamma.

---

## Comment ZeroGEX met en évidence vanna et charm

Le dashboard traite vanna et charm comme des superpositions sur la lecture structurelle, et non comme des signaux autonomes :

- **L'exposition charm-at-spot** est l'un des inputs essentiels du signal avancé EOD Pressure, qui estime la dérive directionnelle vers la clôture à partir de la combinaison des termes de charm et de pin durant la fenêtre active.
- **Les flux de vanna et de charm** sont mis en évidence sur des panneaux dédiés qui montrent le flux agrégé de couverture des dealers pour chaque grecque sur l'ensemble de la chaîne.
- **Le graphique de profil par strike** permet de voir où les expositions gamma, vanna et charm se concentrent ensemble, ce qui correspond généralement aux lectures combinées les plus nettes.

![Panneaux de flux vanna et charm de ZeroGEX](/blog/zerogex-vanna-charm-flows.png)

Un exemple détaillé. Supposons que le SPX soit à 5 830 un vendredi après-midi, et que le dashboard affiche :

- **Net GEX :** +1,4 Md$
- **Gamma Flip :** 5 810
- **Strike gamma le plus lourd :** 5 825
- **Charm-at-spot :** orienté modérément à la baisse
- **Tendance du flux de vanna au cours de la matinée :** cohérente avec une compression de la volatilité
- **Score EOD Pressure :** −0,4 (déclenché, légère dérive baissière)

La lecture composite : régime long-gamma, aimant structurel juste sous le spot, décroissance de charm pointant dans la même direction, vanna grind cohérent avec la baisse de vol de la matinée. Biais pratique vers la clôture : une dérive baissière vers 5 825 constitue le scénario le plus probable, avec l'aimant gamma absorbant le mouvement et la décroissance de charm confirmant la direction. Rien de tout cela n'est un signal de trading — c'est le contexte de régime composite pour la dernière heure de séance.

![Panneaux de score EOD Pressure et charm-at-spot de ZeroGEX durant la fenêtre de fin d'après-midi](/blog/zerogex-eod-pressure-charm.png)

---

## Idées reçues courantes sur vanna et charm

Quelques pièges :

- **« Vanna est haussier. »** Ce n'est pas le cas. C'est le réflexe des dealers face aux mouvements de l'IV. Le signe directionnel de ce réflexe dépend de la composition de la chaîne ; sur une chaîne typique client-acheteur-de-calls durant une compression de volatilité, l'*agrégat* tend à être un bid — mais c'est une affirmation de régime, pas une propriété de la grecque.
- **« Charm est un signal. »** Le flux piloté par charm est une force structurelle, pas un trade. Il produit une tendance à la dérive dans la dernière heure ; il ne vous dit pas quand entrer.
- **« Vanna et charm ne comptent que pendant la semaine OPEX. »** Ils y sont les plus marqués, mais la décroissance de charm compte chaque jour comportant un flux 0DTE significatif — ce qui concerne désormais la plupart des jours.
- **« Le vanna grind fonctionne toujours en compression de volatilité. »** Uniquement quand la composition de la chaîne le soutient et que le régime gamma ne s'y oppose pas.
- **« La couverture de charm s'estompe après la clôture. »** C'est vrai — mais le flux s'est déjà produit d'ici là. L'important est de le lire pendant la fenêtre active, pas après.

---

## À retenir

> Le gamma est la force de couverture réactive. Vanna et charm sont les forces de couverture non pilotées par le prix — ce que font les dealers quand la vol bouge ou que le temps passe, même avec un spot figé.

Les grecques de second ordre décrivent des flux réels dans le book des dealers que la seule lecture de premier ordre ne permet pas de voir. Elles produisent le grind persistant en compression de volatilité, l'attraction structurelle vers la clôture les jours fortement 0DTE, et la dérive de semaine OPEX vers les strikes lourds — quand, et seulement quand, le régime gamma les soutient.

Intégrez-les à votre lecture. Ne les mettez pas en tête.

Contenu à visée éducative uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous souhaitez voir en temps réel les flux de vanna et charm du jour, ainsi que le régime gamma qui détermine s'ils produiront une dérive ou seront balayés, le dashboard gratuit de ZeroGEX affiche tout cela.
