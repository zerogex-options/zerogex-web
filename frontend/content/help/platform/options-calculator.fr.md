# Strategy Builder

*Valorisez une stratégie d'options à une ou plusieurs jambes aux cotations en direct. Choisir une stratégie, ajuster ses jambes et lire le graphique de profit/perte à l'échéance.*

---

## Qu'est-ce que le Strategy Builder

Le Strategy Builder est l'**outil de modélisation par opération**. Vous choisissez une stratégie et ajustez ses jambes, la page la valorise aux cotations en direct, et vous lisez son profit ou sa perte à l'échéance sur une plage de prix.

C'est l'endroit où vous allez après que le dashboard vous dit « la structure est haussière » et que vous devez choisir l'instrument concret.

## Construire une stratégie

1. **Choisissez un symbole** (SPY, SPX, QQQ, NDX) avec le sélecteur de symbole.
2. **Choisissez une stratégie** dans le menu **Strategy** - plus de 40 modèles, des calls et puts simples aux verticales, straddles, strangles, iron condors, butterflies, ratios, backspreads, calendars, diagonales, collars et synthétiques. Chaque jambe démarre avec un strike et une échéance par défaut cohérents.
3. **Ajustez les jambes** - chaque jambe d'option a son propre menu **Exp** et **Strike**, alimenté par la chaîne en direct.
4. **Réglez Contracts** - le nombre de contrats, appliqué à chaque jambe ; une jambe à ratio conserve son ratio.

Les prix des jambes, le total, le graphique et les breakevens se mettent à jour à chaque modification.

ES et NQ n'ont pas de chaîne d'options propre, le Strategy Builder n'est donc pas disponible pour eux - passez à SPX ou NDX.

## Comment les jambes sont valorisées

Chaque jambe d'option est valorisée à sa **cotation en direct**, rafraîchie toutes les quelques secondes : une jambe achetée à l'**ask**, une jambe vendue au **bid** - ce que vous paieriez ou encaisseriez réellement en traversant le spread. Chaque jambe affiche son contrat, ce prix et le côté utilisé. Les jambes en actions (dans les covered calls, collars, conversions, etc.) représentent 100 actions par contrat, prises au spot actuel.

**Total position** additionne le tout sur chaque jambe et chaque contrat : **debit** indique ce que coûte l'ouverture de la structure, **credit** ce qu'elle encaisse.

## Le graphique de P&L

**Profit / Loss at Expiration** montre ce que vaut la structure le jour de l'échéance, net de ce qu'elle a coûté ou rapporté à l'ouverture :

- Le prix du sous-jacent sur l'axe des x - par défaut ±5 % autour du spot. Les boutons **+** et **-** zooment et dézooment, **RESET** revient à la vue par défaut, et le sélecteur **%** / **$** étiquette chaque ligne de la grille en variation en pourcentage ou en dollars par rapport au spot.
- Le P&L en dollars sur l'axe des y, pour le nombre de contrats choisi.
- Une ligne pointillée au spot actuel, et une ligne **BE** à chaque breakeven visible.

Survolez la courbe pour voir le P&L à ce prix et son écart par rapport au spot.

## Calendars et diagonales

Quand les jambes expirent à des dates différentes, le graphique valorise quand même chaque jambe à sa valeur intrinsèque, comme si toutes expiraient ensemble. Cela sous-estime ce que vaut encore la jambe à échéance lointaine, et la page le signale - ne lisez la courbe que comme une indication approximative.

## Ce qu'il ne fait pas

Le Strategy Builder est un **outil de valorisation**, pas un outil d'acheminement d'ordres. Il ne se connecte pas à votre broker. Vous récupérez la structure et la mettez en place vous-même.

Il n'affiche par ailleurs que le payoff à l'échéance - pas de greeks, ni de courbes pour des dates antérieures à l'échéance.

## Note sur les niveaux

Le Strategy Builder est disponible pour les formules Basic et Pro.

## Voir aussi

- [Cotations d'Options en Direct](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
