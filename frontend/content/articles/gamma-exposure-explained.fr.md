# Gamma Exposure (GEX) expliqué : le guide complet

*La gamma exposure expliquée depuis le début — ce qu'est le GEX, comment le gamma des dealers est calculé et signé, pourquoi le régime au-dessus et en dessous du flip se comporte de manière si différente, et comment l'utiliser concrètement en séance.*

---

## Pourquoi la gamma exposure compte

L'essentiel de l'action des prix que les traders essaient de lire sur un graphique est un effet en aval de quelque chose qui se produit un niveau plus bas : les **flux de couverture des dealers**. Les market makers se trouvent de l'autre côté de chaque transaction sur options et, pour rester delta-neutres, achètent et vendent en permanence le sous-jacent à mesure que le prix évolue. Qu'ils achètent la faiblesse ou qu'ils la vendent — qu'ils atténuent la volatilité ou qu'ils l'amplifient — dépend d'une variable structurelle : leur **gamma exposure**.

La gamma exposure (GEX) est le moyen le plus clair de lire ce que fait ce book de dealers. Elle indique si la force structurelle du marché pousse vers la stabilité ou l'instabilité, si les breakouts ont tendance à se prolonger ou à s'essouffler, et si les strikes visibles sur la chaîne d'options absorbent le flux ou le libèrent. Elle n'indique pas la direction. Elle indique le **caractère du régime** dans lequel vous évoluez — et c'est là que se trouve l'essentiel de l'avantage.

Cet article est la lecture exhaustive. Nous aborderons ce qu'est la gamma exposure, comment elle se construit à partir de la chaîne d'options, la mécanique des régimes de gamma positif contre négatif, le rôle du gamma flip et des gamma walls, ainsi que le flux de travail pratique pour utiliser tout cela en intraday. Pour des lectures plus approfondies destinées aux traders sur chaque sous-thème, ce guide renvoie vers [Comment lire un Gamma Flip](/education/how-to-read-a-gamma-flip), [Les Gamma Walls expliqués](/education/gamma-walls-explained) et [Le positionnement des dealers en 0DTE expliqué](/education/0dte-dealer-positioning-explained). Pour les Grecques de second ordre spécifiques, voir [Vanna et Charm expliqués pour les traders d'options](/education/vanna-and-charm-explained), et pour la discussion pinning contre magnet, voir [Max Pain expliqué — est-ce que ça fonctionne vraiment ?](/education/max-pain-explained).

---

## Qu'est-ce que la gamma exposure (GEX) ?

La gamma exposure est le besoin agrégé de couverture des dealers, tel qu'implicite dans le profil d'open interest de la chaîne d'options. Elle répond à une seule question : *si le spot bouge légèrement, avec quelle agressivité les dealers doivent-ils négocier le sous-jacent pour maintenir leur book delta-neutre ?*

Trois définitions rapides pour poser le reste de cet article.

### Qu'est-ce que le gamma ?

Le gamma est une Grecque de second ordre qui mesure le **taux de variation du delta** par rapport au sous-jacent. Le delta indique à quel point le prix d'une option est sensible au sous-jacent ; le gamma indique à quel point cette sensibilité elle-même est sensible. Si le delta est la vitesse, le gamma est l'accélération.

Le gamma est le plus élevé à la monnaie et décroît dans les deux directions à mesure qu'on s'éloigne du spot. Il décroît également avec le temps — les options à échéance lointaine ont moins de gamma par contrat que celles à échéance courte. Le gamma le plus fort de toute chaîne se trouve sur les strikes à la monnaie et à échéance courte, ce qui explique en partie pourquoi le flux 0DTE a remodelé aussi complètement la structure intraday.

### Pourquoi le gamma des dealers compte spécifiquement

Les dealers ne détiennent pas d'options pour spéculer. Ils les stockent comme un inventaire, en couvrant le delta aussi rapidement que possible. Leur gamma exposure détermine comment cette couverture doit évoluer à mesure que le prix bouge.

- Un dealer **short gamma** doit négocier **dans le sens** du mouvement pour rester plat — acheter quand le prix monte, vendre quand il baisse. Cette couverture amplifie le mouvement.
- Un dealer **long gamma** négocie **à contre-sens** du mouvement pour rester plat — vendre quand le prix monte, acheter quand il baisse. Cette couverture atténue le mouvement.

La gamma exposure agrégée des dealers sur l'ensemble de la chaîne est, en substance, une estimation du volume de flux sur le sous-jacent que les market makers devront faire passer lors d'un mouvement de prix donné, et dans quelle direction. C'est ce que capture le GEX.

### Une définition opérationnelle

La gamma exposure est l'ampleur en dollars (et le signe) du flux de couverture des dealers par unité de mouvement du sous-jacent, agrégée sur l'ensemble des contrats ouverts. Quand les traders demandent ce que signifie « gamma exposure expliqué » ou « qu'est-ce que le GEX », voici la réponse : c'est une estimation en temps réel de la façon dont le book des dealers va réagir au prix.

---

## Comment la gamma exposure est-elle calculée ?

Le calcul comporte plusieurs éléments mobiles, mais la structure est simple.

### La formule par strike

Pour un seul contrat d'options, la contribution à la gamma exposure des dealers (en dollars, pour un mouvement de 1 %) est approximativement :

```
contract_GEX ≈ gamma × open_interest × 100 × spot² × 0.01
```

Où :

- `gamma` est le gamma par option issu du modèle de Black-Scholes.
- `open_interest` est le nombre de contrats en cours sur ce strike.
- `100` est le multiplicateur de contrat standard.
- `spot²` convertit le gamma (qui est lui-même exprimé par dollar) en une ampleur de flux de couverture.
- `0.01` remet le résultat à l'échelle pour une interprétation « pour 1 % de mouvement », qui est la convention du secteur.

L'interprétation en dollars est ce qui rend ce chiffre utile : elle répond à « quel volume de sous-jacent les dealers doivent-ils négocier si le spot bouge de 1 % ? » — sur un seul strike, puis agrégé sur l'ensemble de la chaîne.

### La gamma exposure signée

Pour transformer une magnitude brute en signal de régime, chaque contrat est signé selon qui le détient. La convention standard suppose que :

- Les clients sont généralement nets acheteurs de calls et nets acheteurs de puts.
- Les dealers sont donc généralement nets vendeurs sur les deux — les calls vendus apportent un gamma positif au book des dealers, les puts vendus apportent un gamma négatif.

En pratique, cela produit un GEX de dealers signé par strike — positif pour les calls, négatif pour les puts — qui, une fois sommé, donne l'exposition nette du dealer sur l'ensemble de la chaîne.

Il s'agit d'une approximation. Le positionnement des dealers n'est pas directement observable ; il est déduit de l'open interest et de la convention standard « client acheteur net ». Les fournisseurs traitent les cas limites différemment, et cette hypothèse peut se révéler fausse dans des conditions de flux inhabituelles. Comme estimateur de régime, cependant, elle a fait ses preuves suffisamment longtemps pour devenir la norme.

### Net GEX contre Total GEX

Deux chiffres agrégés découlent de la même chaîne :

- Le **Total GEX** est la somme de la contribution *absolue* à chaque strike — une lecture de magnitude, indifférente au signe. Il indique la quantité de gamma présente dans le système dans son ensemble.
- Le **Net GEX** est la somme *signée* — calls moins puts. Il indique quel côté du book des dealers domine, et si le réflexe de couverture agrégé atténue ou amplifie.

La plupart des analyses de régime utilisent le Net GEX. La magnitude compte aussi — un Net GEX de +2 Md$ constitue un régime bien plus marqué que +200 M$ — mais le signe est la première lecture.

### Gamma des dealers par spot-shift contre agrégation par strike

Il existe deux manières d'extraire l'information de régime à partir de la chaîne :

1. L'**agrégation par strike** additionne la gamma exposure signée à chaque strike au spot du jour. Elle est rapide et intuitive.
2. Le **gamma des dealers par spot-shift** réévalue le gamma de chaque option à chaque prix spot hypothétique sur une grille, puis fait la somme pour obtenir une *courbe* du gamma des dealers en fonction du prix. Le passage à zéro de cette courbe est le gamma flip ; la valeur au spot du jour est le Net GEX-au-spot.

L'approche par spot-shift présente un avantage structurel : comme le Net GEX affiché et le gamma flip sont lus sur une seule et même courbe, ils ne peuvent pas se contredire. Un Net GEX positif correspond toujours à un spot situé au-dessus du flip ; un Net GEX négatif se situe toujours en dessous. L'approche par strike peut produire des signes incohérents lorsque la chaîne se déplace, ce qui explique pourquoi l'approche par spot-shift est la norme du secteur pour une analyse de régime sérieuse. La méthodologie derrière l'implémentation de ZeroGEX est documentée en détail dans [GEX et le Gamma Flip — Comment ZeroGEX les calcule](/guides/gamma-flip-calculation-before-vs-after).

---

## Régimes de gamma positif contre négatif

La lecture individuelle la plus importante dans l'analyse du positionnement des dealers est de savoir de quel côté du gamma flip se trouve le spot. Les mécaniques sont inverses l'une de l'autre — et les trades qui fonctionnent dans un régime ont tendance à être les mauvais trades dans l'autre.

### Régime de gamma positif

Au-dessus du gamma flip, les dealers sont généralement nets longs en gamma. Pour rester delta-neutres, ils couvrent les mouvements directionnels — en vendant quand le prix monte et en achetant quand il baisse. Ce réflexe a tendance à :

- Comprimer la volatilité réalisée.
- Attirer le prix vers les strikes à forte concentration de gamma, surtout à l'approche de la clôture.
- Rendre les breakouts plus difficiles à soutenir.
- Rendre les setups de retour à la moyenne plus fiables.

Le caractère du marché est **borné et absorbant**. Le comportement de pinning est plus probable, surtout à l'approche de l'OPEX et vers la clôture du marché cash. Les stratégies de vente de prime ont tendance à fonctionner plus souvent. Les setups de suivi de tendance ont un taux de réussite plus faible.

### Régime de gamma négatif

En dessous du gamma flip, les dealers sont généralement nets courts en gamma. Pour rester delta-neutres, ils couvrent avec des mouvements directionnels — en achetant quand le prix monte et en vendant quand il baisse. Ce réflexe a tendance à :

- Amplifier la volatilité réalisée.
- Faire durer les breakouts plus longtemps qu'ils ne le laissent penser.
- Accélérer les mouvements de vente à mesure qu'ils progressent.
- Rendre les setups de retour à la moyenne dangereux.

Le caractère du marché est **guidé par le momentum et amplificateur**. Les pins du régime précédent se libèrent ; les strikes qui faisaient office de résistance peuvent devenir des cibles de breakout. Les stratégies d'achat de prime et de continuation de tendance ont tendance à fonctionner plus souvent. Vouloir attraper un couteau qui tombe dans un régime de gamma profondément négatif va exactement à l'encontre du réflexe qui permettrait à un achat sur repli de fonctionner.

### Deux mises en garde importantes

Le régime est une **inclinaison probabiliste, pas une garantie**. Les chocs macro, les catalyseurs propres à une action au sein des composantes de l'indice et les événements de flux inhabituels peuvent l'emporter sur la traction structurelle, dans un sens comme dans l'autre. Un régime de spot indique *quel est le réflexe du dealer*, pas ce que feront tous les autres intervenants.

Le régime est aussi **dynamique**. Le flip se déplace à mesure que le positionnement se rééquilibre, et le spot peut le franchir plusieurs fois au cours d'une séance. Lire le régime est une activité continue, pas un rituel matinal.

---

## Le gamma flip : la frontière de régime

Le gamma flip est le niveau où le gamma agrégé des dealers croise zéro. Au-dessus, les dealers sont typiquement nets longs en gamma ; en dessous, nets courts. C'est la frontière structurelle entre les deux régimes décrits ci-dessus.

Quelques points méritent d'être précisés :

- Le flip est un **niveau, pas un mur**. Il ne résiste pas au prix comme pourrait le faire une forte concentration de strikes. Il marque une inflexion de comportement, pas une barrière structurelle.
- C'est une **ligne de régime, pas un signal directionnel**. Un spot au-dessus du flip n'est pas haussier ; un spot en dessous n'est pas baissier. Cela renseigne sur le caractère de la volatilité, pas sur la direction.
- Il est **dynamique**. À mesure que l'OI tourne et que la chaîne se repondère, le flip dérive. Un flip obsolète est un flip trompeur.
- C'est un **filtre, pas un signal**. Il indique quel plan de jeu suivre ; l'entrée doit venir d'ailleurs.

Pour le flux de travail de lecture pratique — y compris ce qui change au-dessus par rapport à en dessous, comment agir en intraday, et les erreurs courantes — voir [Comment lire un Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Les gamma walls : où les flux se concentrent

Si le flip est la frontière de régime, les gamma walls sont les frontières structurelles à l'intérieur de celle-ci. Le **call wall** est le strike au-dessus du spot portant la plus forte gamma exposure sur les calls ; le **put wall** est le strike en dessous du spot avec la plus forte gamma exposure sur les puts. Ensemble, ils dessinent la fourchette que la couverture des dealers a tendance à défendre.

Les walls se comportent très différemment dans les deux régimes :

- Dans un régime de **gamma positif**, les walls absorbent. Le réflexe des dealers autour d'eux consiste à contrer les mouvements — vendre les rallyes à l'approche du call wall, acheter les replis à l'approche du put wall.
- Dans un régime de **gamma négatif**, les walls se libèrent. Le même niveau qui résistait au prix en gamma long peut devenir une cible de breakout.

Les walls migrent aussi. Un call wall qui dérive vers le haut à mesure que le prix le teste constitue une lecture structurellement différente d'un wall qui tient. Pour le flux de travail de lecture complet, voir [Les Gamma Walls expliqués : Call Wall, Put Wall, et comment le prix réagit](/education/gamma-walls-explained).

---

## Comment le GEX façonne la volatilité intraday

La volatilité réalisée — l'amplitude effective des mouvements de prix pendant la séance — est fortement façonnée par le régime de GEX, indépendamment de la volatilité implicite (qui est ce que le marché des options intègre pour l'avenir).

La relation est structurelle :

- Un régime de gamma positif profond tend à produire une **volatilité réalisée plus faible que l'implicite**. Le réflexe d'atténuation est suffisamment fort pour supprimer des mouvements que le marché anticipait. Cela favorise souvent les stratégies de vente de prime.
- Un régime de gamma négatif profond tend à produire une **volatilité réalisée plus élevée que l'implicite**. Le réflexe amplificateur élargit les fourchettes au-delà de ce que le marché avait intégré. Cela tend à favoriser les stratégies d'achat de prime et de momentum.

La magnitude compte autant que le signe. Un passage de +2 Md$ de Net GEX à +200 M$ est un état très différent d'un passage de −2 Md$ à +200 M$, même si les deux aboutissent à un chiffre similaire. Le premier est un régime de gamma long en train de *s'estomper* ; le second en est un en train de *se construire*. La trajectoire fait partie de la lecture.

Une erreur courante consiste à utiliser le GEX comme signal directionnel — « le Net GEX monte, donc le marché monte ». Ce n'est pas ce qu'il indique. Le GEX renseigne sur le **caractère du mouvement**, pas sur sa direction. Un régime de gamma positif peut tout aussi bien dériver à la baisse qu'à la hausse, mais il aura tendance à dériver plutôt qu'à casser.

---

## Comment utiliser le GEX en intraday

Un flux de travail pratique :

### Étape 1 : Identifier le régime

Avant toute chose, vérifiez si le spot est au-dessus ou en dessous du gamma flip et quelle est l'ampleur du Net GEX. Cette seule lecture filtre une part importante des mauvais trades — contrer un mouvement alors qu'il faudrait l'accompagner, ou trader des breakouts alors qu'il faudrait les contrer.

### Étape 2 : Lire les walls au sein du régime

Repérez le call wall et le put wall actifs. Dans un régime de gamma positif, ce sont vos frontières absorbantes — la fourchette structurelle. Dans un régime de gamma négatif, ils sont plus faibles en tant que résistance et peuvent se transformer en cibles de breakout.

### Étape 3 : Surveiller la migration

Les niveaux ne sont pas statiques. Un wall qui migre avec le prix (en poursuivant le mouvement) constitue une lecture différente d'un wall qui tient. Un flip qui dérive vers le haut aux côtés du prix a des implications différentes d'un flip qui reste bloqué pendant que le spot s'en éloigne. Suivez le *changement*, pas seulement la valeur.

### Étape 4 : Tenir compte de la concentration 0DTE

Lorsque les options expirant le jour même dominent la chaîne — ce qui devient de plus en plus la norme pour le SPX pendant la séance cash — le compartiment 0DTE pilote de manière disproportionnée le comportement intraday des dealers. Le gamma pertinent est celui des strikes qui seront encore actifs à la clôture. Le traitement approfondi se trouve dans [Le positionnement des dealers en 0DTE expliqué](/education/0dte-dealer-positioning-explained).

### Étape 5 : Intégrer les Grecques de second ordre lorsque c'est pertinent

Le gamma n'est pas toute l'histoire. La vanna (couverture pilotée par la vol) crée un flux acheteur persistant dans les régimes de compression de la volatilité ; le charm (couverture pilotée par le temps) génère les flux prévisibles en fin de séance qui apparaissent dans les lectures de pression de fin de journée. L'article complémentaire [Vanna et Charm expliqués pour les traders d'options](/education/vanna-and-charm-explained) couvre les deux.

---

## Vanna et charm : l'histoire du second ordre

Le GEX est la lecture principale, mais ce n'est pas tout le book des dealers. Deux Grecques de second ordre façonnent de manière substantielle les flux de couverture des dealers en plus du gamma :

- **La vanna** est la sensibilité du delta à la volatilité implicite. Quand l'IV bouge, les deltas des options des dealers bougent même si le spot ne bouge pas — et ils doivent couvrir cela. Dans un régime de compression de la volatilité, les flux de vanna issus des calls vendus par les dealers se manifestent souvent par un flux acheteur persistant et progressif sur le sous-jacent.
- **Le charm** est la sensibilité du delta au temps. À l'approche de l'échéance, le delta des options dérive de manière prévisible — les options hors de la monnaie décroissent vers 0, celles dans la monnaie vers 1 — et les dealers doivent continuellement recouvrir cette dérive. L'endroit le plus net pour observer le charm dans le marché sont les 90 dernières minutes de la séance cash.

Les deux effets sont les plus importants lorsque le gamma est également important — c'est-à-dire lorsque les options 0DTE et à échéance courte dominent la chaîne. Lisez-les conjointement avec le GEX, pas isolément.

---

## Idées reçues courantes sur le GEX

Quelques pièges :

- **« Le gamma positif est haussier. »** Ce n'est pas le cas. Il est **stabilisant**. Le marché peut dériver à la baisse dans un régime de gamma positif ; il a simplement tendance à le faire lentement.
- **« Le Net GEX est un indicateur directionnel. »** Ce n'est pas le cas. Le signe indique le régime ; la direction vient d'ailleurs.
- **« Les niveaux de GEX sont fixes. »** Ce n'est pas le cas. Le flip, les walls et le Net GEX lui-même évoluent tous à mesure que la chaîne se repositionne.
- **« Les walls sont des supports et résistances durs. »** Ce sont des inclinaisons structurelles dont l'effet comportemental dépend du régime. Ils sont régulièrement enfoncés.
- **« Le GEX est un signal. »** Il se rapproche davantage d'un filtre. Une lecture de régime propre affine tout autre outil que vous utilisez ; elle n'indique pas, à elle seule, quand entrer en position.

---

## Ce que le GEX n'est pas (limites)

Le GEX est un estimateur des besoins de couverture des dealers, construit à partir de l'open interest sous une hypothèse standard sur qui détient quoi. Cela le rend utile, mais ce n'est pas une image complète :

- **L'OI est une photographie instantanée, pas un inventaire en temps réel.** Le positionnement des dealers évolue au cours de la journée de manières que l'OI ne capture pas.
- **La convention client-acheteur-de-calls/client-acheteur-de-puts peut se rompre.** Dans des conditions de flux inhabituelles, l'hypothèse sur le signe du dealer peut mal attribuer l'exposition.
- **Les événements macro l'emportent sur la structure.** Une surprise sur le CPI ou une annonce du FOMC peut submerger le réflexe des dealers.
- **Les catalyseurs propres à une action peuvent déplacer le GEX de l'indice indirectement.** Les résultats d'entreprises, les fusions-acquisitions et l'actualité des composantes peuvent remodeler le flux du SPX de manières qui se traduisent dans le GEX avec un décalage.
- **Les hypothèses sticky-strike contre sticky-delta** comptent pour les implémentations par spot-shift ; les fournisseurs les traitent différemment.

Le cadrage correct est que le GEX constitue la lecture individuelle la plus claire de la force structurelle pilotée par les dealers dans le marché — pas la seule force, pas une prévision, et pas un substitut à la gestion du risque.

---

## Comment ZeroGEX présente la gamma exposure

Le tableau de bord centralise les lectures en temps réel :

- La **carte Net GEX** affiche la valeur du gamma des dealers au spot (cohérente en signe avec le flip, calculée à partir d'une seule courbe).
- La **carte Gamma Flip** affiche le niveau actuel du flip avec la distance en temps réel par rapport au spot.
- Les **cartes Call Wall et Put Wall** tracent les frontières structurelles en temps réel.
- Le **graphique de profil par strike** trace le profil de gamma des dealers à travers les strikes — la courbe à partir de laquelle sont dérivés à la fois le Net GEX et le flip.
- La **heatmap strike par DTE** décompose le gamma par tranche d'échéance, mettant en évidence la concentration 0DTE qui domine de plus en plus la lecture intraday.

![Vue d'ensemble du tableau de bord ZeroGEX montrant les cartes Net GEX, Gamma Flip, Call Wall et Put Wall](/blog/zerogex-dashboard-overview.png)

Un exemple concret. Supposons que le SPX soit à 5 830 et que le tableau de bord affiche :

- **Net GEX :** +1,5 Md$
- **Gamma Flip :** 5 810
- **Call Wall :** 5 850
- **Put Wall :** 5 790

La lecture composite : le spot se situe confortablement en territoire de gamma long (20 points au-dessus du flip), le Net GEX est un chiffre positif substantiel indiquant une magnitude réelle dans le book des dealers, et la fourchette des walls est asymétrique, le call wall étant plus proche que le put wall. L'inclinaison pratique : régime de volatilité atténuée, marché favorable au retour à la moyenne, breakouts plus susceptibles de s'essouffler que de se prolonger, et comportement de pinning vers la forte concentration de gamma envisageable à l'approche de la clôture. Rien de tout cela n'est un signal de trade — c'est la toile de fond structurelle sur laquelle tout autre outil que vous utilisez devrait être calibré.

![Graphique de profil par strike de ZeroGEX avec la courbe de gamma des dealers, la ligne de flip et les walls mis en évidence](/blog/zerogex-strike-profile-overview.png)

Imaginez maintenant le même tableau de bord 90 minutes plus tard : le Net GEX s'est estompé à +300 M$ et le gamma flip a dérivé vers le haut jusqu'à 5 825, tandis que le spot est retombé à 5 818. Le régime est désormais contesté — le spot est techniquement en dessous du flip, mais seulement de quelques points, et la magnitude s'est amenuisée. C'est exactement l'état structurel où les deux régimes sont partiellement actifs, où le comportement devient instable, et où la discipline correcte consiste généralement à attendre une lecture plus nette avant de s'engager.

---

## À retenir

> La gamma exposure n'est pas une prédiction. C'est une lecture de régime — la force structurelle dans le book des dealers qui façonne le comportement du marché, mais qui ne dicte pas à elle seule la direction.

La discipline consiste à partir du régime, à lire la structure à l'intérieur de celui-ci, à observer comment les deux évoluent au fil de la séance, et à laisser le GEX filtrer quel plan de jeu a du sens plutôt que de le traiter comme un signal en soi. L'essentiel de l'avantage dans l'analyse du positionnement des dealers réside dans le fait de *ne pas prendre* les trades qui vont à l'encontre du réflexe des dealers.

Contenu purement pédagogique — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez consulter aujourd'hui la [lecture complète de la gamma exposure en temps réel](/real-time-gex-0dte) — Net GEX, le gamma flip, les call et put walls, et le profil de gamma des dealers — [le tableau de bord gratuit ZeroGEX](/spx-gamma-levels) met tout cela à disposition. Pour une comparaison côte à côte entre ZeroGEX et d'autres plateformes de gamma exposure, voir [le guide des meilleurs outils GEX](/education/best-gex-tools).
