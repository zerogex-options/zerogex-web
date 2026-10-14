# Technicals

*Le tableau intrajournalier du prix sur lequel repose le book d'options - VWAP, range d'ouverture, pics de volume et divergence de momentum, sur un seul graphique avec le flip et les walls.*

---

## Ce que montre cette page

La page Technicals est la **lecture price-first** du symbole actif. C'est la seule page Metrics qui lit le prix plutôt que la chaîne d'options - le VWAP, le range d'ouverture, le volume inhabituel et le momentum confronté au flux d'options - et elle trace le tout face au gamma flip, aux walls et au pin.

C'est la page à ouvrir quand tu as besoin de confirmer ce que le positionnement des dealers implique par rapport à ce que le prix fait réellement.

## La lecture de la séance

La ligne du haut lit la séance d'un coup d'œil : **Price**, **VWAP** (et l'écart du prix à celui-ci), la place du prix dans l'**Opening range**, **Dealer gamma** (gamma long ou court, et de quel côté du flip se trouve le prix) et les **Walls**, chacun avec sa distance au prix.

## Le graphique de séance

Bougies de 5 minutes de la séance, heures en ET, avec :

- **VWAP** - la ligne pointillée qui traverse les bougies.
- **Le range d'ouverture** - la bande ombrée entre le plus haut et le plus bas de 09:30-09:59 ET. Ses cinquièmes supérieur et inférieur, plus clairs, sont la zone où le statut indique « near the high » ou « near the low ».
- **Le flip, les walls et le pin** - les mêmes niveaux que le bandeau Key Levels et le Gamma Terminal. Un niveau trop éloigné des prix de la séance pour être tracé est signalé par une flèche au bord de l'axe des prix.
- **Volume** - en dessous. Les barres dépassant d'au moins un écart-type leur propre moyenne récente sont colorées selon que les achats (vert) ou les ventes (rouge) ont dominé ; les autres sont grises.
- **Marqueurs numérotés** - divergences et cassures du range d'ouverture, numérotées dans l'ordre chronologique pour correspondre à la liste des événements.

Les boutons au-dessus du graphique activent ou masquent chaque couche, et ce navigateur retient ton choix. Survole une bougie, ou touche-la sur mobile, pour voir son ouverture, son plus haut, son plus bas, sa clôture, le VWAP et le volume.

## Range d'ouverture

Le plus haut et le plus bas des 30 premières minutes de la séance régulière (09:30-09:59 ET), figés pour le reste de la journée, chacun avec sa distance au prix, la taille du range et son **statut** :

- **Above the range** / **Below the range** - la dernière clôture de 5 minutes est au-delà du plus haut ou du plus bas.
- **Near the high** / **Near the low** - dans le range, dans son cinquième supérieur ou inférieur.
- **Inside** - les trois cinquièmes du milieu.

« Near » se mesure par rapport au range lui-même : il s'adapte à la journée plutôt qu'au prix. **Where price sits** dessine les mêmes zones sous forme de barre.

Le **journal des cassures** liste ce que le prix a fait autour du range : tests du plus haut ou du plus bas (une mèche au-delà, puis une clôture de retour dans le range), cassures (une clôture au-delà), le point le plus éloigné atteint en multiples du range et les clôtures de retour dans le range, avec la durée de la cassure.

## Événements

Une seule liste, du plus récent au plus ancien :

- **Bearish divergence** - le prix monte sur cinq minutes alors que le flux d'options penche vers les puts. **Bullish divergence** - le prix baisse alors qu'il penche vers les calls.
- **Weak rally** / **Weak selloff** - le prix a bougé alors que le volume haussier et baissier penchait dans l'autre sens.
- **Volume spike** - une barre de 5 minutes dépassant d'au moins un écart-type sa moyenne récente, avec l'ampleur de l'écart et le côté (achats ou ventes) qui a dominé.
- **Événements du range d'ouverture** issus du journal des cassures.

Les barres où le prix et le flux d'options concordent (les confirmations) sont omises, car ce sont le cas ordinaire. La variation sur 5 minutes est exprimée dans les unités de prix du symbole - des points sur ES et NQ -, pas en pourcentage.

## Comment la lire

Trois configurations, toutes visibles sur le même graphique :

1. **Prix entre le call wall et le put wall** en gamma positif ⇒ le hedging s'oppose aux mouvements vers l'un ou l'autre wall, un contexte de retour à la moyenne. Les bougies confirment le range ; les niveaux en suggèrent la raison.
2. **Prix cassant sous le put wall** en gamma négatif avec l'IV en expansion ⇒ une poursuite de tendance *devient plus probable*. Les bougies montrent la cassure ; le régime explique l'amplification modélisée.
3. **VWAP et gamma flip qui se superposent au même niveau** ⇒ un pivot structurel à surveiller. Les réactions à ce niveau *peuvent* avoir une conviction plus élevée qu'à l'un ou l'autre pris isolément.

Pour le reste du tableau gamma à côté des bougies - les échelles de strikes, les rubans et le rewind -, utilise le Gamma Terminal ; voir [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts).

## Voir aussi

- [Lire le Tableau de bord](/help/platform/dashboard)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts)
- [Comment lire un Gamma Flip](/education/how-to-read-a-gamma-flip)
