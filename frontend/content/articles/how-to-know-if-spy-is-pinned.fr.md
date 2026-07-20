# Comment savoir si SPY est pinné : les cinq signes

*Comment savoir si SPY est pinné aujourd'hui — les cinq signes structurels indiquant que le prix est aimanté vers un strike, et le playbook de trading (fader les extrêmes, éviter le milieu) que récompense un tape pinné.*

---

## Reconnaître le pin est le filtre le plus propre pour le day-trading

La plupart des pertes en day-trading viennent du fait d'appliquer le mauvais playbook pour le régime en cours. La version la plus coûteuse de cette erreur est d'essayer de trader le momentum dans un tape pinné. SPY se comprime vers un strike, vous achetez la première poussée, elle s'inverse, vous vendez le premier repli, ça rebondit. La mort par chop. À 14h00 ET, vous êtes en baisse de 1,5 % sur une journée où SPY a à peine bougé de 0,3 %.

La solution, c'est la reconnaissance de régime : savoir quand SPY est pinné et changer de playbook en conséquence. Un tape pinné récompense le fait de fader les extrêmes de la range de compression ; il pénalise tout le reste. Une fois que vous pouvez reconnaître le pin en temps réel, la sélection des trades s'améliore immédiatement.

Cet article passe en revue les cinq signes structurels indiquant que SPY est pinné aujourd'hui, le playbook qui fonctionne dans ce régime, et le moment où le pin se rompt. Pour l'explication associée sur le mécanisme du pinning lui-même, voir [Pourquoi SPY se pinne-t-il près d'un strike ?](/education/why-spy-pins-near-strikes) ; pour le contexte plus large du régime, le [pilier Gamma Exposure](/education/gamma-exposure-explained).

---

## Ce qu'est réellement un pin

Un pin, c'est ce qui se produit lorsque le hedging des dealers produit une attraction structurelle vers un strike à fort gamma. La mécanique :

1. Un strike spécifique — généralement la plus forte concentration de calls/puts 0DTE — porte un gamma dealer élevé.
2. Le régime est **long-gamma** : les dealers se couvrent en vendant sur la force et en achetant sur la faiblesse.
3. Quand le spot monte au-dessus du strike, les dealers vendent — ce qui ramène le prix vers le bas.
4. Quand le spot descend en dessous du strike, les dealers achètent — ce qui ramène le prix vers le haut.
5. L'effet net est un prix qui oscille dans une range étroite *autour* du strike. Le strike agit comme un aimant.

Les pins ne sont pas psychologiques. Ils sont la manifestation visible d'un hedging forcé sur une concentration de strike. Ils se forment le plus fiablement les jours d'OPEX, en fin de mois, et à l'approche de la clôture cash — partout où les options du jour même ou à échéance rapprochée dominent le profil de gamma.

Le mécanisme complet est détaillé dans [Pourquoi SPY se pinne-t-il près d'un strike ?](/education/why-spy-pins-near-strikes).

---

## Les cinq signes que SPY est pinné aujourd'hui

### Signe 1 : le Net GEX est significativement positif (régime long-gamma)

Le pin ne se produit que dans un régime long-gamma. Le spot doit être au-dessus du gamma flip, et le Net GEX doit être substantiel (le seuil standard suivi par la plupart des analystes tourne autour de 500 M$+ à l'échelle de SPY, même si l'ampleur compte plus qu'un chiffre précis).

Si le Net GEX est négatif ou proche de zéro, la thèse du pin est écartée. Le réflexe des dealers ne tire pas — il poursuit le prix ou est neutre. Il faut alors abandonner complètement le playbook du pin.

### Signe 2 : le max pain et l'aimant gamma s'accordent près du spot

Deux strikes structurels à vérifier : le **max pain** (le strike où le paiement aux détenteurs d'options est minimisé à l'expiration) et l'**aimant gamma** (le strike au gamma absolu le plus élevé). Quand les deux pointent vers le même niveau et que ce niveau se situe à moins de 0,3 % du spot actuel, l'attraction structurelle est à son maximum.

Quand ils divergent, l'aimant gamma l'emporte généralement — c'est le mécanisme de hedging réel, tandis que le max pain relève de la géométrie du payoff. Voir [Max Pain expliqué](/education/max-pain-explained) pour la différence.

### Signe 3 : le spot oscille autour de l'aimant depuis la dernière heure

Une lecture en direct : tracez SPY par rapport au strike de l'aimant gamma sur une unité de temps de 5 minutes. Si le prix a franchi la ligne de l'aimant trois fois ou plus au cours des 60 dernières minutes, chaque excursion étant plus petite que la précédente, le pin est en train de se former. La range de compression se resserre à mesure que l'aimant tire plus fort à l'approche de l'expiration.

L'inverse — le prix dérivant de manière constante au-dessus ou en dessous de l'aimant sans revenir — plaide contre le pin. Le prix est dans une direction, pas dans une range.

### Signe 4 : la volatilité réalisée s'est comprimée sous l'implicite

Celui-ci nécessite une lecture de la vol : si la vol intraday réalisée de SPY sur la dernière heure est nettement inférieure à la vol implicite du jour, le réflexe des dealers fait son travail. Le hedging long-gamma amortit la vol réalisée ; un pin réussi se traduit par une réalisée inférieure à l'implicite.

Si la réalisée est en train de *s'étendre* (le prix bouge plus que prévu), le pin ne tient pas. Le book des dealers est débordé par un autre flux.

### Signe 5 : l'EOD Pressure est proche de zéro dans la fenêtre active

Après 14h30 ET, le signal EOD Pressure devient informatif. Une lecture proche de zéro (entre -0,20 et +0,20) pendant la fenêtre active est la signature structurelle d'un pin — les termes de charm et de pin-gravity s'annulent, ce qui se produit quand le prix est assis pile sur le strike de l'aimant.

Une lecture large, positive ou négative, de l'EOD Pressure est le signal inverse : le prix est *éloigné* de l'aimant, et le hedging forcé le repousse vers l'aimant (ou l'en éloigne, dans un régime short-gamma). Voir [Signal EOD Pressure expliqué](/education/eod-pressure-explained) pour la lecture complète.

---

## Le playbook du tape pinné

Quand les cinq signes (ou la plupart d'entre eux) s'alignent, le playbook est simple et contrarian :

### À faire : fader les extrêmes de la range de compression

L'attraction structurelle ramène vers l'aimant. Vendre les poussées près du haut de la range de compression (et acheter les poussées près du bas) est le seul setup où le réflexe des dealers joue en votre faveur. Taille réduite — les pins sont probabilistes, pas garantis — mais la lecture est structurelle.

### À ne pas faire : poursuivre le milieu de la range

Le milieu, c'est là où se trouve l'aimant. Acheter ou vendre au milieu, c'est acheter un niveau vers lequel le prix cherche structurellement à revenir. L'espérance de gain est à peu près nulle, avec un carry négatif dû au spread et au theta. C'est là que naissent la plupart des pertes sur un tape pinné — les poursuivants qui achètent chaque poussée et vendent chaque repli au milieu.

### À ne pas faire : prendre des setups momentum

Les playbooks momentum (breakout, expansion de vol, squeeze) supposent que le mouvement se prolonge. Un tape pinné est l'hypothèse inverse. Appliquer le mauvais playbook, c'est l'essentiel de l'erreur.

### À faire : réduire la taille de position

Les ranges d'un tape pinné sont étroites. Les stops le sont encore plus. La taille de position doit refléter le gain plus faible (et la distance plus courte jusqu'à l'aimant pour le stop). Traiter un tape pinné avec une taille de position de journée normale, c'est s'exposer à des sorties de stop prématurées.

---

## Quand le pin se rompt

Les pins ne durent pas éternellement. Les conditions qui les brisent :

- **Un catalyseur.** CPI, FOMC, NFP, surprise géopolitique. Le flux macro submerge l'attraction structurelle.
- **Un croisement du gamma flip.** Si le spot passe sous le gamma flip, le régime s'inverse. Le même aimant qui attirait le prix vers lui en long-gamma commence à le relâcher en short-gamma.
- **La décroissance du Net GEX.** À mesure que les positions 0DTE arrivent à expiration (surtout après 15h30 ET), le book des dealers s'amenuise. L'aimant s'affaiblit.
- **Un choc sur une valeur ou un secteur.** Une actualité sur une composante majeure (NVDA, AAPL, MSFT) peut déplacer le flux de l'indice suffisamment pour l'emporter sur le pin.
- **Le wall migre.** Si un nouvel open interest se construit agressivement sur un strike différent, l'aimant se déplace — et l'ancien pin devient sans objet.

Surveiller ces ruptures fait partie du workflow. Un pin qui tient depuis deux heures est plus fiable qu'un pin qui vient de se former — mais un pin peut aussi se défaire rapidement quand les conditions cessent de le soutenir.

---

## Exemple concret

Il est 13h30 ET un vendredi. SPY est à 581,10. ZeroGEX affiche :

- **Net GEX :** +1,3 Md$ (long-gamma)
- **Gamma Flip :** 579,50 (spot bien au-dessus)
- **Aimant gamma :** 581,00 (essentiellement au spot)
- **Max Pain :** 581,00 (en accord avec l'aimant)
- **EOD Pressure :** +0,10 (proche de zéro — signature de pin à l'intérieur de la fenêtre)

SPY a oscillé entre 580,85 et 581,30 quatre fois au cours de la dernière heure, chaque excursion étant plus petite que la précédente.

La lecture composite : chacun des cinq signes de pin est actif. Le Net GEX est sainement positif, le max pain et l'aimant s'accordent à 581, l'aimant se situe au spot, le prix oscille avec une amplitude qui se resserre, et l'EOD Pressure est proche de zéro dans la fenêtre active. C'est un pin d'école.

Inclinaison pratique : fader les extrêmes (petits puts près de 581,30, petits calls près de 580,85), éviter complètement le milieu. Taille de position réduite. Surveiller les conditions de rupture — en particulier la décroissance du Net GEX à l'approche de la clôture.

---

## Erreurs de lecture courantes

Trois pièges :

- **« Ça a rebondi une fois à 580,85, donc c'est pinné. »** Un seul rebond n'est pas un pin. Il faut plusieurs oscillations *et* les conditions structurelles (Net GEX positif, accord entre l'aimant et le spot). Un rebond n'est qu'un rebond.
- **« Ça range depuis le début de la journée, donc ça va continuer à ranger. »** Les ranges se rompent. Le pin tient à cause des conditions structurelles *actuelles*. Quand le Net GEX décroît à l'approche de la clôture ou qu'un catalyseur survient, la range se rompt. Les conditions structurelles se mettent à jour plus vite que le pattern graphique.
- **« Je devrais acheter le breakout du pin. »** Parfois — mais le breakout d'un vrai pin est statistiquement moins probable que la continuation du pin jusqu'à ce que les conditions structurelles changent. Traiter chaque incursion hors de la range comme un signal de breakout vous fait acheter en haut et vendre en bas, à répétition.

---

## À retenir

> Un tape SPY pinné est l'une des lectures de régime les plus propres en day-trading — et c'est le régime où appliquer le mauvais playbook coûte le plus cher. Les cinq signes ci-dessus permettent de repérer que le régime est actif ; le playbook (fader les extrêmes, éviter le milieu, taille réduite) est ce qui fonctionne dans ce régime.

La discipline consiste à reconnaître le pin *avant* de commencer à trader le tape ce jour-là, pas après avoir perdu trois fois au milieu de la range. La lecture structurelle est disponible dès l'ouverture ; la reconnaissance, c'est l'edge.

Contenu éducatif uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le gamma flip, le Net GEX, l'aimant gamma et le max pain du jour — les quatre niveaux structurels qui déterminent si SPY est pinné aujourd'hui — la vue gratuite des gamma-levels de ZeroGEX les affiche tous.
