# Dealer Positioning

*La surface GEX complète — Net GEX au spot, le gamma flip, call wall et put wall, et comment lire la term structure.*

---

## Ce que montre cette page

La page Dealer Positioning est la **carte structurelle** du book d'options. Chaque graphique et chaque tuile répond à une seule question : où sont positionnés les dealers, et que seront-ils contraints de faire à mesure que le prix évolue ?

C'est la page la plus importante pour comprendre le contexte — même si le trade lui-même est exécuté ailleurs.

## Les tuiles principales

### Net GEX au spot

La valeur de dollar-gamma de toutes les options ouvertes, signée selon la position des dealers, évaluée **au prix spot actuel**. Positif ⇒ les dealers sont net long gamma ; négatif ⇒ les dealers sont net short.

Le chiffre affiché ici est mesuré au spot, et non additionné sur toute la chaîne — c'est important car le signe au spot détermine le comportement des dealers à cet instant précis, indépendamment de ce que fait la courbe cumulée à d'autres prix.

### Gamma Flip

Le strike auquel la courbe de gamma des dealers croise zéro. Le flip est la ligne de régime : au-dessus, le hedging est stabilisant ; en dessous, il est amplificateur. La tuile affiche à la fois le strike absolu et la distance en pourcentage par rapport au spot.

### Call Wall / Put Wall

Les strikes présentant le plus grand call gamma et put gamma. Ils tendent à agir comme résistance et support intraday. Le fait que le wall se comporte réellement comme un « mur » est plus fiable en gamma positif.

### Max Pain

Le strike auquel le payout total des acheteurs d'options est minimisé. Plus pertinent dans les 24 à 48 dernières heures d'une échéance significative.

## Le graphique de profil GEX

Le graphique principal. Strike en abscisse ; gamma des dealers en ordonnée. Trois éléments à lire :

1. **Là où la courbe croise zéro** — le gamma flip.
2. **La plus grande accumulation de call gamma** — le call wall.
3. **La plus grande accumulation de put gamma** — le put wall.

Le prix spot actuel est affiché sous forme de ligne de référence verticale. La plage visible est centrée sur le spot.

## Le graphique des walls

Une vue distincte, en format plus grand, de la structure des walls avec le call wall, le put wall, le max pain et le gamma flip superposés. Utile lorsque vous voulez voir comment la structure a évolué depuis l'ouverture.

## Le graphique de term structure

Le profil GEX **par échéance**. Empile 0DTE, les échéances de la semaine en cours, de la semaine suivante et les mensuelles en une seule vue. Utile pour :

- Repérer un **comportement de pin sur 0DTE** isolé du book plus large.
- Déterminer si un wall est concentré sur les mensuelles (durable) ou sur les hebdomadaires (transitoire).

## La heatmap strike × DTE

Une heatmap 2D du gamma des dealers selon le strike (lignes) et le DTE (colonnes). Les cellules les plus « chaudes » sont les strikes qui comptent pour les échéances les plus proches. La heatmap évolue en intraday à mesure que le flux arrive — observer son mouvement est instructif.

## L'en-tête de régime

Le tout haut de la page reprend le label de régime GEX (Positif / Négatif / En transition) avec l'interprétation en une ligne. Si le label de régime et la relation spot/flip ne concordent pas, survolez le régime — l'infobulle explique pourquoi (le label « En transition » apparaît lorsque le Net GEX au spot est proche de zéro).

## Lire le dealer positioning en trois étapes

1. **Où se situe le spot par rapport au flip ?** Au-dessus ⇒ stabilisation structurelle ; en dessous ⇒ amplification structurelle.
2. **Où se situent les walls ?** Le call wall est votre friction à la hausse ; le put wall est votre friction à la baisse.
3. **Comment la heatmap évolue-t-elle ?** Si le call wall monte, les dealers sont contraints de rouler plus haut — lecture structurelle haussière.

## Pourquoi le calcul du gamma flip de ZeroGEX est différent

Le flip est calculé à partir d'un **profil de gamma des dealers à spot décalé** — et non d'une approximation basée sur le Net GEX cumulé. Pour la méthodologie et la comparaison avant/après, voir [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Lectures courantes

- **Spot nettement au-dessus du flip, call wall proche au-dessus** ⇒ pin vers la clôture, fade des extensions.
- **Spot en dessous du flip, put wall proche en dessous** ⇒ biais de tendance ; amplification attendue en cas de cassure.
- **Spot proche du flip avec une vol en hausse** ⇒ risque de changement de régime ; réduisez la taille ou attendez.
- **Concentration de la heatmap sur les strikes call 0DTE proches du spot** ⇒ pression de pin vers la clôture.

## Voir aussi

- [GEX Summary & Greeks](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
