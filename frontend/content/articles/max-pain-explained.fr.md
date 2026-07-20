# Le Max Pain expliqué — et fonctionne-t-il vraiment ?

*Le max pain expliqué honnêtement — ce que c'est, la théorie invoquée pour le justifier, les preuves quant à savoir si le max pain déplace réellement le prix, et comment l'utiliser sans le surpondérer.*

---

## Pourquoi cette question mérite d'être posée

Le max pain est l'un de ces concepts qui vit dans deux mondes très différents. Dans l'univers retail des options, on le cite presque comme une loi physique — *« le prix est attiré vers le max pain à l'expiration. »* Dans l'univers institutionnel, on le traite comme une théorie populaire qui décrit parfois un pinning réel, mais qui reçoit probablement le crédit d'effets en réalité provoqués par autre chose. La vérité, comme souvent, se situe entre les deux — mais plus proche de la vision institutionnelle que de la vision retail.

Cet article propose la lecture honnête. Nous allons définir le max pain, passer en revue son calcul, exposer la théorie invoquée pour le justifier, puis examiner ce que les preuves disponibles suggèrent réellement quant à savoir si le max pain *déplace* le prix ou se contente de *décrire* où le prix finit par se situer. Tout au long du texte, l'objectif est de vous donner un modèle mental exploitable — ni un outil de prédiction, ni une démystification.

Pour le contexte, le max pain interagit directement avec le cadre plus large du positionnement des dealers. Si ce n'est pas déjà fait, l'article pilier [Gamma Exposure expliqué](/education/gamma-exposure-explained) couvre les mécanismes structurels, et les articles [Comment lire un Gamma Flip](/education/how-to-read-a-gamma-flip) et [Gamma Walls expliqués](/education/gamma-walls-explained) couvrent les niveaux avec lesquels le max pain est souvent confondu.

---

## Qu'est-ce que le max pain ?

Le max pain est le strike auquel le paiement total aux détenteurs d'options à l'expiration serait minimisé — de façon équivalente, le strike auquel le plus grand notionnel agrégé d'options expire sans valeur.

Lorsque les traders demandent « qu'est-ce que le max pain », ils posent généralement l'une de deux questions liées : *quel strike la structure de la chaîne est-elle construite pour favoriser à l'expiration*, ou *vers quel strike la structure du marché des options suggère-t-elle que le prix pourrait graviter*. Ces deux formulations sont raisonnables. La première est un fait de définition ; la seconde est une hypothèse quant à savoir si ce fait structurel a un effet comportemental sur le prix.

L'intuition : à un strike donné, chaque call dans la monnaie et chaque put dans la monnaie représente un paiement dû à son détenteur à l'expiration. Additionnés sur l'ensemble de la chaîne, ces paiements sont fonction de l'endroit où atterrit le spot. Il existe un prix — le strike de max pain — qui minimise ce paiement total. Si le prix expire à cet endroit, le plus grand montant en dollars de positions longues sur options finit sans valeur.

La théorie populaire fait alors un saut : si les *vendeurs* d'options (souvent des dealers, market makers ou vendeurs institutionnels) bénéficient collectivement du fait que le prix expire au max pain, peut-être que les flux structurels du marché poussent le prix vers ce niveau. Ce saut est la partie qui mérite d'être examinée honnêtement.

---

## D'où vient le concept

Le terme max pain provient d'un corpus de recherche retail sur les options remontant au début des années 2000, appliqué initialement aux options sur actions individuelles autour des expirations mensuelles. L'observation originale était empirique : les prix de clôture lors de l'OPEX mensuelle, en particulier pour les actions individuelles présentant un open interest concentré, semblaient se regrouper près du strike qui minimisait le paiement aux détenteurs d'options.

Ce regroupement était réel. Le mécanisme qui le produisait — et la fiabilité avec laquelle il se généralise — est beaucoup plus contesté. Plusieurs mécanismes différents pourraient produire la même observation :

1. **Le gamma-pinning des dealers** sur des strikes lourds (qui coïncide souvent avec le max pain).
2. **Une manipulation réelle** par de gros vendeurs d'options, sur des marchés où cela est plausible.
3. **Un biais de sélection** — l'observation se concentre sur les cas où le pinning s'est produit et ignore les cas où il ne s'est pas produit.
4. **Un open interest concentré sur des strikes psychologiquement ronds** dont le prix était déjà proche.

Démêler ces mécanismes est difficile, et la littérature empirique est mitigée. Des effets de pinning près des dates majeures d'OPEX mensuelle ont été observés dans certaines études, mais les effets sont généralement faibles, et s'estompent ou disparaissent souvent sur des échantillons plus larges et sur les produits indiciels.

---

## Comment calcule-t-on le max pain ?

Le calcul est mécanique :

1. Pour chaque strike de la chaîne d'options, on suppose que le spot expire à ce strike.
2. On calcule la valeur intrinsèque totale de tous les calls dans la monnaie (`max(0, S − K) × OI`) à cette clôture hypothétique.
3. On calcule la valeur intrinsèque totale de tous les puts dans la monnaie (`max(0, K − S) × OI`) à cette clôture hypothétique.
4. On additionne les deux — c'est le paiement total aux détenteurs d'options à cette clôture hypothétique.
5. On répète l'opération pour tous les strikes ; celui avec le total le plus faible est le strike de max pain.

Le calcul n'utilise que l'**open interest** et les **strikes** — pas de grecques, pas de volatilité implicite, pas d'hypothèse sur le signe du dealer. Cela le rend peu coûteux et facile à calculer, ce qui explique en partie sa diffusion. C'est aussi en partie pourquoi il est structurellement plus faible que les lectures fondées sur le gamma des dealers : il ne sait rien de la façon dont les dealers se couvrent réellement.

Le résultat est un strike unique (ou parfois une petite fourchette de strikes presque égaux), recalculé à chaque instantané de la chaîne. Comme tout autre niveau dérivé de la chaîne, le max pain est **dynamique** — il se déplace au fur et à mesure que l'open interest tourne au cours de la journée et d'une séance à l'autre jusqu'à l'expiration.

---

## La théorie : pourquoi le max pain « devrait » fonctionner

L'argument standard est mécaniste :

1. Les vendeurs d'options (dealers, market makers et vendeurs institutionnels) paient collectivement la portion dans la monnaie du book d'options à l'expiration.
2. Ils ont intérêt à minimiser ce paiement.
3. Ils ont donc intérêt à ce que le spot expire au strike qui minimise le paiement total — le strike de max pain.
4. Par leur activité de couverture ou de trading, ils exercent une pression structurelle pour pousser le spot vers ce strike, en particulier près de l'expiration.

C'est une histoire cohérente. C'est aussi là que l'honnêteté doit commencer. L'argument présente plusieurs points faibles :

- **Les dealers gèrent des books delta-neutres.** Leur P&L est dominé par la capture de spread, pas par des résultats directionnels à l'expiration. L'idée que « les dealers veulent le prix au max pain » suppose un book directionnel qu'ils n'ont généralement pas.
- **Le mécanisme de couverture n'est pas l'argument du paiement au vendeur.** Si les dealers fixent effectivement le prix près d'un strike, c'est généralement via la couverture *gamma* — le réflexe qui les oblige à vendre la force et à acheter la faiblesse lorsqu'ils sont longs en gamma — un mécanisme différent, parfois orienté vers un strike différent du max pain.
- **La version « manipulation » de l'histoire** — de gros vendeurs négociant activement le sous-jacent pour défendre un strike — est plausible sur certains marchés d'actions individuelles peu liquides, et beaucoup moins plausible sur des produits indiciels liquides comme le SPX.

Autrement dit, le *résultat* que prédit la théorie du max pain (le prix gravitant vers un strike structurel) se produit parfois, mais le *mécanisme* invoqué n'est généralement pas le mécanisme réel.

---

## Le max pain fonctionne-t-il vraiment ?

La réponse honnête est : **parfois, faiblement, et généralement parce que quelque chose d'autre fait le travail.**

Quelques formulations qui tiennent la route :

### Le mécanisme le plus propre est le gamma pinning, pas la minimisation du paiement

Lorsque le prix se fixe *effectivement* près d'un strike structurel à l'expiration — en particulier lors de l'OPEX mensuelle sur les produits indiciels — le mécanisme est presque toujours la couverture gamma des dealers dans un régime de gamma positif, et non l'argument du paiement au vendeur derrière le max pain. Le gamma se concentre sur les strikes à open interest élevé, et dans les régimes long-gamma, le réflexe du dealer attire réellement le prix vers les strikes à fort gamma via l'activité de couverture normale.

Le max pain coïncide souvent avec une forte concentration de gamma (les deux dépendent de la localisation de l'open interest), ce qui explique pourquoi les deux lectures concordent fréquemment. Mais lorsqu'elles *divergent*, la lecture fondée sur le gamma tend à être la plus fiable — parce qu'elle repose sur un mécanisme de couverture que les dealers utilisent réellement, et non sur un book directionnel qu'ils n'ont généralement pas.

### L'effet, lorsqu'il est présent, est faible et concentré près des OPEX majeures

Les études sur les effets de pinning dans les options sur actions ont généralement mis en évidence un regroupement faible mais mesurable des prix de clôture près des strikes à open interest élevé lors des expirations mensuelles, en particulier sur les actions individuelles. Sur le SPX et les produits indiciels, l'effet est beaucoup plus difficile à détecter et d'une ampleur bien plus faible. Même là où il a été observé, l'effet se mesure généralement en dizaines de points de base de dérive attendue sur la dernière séance — bien plus faible que l'amplitude réalisée typique de la journée.

### Il est le plus souvent évoqué comme une description, pas une prédiction

Même les traders qui surveillent le max pain de près tendent à l'utiliser comme **contexte**, et non comme un niveau contre lequel trader. La formulation est « si tout le reste est équilibré, attendez-vous à une certaine traction structurelle vers ce strike près de l'expiration » — et non « le max pain est à X, donc le prix ira là-bas. »

### Où il ne fonctionne définitivement pas

Quelques formulations à éviter :

- **Le max pain comme cible intrajournalière.** La version retail de la théorie est souvent étirée jusqu'à « le prix se dirige vers le max pain aujourd'hui » — aucun mécanisme ne soutient cela sur des horizons intrajournaliers pour des produits indiciels liquides.
- **Le max pain comme pin rigide.** Même là où des effets de pinning existent, ce sont des tendances statistiques observées en moyenne, pas des résultats fiables pour chaque expiration individuelle.
- **Le max pain dans un régime de gamma profondément négatif.** Lorsque le réflexe du dealer amplifie les mouvements au lieu de les amortir, toute thèse de pinning fondée sur des strikes lourds — max pain ou autre — s'inverse. Le strike devient un vecteur de breakout, pas un aimant.

---

## Le max pain face au gamma magnet

Le cousin mécanique le plus proche du max pain est ce qu'on appelle parfois le **gamma magnet** — le strike présentant la plus forte concentration de gamma des dealers près de l'expiration. Dans un régime de gamma positif, le gamma magnet attire souvent *réellement* le prix près de l'expiration, via le mécanisme de couverture décrit ci-dessus.

La différence pratique :

- **Le max pain** répond à : *où le paiement aux détenteurs d'options est-il minimisé à l'expiration ?*
- **Le gamma magnet** répond à : *où la concentration de couverture des dealers est-elle la plus forte, et dans quelle direction tire-t-elle ?*

Lorsque les deux strikes sont proches — ce qui arrive souvent —, les deux lectures concordent, et la traction structurelle tend à être visible sur le tape. Lorsqu'elles divergent, la lecture gamma l'emporte généralement, car le réflexe gamma est le mécanisme de couverture réel qui produit le pin.

Un trader qui utilise le max pain seul lit le *résultat* du book des dealers sans lire le book des dealers lui-même. Lire les deux — le max pain *et* le profil gamma — constitue le workflow le plus propre.

---

## Comment utiliser le max pain sans le surpondérer

Une formulation pragmatique :

1. **Traitez le max pain comme un contexte, pas comme une cible.** C'est un point de donnée structurel sur l'équilibre de la chaîne ; ce n'est pas une prévision.
2. **Vérifiez-le en le croisant avec le gamma magnet.** Si le strike à plus fort gamma et le max pain concordent, la thèse du pin (là où elle existe) est plus nette. En cas de divergence, privilégiez par défaut la lecture gamma.
3. **Accordez-lui le plus de poids près de l'OPEX mensuelle, le moins en intrajournalier.** L'effet faible qui existe est concentré près de l'expiration. Lire le max pain en intrajournalier un mardi ordinaire vous en apprend très peu.
4. **Lisez toujours le régime en premier.** Un régime long-gamma est le seul régime dans lequel une thèse de pinning quelconque — max pain ou autre — dispose d'un mécanisme structurel sous-jacent. Dans les régimes short-gamma, écartez entièrement la thèse du pin.
5. **Utilisez-le pour *cadrer* des trades, pas pour y *entrer*.** Un régime long-gamma, un gamma magnet qui concorde avec le max pain à quelques points au-dessus du spot, et une date d'OPEX pourraient tous ensemble plaider pour vendre les rallyes vers ce niveau. Rien de tout cela, pris isolément, ne constitue un trade.

---

## Comment ZeroGEX affiche le max pain

Le dashboard affiche le max pain aux côtés des lectures de gamma des dealers afin qu'elles puissent être vérifiées par recoupement plutôt que lues isolément :

- **La carte Max Pain** affiche le strike de max pain actuel avec la distance en dollars et en pourcentage par rapport au spot, en temps réel.
- **La carte Gamma Flip** indique si le spot se trouve dans le régime long-gamma (où les thèses de pinning ont un mécanisme) ou dans le régime short-gamma (où elles n'en ont pas).
- **Les cartes Call Wall et Put Wall** montrent où se situe réellement la concentration de gamma des dealers.
- **Le graphique de profil par strike** affiche la courbe de gamma des dealers afin que le gamma magnet soit directement visible.

![Carte Max Pain du dashboard ZeroGEX avec distance en temps réel par rapport au spot](/blog/zerogex-max-pain-card.png)

Un exemple chiffré. Supposons que le SPX soit à 5 830 le matin d'une OPEX mensuelle, et que le dashboard affiche :

- **Max Pain :** 5 820
- **Gamma Magnet (strike à plus fort gamma) :** 5 820
- **Net GEX :** +1,6 Md$
- **Gamma Flip :** 5 805

La lecture du max pain et celle de la concentration de gamma concordent toutes deux à 5 820, le régime est solidement long-gamma, et c'est l'OPEX mensuelle. La lecture structurelle : la thèse de traction vers 5 820 est aussi bien étayée que possible. Inclinaison pratique : dérive vers 5 820, vente des rallyes au-dessus, achat des replis jusqu'à ce niveau. Toujours une inclinaison probabiliste — pas une garantie —, mais chaque condition structurelle susceptible de *produire* un pinning est réunie.

![Graphique de profil par strike ZeroGEX montrant le gamma magnet au même strike que le max pain](/blog/zerogex-max-pain-gamma-agreement.png)

Imaginez maintenant un matin différent : SPX à 5 830, max pain à 5 810, mais le strike à plus fort gamma est 5 840 et le Net GEX est de −400 M$. Les lectures divergent, le régime est short-gamma, et c'est une séance ordinaire sans expiration. La lecture structurelle : le max pain *décrit* une géométrie de payoff de la chaîne, sans indiquer un niveau que le book des dealers va défendre. La démarche honnête consiste à ignorer le max pain dans cet état et à s'appuyer plutôt sur la lecture du régime.

---

## Idées reçues courantes sur le max pain

Quelques pièges :

- **« Le prix est attiré vers le max pain à l'expiration. »** Une tendance faible dans certains cas d'OPEX sur actions individuelles, bien plus faible sur les produits indiciels, et absente dans les régimes short-gamma. Ce n'est pas une règle.
- **« Le max pain, c'est là où le graphique clôturera aujourd'hui. »** Presque jamais utile comme cible intrajournalière ou journalière.
- **« Les gros vendeurs manipulent le prix vers le max pain. »** Implausible à l'échelle des produits indiciels liquides. Plausible sur certains marchés d'actions individuelles peu liquides, mais ce n'est toujours pas le mécanisme dominant de l'effet observé.
- **« Le max pain et le gamma flip, c'est la même chose. »** Non. Le flip est la ligne de régime ; le max pain est un strike de géométrie de payoff. Ils répondent à des questions différentes.
- **« Le max pain est un indicateur contrarian. »** Il n'est pas conçu pour l'être. Le traiter comme tel ajoute simplement du bruit.

---

## À retenir

> Le max pain est un calcul réel décrivant une géométrie de chaîne réelle. Ce n'est pas un prédicteur fiable du prix.

La formulation la plus claire est celle-ci : le max pain coïncide souvent avec une forte concentration de gamma, et c'est *cette* traction structurelle que les traders observent parfois près de l'expiration. Lorsque le max pain et le gamma magnet concordent dans un régime long-gamma près de l'OPEX, la thèse du pin est à son plus fort — et même alors, il s'agit d'une inclinaison probabiliste. Lorsqu'ils divergent, la lecture gamma est la plus fiable.

Utilisé comme contexte au sein d'un cadre plus large de positionnement des dealers, le max pain constitue une vérification croisée utile. Utilisé comme prévision autonome, il tend à induire en erreur.

Contenu éducatif uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous souhaitez voir la lecture du max pain d'aujourd'hui en temps réel, aux côtés du gamma flip, des call et put walls, et du profil gamma des dealers qui détermine si une thèse de pin dispose d'un mécanisme sous-jacent, le dashboard gratuit de ZeroGEX affiche tout cela.
