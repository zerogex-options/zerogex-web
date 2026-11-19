# Cotations d'Options en Direct

*Suivez un contrat d'options pendant toute la séance. Choisir le contrat, lire les barres de volume acheté et vendu et les chiffres au-dessus du graphique.*

---

## Ce que montre cette page

La page Cotations d'Options en Direct suit **un contrat d'options** du symbole actif pendant la séance : le prix de la dernière transaction, et le volume de chaque minute réparti par côté - acheté, vendu ou sans indice de côté. Elle se met à jour toutes les 30 secondes.

## Choisir un contrat

Trois menus au-dessus du graphique déterminent le contrat :

- **Expiration** - les échéances négociées pendant cette séance, aujourd'hui ou plus tard. Par défaut celle du jour (0DTE) s'il y en a une, sinon la plus proche.
- **Strike** - par défaut le strike le plus proche du prix en direct.
- **Type** - **Call** ou **Put**. Par défaut Call.

Le nom du contrat s'affiche sous les menus - p. ex. `SPY 600 C 10/02/2026` - avec son nombre de jours avant l'échéance.

## Les chiffres au-dessus du graphique

Pour la séance affichée :

- **Vol** - contrats échangés jusqu'ici.
- **OI** - open interest.
- **Avg** - le prix moyen des transactions, pondéré par le volume.
- **Prem** - prime échangée : Vol × Avg × 100.
- **IV**, **Δ** (delta) et **Θ** (theta) - issus de la cotation la plus récente.

## Le graphique

- **Barres** (axe de gauche) - volume par minute, empilé par côté : **Bought** (acheté), **No side** (sans côté) et **Sold** (vendu).
- **Ligne** (axe de droite) - le prix de la dernière transaction (**Last**).

Le côté vient du **tick test**, qui compare le prix de chaque transaction à celui de la transaction précédente sur le même contrat, et non au bid ni au ask. Un prix plus haut compte comme acheté, un prix plus bas comme vendu, et un prix inchangé prend le côté du dernier changement de prix. **No side** est le volume auquel le test ne peut pas attribuer de côté : une transaction sans transaction antérieure à laquelle la comparer, un prix inchangé avant qu'un changement de prix ait fixé un côté, et tout ce qui s'échange dans la minute d'ouverture de 9 h 30.

L'axe du temps couvre la séance, de 9 h 30 à 16 h 15 ET. Avant l'ouverture de la séance du jour, la page affiche la plus récente. Sur téléphone, les barres sont regroupées par tranches de 5 minutes pour rester lisibles.

Survolez une barre pour voir l'heure, le dernier prix et le nombre de ses contrats comptés comme vendus, achetés ou sans côté.

## Comment le lire

Trois schémas :

1. **Qui pousse le prix ?** Le volume acheté correspond à des acheteurs qui paient plus cher pour être servis : des transactions qui ont fait monter le prix ou l'ont maintenu après une hausse. Le volume vendu correspond à des vendeurs qui acceptent moins : des transactions qui l'ont fait baisser ou l'ont maintenu après une baisse. Le volume sans côté correspond aux transactions auxquelles le test n'a pas pu attribuer de côté.
2. **Quel volume derrière le mouvement ?** Le côté vient des propres changements de prix de ce contrat, donc le volume acheté et une ligne Last en hausse vont généralement ensemble ; leur accord n'est pas une seconde lecture indépendante. Ce que les barres ajoutent, c'est le nombre de contrats échangés à chaque mouvement : une hausse sur une poignée de contrats en dit moins qu'une hausse portée par un fort volume acheté.
3. **Quel poids pour la séance du jour face à l'OI ?** Quand Vol est élevé par rapport à l'OI, l'activité du jour est importante au regard des positions déjà ouvertes - un nouveau positionnement est peut-être en train de se construire.

## ES et NQ

ES et NQ n'ont pas de chaîne d'options propre - leurs niveaux sont dérivés des options sur SPX et NDX. Cette page n'est pas disponible pour eux ; passez à SPX ou NDX.

## Remarque sur le forfait

Les Cotations d'Options en Direct sont disponibles pour les forfaits Basic et Pro.

## Voir aussi

- [Strategy Builder](/help/platform/options-calculator)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Analyse des Flux](/help/platform/flow-analysis)
