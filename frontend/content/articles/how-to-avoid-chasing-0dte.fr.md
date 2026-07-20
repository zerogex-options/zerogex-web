# Comment éviter de courir après les mouvements 0DTE

*Courir après les mouvements 0DTE est de loin la pire habitude pour les comptes retail qui tradent des options same-day. Voici pourquoi cette poursuite est structurellement plus dangereuse sur les 0DTE que sur n'importe quelle autre échéance — et les signaux concrets qui vous indiquent quand vous arrêter avant de cliquer.*

---

## Courir après les 0DTE est l'habitude la plus coûteuse du trading retail

Si vous tradez régulièrement des options zero-day sur SPY ou SPX, vous l'avez déjà vécu : le prix s'emballe fortement dans une direction, le call (ou le put) que vous vouliez vaut soudain 3 fois ce qu'il valait vingt minutes plus tôt, et vous ressentez un besoin urgent de courir après. Vous achetez. En dix minutes, le mouvement s'est inversé, votre contrat est revenu à 1x, et vous vous retrouvez avec une position perdante et encore des heures de décroissance theta à digérer.

Cette expérience est si répandue qu'elle est essentiellement l'histoire fondatrice du trader retail sur 0DTE. Tout trader 0DTE actif l'a vécue des dizaines de fois. Et à chaque fois, la lecture structurelle vous disait en réalité de ne pas poursuivre — *si* vous saviez où regarder.

Cet article présente la méthode pour ne pas courir après le marché. Les mécanismes qui rendent la poursuite des 0DTE particulièrement dangereuse, trois signaux concrets indiquant que vous êtes sur le point de commettre l'erreur, et la lecture structurelle qui devrait prendre le pas sur votre instinct. Pour approfondir pourquoi le flux 0DTE façonne le book des dealers de cette manière, commencez par [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained).

---

## Pourquoi courir après les 0DTE en particulier est si dangereux

Trois facteurs se combinent sur les options same-day qui ne se combinent pas sur des échéances plus longues :

### 1. Le theta est une falaise, pas une courbe

Les options 0DTE perdent leur valeur temps à un rythme qui s'accélère au fil de la journée. Un call acheté à 11h00 ET pour 2,00 $ ne se dégrade pas lentement — d'ici 14h00 ET, il pourrait valoir 1,20 $ même si le spot n'a pas bougé, et d'ici 15h30 ET, il pourrait valoir 0,30 $. La poursuite qui fonctionnait sur une option hebdomadaire (« tenir en attendant un rebond, récupérer son prix d'entrée ») ne fonctionne pas sur une 0DTE. Il n'y a pas de récupération possible ; il n'y a que la clôture.

### 2. Le gamma est énorme — ce qui veut dire que les retournements le sont aussi

Les options same-day portent un gamma énorme à la monnaie. Cela leur donne l'apparence d'un effet de levier à la hausse. Cela leur donne tout autant l'apparence d'un effet de levier à la baisse. Le retournement qui a fait passer votre call de 5 $ à 1 $ était le même réflexe gamma qui l'avait fait passer de 1 $ à 5 $ au départ — simplement dans le mauvais sens. Courir après un 5x sur un contrat qui peut tout aussi bien faire un 5x contre vous, c'est un pile ou face à espérance négative, ne serait-ce qu'à cause du theta.

### 3. Le hedging des dealers est réactif, pas directionnel

Les dealers se moquent de la direction que prend SPY ; ce qui les préoccupe, c'est de rester delta-neutre. Quand vous courez après un mouvement, vous payez la prime qui existe *précisément parce que* les dealers ont dû couvrir ce mouvement. Le temps que vous vous mettiez à poursuivre, le flux structurel qui a provoqué la flambée s'est déjà produit. Vous achetez au sommet du mouvement forcé par les dealers, pas à son début.

---

## Trois signes que vous êtes sur le point de courir après le marché

L'instinct de poursuite a des déclencheurs prévisibles. Se surprendre soi-même sur l'un d'eux, c'est déjà l'essentiel de la discipline :

### Déclencheur 1 : le prix s'est déjà étendu au-delà de son range récent

Si le SPX vient de pulvériser le plus haut du matin et que vous ressentez le besoin d'acheter des calls *maintenant*, le mouvement a déjà eu lieu. Quelle que soit la cause du breakout — flux, hedging, catalyseur — elle a déjà poussé le prix du contrat là où il se trouve. Votre entrée est la seconde jambe, après que la première a déjà été intégrée dans le prix.

La version la plus pure de ce piège : un breakout d'une enveloppe de volatilité à 20 barres où le contrat a déjà pris 80 % sur la journée. Vous ne captez pas un mouvement ; vous fournissez de la liquidité de sortie à ceux qui l'ont déjà capté.

### Déclencheur 2 : le flux est déjà visiblement déséquilibré dans le sens que vous voulez poursuivre

Ouvrez le panneau de flux. Si la prime put/call affiche déjà un ratio de 3:1 côté call et que le déséquilibre du smart money est déjà nettement positif, le trade de consensus a déjà été mis en place. Vous êtes en retard. La fade est bien plus probable que la continuation à ce stade — ce qui signifie que les trente prochaines minutes seront probablement le trade de *retournement*, pas de continuation.

### Déclencheur 3 : il est tard dans la journée et le mouvement se dirige vers un niveau clé

Après 14h00 ET, la décroissance du charm s'accélère et le réflexe des dealers autour du strike 0DTE le plus pondéré s'intensifie. Courir après un mouvement de fin de journée qui se dirige vers le call wall (ou qui s'éloigne du put wall), c'est acheter précisément là où le hedging des dealers est structurellement en place pour vous faire perdre. Le signal EOD Pressure existe spécifiquement pour signaler ce régime — voir [EOD Pressure Signal Explained](/education/eod-pressure-explained).

---

## La lecture structurelle avant de cliquer

Quand l'envie de poursuivre vous prend, passez cette checklist en revue :

1. **Quel est le régime de gamma ?** Spot au-dessus du flip (long-gamma) → les fades fonctionnent, les poursuites échouent. Spot en dessous du flip (short-gamma) → les poursuites fonctionnent, les fades échouent. Si vous ne connaissez pas le régime, vous devinez.
2. **Où se situe le wall le plus proche ?** Si vous poursuivez un call vers le call wall dans un régime long-gamma, la traction structurelle joue *contre* la poursuite. Si vous poursuivez vers un espace ouvert sans wall entre le spot actuel et l'objectif poursuivi, la traction structurelle est neutre — meilleur setup.
3. **Le Net GEX se renforce-t-il ou s'affaiblit-il ?** Un renforcement dans un régime long-gamma signifie que le réflexe absorbant s'intensifie — poursuivre = piège à fade. Un affaiblissement signifie que le réflexe absorbant se relâche — la poursuite a davantage de marge.
4. **Quelle heure est-il ?** Avant midi ET, le charm sur les 0DTE est faible et le réflexe des dealers est atténué. Après 14h00 ET, les flux de charm s'accumulent. Les poursuites de fin de journée vers une structure sont la pire version du piège.
5. **Le contrat a-t-il déjà fait un x3 ?** Si oui, vous ne captez pas un mouvement — vous payez pour un mouvement déjà survenu. Le mouvement suivant attendu inclut une probabilité non négligeable de mean-reversion.

Si la plupart de ces éléments jouent contre la poursuite, la discipline consiste à passer son tour. Pas « attendre une meilleure entrée » — passer son tour. La poursuite 0DTE qui a fonctionné une fois sur dix, c'est le biais du survivant qui maintient l'habitude en vie.

---

## Quand le momentum 0DTE est réel

La poursuite n'est pas toujours une erreur. Le trade de momentum 0DTE *peut* fonctionner quand :

- Le spot est dans un **régime de gamma négatif** (sous le flip). Le réflexe des dealers amplifie, il n'amortit pas. Le momentum se prolonge.
- **Le Net GEX est faible ou négatif.** La fade structurelle est faible ou inversée.
- Il existe un **véritable catalyseur** actif (surprise CPI, réaction au FOMC, actualité géopolitique). Le flux porté par le catalyseur écrase le réflexe structurel.
- Le mouvement se produit **tôt dans la séance** (avant l'accumulation de charm).
- Le contrat n'a pas encore accompli tout son mouvement — vous captez les premiers 30 % du range de la journée, pas les derniers 30 %.

Ce sont les conditions pour un trade de breakout 0DTE avec une probabilité réelle. Elles sont l'inverse du déclencheur typique du « je veux courir après ça ».

---

## Comment lire cela sur ZeroGEX en temps réel

La vue gratuite `/spx-gamma-levels` vous donne les trois filtres dont vous avez besoin :

- **Gamma Flip** — vérification du régime.
- **Call Wall / Put Wall** — là où les poursuites sont structurellement configurées pour fader.
- **Net GEX** — magnitude du book des dealers.

Pour le filtre horaire, les tableaux de bord en direct affichent le signal EOD Pressure pendant la fenêtre active (après 14h30 ET) — une lecture directionnelle indiquant vers où penche le hedging forcé à l'approche de la clôture.

Exemple concret. Il est 14h45 ET. Le SPX vient de percer le plus haut de la journée à 5 810. Le contrat que vous voulez poursuivre a gagné 70 % depuis l'ouverture. ZeroGEX affiche :

- **Gamma Flip :** 5 795 (régime long-gamma)
- **Net GEX :** +1,6 Md$, stable
- **Call Wall :** 5 815 (pratiquement à l'objectif de la poursuite)
- **EOD Pressure :** +0,35 (dérive haussière légère, mais qui se dirige vers l'aimant)

Lecture : régime long-gamma, positionnement sain, le wall se situe cinq points au-dessus du niveau actuel — et la dérive EOD est légère, pas criante. Tous les filtres penchent du côté *fade*. Poursuivre reviendrait à acheter juste au sommet de la zone structurelle d'absorption, tard dans la journée, avec un theta qui s'accélère. Passer son tour.

---

## Des habitudes qui portent leurs fruits

Quelques-unes qui fonctionnent :

- **Fixez-vous un minuteur « pas de poursuite ».** Quand l'envie vous prend, forcez-vous à attendre cinq minutes avant de cliquer. L'envie s'estompe généralement.
- **Vérifiez le régime avant chaque entrée 0DTE.** Intégrez-le à votre workflow. Long-gamma + poursuite = taux d'échec élevé.
- **Dimensionnez votre position pour le pire scénario.** Si la poursuite échoue, le contrat tombe à zéro. Dimensionnez votre position en supposant que c'est le scénario de base.
- **Suivez vos poursuites séparément.** Étiquetez chaque entrée « chase » dans votre journal de trading. Comparez le taux de réussite avec vos entrées hors poursuite. Les données honnêtes tranchent généralement le débat.

---

## À retenir

> La poursuite 0DTE n'est pas une stratégie ; c'est une réaction émotionnelle face à un contrat qu'on voulait et qui monte sans nous. Le remède, c'est la lecture structurelle avant le clic, pas plus de discipline.

La discipline vient naturellement une fois que la lecture est cohérente — si vous avez vérifié le régime, le wall, le Net GEX et l'heure de la journée et que tout pointe vers la fade, la poursuite perd son attrait. Le piège consiste à courir après le marché *avant* d'avoir fait cette vérification.

Contenu à visée éducative uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez consulter le gamma flip, les walls et le Net GEX du jour avant votre prochaine entrée 0DTE — la carte structurelle qui signale la plupart des setups de poursuite — la vue gratuite gamma-levels de ZeroGEX affiche les trois.
