# Technicals

*L'instantané technique intrajournalier — prix, bougies, jauges de volatilité et la façon dont les niveaux se superposent aux murs de GEX.*

---

## Ce que montre cette page

La page Technicals est la **lecture price-first** du symbole actif. C'est la seule page qui **ne** démarre **pas** par des chiffres dérivés des options — elle démarre par l'action du prix, la volatilité et le contexte technique standard.

C'est la page à ouvrir quand tu as besoin de confirmer ce que le positionnement des dealers implique par rapport à ce que le prix fait réellement.

## Le graphique en chandeliers

Le graphique principal. Chandeliers OHLC standard avec sélecteur de timeframe (1m / 5m / 15m / 1h / 1d). Overlays :

- **VWAP** (ancré sur l'ouverture de la session).
- **Le gamma flip** sous forme de ligne horizontale.
- **Le call wall et le put wall** sous forme de lignes horizontales.
- **Max pain** sous forme de ligne horizontale (là où c'est pertinent).

L'intérêt des overlays est de te permettre de lire l'action du prix à travers le prisme du positionnement des dealers sans avoir à changer d'onglet.

## Les jauges de volatilité

Trois jauges :

- **Implied Volatility** — IV ATM actuelle avec le rang par rapport aux 60 derniers jours.
- **Realized Volatility** — volatilité réalisée sur fenêtre courte avec une baseline sur fenêtre plus longue.
- **Ratio IV / RV** — quand le ratio est significativement supérieur à 1, la vol est chère (vendre de la prime) ; en dessous, la vol est bon marché (acheter de la prime).

## La bande de session

Une petite bande affichant :

- La session en cours (Pre-market, Open, After-hours, Closed)
- Le prix d'ouverture de session
- Le plus haut et le plus bas de session
- La distance du spot au VWAP
- Le temps avant le prochain événement majeur de session (ouverture, pause déjeuner, clôture)

## Comment la lire

Trois configurations :

1. **Prix coincé entre le call wall et le put wall** en gamma positif ⇒ retour à la moyenne à l'intérieur du range. Les technicals confirment le range ; la page dealer t'explique pourquoi.
2. **Prix cassant sous le put wall** en gamma négatif avec l'IV en expansion ⇒ poursuite de tendance. Les technicals montrent la cassure ; la page dealer explique l'amplification.
3. **VWAP et gamma flip qui se superposent au même niveau** ⇒ pivot structurel. Les réactions à ce niveau ont une conviction plus élevée qu'à l'un ou l'autre pris isolément.

## La vue intraday-tools

La page intraday-tools est une mise en page jumelée — le graphique en chandeliers en haut, un en-tête compressé de positionnement des dealers en dessous — pour les traders qui veulent les deux vues côte à côte.

## Voir aussi

- [Lire le Dashboard](/help/platform/dashboard)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Comment lire un Gamma Flip](/education/how-to-read-a-gamma-flip)
