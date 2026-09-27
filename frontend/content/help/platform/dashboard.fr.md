# Lire le Tableau de bord

*La page que tu ouvres en premier chaque matin. Chaque bandeau, graphique et carte, expliqués.*

---

## À quoi sert le Tableau de bord

Le Tableau de bord principal est la **lecture en un seul écran** du marché actuel. Il répond, en 30 secondes, à trois questions :

1. **Comment les dealers sont-ils positionnés ?** (le régime gamma et les niveaux clés)
2. **Que dit le tape ?** (flow et volatilité)
3. **Quelle est la lecture combinée ?** (Trade Bias et le Composite MSI)

Tu ne prends pas de décisions sur le Tableau de bord. Tu t'orientes. À partir de là, tu vas creuser dans la page appropriée.

## Simple et Detailed

Le sélecteur **Simple / Detailed** en haut à droite règle la quantité d'information affichée sur la page. **Simple** est le mode par défaut et garde la page lisible d'un coup d'œil : Lecture du Jour, Signaux Propriétaires et Volatilité, et Positionnement et Flux sont repliées au départ - clique sur le titre d'une section pour l'ouvrir. **Detailed** ouvre toutes les sections. Ton choix est mémorisé.

## L'anatomie

### 1. Key Levels

Le bandeau tout en haut. Son en-tête affiche le symbole, les expirations dont proviennent les niveaux, et le chip **Long γ / Short γ** : long gamma signifie que le hedging des dealers tend à amortir les mouvements (pinning) ; short gamma signifie qu'il tend à les amplifier (tendance). En dessous, une carte par niveau, chacune avec l'écart entre le prix et ce niveau :

- **Spot** - le prix en direct et sa variation.
- **Gamma Flip** - le niveau où le gamma modélisé des dealers change de signe. Au-dessus, le hedging amortit les mouvements ; en dessous, il les amplifie. Plus le prix est proche du flip, plus le risque d'un changement de régime est élevé.
- **Pin Strike** - le strike 0DTE proche où le gamma positif des dealers et la probabilité que le prix l'atteigne se combinent le plus fortement, avec un label Strong / Moderate / Weak. C'est un niveau de pinning modélisé, pas un objectif de prix, et la carte le signale lorsqu'aucun strike ne remplit les conditions. Voir [Pin Strike](/help/platform/pin-strike).
- **Call Wall** et **Put Wall** - les strikes qui concentrent le plus de gamma call et de gamma put. Ils ont tendance à agir comme résistance et support, en particulier en gamma positif. Voir [Les Gamma Walls expliqués](/education/gamma-walls-explained).
- **Max Pain** - le strike qui minimise la valeur totale des options en circulation à l'expiration. Surtout pertinent dans les un ou deux derniers jours avant une expiration significative. Voir [Le Max Pain expliqué](/education/max-pain-explained).

Le bandeau affiche exactement les niveaux que trace le Gamma Chart, y compris tout filtre d'expiration que tu as défini sur le graphique. Pour changer de symbole depuis le bandeau, survole-le sur ordinateur pour faire apparaître des flèches, ou balaie-le du doigt sur téléphone.

### 2. Lecture du Jour

Un titre et un court paragraphe générés automatiquement sur le régime du symbole sélectionné : long gamma (pinning, volatilité plus faible), short gamma (tendance, volatilité plus élevée), au niveau du flip (une transition), ou indéterminé lorsque le flip ne peut pas être calculé à partir du snapshot actuel. La Lecture repose sur le même modèle que le [Bulletin en direct](/help/platform/live-bulletin), et cliquer dessus ouvre le bulletin complet.

### 3. Le Gamma Chart

Le ZeroGEX Gamma Chart est la pièce maîtresse : des bougies en direct, avec la structure de gamma des dealers tracée sur le même axe de prix. Par défaut, il trace le flip et les call et put walls (**Gamma Levels**), **Max Pain**, **Pin Strike** et **VWAP**, et ombre les zones de gamma long et court (**Regime**) - chacun est un bouton au-dessus du graphique. Le **Gamma Rail**, à côté des bougies, montre le gamma net des dealers par prix, de sorte que les walls apparaissent littéralement comme des barres. L'en-tête du graphique affiche le prix en direct, sa variation, la session et le régime de gamma des dealers. Utilise les contrôles du graphique pour changer l'unité de temps et le style du graphique, et pour filtrer les expirations qui alimentent les niveaux. Voir [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts).

### 4. Trade Bias

Une seule carte avec le régime, le bias (par exemple *Buy Dips*, *Sell Rips*, *Range-Bound* ou *Neutral*) et un score de confiance sur 10. C'est une synthèse de lecture descendante, **pas** un signal de trading. **Open Trade Bias** mène au détail complet et au playbook sur la page Trade Bias, qui fait partie de Pro. En Basic, la carte est construite sans les inputs de signaux réservés à Pro.

Sous la carte, **How to read these signals** (replié) explique comment Trade Bias, le Composite MSI, les signaux Basic et les signaux Advanced s'articulent.

### 5. Signaux Propriétaires et Volatilité

- **Composite MSI** - une jauge de régime 0-100 : 70 et plus correspond à **Trend / Expansion**, 40-70 à **Controlled Trend**, 20-40 à **Chop / Range** et moins de 20 à **Compression**, la zone où les mouvements ont le moins porté. Un MSI élevé ne signifie pas haussier - il signifie que les tendances peuvent se prolonger. Lis la direction dans Trade Bias ou dans les signaux individuels.
- **Signal Breadth** - combien de signaux sont orientés à la hausse, neutres ou orientés à la baisse, avec le plus fort de chaque côté.
- **Regime Triggers** (Pro) - à quel point le marché est prêt pour un changement de régime, d'après Volatility Expansion, Range Break Imminence et Market Pressure. Lis l'ampleur de chaque score, pas son signe.
- **Moniteur de Volatilité** - deux jauges : **Level** (VIX, ou VXN pour QQQ et NDX) et **Momentum** (si la volatilité s'effondre, se détend, reste stable, monte ou s'envole).

### 6. Positionnement et Flux

- **Call GEX** et **Put GEX** - l'exposition gamma totale des calls et des puts.
- **Call Wall (Résistance)** et **Put Wall (Support)** - le plus fort gamma call au niveau du spot ou au-dessus, et le plus fort gamma put au niveau du spot ou en dessous, avec la distance au spot. Ils sont classés sur l'expiration du jour et les deux suivantes (0-2DTE) : si tu as filtré le graphique sur le 0DTE seul, le bandeau Key Levels peut donc afficher un autre strike.
- **Flux Net**, **Prime Nette** et **Ratio Put/Call** - pour la session en cours : contrats call nets moins contrats put nets, la même chose en dollars de prime, et volume put divisé par volume call. "Net" signifie initié par l'acheteur moins initié par le vendeur : un Flux Net positif est donc un flux orienté vers les calls.

En bas de la page figurent le rappel que le positionnement des dealers est modélisé, pas observé directement, et l'heure de la dernière mise à jour.

## Comment le tableau de bord se met à jour

Tout se met à jour en direct, il n'est donc pas nécessaire de recharger la page. Le prix se met à jour chaque seconde. Les niveaux et les signaux sont recalculés environ une fois par minute, et la page récupère chaque nouveau calcul en quelques secondes. Les jauges de volatilité se mettent à jour environ toutes les 30 secondes.

## Pre-market, after-hours et marché fermé

La session affichée dans l'en-tête du Gamma Chart t'indique de quelle session provient le prix. En dehors des heures régulières, les niveaux et les signaux reflètent le calcul le plus récent.

## Lire le Tableau de bord en 30 secondes

La discipline :

1. Lis le chip **Long γ / Short γ** et la position du Spot par rapport au **Gamma Flip**.
2. Lis le **Call Wall** et le **Put Wall** - ce sont tes niveaux. Près de l'expiration, vérifie aussi le **Pin Strike**.
3. Jette un œil à la carte **Trade Bias**.
4. Ouvre la **Lecture du Jour** si tu la veux en mots.
5. Décide quelle page ouvrir pour le trade proprement dit.

C'est tout. Si tu te surprends à passer plus de 30 secondes ici, tu as cessé de t'orienter et commencé à analyser - va sur la page de signal concernée.

Envie de ta propre disposition ? [Mon tableau de bord](/my-dashboard) te permet de composer un tableau à partir de widgets, dont Key Levels, et sur ordinateur tu peux le diviser pour suivre deux symboles côte à côte.

## Voir aussi

- [Comment fonctionnent les Signals, de bout en bout](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Utiliser le Live Bulletin](/help/platform/live-bulletin)
- [Pin Strike](/help/platform/pin-strike)
