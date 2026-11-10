# Pourquoi SPY s'ancre-t-il près d'un strike ? Le pinning des options expliqué

*Pourquoi SPY s'ancre-t-il près de strikes spécifiques - surtout le vendredi et vers la clôture ? C'est rarement une coïncidence. Le pinning des options expliqué : le mécanisme modélisé de couverture des dealers qui peut attirer le prix vers un strike, pourquoi il tend à être le plus fort lors de l'OPEX et en fin de journée, et comment évaluer si le tape du jour est susceptible de s'ancrer.*

---

## Le pinning n'est pas de la superstition

Si vous tradez régulièrement des options hebdomadaires SPY, vous l'avez déjà observé : SPY dérive vers un strike à nombre rond - 580, 583, 585 - et le vendredi après-midi, il y reste, oscillant dans une fourchette de 30 cents, refusant de s'en écarter. La même chose se produit autour des échéances trimestrielles et lors de l'OPEX mensuel. Et cela arrive aussi bien des mercredis et jeudis ordinaires, lorsque la chaîne 0DTE est chargée.

Beaucoup de traders traitent le pinning comme un phénomène relevant du ressenti - « le marché sait où il veut se stabiliser » - ou l'attribuent à des figures chartistes. Une explication plus concrète se cache en dessous : la couverture modélisée des dealers sur les strikes à forte concentration de gamma peut générer des flux qui tendent à ramener le prix vers le strike, aux côtés d'autres facteurs comme la liquidité, le positionnement et la mécanique de l'expiration. Une fois que vous percevez le mécanisme, vous pouvez aussi évaluer quand il est plus susceptible d'être à l'œuvre aujourd'hui, et quand il ne l'est pas.

Cet article détaille la mécanique réelle du pinning, explique pourquoi elle s'intensifie près de l'échéance, présente les deux types de pin que la plupart des traders confondent, les conditions structurelles qui font d'aujourd'hui une journée de pin, les cinq signes qu'un pin est en place en ce moment, et le playbook que récompense un tape pinné. Pour la discussion connexe sur le max pain, voir [Le max pain expliqué](/education/max-pain-explained).

---

## Le mécanisme de couverture des dealers derrière le pinning

Le mécanisme est plus facile à voir une fois écrit noir sur blanc - en gardant à l'esprit qu'il s'agit d'un modèle du comportement des dealers, et non de quelque chose que vous pouvez lire directement sur le tape :

1. Un strike précis - disons SPY 583 - porte une forte concentration de gamma. Selon le modèle de positionnement standard, le book des dealers est supposé **long** de ce gamma. (Une forte concentration n'en est pas à elle seule la preuve - l'open interest indique combien de contrats sont ouverts, pas qui est long ou short - mais c'est l'hypothèse de travail lorsque les calls dominent le strike.)
2. Si le book des dealers est long gamma sur ce strike, la couverture pousse *à contre-sens* des mouvements qui s'en éloignent - le réflexe stabilisateur qui tend à ancrer le prix. (C'est le régime de gamma positif qui se joue sur un unique strike dominant.)
3. Quand SPY franchit 583 à la hausse, le delta de couverture modélisé devient positif, donc pour rester neutres les dealers tendent à **vendre** du SPY.
4. Quand SPY franchit 583 à la baisse, le delta de couverture modélisé devient négatif, donc pour rester neutres les dealers tendent à **acheter** du SPY.
5. Chaque écart par rapport à 583 appelle une opération de couverture *de retour vers* 583. Le strike peut agir comme un aimant - non pas parce que quelqu'un le viserait, mais parce que, selon le modèle, la mathématique de la couverture fait pencher le prix dans cette direction.

C'est une lecture plausible de ce qui se passe lorsque vous voyez SPY osciller dans une fourchette étroite : le book agrégé des dealers qui se corrige vers la neutralité à chaque mouvement. C'est rarement la seule chose à l'œuvre - la liquidité, le comportement des traders et la mécanique de l'expiration y contribuent aussi - mais c'est souvent un facteur dominant.

---

## Pourquoi le pinning s'intensifie près de l'échéance

Le mécanisme décrit ci-dessus s'applique à toute option - mais la *force* du pin dépend de l'ampleur du gamma sur le strike. Deux facteurs rendent cette ampleur considérable à l'approche de l'échéance :

### Le gamma évolue en 1/√T

Le gamma par contrat d'option est à peu près inversement proportionnel à la racine carrée du temps restant avant échéance. Le gamma at-the-money d'une option 0DTE est environ 5× plus élevé que celui d'une option de même strike à 5 jours d'échéance, et de plusieurs ordres de grandeur supérieur à celui d'une option mensuelle. Plus on se rapproche de l'échéance, plus le gamma par contrat est élevé - et plus l'opération de couverture requise à chaque tick de prix est importante.

Un strike 0DTE autour duquel tout le monde est positionné peut se comporter comme un trou noir pour le spot. Les dealers peuvent avoir à déplacer des quantités très importantes de sous-jacent pour des variations de prix très faibles, si bien que le pinning peut devenir le chemin de moindre résistance.

### L'open interest se concentre sur les strikes ronds

Le marché concentre structurellement l'open interest sur les nombres ronds - 580, 583, 585 sur SPY, 5800, 5810 sur SPX. Le vendredi après-midi, la concentration de gamma sur un ou deux de ces strikes peut dominer le reste de la chaîne combinée. Cette domination d'un strike unique explique pour une large part le « magnétisme » visible que les traders ressentent à la clôture.

Combinez les deux facteurs - temps restant court avant échéance + OI concentré sur des strikes ronds - et les pins du vendredi après-midi deviennent structurellement plus probables. Le mercredi et le lundi présentent des versions plus faibles du même schéma, à mesure que le flux 0DTE continue de croître.

---

## Deux types de pin - et ce n'est pas la même chose

Une source de confusion fréquente : le **max pain** face à l'**aimant de gamma**. Les deux sont appelés « le pin », mais ils sont calculés différemment et peuvent diverger.

### Max pain

Le max pain est le strike auquel le paiement total aux détenteurs d'options serait minimisé à l'échéance. C'est un calcul de géométrie de payoff - pure mathématique de valeur intrinsèque. Il indique le strike « structurellement favorable » aux vendeurs d'options.

### Aimant de gamma

L'aimant de gamma est le strike présentant la plus grande concentration absolue de gamma chez les dealers - le strike où la couverture forcée est la plus intense. C'est une lecture du flux de couverture.

Lorsque les deux strikes concordent, la thèse du pin tend à être la plus nette. Lorsqu'ils divergent, ZeroGEX s'appuie sur l'aimant de gamma, car il correspond au flux de couverture modélisé plutôt qu'à la seule géométrie des payoffs - mais c'est une inclinaison, pas une règle, et la lecture qui compte le plus dépend du signe modélisé du gamma des dealers et du flux environnant.

[Le max pain expliqué](/education/max-pain-explained) approfondit cette distinction et indique honnêtement à quelle fréquence le max pain seul induit en erreur.

---

## Quand le pin tient

Les conditions structurelles qui font d'aujourd'hui une journée de pin :

- **Régime de gamma positif.** Spot au-dessus du gamma flip modélisé ; Net GEX clairement positif. Sans cela, le réflexe de couverture modélisé peut s'inverser, et le même strike peut relâcher le prix au lieu de l'attirer.
- **Forte concentration de strike près du spot.** L'aimant de gamma se situe près du prix - ZeroGEX considère qu'environ 0,3-0,5 % correspond à « près », bien que cette bande soit une heuristique maison et non un standard du secteur. Les aimants éloignés du spot tendent à agir davantage comme des cibles que comme des pins actifs.
- **Le max pain et l'aimant de gamma concordent.** Les deux pointent vers le même niveau. Cela renforce la traction structurelle.
- **Chaîne dominée par l'échéance.** Les options 0DTE/hebdomadaires portent l'essentiel du gamma. Les chaînes dominées par les options mensuelles pinnent de manière beaucoup moins fiable.
- **Calendrier des catalyseurs calme.** Pas de données macro majeures ni d'événement de banque centrale durant la séance.
- **Volatilité réalisée en compression.** Le tape montre que le réflexe amortisseur des dealers fonctionne.

Lorsque la plupart de ces conditions s'alignent, le pin bénéficie d'une probabilité structurelle en sa faveur.

---

## Quand le pin se rompt

Le pin se défait lorsque :

- **Le croisement du gamma flip se produit.** Le spot passe sous le flip modélisé ; ce franchissement suggère que la tendance de couverture agrégée du modèle a changé de signe, si bien que le même aimant peut commencer à relâcher le prix au lieu de l'attirer.
- **Un catalyseur survient.** CPI, FOMC, NFP, choc sur une valeur individuelle. Le flux macro submerge le réflexe des dealers.
- **Le Net GEX se dégrade significativement.** Le gamma proche de l'échéance se revalorise : le gamma ATM peut augmenter tandis que le gamma nettement ITM ou OTM tend vers zéro. L'agrégat peut se renforcer ou s'affaiblir.
- **L'aimant migre.** L'open interest confirmé est généralement publié pour la séance suivante, mais l'aimant modélisé peut tout de même se déplacer en cours de séance à mesure que le spot, le gamma, le temps et l'IV évoluent - ou à mesure qu'un positionnement intraday inféré se construit sur un autre strike - ce qui déplace la cible ailleurs.
- **Le skew se déplace.** Une forte demande sur les puts (peur) peut inverser le signe du book des dealers, même sur le même strike.

Un pin qui tient depuis deux heures est plus durable qu'un pin qui vient de se former, mais aucun pin ne dure indéfiniment. Les conditions qui le soutenaient doivent continuer de tenir pour que le pin persiste.

---

## Lire le pin en temps réel

Une démarche rapide :

1. **Identifiez le strike au gamma le plus élevé près du spot.** C'est le candidat aimant.
2. **Vérifiez le Net GEX.** C'est un chiffre modélisé - le gamma des dealers estimé selon la convention traditionnelle d'open interest calls positifs/puts négatifs, et non un inventaire observé des dealers. Une valeur positive substantielle est la condition qui soutient le pin ; des lectures négatives ou proches de zéro plaident contre lui.
3. **Vérifiez le gamma flip.** Le spot doit se situer au-dessus. Si le flip est exactement au niveau du spot, la situation est disputée - le pin peut se former ou non.
4. **Recoupez avec le max pain.** Même strike ou à moins de ~0,3 % de l'aimant (une heuristique ZeroGEX) → thèse de pin plus nette. Nettement différent → thèse plus faible ; ZeroGEX s'appuie sur l'aimant, puisqu'il correspond au flux de couverture modélisé.
5. **Lisez l'heure de la journée.** Avant midi ET, le charm ne s'est pas encore suffisamment accumulé pour imposer fortement le pin. Après 14h00 ET, l'attraction s'intensifie. Après 15h30 ET, les dynamiques de la fenêtre de clôture dominent.

---

## Comment savoir si le SPY est pinné : les cinq signes

Reconnaître un pin en temps réel se résume à cinq signes structurels. Plus ils sont nombreux à s'aligner, plus le pin est net.

**1. Le Net GEX est nettement positif (régime long-gamma).** Spot au-dessus du gamma flip et Net GEX clairement positif. (Le Net GEX est un gamma dealer estimé selon la convention traditionnelle calls positifs / puts négatifs sur l'open interest - un modèle, pas un inventaire observé.) ZeroGEX considère à l'échelle du SPY qu'environ 500 M$+ est « substantiel », mais c'est une heuristique maison - l'ordre de grandeur compte plus que n'importe quel chiffre précis. Un Net GEX négatif ou proche de zéro plaide contre le pin.

**2. Le max pain et l'aimant de gamma concordent près du spot.** Quand les deux pointent vers le même niveau et que celui-ci se situe à moins d'environ 0,3 % du spot, la traction structurelle est à son maximum. Quand ils divergent, ZeroGEX s'appuie sur l'aimant de gamma - il correspond au mécanisme de couverture modélisé, alors que le max pain relève de la géométrie des paiements.

**3. Le spot oscille autour de l'aimant depuis une heure.** Tracez le SPY face au strike de l'aimant de gamma en unité de 5 minutes. Trois croisements ou plus sur les 60 dernières minutes, chaque excursion plus petite, suggère un pin en formation. Une dérive continue en s'éloignant de l'aimant plaide contre - c'est une direction, pas une fourchette.

**4. La volatilité réalisée s'est comprimée sous l'implicite.** La couverture long-gamma amortit la volatilité réalisée : un pin qui fonctionne se voit donc à une réalisée sous l'implicite. Si la réalisée s'étend, le pin ne tient pas - le book est submergé par d'autres flux.

**5. L'EOD Pressure est proche de zéro dans la fenêtre active.** Après 14h30 ET, une lecture d'EOD Pressure proche de zéro (environ −0,20 à +0,20) est une signature modélisée de pin - les termes de charm et de gravité du pin s'annulent en grande partie parce que le prix se tient sur l'aimant. Une lecture élevée signifie que le prix est *loin* de l'aimant. Voir [Le signal EOD Pressure expliqué](/education/eod-pressure-explained).

---

## Le playbook d'un tape pinné

Quand la plupart des cinq signes s'alignent, le playbook est à contre-courant et simple :

- **À faire : jouer contre les extrêmes de la fourchette de compression.** La traction structurelle ramène vers l'aimant : vendre les poussées près du haut de la fourchette et acheter les creux près du bas est la seule configuration où le réflexe du dealer est de votre côté. Taille réduite - les pins sont probabilistes, pas garantis.
- **À éviter : courir après le milieu.** C'est au milieu que se tient l'aimant ; y acheter ou y vendre revient à combattre le niveau vers lequel le prix cherche structurellement à revenir. C'est de là que vient l'essentiel des pertes sur un tape pinné.
- **À éviter : prendre des configurations de momentum.** Les playbooks de cassure, d'expansion de volatilité et de squeeze supposent que le mouvement se prolonge - l'inverse d'un tape pinné. Dérouler le mauvais playbook constitue l'essentiel de l'erreur.
- **À faire : réduire la taille de position.** Les fourchettes pinnées sont serrées et les stops encore plus ; une taille de journée normale invite à se faire sortir prématurément.

---

## Exemple chiffré

SPY est à 582,95 un vendredi après-midi. ZeroGEX affiche :

- **Net GEX :** +1,4 Md$ (positif - régime long-gamma)
- **Gamma Flip :** 581,20 (spot largement au-dessus)
- **Strike 0DTE le plus lourd :** 583,00 (pratiquement au niveau du spot)
- **Max Pain :** 583,00 (concorde avec l'aimant de gamma)
- **Heure :** 14h15 ET (l'accumulation de charm démarre)

Toutes les conditions structurelles d'un pin sont réunies. L'aimant se situe à 583 ; le max pain concorde à 583 ; le régime est long-gamma ; on se trouve dans la fenêtre active de fin de journée. La probabilité que SPY oscille dans une fourchette d'environ 30 cents autour de 583 jusqu'à la clôture est sensiblement élevée.

Lecture pratique : une fourchette resserrée de 582,70-583,30 constitue le trajet attendu. Les incursions vers les bords sont des candidats à des setups de fade. Le centre de la fourchette est une zone de non-intervention. Taille de position réduite. Surveiller les conditions de rupture - en particulier en cas de choc sur une valeur individuelle ou de titre inattendu.

Imaginez maintenant le même scénario mais avec un Net GEX à −600 M$ et un gamma flip à 583,50 (spot en dessous). La thèse du « pin » s'effondre. Même chaîne, même strike, lecture opposée - car le régime modélisé, qui détermine si l'aimant tend à attirer ou à relâcher, a changé de signe.

---

## Idées reçues courantes

- **« Le pinning, c'est uniquement de la psychologie. »** Les incitations liées aux payoffs à l'expiration, la couverture des dealers, la liquidité et le comportement des traders peuvent tous y contribuer. Les données publiques ne permettent pas d'isoler dans quelle mesure un mécanisme particulier a causé un pin observé.
- **« SPY s'ancre toujours sur les nombres ronds. »** Lorsque le pinning se produit, il coïncide souvent avec un positionnement concentré. Les nombres ronds sont fréquents parce que l'OI s'y agglomère, mais l'OI seul ne prouve pas la cause.
- **« Si le max pain est X, le prix clôturera à X. »** Souvent faux. Le max pain relève de la géométrie des payoffs, pas d'une force de couverture ; l'aimant de gamma modélisé correspond plus directement au flux de couverture. En cas de divergence, ZeroGEX s'appuie sur l'aimant.
- **« Les pins sont haussiers/baissiers. »** Ni l'un ni l'autre. Ils sont anti-volatilité. Bornés dans une fourchette. La direction vient d'ailleurs ; le pin concerne le *caractère de l'action des prix*, pas la direction.
- **« Le pinning se produit tous les vendredis. »** Souvent, mais pas toujours. Certains vendredis comportent des catalyseurs, des régimes short-gamma ou des aimants migrants qui empêchent le pin. Il importe de lire les conditions.

---

## À retenir

> SPY tend à s'ancrer parce que la couverture modélisée des dealers sur des strikes à forte concentration de gamma peut ramener le prix vers le strike. La traction modélisée peut servir de contexte lorsque les conditions structurelles la soutiennent et que vous la traitez comme une probabilité, pas comme une certitude.

La discipline consiste à vérifier les conditions avant de supposer qu'aujourd'hui est une journée de pin. Régime long-gamma + strike lourd au niveau du spot + concordance avec le max pain + séance avancée font pencher les probabilités vers un pin net. Que l'un seul de ces éléments s'inverse affaiblit la lecture ; que tous s'inversent l'annule de fait.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous souhaitez consulter le strike au gamma le plus lourd du jour, le max pain, le gamma flip et le Net GEX - les quatre chiffres qui déterminent si SPY s'ancre aujourd'hui -, la vue gratuite des gamma-levels de ZeroGEX les affiche tous.
