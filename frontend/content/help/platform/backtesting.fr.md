# Backtesting

*Rejouez n'importe quel signal ZeroGEX ou une règle personnalisée sur des données d'options historiques, valorisées comme de véritables allers-retours sur jambes d'options — nets du slippage et de la commission — avec un tearsheet complet ajusté du risque, un cône de résultats Monte Carlo et des résultats ventilés par régime de gamma.*

---

## Ce qu'est la page Backtesting

La page Backtesting vous permet de tester comment une règle se serait comportée sur l'historique et de la voir valorisée comme un trade réel serait exécuté — en traversant le spread bid/ask, en payant une commission, et en subissant le drawdown d'une position ouverte. C'est un **outil de recherche** : utilisez-le pour éprouver des idées et rejeter celles qui ne tiennent pas la route, pas pour fabriquer une courbe qui a l'air belle.

## Ce que vous pouvez backtester

- **Patterns du Playbook** — n'importe lequel des patterns de signal intégrés qui pilotent les Action Cards en direct (cassure du gamma flip, fade sur le call wall, rebond sur le put wall, dérive de pression en fin de séance, et plus), seuls ou en panier.
- **Stratégies personnalisées** — un constructeur de conditions sur la structure de marché à la minute (net GEX / net GEX au spot, distance au gamma flip, distances au call/put wall, put-call ratio, MSI et régime MSI, convexity, …) compilé en entrées.
- **Structures d'options réelles** — options ATM simples, verticales à risque défini, et straddles, strangles et iron condors neutres.

## Les paramètres réglables

- **Symbole** — SPY / SPX / QQQ
- **Plage de dates** — jusqu'à la profondeur d'historique disponible (indiquée sur le formulaire)
- **Entrée** — un panier de patterns, ou une règle conditionnelle personnalisée en ET
- **Sortie** — objectifs/stops sur le niveau du sous-jacent, un overlay take-profit / stop-loss sur la prime de l'option, et un stop de durée maximale de détention (le premier déclenché l'emporte)
- **Modèle d'exécution** — % de slippage et commission par contrat (les deux sont appliqués — voir ci-dessous)
- **Dimensionnement** — capital, risque par trade, nombre maximal de positions simultanées, et plafonds optionnels de net-delta / net-vega
- **Balayages de paramètres** — exécutez une grille sur un ou deux axes pour comparer des réglages côte à côte

## Les résultats produits

### La courbe d'equity

La valeur de votre compte tout au long du run, valorisée **au marché** — les positions ouvertes sont valorisées à chaque bougie, donc un trade en perte latente se répercute sur la courbe et sur le drawdown maximal. Le drawdown est calculé du pic au creux sur cette courbe, pas seulement sur les pertes réalisées.

### Le tearsheet de performance

La batterie de métriques ajustées du risque qu'un lecteur sérieux consulte en premier :

- **Sharpe, Sortino, Calmar** et **CAGR**
- **Volatilité annualisée**, **exposition**, et la **plus longue série de pertes**
- **Expectancy par trade**, **payoff ratio**, gain et perte moyens et maximaux
- Un **edge t-stat** — le résultat moyen du trade est-il distinguable du bruit (|t| ≥ 2) ?
- Un **benchmark** : votre rendement comparé au simple achat-conservation du sous-jacent sur la même période, et le surplus de rendement.

### Le cône de résultats Monte Carlo

Votre séquence de trades rééchantillonnée de mille façons différentes, parce qu'une seule courbe d'equity ressemble à une fatalité alors qu'elle n'en est pas une. Vous obtenez la **probabilité de terminer profitable**, le **risque de ruine** (probabilité d'un drawdown ≥50 %), la plage **p5 / p50 / p95** des rendements et des drawdowns maximaux, ainsi qu'un **cône d'equity** ombré indiquant où le compte pourrait plausiblement atterrir.

### Résultats par régime de marché

La ventilation propre à ZeroGEX : les mêmes règles réparties selon le **contexte de dealer-gamma** (positif/suppresseur vs négatif/amplificateur) et selon le **régime MSI**, avec le win rate, le P&L net et l'expectancy pour chacun. Une règle qui performe en séances de gamma négatif et saigne en gamma positif est un pari de régime — c'est ici que vous le voyez.

### Le journal des trades

Chaque aller-retour avec la prime d'entrée/sortie, les contrats, le net Δ/vega, le régime à l'entrée, le P&L net et le résultat. Exportez le journal complet en CSV.

## Comment les exécutions sont modélisées

- **Sensible au slippage.** Chaque jambe est exécutée à travers le spread coté — vous achetez à l'ask, vendez au bid — élargi par votre paramètre de slippage. C'est le coût dominant et réaliste sur le 0DTE.
- **Sensible à la commission.** La commission est facturée par contrat, par jambe, à l'entrée comme à la sortie, et intégrée au dimensionnement de la position.
- **Sensible au risque défini.** Les structures multi-jambes sont bornées à leur perte maximale / gain maximal sans arbitrage, de sorte qu'une cotation illiquide proche de l'expiration ne puisse pas enregistrer un résultat impossible.

Les rendements rapportés sont **nets de tout ce qui précède** — les chiffres que vous voyez sont après coûts, pas bruts.

## Ce que le backtester **n'est pas**

- **Pas un outil de prévision.** Les performances passées ne prédisent pas les rendements futurs. Utilisez le backtester pour **rejeter** les règles qui semblent mauvaises, pas pour "trouver" des règles qui semblent bonnes.
- **Pas un substitut à la discipline out-of-sample.** Le cône Monte Carlo et l'edge t-stat vous indiquent à quel point un résultat est fragile, mais l'habitude reste essentielle : concevez sur une période, confirmez sur une autre que vous avez mise de côté.
- **Limité par la profondeur des données.** Vous ne pouvez tester que la fenêtre archivée par la plateforme. Une fenêtre courte est un petit échantillon — lisez le t-stat et la plage Monte Carlo en conséquence, et appuyez-vous sur la ventilation par régime pour savoir de quel contexte proviennent vos chiffres.

## Lire les résultats honnêtement

> Jugez une règle sur ses chiffres **ajustés du risque** et sur sa **plage de résultats**, pas sur sa meilleure ligne isolée.

Un win rate élevé avec un payoff ratio inférieur à 1 et un cône Monte Carlo large n'est pas un edge. Un win rate modeste avec une expectancy positive, un t-stat supérieur à 2, un drawdown limité et une cohérence à travers les régimes de gamma, si. Vérifiez toujours quel régime a produit le résultat — et s'il survit à celui dans lequel vous tradez aujourd'hui.

## Note sur le palier

Le Backtesting est une fonctionnalité Pro.

## Voir aussi

- [Composite Score](/help/platform/composite-score)
- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
