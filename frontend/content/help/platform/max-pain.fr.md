# Max Pain

*Comment le max pain est calculé, quand il agit comme un aimant et quand il n'est qu'une coïncidence, et comment le lire aux côtés du gamma profile.*

---

## Ce qu'est le max pain

Le max pain est le **strike à l'expiration** auquel la valeur totale en dollars de toutes les options ouvertes est minimale — c'est-à-dire le niveau où, globalement, les acheteurs d'options "perdent le plus".

L'argument classique veut que les market makers (les vendeurs naturels d'options aux particuliers) aient intérêt à pousser le spot vers le max pain. L'argument plus honnête est plus nuancé — voir [Max Pain Expliqué](/education/max-pain-explained).

## Ce que montre cette page

### La tuile principale

Le strike de max pain actuel pour la prochaine échéance majeure, avec la distance par rapport au spot.

### Le sélecteur d'échéance

Le max pain est calculé par échéance. Le sélecteur permet de choisir 0DTE, les échéances de cette semaine, de la semaine prochaine et la prochaine échéance mensuelle.

### Le graphique

En abscisse, le strike ; en ordonnée, la somme des payouts des options in-the-money (call + put). Le point minimum de la courbe est le max pain. Le graphique montre également :

- Le spot actuel.
- Le call wall et le put wall issus du profil GEX.
- Le gamma profile spécifique à l'échéance, en dessous.

### La migration historique

Un petit panneau montrant comment le max pain a évolué au cours des dernières séances pour l'échéance sélectionnée — utile pour repérer une dérive vers (ou à l'écart de) le spot.

## Quand le max pain compte

Le max pain est le plus fiable :

- **Dans les 24 à 48 dernières heures avant une échéance significative.** Avant cela, la chaîne est trop active pour que le max pain soit stable.
- **Pour le 0DTE sur SPX.** La chaîne 0DTE a une taille suffisante pour que la pression de pinning soit réelle.
- **Quand l'aimant gamma s'aligne avec l'aimant du max pain.** Lorsque le strike de max pain coïncide aussi avec un strike à gamma élevé (un wall), la pression de pinning est réelle. Lorsqu'ils ne s'alignent pas, il s'agit surtout d'une coïncidence.

## Quand il ne compte pas

- **Sur des marchés activement en tendance.** Les catalyseurs macro l'emportent sur le comportement de pin.
- **Pour les échéances minces ou les weeklies peu liquides.** Il n'y a pas assez d'open interest pour créer une pression de pinning.
- **Loin de l'expiration.** Le "temps avant l'expiration" est le facteur déterminant.

## Comment le lire aux côtés du gamma

Deux lectures :

1. **Max pain très proche d'un wall** ⇒ pin structurel vers la clôture. Le wall est le niveau ; le max pain est l'appât.
2. **Max pain éloigné des walls et du spot** ⇒ ignorez le max pain. La pression structurelle se situe ailleurs.

## Voir aussi

- [Max Pain Expliqué — Est-ce Vraiment Efficace ?](/education/max-pain-explained)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Gamma Walls Expliqués](/education/gamma-walls-explained)
