# GEX Summary

*Les chiffres clés du GEX et les niveaux qu'ils impliquent, sur un seul écran - ainsi que la tenue du gamma flip selon les horizons, et le caractère inhabituel ou non du gamma des dealers du jour.*

---

## Ce que montre cette page

La page GEX Summary est la vue **en chiffres** du book d'options. Là où Dealer Positioning est structurel (profil, walls, heatmaps), cette page réunit dix chiffres clés sur un seul écran, puis montre comment le gamma flip évolue selon les horizons d'options et comment le gamma des dealers du jour se compare à son propre historique.

Le sélecteur **GEX unit** de l'en-tête bascule tous les montants GEX en dollars entre le gamma par mouvement de 1 % (par défaut) et par 1 point. L'exposition est la même dans les deux cas ; seule l'unité change.

## La rangée du haut

### Prix

Le prix en direct du symbole actif. Lorsque le marché au comptant est fermé et que le prix provient des futures, la carte l'indique et nomme le contrat - les niveaux GEX restent calculés sur l'indice au comptant.

### Net GEX

Le gamma modélisé des dealers, en dollars, selon la convention traditionnelle d'open interest (calls positifs, puts négatifs). Selon cette convention, un net GEX positif est cohérent avec des dealers qui *tendent* à acheter la faiblesse et à vendre la force ; négatif, avec des dealers qui *tendent* à poursuivre le prix. Affiché au spot - la valeur de même signe que le gamma flip, et non le total sur toute la chaîne.

> Le Net GEX est une **estimation** : il modélise le gamma des dealers selon la convention calls positifs / puts négatifs. L'inventaire réel des dealers n'est pas directement observable à partir des données publiques de la chaîne d'options.

### Gamma Flip

Le flip structurel : le prix auquel le gamma agrégé modélisé des dealers change de signe, calculé avec une pondération par horizon qui atténue les walls 0DTE à échéance proche. Au-dessus, le hedging modélisé *tend* à amortir les mouvements ; en dessous, à les amplifier. **Raw nearest**, juste en dessous, est le passage à zéro le plus proche sur le profil non pondéré - la convention que publient de nombreux autres dashboards. Sans la pondération, les walls à échéance proche peuvent le tirer beaucoup plus près du spot que le flip structurel.

### Max Pain

Le strike auquel le paiement aux détenteurs d'options à l'échéance est le plus faible. Voir [Max Pain](/help/platform/max-pain) pour savoir quand il compte et quand il ne compte pas.

### Pin Strike

Le strike 0DTE atteignable présentant le plus fort gamma positif modélisé des dealers jusqu'à la clôture, avec sa force (Strong, Moderate ou Weak) et son pourcentage de confiance. Voir [Pin Strike](/help/platform/pin-strike) pour son calcul et ce que « Weak » signifie réellement.

## La rangée du bas

- **Call GEX** et **Put GEX** - l'exposition gamma totale modélisée des calls et des puts, les deux moitiés derrière le Net GEX.
- **Put/Call Ratio** - le volume de puts divisé par le volume de calls. Au-dessus de 1, tendance baissière ; en dessous de 1, haussière.
- **Call Wall (Resistance)** et **Put Wall (Support)** - le strike au niveau du spot ou au-dessus présentant le plus grand call gamma, et le strike au niveau du spot ou en dessous présentant le plus grand put gamma, chacun additionné sur l'échéance du jour et les deux suivantes (0-2DTE), avec la distance au spot. Un graphique limité au seul 0DTE peut afficher un autre strike. Les libellés sont la lecture habituelle, pas une garantie : dans notre étude portant sur 737 tests de walls, les walls du S&P ont tenu environ deux fois sur trois dans l'heure et ceux du Nasdaq environ une fois sur deux, et le signe modélisé du gamma des dealers n'y a rien changé.

## Gamma Flip · Term Structure

Le gamma flip du jour, résolu séparément pour chaque horizon d'options - de 1 à 60 jours par défaut, avec les préréglages **Std**, **Short** et **Long**. Chaque point est coloré selon le signe du gamma des dealers au spot. Les contours en losange marquent le flip enregistré il y a autant de jours, et un X rouge signale un horizon pour lequel aucun passage à zéro n'a pu être résolu. Utilisez-le pour voir si le flip tient sur l'ensemble des horizons ou s'il s'agit d'un effet d'échéance proche.

## Horizon × Price Contour

La même question sous forme de surface : le gamma modélisé des dealers selon des prix spot hypothétiques (x) et des horizons d'options (y). Les cellules bleues sont long gamma (stabilisantes), les rouges short gamma (déstabilisantes), et une ligne noire suit le passage à zéro - le flip à chaque horizon. Des repères marquent le spot actuel et les call et put walls les plus lourds.

## Gamma Pulse

*« Is current dealer gamma irregular? »* Le Net GEX au spot et le net GEX total de la chaîne, chacun situé par rapport aux 30 derniers jours et à tout l'historique - **EXTREME HIGH**, **ELEVATED**, **NORMAL**, **LOW** ou **EXTREME LOW** - avec un trophée lorsqu'une valeur établit un record. La comparaison tient compte de l'heure de la séance, si bien que le pin habituel de fin de journée n'est pas signalé comme inhabituel.

## Conventions de signe

ZeroGEX signe chaque greek depuis une perspective de dealer modélisée - la même convention partout, et non un inventaire observé :

- Gamma positif ⇒ selon la convention calls positifs / puts négatifs, les dealers sont *selon le modèle* nets longs en calls / courts en puts, et se couvrent contre le prix.
- Gamma négatif ⇒ les dealers sont *selon le modèle* nets courts en gamma, et se couvrent dans le sens du prix.

Lorsque vous consultez un autre fournisseur de données GEX, vérifiez toujours la convention de signe. La plupart utilisent le même signe basé sur la perspective des dealers, mais certains l'inversent.

## Lire la page

Deux approches :

1. **Recouper avec Dealer Positioning.** Si le Net GEX est nettement positif mais que le profil GEX montre la courbe basculer en négatif juste sous le spot, vous vous trouvez sur la ligne de régime - le risque est asymétrique.
2. **Comparer le flip et Raw nearest.** Quand les deux sont très éloignés, c'est le gamma à échéance proche qui tire. La term structure du flip montre si le niveau tient sur l'ensemble des horizons.

## Voir aussi

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Vanna et Charm expliqués pour les traders d'options](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) expliqué](/education/gamma-exposure-explained)
