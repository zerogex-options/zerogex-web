# Smart Money

*L'écran smart-money — ce qui qualifie un trade de smart-money, comment le ratio C/P est calculé, et comment utiliser le bias en intraday.*

---

## Ce que "smart money" signifie ici

Smart money est une heuristique — une étiquette que nous appliquons aux trades d'options présentant l'empreinte structurelle d'un pari informé :

- **Taille** — prime et taille du contrat sensiblement supérieures à la moyenne pour le strike/l'échéance.
- **Agressivité** — payé au niveau de l'offre ou au-delà (achat), ou exécuté au bid (vente), et non à des prix mid.
- **Répétition** — plusieurs impressions agressives dans la même direction sur une courte fenêtre de temps.
- **Prime de conviction** — le trade paie un pourcentage non négligeable de la valeur du contrat.

Un bloc isolé ne suffit pas à qualifier un trade. Un ensemble de trades de conviction sur un strike, si.

## Ce que montre cette page

### Le ratio C/P smart-money

Le ratio entre la prime call smart-money et la prime put smart-money. Une valeur nettement supérieure à 1 signifie que le flux smart-money est structurellement orienté vers les calls ; nettement inférieure signale les puts. Ce n'est **pas** la même chose que le PCR (put/call ratio) principal — il ne filtre que les impressions à forte conviction.

### Le tape smart-money

Un flux en direct des trades étiquetés smart-money — taille, prime, strike, échéance, direction, horaire. Cliquez pour voir le trade dans son contexte.

### Le bias smart-money

Un indicateur de bias combiné — haussier, baissier, neutre — construit à partir du ratio C/P et du flux net pondéré par la prime au sein du sous-ensemble smart-money.

### La carte de concentration par strike

Là où le flux smart-money s'est concentré par strike, codé par couleur selon la direction. Utile pour repérer "où penche le gros argent".

## Comment l'utiliser

Trois schémas :

1. **Smart-money fortement acheteur de calls + composite positif + gradient GEX favorable** ⇒ la lecture structurelle s'aligne avec le flux smart-money. Directionnel à forte conviction.
2. **Smart-money fortement acheteur de puts au put wall** ⇒ défense ou fading. Combiné à une lecture Positioning Trap, cela peut constituer un counter-bias exploitable.
3. **Flux smart-money neutre, flux principal fort** ⇒ le flux principal est porté par le retail ; à traiter avec prudence.

## Ce que ce n'est pas

L'étiquette smart-money est une **heuristique probabiliste**. Toute impression smart-money n'est pas informée ; tout trade informé n'est pas forcément signalé. La page est surtout utile au **niveau du bias** — quelle est l'inclinaison cumulée ? — plutôt que comme signal de trading sur des impressions individuelles.

## La vue d'ensemble

Le flux smart-money est l'un des multiples inputs du signal de base Positioning Trap (qui utilise le déséquilibre smart-money signé) et du Market Pressure Index (skew du flux smart-money). La page smart-money est la lecture autonome ; les signaux en sont les interprétations.

## Voir aussi

- [Analyse des flux](/help/platform/flow-analysis)
- [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow)
- [Signal Positioning Trap expliqué](/education/positioning-trap-explained)
