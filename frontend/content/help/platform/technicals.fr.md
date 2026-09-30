# Technicals

*Le tableau intrajournalier du prix sur lequel repose le book d'options - VWAP, range d'ouverture, pics de volume et divergence de momentum.*

---

## Ce que montre cette page

La page Technicals est la **lecture price-first** du symbole actif. C'est la seule page Metrics qui lit le prix plutôt que la chaîne d'options - le VWAP, le range d'ouverture, le volume inhabituel et le momentum confronté au flux d'options.

C'est la page à ouvrir quand tu as besoin de confirmer ce que le positionnement des dealers implique par rapport à ce que le prix fait réellement.

## VWAP Analysis

Quatre cartes - **Current Price**, **VWAP**, **Deviation** (l'écart du prix au VWAP, en pourcentage) et **Position** (au-dessus ou en dessous) - et un graphique du prix face au VWAP au fil de la séance. Le canal ombré entre les deux s'élargit à mesure que le prix s'éloigne du VWAP : vert quand le prix est au-dessus, rouge quand il est en dessous.

## Opening Range Breakout

Le range d'ouverture est le plus haut et le plus bas des 30 premières minutes de la séance régulière (09:30-09:59 ET), figé pour le reste de la journée. Les cartes affichent **ORB High** et **ORB Low** avec la distance à chacun, ainsi que l'**ORB Range** ; **Position Within Range** montre où se situe le prix entre les deux, et l'**ORB breakout map** trace le prix face aux deux lignes.

## Unusual Volume Spikes

Les barres de 5 minutes dont le volume a dépassé d'au moins un écart-type leur propre moyenne récente - étiquetées Moderate, High ou Extreme Spike -, tracées face au prix du sous-jacent. Chaque barre est colorée du rouge (volume entièrement baissier) au vert (volume entièrement haussier) en passant par le neutre. Survole une barre pour voir son volume, son multiple de la moyenne et la répartition de la pression acheteuse.

## Momentum Divergence Signals

Une liste continue, de la plus récente à la plus ancienne, qui confronte chaque mouvement de prix de 5 minutes au flux d'options et au volume haussier et baissier qui le sous-tend : **Bearish Divergence** (le prix monte pendant que des puts sont achetés), **Bullish Divergence** (le prix baisse pendant que des calls sont achetés), **Bullish** ou **Bearish Confirmation** quand le prix et le flux d'options concordent, et **Weak Rally** ou **Weak Selloff** quand le volume va à l'encontre du mouvement.

## Comment la lire

Trois configurations - les walls et le flip viennent de Dealer Positioning ou du Gamma Terminal :

1. **Prix entre le call wall et le put wall** en gamma positif ⇒ le hedging s'oppose aux mouvements vers l'un ou l'autre wall, un contexte de retour à la moyenne. Les technicals confirment le range ; la page dealer en suggère la raison.
2. **Prix cassant sous le put wall** en gamma négatif avec l'IV en expansion ⇒ une poursuite de tendance *devient plus probable*. Les technicals montrent la cassure ; la page dealer explique l'amplification modélisée.
3. **VWAP et gamma flip qui se superposent au même niveau** ⇒ un pivot structurel à surveiller. Les réactions à ce niveau *peuvent* avoir une conviction plus élevée qu'à l'un ou l'autre pris isolément.

Pour voir le flip, les walls, le max pain et le VWAP tracés directement sur les bougies, utilise le graphique du Gamma Terminal - voir [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts).

## Voir aussi

- [Lire le Tableau de bord](/help/platform/dashboard)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts)
- [Comment lire un Gamma Flip](/education/how-to-read-a-gamma-flip)
