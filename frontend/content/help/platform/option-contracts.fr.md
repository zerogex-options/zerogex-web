# Cotations d'Options en Direct

*Suivez un contrat d'options pendant toute la séance. Choisir le contrat, lire les barres de volume au bid/mid/ask et les chiffres au-dessus du graphique.*

---

## Ce que montre cette page

La page Cotations d'Options en Direct suit **un contrat d'options** du symbole actif pendant la séance : le prix de la dernière transaction, et le volume de chaque minute réparti selon l'endroit où il s'est échangé - à l'ask, au mid ou au bid. Elle se met à jour toutes les 30 secondes.

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

- **Barres** (axe de gauche) - volume par minute, empilé selon l'endroit où il s'est échangé : **Ask Vol**, **Mid Vol** et **Bid Vol**.
- **Ligne** (axe de droite) - le prix de la dernière transaction (**Last**).

L'axe du temps couvre la séance, de 9 h 30 à 16 h 15 ET. Avant l'ouverture de la séance du jour, la page affiche la plus récente. Sur téléphone, les barres sont regroupées par tranches de 5 minutes pour rester lisibles.

Survolez une barre pour voir l'heure, le dernier prix et le nombre de contrats échangés au bid, au mid et à l'ask.

## Comment le lire

Trois schémas :

1. **Qui traverse le spread ?** Le volume côté ask correspond aux transactions exécutées à l'ask ou près de lui - des acheteurs qui paient l'ask pour être servis. Le volume côté bid correspond à des vendeurs qui vendent au bid. Le volume mid correspond aux transactions entre les deux.
2. **Le prix confirme-t-il ?** Du volume côté ask avec une ligne Last en hausse signifie que les acheteurs contrôlent ce contrat. Un fort volume côté ask alors que le prix stagne mérite un examen plus attentif.
3. **Quel poids pour la séance du jour face à l'OI ?** Quand Vol est élevé par rapport à l'OI, l'activité du jour est importante au regard des positions déjà ouvertes - un nouveau positionnement est peut-être en train de se construire.

## ES et NQ

ES et NQ n'ont pas de chaîne d'options propre - leurs niveaux sont dérivés des options sur SPX et NDX. Cette page n'est pas disponible pour eux ; passez à SPX ou NDX.

## Remarque sur le forfait

Les Cotations d'Options en Direct sont disponibles pour les forfaits Basic et Pro.

## Voir aussi

- [Strategy Builder](/help/platform/options-calculator)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Analyse des Flux](/help/platform/flow-analysis)
