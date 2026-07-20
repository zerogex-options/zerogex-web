# GEX Summary & Greeks

*Les chiffres clés du GEX ainsi que les agrégats de delta, gamma, vanna et charm.*

---

## Ce que montre cette page

La page GEX Summary est l'**agrégation par greek** du book d'options. Là où Dealer Positioning est structurel (walls, flip, profil), cette page fournit les totaux chiffrés : delta, gamma, vanna, charm et vega agrégés.

## Les cinq chiffres principaux

### Net GEX

Le gamma agrégé des dealers, en dollars. Positif ⇒ les dealers achètent sur la faiblesse et vendent sur la force. Négatif ⇒ les dealers poursuivent le prix. Affiché au spot.

### Net DEX

Le delta agrégé des dealers. Une valeur fortement négative signifie que les dealers sont courts en delta et doivent structurellement acheter à des niveaux plus élevés.

### Net VEX (Vanna)

Le vanna agrégé des dealers — la sensibilité du delta à l'IV. Positif signifie qu'une baisse de l'IV force les dealers à vendre ; une hausse de l'IV les force à acheter. C'est le moteur des journées de "grind par compression de volatilité".

### Net Charm

Le charm agrégé des dealers — la sensibilité du delta au temps. Positif soutient structurellement le drift vers la clôture ; négatif le contrarie. Le flux piloté par le charm s'intensifie dans les deux dernières heures de séance.

### Net Vega

Le vega agrégé des dealers. Indique dans quelle mesure les dealers sont exposés à un mouvement significatif de l'IV.

## La ventilation par strike

Sous les totaux, la page affiche les mêmes chiffres ventilés par strike — les contributions de chaque strike au gamma, au delta, au vanna et au charm. Utilisez cette vue lorsque :

- Vous voulez voir **quels strikes** pilotent le chiffre principal.
- Vous voulez confirmer que le call wall se trouve bien là où le profil GEX l'indique.
- Vous voulez repérer une concentration de vanna ou de charm que le profil GEX ne rend pas évidente.

## Conventions de signe

ZeroGEX applique systématiquement la perspective des dealers :

- Gamma positif ⇒ les dealers sont nets longs en calls / courts en puts, et se couvrent contre le prix.
- Delta positif ⇒ les dealers sont longs en delta.
- Vanna positif ⇒ les dealers profitent (en termes de delta) quand la volatilité monte.
- Charm positif ⇒ les dealers profitent (en termes de delta) à mesure que le temps s'écoule.

Lorsque vous consultez un autre fournisseur de données GEX, vérifiez toujours la convention de signe. La plupart utilisent le même signe basé sur la perspective des dealers, mais certains l'inversent.

## Lire la page

Deux approches :

1. **Recouper avec Dealer Positioning.** Si le Net GEX est nettement positif mais que le profil GEX montre la courbe basculer en négatif juste sous le spot, vous vous trouvez sur la ligne de régime — le risque est asymétrique.
2. **Surveillez vanna et charm à l'approche de la clôture.** Les deux atteignent leur influence intraday maximale dans les deux dernières heures ; la contribution du charm par strike indique où le pin se stabilisera.

## Voir aussi

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Vanna et Charm expliqués pour les traders d'options](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) expliqué](/education/gamma-exposure-explained)
