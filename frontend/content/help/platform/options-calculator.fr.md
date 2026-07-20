# Strategy Builder

*Construisez n'importe quelle stratégie d'options à une ou plusieurs jambes. Comment le calculateur détermine les prix, comment les greeks sont calculées et comment lire les scénarios de P&L.*

---

## Qu'est-ce que le Strategy Builder

Le Strategy Builder est l'**outil de modélisation par opération**. Vous construisez une stratégie jambe par jambe, la page la valorise en direct, et vous lisez la surface de P&L ainsi que les greeks agrégées.

C'est l'endroit où vous allez après que le dashboard vous dit « la structure est haussière » et que vous devez choisir l'instrument concret.

## Construire une stratégie

1. **Choisissez un symbole** (SPY, SPX, QQQ).
2. **Ajoutez une jambe** — achat ou vente, call ou put, strike, échéance. La chaîne est en direct.
3. **Répétez** pour les structures multi-jambes (verticales, condors, calendars, ratios, straddles, strangles).
4. **Définissez le spot pour l'analyse** — par défaut le spot en direct, mais vous pouvez tester n'importe quel prix en scénario.

Le prix agrégé, les breakevens et les greeks se mettent à jour à chaque modification.

## Le modèle de valorisation

Le Builder utilise **Black-Scholes** avec la surface de volatilité implicite en direct pour chaque jambe. La surface d'IV est extraite de notre pipeline de données — la même surface qui alimente la chaîne sur la page [Cotations d'Options en Direct](/help/platform/option-contracts).

Pour les considérations d'exercice de type américain (pertinentes pour les ETF comme SPY et QQQ), le modèle approxime avec une prime d'exercice anticipé sur les jambes deep ITM proches de l'échéance. SPX est à exercice de type européen, donc aucun ajustement n'est appliqué.

## Le panneau des greeks

Pour chaque jambe et pour l'agrégat :

- **Delta** — exposition directionnelle
- **Gamma** — comment le delta évolue avec le spot
- **Theta** — décroissance temporelle (par jour)
- **Vega** — sensibilité à l'IV (par variation de 1 %)
- **Charm** — décroissance du delta (par jour)

Les greeks agrégées vous permettent de lire une structure multi-jambes d'un seul coup d'œil — par exemple, un calendar long est net long vega, short theta sur le mois proche, long theta sur le mois lointain.

## La surface de P&L

Le graphique de P&L en 2D affiche :

- Le prix spot sur l'axe des x.
- La valeur de P&L sur l'axe des y.
- Plusieurs courbes : à l'échéance (le payoff), et à diverses dates entre aujourd'hui et l'échéance.

Vous pouvez également voir les breakevens mis en évidence sur l'axe des x.

## Test de scénarios

Le panneau de scénarios vous permet de balayer deux variables à la fois — typiquement le spot et l'IV — et de voir la grille de P&L résultante. Utile pour :

- Une structure long-vol : combien gagnez-vous avec un choc de 2 points de volatilité ?
- Un pin trade : combien pouvez-vous perdre si le spot s'écarte de 1 % du max pain ?

## Ce qu'il ne fait pas

Le Strategy Builder est un **outil de valorisation**, pas un outil d'acheminement d'ordres. Il ne se connecte pas à votre broker. Vous récupérez la structure et la mettez en place vous-même.

## Note sur les niveaux

Le Strategy Builder est disponible pour les formules Basic et Pro.

## Voir aussi

- [Cotations d'Options en Direct](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
