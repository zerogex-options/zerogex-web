# Smart Money

*L'écran smart money - ce qui qualifie un trade de smart money, comment se lit la répartition calls/puts, et comment utiliser le bias en intraday.*

---

## Ce que "smart money" signifie ici

Smart money est une heuristique - un filtre pour les prints d'options assez gros ou inhabituels pour être la position de quelqu'un plutôt que des restes de couverture. Chaque ligne correspond aux échanges d'un contrat sur une minute, et elle se qualifie dès qu'elle franchit l'un de ces seuils :

- **Taille** - 50 contrats ou plus.
- **Prime** - 50 K$ ou plus.
- **Prints plus petits mais inhabituels** - 20 contrats ou plus sur un contrat à IV élevée (au-dessus de 40 %) ou très en dehors de la monnaie (|delta| inférieur à 0,15).

Chaque print qualifié porte son **côté agresseur** - **Buy** quand la prime initiée par l'acheteur a dominé, **Sell** quand celle initiée par le vendeur a dominé, **Neutral** quand aucune n'a dominé - et une **classe de notionnel** allant de 500 K$+ à moins de 50 K$. La page conserve les 50 plus gros prints de la séance en notionnel.

## Ce que montre cette page

### Le bandeau de régime

**Smart Money Regime** additionne le notionnel des calls et celui des puts parmi les blocs qui passent vos filtres : **Call Buyers in Control** quand les calls mènent de 250 K$ ou plus, **Put Buyers in Control** quand ce sont les puts, et **Balanced Positioning** sinon. Il compte le notionnel des deux côtés du tape - réglez **Side** sur **Buy** si vous voulez qu'il ne lise que les acheteurs. Ce n'est **pas** la même chose que le PCR (put/call ratio) principal - il ne compte que les blocs filtrés.

### Les filtres

- **Session** - la séance en cours ou la précédente.
- **Min class** - le plus petit notionnel affiché, de 500 K$+ (par défaut) à moins de 50 K$.
- **Side** - uniquement les prints Buy, Sell ou Neutral.
- **Min |Δ|** - écarte les prints dont le delta est inférieur à 0,10, 0,25 ou 0,40, ce qui élimine les tickets de loterie très en dehors de la monnaie.
- **Expiry** - 0DTE, 1-7 DTE ou 8+ DTE.

### Blocks vs. underlying price

Les blocs filtrés sous forme de barres empilées par minute - vert pour les calls, rouge pour les puts - face au prix du sous-jacent sur la séance. Survolez une barre pour voir les contrats qui la composent ; leurs lignes s'allument dans le tableau en dessous.

### Block detail

Les mêmes blocs sous forme de tableau : heure, contrat, strike, échéance, DTE, type, côté, delta, contrats, notionnel et classe. Cliquez sur un en-tête pour trier (un second en-tête sert de critère de départage, jusqu'à trois niveaux), et utilisez l'entonnoir de Strike, Expiration ou Type pour filtrer sur une valeur.

## Comment l'utiliser

Trois schémas :

1. **Smart money fortement acheteur de calls + MSI dans un régime de tendance (≥ 70) + gradient GEX favorable** ⇒ la lecture structurelle s'aligne avec le flux smart money. Directionnel à forte conviction.
2. **Smart money fortement acheteur de puts au put wall** ⇒ défense ou fading. Combiné à une lecture Positioning Trap, cela peut constituer un counter-bias exploitable.
3. **Flux smart money neutre, flux principal fort** ⇒ le flux principal traduit probablement une participation large et peu convaincue plutôt qu'un positionnement informé ; à traiter avec prudence.

## Ce que ce n'est pas

L'étiquette smart money est une **heuristique probabiliste**. Tout print smart money n'est pas informé ; tout trade informé n'est pas forcément signalé. La taille est un indice, pas une intention : un gros print peut être un pari d'ouverture, une sortie de position ou une jambe d'un spread dont l'autre jambe se trouve ailleurs dans la chaîne, et le tape ne peut pas vous dire lequel. La page est surtout utile au **niveau du bias** - quelle est l'inclinaison cumulée ? - plutôt que comme signal de trading sur des prints individuels.

## ES et NQ

Smart money n'est pas disponible pour ES et NQ. Ils n'ont pas ici de chaîne d'options propre - leurs niveaux de gamma sont dérivés des options SPX et NDX -, passez donc sur SPX ou NDX pour voir l'écran.

## La vue d'ensemble

Le flux smart money est l'un des multiples inputs du signal de base Positioning Trap (qui utilise le déséquilibre smart money signé) et du Market Pressure Index (skew du flux smart money). La page smart money est la lecture autonome ; les signaux en sont les interprétations.

## Voir aussi

- [Analyse des flux](/help/platform/flow-analysis)
- [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow)
- [Signal Positioning Trap expliqué](/education/positioning-trap-explained)
