# Hedging Flow expliqué : lire le tape des options à travers la couverture

*La plupart des outils gamma se demandent comment les dealers pourraient se couvrir si le prix bouge. Hedging Flow se demande quelle couverture l'activité sur les options du jour implique déjà, et si le gamma autour du prix est disposé à absorber cette poussée ou à l'amplifier.*

---

## Une autre question que celle du GEX

La gamma exposure est une lecture structurelle. Elle part de l'open interest inscrit dans les books et se demande : si le prix bouge, comment la couverture pourrait-elle réagir ?

Hedging Flow part au contraire du tape. Étant donné les options réellement traitées aujourd'hui, quelle couverture en actions cette activité impliquerait-elle, et dans quel sens pousse-t-elle en ce moment ?

La page associe cette estimation à une lecture de l'évolution du gamma des dealers près du prix actuel, puis condense les deux en une seule synthèse, **Gamma Weather**. Rien de tout cela n'est un signal d'achat ou de vente. Cela répond à une question plus étroite et plus utile : le tape des options pousse-t-il dans le sens du prix ou contre lui, et la structure autour du prix est-elle plus susceptible d'amortir cette poussée ou de l'amplifier ?

---

## Ce qu'est le chiffre

ZeroGEX classe le volume d'options en comparant le prix auquel il s'est traité à la cotation en vigueur à ce moment-là :

- le volume qui s'imprime près de l'ask compte comme **initié par l'acheteur** ;
- le volume qui s'imprime près du bid compte comme **initié par le vendeur** ;
- le volume au milieu du spread, le volume de la première minute de la séance et le volume sans cotation exploitable restent **non classés**.

Pour chaque contrat et chaque minute, le volume non classé est réparti selon la même proportion achat/vente que le volume classé de cette minute. Une minute-contrat sans aucun volume classé n'ajoute rien.

Le modèle suppose ensuite que le côté passif de chaque transaction classée était un market maker qui se couvre pour rester delta-neutre, et calcule les actions que cette couverture traiterait :

`(contracts bought − contracts sold) × delta × 100 × underlying price`

Le delta est signé, positif pour les calls et négatif pour les puts, de sorte que le signe du résultat donne la direction de la couverture implicite : **positif signifie que la couverture achète le sous-jacent, négatif qu'elle le vend.** Les résultats sont additionnés dans des barres fixes de cinq minutes, de 9h30 à 16h15 ET.

Deux exemples rapides, avec SPY à 660 $ :

- Un client achète 1 000 calls à un delta de 0,40 : `1,000 × 0.40 × 100 × $660 = +$26.4M`. Le market maker qui les lui a vendus est maintenant short delta, donc la couverture implicite **achète** environ 26,4 M$ de SPY.
- Un client achète 1 000 puts à un delta de −0,30 : `1,000 × (−0.30) × 100 × $660 = −$19.8M`. La couverture implicite **vend** environ 19,8 M$. Si le client avait plutôt vendu ces puts, le signe s'inverserait pour donner +19,8 M$.

---

## Ce que le chiffre n'est pas

Le mot clé est *implique*. Une lecture de +500 M$ signifie qu'environ 500 M$ d'achats du sous-jacent sont impliqués par l'activité d'options classée, selon les hypothèses du modèle. Cela ne signifie pas que les dealers ont acheté pour 500 M$ d'actions.

ZeroGEX ne voit pas qui se trouve de chaque côté d'une transaction, si une transaction a ouvert ou clôturé une position, ni ce qu'un market maker détient ou couvre réellement. L'hypothèse selon laquelle le côté passif était un market maker n'a pas encore été validée par rapport aux données de market makers classées par les bourses. C'est pourquoi la page affiche cette mise en garde sous son graphique :

> Pression de couverture estimée. Déduite des transactions d'options classées selon l'agresseur, en supposant que le côté passif de chaque print était un market maker ; cette hypothèse n'est pas validée. Pas un flux de dealers observé.

Quelques autres limites méritent d'être connues :

- chaque jambe d'un spread est classée séparément, de sorte qu'une seule transaction à plusieurs jambes peut apparaître comme des achats et des ventes distincts ;
- le delta est relevé une fois par contrat et par minute, pas à l'instant de chaque transaction ;
- l'estimation couvre les échéances et les strikes que ZeroGEX suit pour ce symbole, pas tous les contrats cotés.

---

## Les calls ne sont pas automatiquement haussiers, et les puts pas automatiquement baissiers

Comme le delta est signé, la direction de la couverture implicite dépend à la fois du type d'option et du côté qui a initié la transaction :

| Activité du client | Couverture implicite |
|---|---|
| Achète des calls | Achète le sous-jacent (+) |
| Vend des calls | Vend le sous-jacent (−) |
| Achète des puts | Vend le sous-jacent (−) |
| Vend des puts | Achète le sous-jacent (+) |

C'est pourquoi les cartes **Call-driven** et **Put-driven** décrivent d'où vient la pression, et non si elle était haussière ou baissière. Un chiffre Put-driven positif est tout à fait possible : c'est à cela que ressemblent de fortes ventes de puts. Il en va de même d'un chiffre Call-driven négatif.

---

## Les cartes : par où la journée est passée

Trois des quatre cartes résument la séance jusqu'ici :

- **Session pressure** est le total net cumulé de la pression de couverture estimée depuis l'ouverture. C'est un cumul, pas la poussée des cinq minutes en cours.
- **Call-driven** est la part de ce total qui provient des calls.
- **Put-driven** est la part qui provient des puts.

Call-driven plus Put-driven égale Session pressure. Toute différence dans les chiffres affichés vient de l'arrondi. Les cartes lisent la barre la plus récente qui a porté un flux réel, de sorte qu'une barre calme reportée n'est pas présentée comme nouvelle.

Séparez l'historique du présent. Une séance peut afficher +2 milliards de dollars de Session pressure alors que ses dernières barres sont déjà passées en négatif. Le total dit par où la journée est passée. Il ne dit pas où vont les prochaines minutes. La quatrième carte, **Last flip**, concerne le présent, et elle est traitée plus bas, dans la section sur les flips.

---

## Le graphique de flux : Pressure rate et Session cumulative

Le graphique propose deux vues.

**Pressure rate** est la vue par défaut. Chaque barre représente la pression estimée d'une seule barre de cinq minutes, prise isolément (**Pressure this bar**), avec par-dessus une ligne **3-bar average**, soit à peu près les 15 dernières minutes. La barre la plus récente peut être encore en cours de remplissage, et elle compte dans cette moyenne pendant ce temps.

**Session cumulative** trace à la place les totaux cumulés Call-driven et Put-driven ainsi que la ligne **Net hedging pressure**.

Les deux vues tracent la courbe **Price** sur l'axe de droite, et c'est là que l'information intraday utile tend à apparaître :

| Prix | Pression | Une façon de le lire |
|---|---|---|
| En hausse | Positive | Le mouvement a derrière lui une demande de couverture estimée |
| En hausse | Négative | Le prix progresse à contre-courant de la pression estimée |
| En baisse | Positive | Des achats estimés apparaissent dans la baisse |
| En baisse | Négative | Le tape des options renforce le mouvement |

La relation est généralement plus informative que la taille d'une barre isolée. Une forte impulsion qui fait à peine bouger le prix dit aussi quelque chose : l'autre côté du marché l'absorbe.

Le sélecteur de vue modifie aussi le graphique de structure situé en dessous, pour que les deux comparent toujours des choses comparables. En Pressure rate, il montre les 30 dernières minutes d'évolution structurelle. En Session cumulative, il montre l'évolution depuis l'ouverture.

---

## Les flips et la carte Last flip

Un **flip** marque un changement de direction de la moyenne sur 3 barres, et il est volontairement plus difficile à déclencher qu'un simple changement de signe :

- la moyenne doit s'installer de l'autre côté d'une **bande neutre** autour de zéro, qui s'étend, dans chaque sens, jusqu'à la moitié du rythme typique de la séance jusqu'ici. Une ligne qui franchit zéro de justesse puis revient est traitée comme plate, et non comme deux flips ;
- un flip est **significatif** quand son amplitude atteint au moins la variation typique d'une barre à l'autre observée jusqu'ici dans la séance. Les autres sont **légers**.

Les deux seuils sont construits uniquement à partir des barres antérieures au flip, de sorte que chaque flip est jugé sur ce que l'on savait à ce moment-là. La barre la plus récente est toutefois encore en cours de remplissage, si bien qu'un flip sur cette barre peut apparaître puis disparaître avant sa clôture.

Le graphique marque les flips d'un point sur la ligne zéro et d'un badge au-dessus, et par défaut il n'affiche que les flips significatifs. La carte **Last flip** est différente : elle affiche le flip le plus récent, quelle que soit sa taille, avec l'heure de début de sa barre. Quand le flip le plus récent est léger, la carte et le badge peuvent désigner des flips différents. Décochez **Significant flips only** pour voir les flips légers sur le graphique. Toutes les heures de la page sont exprimées en heure de l'Est, au format 24 heures.

---

## Dealer gamma structure : ce que rencontre la poussée

Hedging Flow estime la poussée. **Dealer gamma structure** décrit ce qui la reçoit, à partir du gamma des dealers modélisé par ZeroGEX, en pondérant chaque strike selon sa proximité avec le prix actuel. Les strikes situés à environ 1 % du prix ou moins portent l'essentiel du poids, et ceux qui en sont à plus de 8 % n'en portent aucun.

Une chose vaut pour tout ce qui figure dans cette section : l'open interest est publié une fois par jour. Ces lectures ne bougent pas parce que de nouvelles positions ont été ouvertes en intraday. Elles bougent parce que le book existant est revalorisé à mesure que le prix, le temps et la volatilité implicite changent.

Le graphique trace deux lignes :

- **Stability** mesure si le gamma proche du prix a évolué dans un sens qui devrait amortir le mouvement (au-dessus de zéro, vers le pinning) ou l'amplifier (en dessous de zéro, vers l'accélération).
- **Lean** compare l'évolution du gamma sous le prix à son évolution au-dessus du prix. Au-dessus de zéro, la lecture est **Supportive** : du gamma qui se construit sous le prix, qui s'érode au-dessus, ou les deux. En dessous de zéro, elle est **Capping** : l'inverse.

Les deux mesurent une variation, pas un niveau. Une lecture orientée vers le pinning ne signifie pas que l'ensemble du book est long gamma. Elle signifie que la structure proche du prix a évolué dans un sens amortissant sur la fenêtre considérée.

Le libellé à côté du titre combine les deux lignes, chacune séparée à zéro : **Firming** (stabilisant, porteur), **Capping** (stabilisant, gamma qui se construit au-dessus), **Fragile bid** (porteur mais qui s'amincit) et **Deteriorating** (qui s'amincit et plafonne). Gamma Weather, plus bas, classe la même lecture Stability avec une bande neutre, si bien que le graphique peut afficher Firming tandis que le bandeau Weather affiche Flat. Ce n'est pas une contradiction : une petite lecture positive est les deux à la fois.

---

## Gamma Weather : le bandeau en haut de page

**Gamma Weather** est la lecture combinée affichée en haut de la page. Il affiche un état principal, depuis combien de temps cet état tient, un résumé en une phrase, et cinq pastilles : **Pressure now**, **Lean**, **Stability**, **Gamma trend** et **Flip cushion**. Cliquez sur n'importe quelle pastille pour ouvrir un graphique de ce champ sur la séance, avec la trace des moments où il a changé.

Weather lit toujours toutes les échéances suivies, et il lit la barre la plus récente qui dispose à la fois d'un flux de couverture et d'une lecture de structure.

### Pressure now

**Pressure now** traduit la dernière barre et sa moyenne sur 15 minutes en une direction, et la règle est plus stricte que ne le suggèrent les libellés :

- **Buying :** la dernière barre et la moyenne sur 15 minutes sont toutes deux positives, et au moins l'une d'elles dépasse 25 M$.
- **Selling :** l'image miroir.
- **Mixed :** tout le reste. Les deux divergent, l'une d'elles vaut exactement zéro, les deux restent dans la limite de 25 M$, ou l'historique est encore insuffisant. Les deux premières barres de chaque séance affichent Mixed.

Mixed n'est pas synonyme de calme. Cela signifie que la poussée immédiate et la poussée sur la fenêtre courte ne concordent pas assez pour désigner une direction. Le plancher de 25 M$ est le même pour tous les symboles, c'est donc un seuil plus bas pour le SPX que pour SPY ou QQQ.

À côté de la direction, la pastille indique à quel point elle est installée :

- **Pulse :** le premier indice, pas encore un état installé.
- **Building :** deux des trois dernières barres dépassent 25 M$ dans ce sens, et la moyenne sur 15 minutes aussi.
- **Persistent :** les trois barres le font.
- **Reversed :** affiché sur l'unique barre où un côté établi cède, après deux barres de l'autre côté. Tant que c'est en suspens, une pastille **Pressure reversing · 1/2** apparaît.

### Lean, Stability et Gamma trend

**Lean** reprend le Lean à 30 minutes du graphique, lu selon son signe : toute lecture supérieure ou égale à zéro est Supportive.

**Stability** reprend la Stability à 30 minutes du graphique, avec une bande de 50 M$ autour de zéro : **Pinning** au-dessus de +50 M$, **Accelerative** en dessous de −50 M$, **Flat** entre les deux. Comme le plancher de pression de 25 M$, la bande est la même pour tous les symboles.

**Gamma trend** est la même mesure de Stability, prise par rapport à la première barre de la séance au lieu d'il y a 30 minutes : **Building**, **Thinning** ou **Flat**. Cela vous donne deux horloges. Gamma trend sur Building à côté de Stability sur Accelerative n'est pas une contradiction : cela peut signifier que la structure s'est améliorée plus tôt dans la journée et reste meilleure qu'à l'ouverture, mais qu'elle a commencé à se détériorer récemment.

### Flip cushion

Le **Flip cushion** est la distance entre le prix et le gamma flip modélisé par ZeroGEX, en points, quel que soit le côté où se trouve le prix. La pastille affiche la distance avec son sens d'évolution, par exemple « 4 pts · Narrowing ». La ligne sous les pastilles précise de quel côté du flip se trouve le prix, la bande, et la variation sur les 5 et 15 dernières minutes.

Des points seuls n'auraient pas le même sens d'un symbole à l'autre, donc la bande évalue le cushion par rapport à la fourchette typique de 30 minutes du sous-jacent, c'est-à-dire la fourchette médiane, du plus haut au plus bas, des fenêtres de 30 minutes sur les cinq derniers jours calendaires :

| Cushion par rapport à la fourchette typique de 30 minutes | Bande |
|---|---|
| Jusqu'à 0,25× | Crossing |
| Jusqu'à 0,60× | Thin |
| Jusqu'à 1,25× | Normal |
| Au-delà de 1,25× | Secure |

Le sens d'évolution affiche **Narrowing**, **Widening** ou **Steady** sur les 15 dernières minutes. Deux détails comptent :

- Narrowing signifie que l'écart s'est réduit. Cela ne veut pas forcément dire que le prix s'est rapproché d'une ligne fixe, car le flip bouge lui aussi.
- Le cushion n'a pas de signe. Quand le prix franchit le flip, le cushion se réduit jusqu'à zéro puis s'élargit à nouveau de l'autre côté. Un Widening juste après un franchissement ne signifie pas que les conditions sont devenues plus sûres.

Quand la bande est Thin ou Crossing et que, en l'espace de 15 minutes, le cushion s'est refermé d'au moins un quart de la marge restante, la pastille affiche **Thin and closing** et un indicateur **Transition risk** apparaît sur le bandeau.

### Comment l'état principal est déterminé

L'état principal ne combine que deux pastilles, Pressure now et Stability :

| Pressure now | Stability | Gamma Weather |
|---|---|---|
| Mixed | Quelconque | Mixed |
| Buying | Pinning ou Flat | Stable bid |
| Buying | Accelerative | Fragile rally |
| Selling | Pinning ou Flat | Supported dip |
| Selling | Accelerative | Unstable |

Un nouvel état doit apparaître sur deux barres de cinq minutes consécutives avant de remplacer l'état principal actuel, et la plus récente des deux peut être encore en cours de remplissage. Pendant cette attente, le bandeau l'affiche comme en formation, par exemple **Fragile rally forming · 1/2**. Une fois qu'un état est installé comme état principal, son âge affiche **New**, puis **Established** à 15 minutes, **Confirmed** à 30 et **Mature** à 60.

Lean, Gamma trend, le Flip cushion, Session pressure et le prix ne déterminent pas l'état principal. Ils forment le contexte autour de lui. Le cushion, en particulier, nuance l'état ; il ne lui fait jamais concurrence.

Les noms ne sont pas des affirmations sur le prix. « Fragile rally » n'exige pas que le prix soit en train de monter : cela désigne une pression acheteuse face à une structure devenue accélératrice. « Supported dip » n'exige pas de repli visible : cela désigne une pression vendeuse face à une structure qui tient ou se raffermit. Lisez Weather comme une description de l'interaction entre la poussée actuelle et la structure actuelle, pas comme une prévision.

---

## Lire un exemple en direct

![Hedging Flow de SPY à 14h56 ET le 28 septembre 2026 : Gamma Weather, les quatre cartes, le graphique Pressure rate et la structure du gamma des dealers](/blog/zerogex-hedging-flow-spy-2026-09-28-cropped.png)

Voici SPY à 14h56 ET le 28 septembre 2026, capturé avec le bouton d'instantané de la page. Chaque séance passée est archivée dans les [séances Hedging Flow](/hedging-flow/sessions), avec une page datée par symbole. Cliquez sur l'image pour l'agrandir. Les niveaux de prix ci-dessous sont lus sur le graphique, considérez-les donc comme approximatifs.

**Les cartes.** Session pressure affiche −4,76 Md$ : soit une estimation de 4,76 milliards de dollars de ventes de SPY impliquées par les transactions d'options classées de la journée. Les deux books ont contribué presque à parts égales, −2,50 Md$ venant des calls et −2,26 Md$ des puts. Selon le modèle, il s'agit de clients qui vendent des calls et achètent des puts, et les deux impliquent une couverture vendeuse.

**Le prix n'a pas suivi le total.** SPY a ouvert vers 767,75 $, a touché environ 768,40 $ avant 10h00, puis a glissé jusqu'à environ 763,95 $ à 10h51, et la plus forte série de barres vendeuses est apparue pendant cette baisse. Il avait tout récupéré à 12h25 et, à part une pointe jusqu'au plus haut du jour, vers 768,80 $, à 13h10, il a passé l'après-midi entre environ 766,40 $ et 767,50 $. Au moment de l'instantané, il se trouvait à moins d'un dollar de son premier print. Les deux brusques sursauts, vers 12h20 et 13h10, sont arrivés avec les plus grosses barres acheteuses de la journée, et le second a été aussitôt effacé, à côté d'une grosse barre vendeuse. Le total est resté profondément négatif alors que le prix revenait entièrement, et c'est tout l'intérêt de séparer Session pressure et Pressure rate : le premier indique par où le tape est passé, pas où le prix doit aller.

**L'historique de Weather.** Le panneau Pressure now colore chaque barre selon l'état de Weather à ce moment-là : Mixed pendant la première heure, Unstable pendant la baisse de fin de matinée, Supported dip pendant que le prix formait une base vers 765 $, Stable bid pendant le rallye de la mi-journée, et plusieurs changements depuis.

**En ce moment.** La moyenne sur 3 barres est passée côté achat à 14h45, ce que montre la carte Last flip. C'était le 13e flip marqué par le graphique ce jour-là, un tape agité selon cette mesure. Une pression acheteuse avec une pastille Stability sur Flat a donné l'état principal **Stable bid**, qui tenait depuis 10 minutes. Mais la barre de 14h55, vieille d'environ une minute au moment de l'instantané, s'imprimait déjà du côté vendeur. Pressure now affiche Mixed, **Mixed forming · 1/2** montre le candidat, et **Pressure reversing · 1/2** montre le côté acheteur en train de céder depuis une barre. L'en-tête ne passe à Mixed que si la barre suivante le confirme, et cette barre vieille d'une minute peut encore changer avant sa clôture.

**Structure.** Stability est sur Flat : la variation sur 30 minutes du gamma proche du prix reste dans la limite de 50 M$ dans un sens comme dans l'autre. Lean est sur Supportive. Le libellé du graphique indique Fragile bid pour ces deux mêmes lectures, car il sépare à zéro et Stability se situe un cheveu en dessous tandis que Lean est un cheveu au-dessus. Gamma trend est sur Thinning : le gamma proche du prix s'est aminci depuis l'ouverture. Les lignes de structure ont fait leurs plus grands mouvements en même temps que le prix, toutes deux sous −1,2 Md$ au plus bas de 10h50 et Stability près de +1,35 Md$ au plus haut de 12h25. Cela correspond à un book fixe revalorisé à mesure que le prix le traverse.

**Flip cushion.** SPY se situe environ 3 points sous le gamma flip modélisé, en bande Secure, avec un cushion qui s'élargit lentement. Sous le flip, c'est le côté que notre [guide du gamma flip](/education/how-to-read-a-gamma-flip) décrit comme généralement short gamma, où la couverture tend à amplifier les mouvements, et « Secure » indique que le prix aurait besoin de plus que la fourchette d'une demi-heure typique pour atteindre le flip. Cela ne dit pas que les conditions sont calmes. Weather lit la variation du book sur la dernière demi-heure ; le cushion lit dans quel régime se trouve le prix. Ici, ils pointent dans des directions différentes : un état principal Stable bid, dans le régime amplificateur.

**Au total :** une journée de fortes ventes de couverture estimées, surtout visibles pendant la baisse de fin de matinée, dont le prix s'est depuis entièrement remis, une poussée passée à l'achat à 14h45 et qui vacillait déjà à 14h55, une structure proche du prix plate pour l'instant et plus mince qu'à l'ouverture, et un prix confortablement du côté amplificateur du flip. C'est une lecture très différente de « −4,76 Md$, donc baissier ».

---

## Comment l'utiliser

Hedging Flow fonctionne mieux comme contexte pour une idée de trade, pas comme l'idée elle-même.

Prenez un test de put wall. Avec Pressure now sur Buying, Stability sur Pinning et un cushion qui s'élargit, ce test se déroule dans un environnement très différent de celui du même wall testé avec une pression Selling, une Stability Accelerative et un cushion mince qui se referme. Le niveau n'a pas changé. Les conditions autour de lui, si. Il en va de même pour le VWAP, le range d'ouverture, le gamma flip, et les call et put walls.

La page s'inscrit dans une séquence simple :

1. **Où sont les niveaux ?** Les niveaux gamma de ZeroGEX y répondent.
2. **Dans quel sens le tape des options pousse-t-il en ce moment ?** Hedging Flow.
3. **La structure autour du prix est-elle susceptible d'absorber cette poussée ou de l'amplifier ?** Dealer gamma structure et Gamma Weather.

Hedging Flow est aussi différent de Forced Flow, même si les deux partagent les mêmes unités et la même convention de signe. Hedging Flow lit les transactions du jour et dit quelle pression elles ont créée. Forced Flow lit le book en place et demande quelle pression il créerait en cas de mouvement du prix, du temps ou de la volatilité.

---

## Une remarque sur l'interrupteur 0DTE only

L'interrupteur **0DTE only** limite la partie flux de la page aux contrats qui expirent le jour même : les quatre cartes, le graphique de flux, ses marqueurs et son badge de flip, et le graphique du panneau Pressure now. L'état principal et les pastilles de Gamma Weather, ainsi que le graphique Dealer gamma structure, ne changent pas. Ils lisent toujours toutes les échéances suivies, car la structure est une propriété de l'ensemble du book, et cela inclut la pression derrière la pastille Pressure now.

Pour la référence page par page, voir la [page d'aide Hedging Flow](/help/platform/hedging-flow). Pour la mécanique sous-jacente, voir [Pourquoi les market makers tradent l'action](/education/why-market-makers-trade-stock), [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip) et [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.
