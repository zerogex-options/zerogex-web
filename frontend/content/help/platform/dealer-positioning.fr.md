# Dealer Positioning

*La surface GEX complète - Net GEX au spot, le gamma flip, call wall et put wall, et comment lire la term structure.*

---

## Ce que montre cette page

La page Dealer Positioning est la **carte structurelle** du book d'options. Chaque graphique et chaque tuile répond à une seule question : où sont positionnés les dealers, et que seront-ils contraints de faire à mesure que le prix évolue ?

C'est la page la plus importante pour comprendre le contexte - même si le trade lui-même est exécuté ailleurs.

Le sélecteur **GEX unit** de l'en-tête bascule tous les montants en dollars de la page entre le gamma par mouvement de 1 % et par 1 point. L'exposition est la même dans les deux cas ; seule l'unité change.

## L'en-tête de régime

Le haut de la page résume le régime en une ligne :

- **Le badge** - **+ Gamma Regime** quand le spot est au-dessus du gamma flip, **- Gamma Regime** quand il est en dessous, **~ Gamma Regime** quand le spot est à moins d'environ 0,25 % du flip, et **? Gamma Regime** quand aucun flip n'a pu être résolu sur ce snapshot.
- **Le gamma flip** - le niveau, et de combien de points le spot se situe au-dessus ou en dessous.
- **Le scénario** - **Positive GEX (pinned, low vol)**, **Negative GEX (trending, high vol)**, **At the Flip (neutral, transition)** ou **Flip unresolved this snapshot**.
- **Une étiquette de posture** - **Aggressive**, **Balanced** ou **Defensive** - construite à partir du signe du gamma au spot, de l'IV rank et du vanna.
- **Market Context** - la même lecture en langage clair, basculable entre **Intraday** et **Swing**.

Le régime se lit uniquement à partir de la position du spot par rapport au flip, et non du signe du total sur toute la chaîne ; le badge et le flip ne peuvent donc pas se contredire.

### Gamma Flip

Le niveau de prix auquel la courbe modélisée de gamma des dealers croise zéro. C'est la ligne de régime : au-dessus, le hedging modélisé *tend* à être stabilisant ; en dessous, amplificateur. Comme il s'agit du passage à zéro d'un profil modélisé, il peut se déplacer avec la convention de signe, les échéances et l'IV - traitez un franchissement comme un changement de la tendance agrégée de hedging du modèle, et non comme un basculement garanti du retour à la moyenne vers la tendance.

## Les tuiles principales

### Net GEX

La valeur de dollar-gamma de toutes les options ouvertes, signée selon la convention de positionnement des dealers modélisée par ZeroGEX (calls +, puts −), évaluée **au prix spot actuel**. Positif ⇒ les dealers sont *selon le modèle* net long gamma ; négatif ⇒ *selon le modèle* net short.

> Il s'agit d'une estimation : le gamma des dealers est modélisé selon la convention traditionnelle d'open interest (calls positifs, puts négatifs). L'inventaire réel des dealers n'est pas directement observable à partir des données publiques de la chaîne d'options.

Le chiffre affiché ici est mesuré au spot, et non additionné sur toute la chaîne - c'est important car le signe au spot façonne la tendance de hedging modélisée des dealers à cet instant précis, indépendamment de ce que fait la courbe cumulée à d'autres prix. Le badge à côté situe la valeur par rapport aux 30 derniers jours (NORMAL, ELEVATED, EXTREME HIGH, etc.).

### IV Rank

La position de la volatilité implicite sur une échelle de 0 à 100 %, lue à partir du VIX (VXN pour QQQ, NDX et NQ). 0 % correspond à un calme historique ; 100 % à une peur extrême.

### Vanna Flow et Charm Decay

Le vanna net et le charm net additionnés sur tous les strikes, affichés sous forme d'étiquette - **+Tailwind**, **-Headwind** ou **Neutral** pour le vanna ; **Bullish**, **Bearish** ou **Neutral** pour le charm. Ils indiquent si les mouvements de la vol implicite et l'écoulement du temps, selon le modèle, ajoutent ou retirent une pression directionnelle de delta.

Le max pain et le pin strike ne figurent pas sur cette page - voir [GEX Summary](/help/platform/gex-summary) et [Max Pain](/help/platform/max-pain).

## Le graphique Gamma Exposure by Strike

Le graphique principal. Strike en abscisse ; le gamma modélisé des dealers par strike sous forme de barres - calls vers le haut, puts vers le bas - avec la courbe **GEX Profile** superposée sur son propre axe. Trois éléments à lire :

1. **Là où la courbe GEX Profile croise zéro** - le gamma flip.
2. **La plus grande accumulation de call gamma au niveau du spot ou au-dessus** - le call wall.
3. **La plus grande accumulation de put gamma au niveau du spot ou en dessous** - le put wall.

Des lignes de référence marquent le spot, le flip et les deux walls. Chaque barre est empilée par échéance - la plus proche (0DTE) la plus marquée, la plus lointaine la plus pâle - pour que vous voyiez quelle part du gamma d'un strike expire bientôt. Le sélecteur d'échéances limite les barres, la courbe, les walls et le flip aux échéances choisies, et ce choix s'applique aussi aux autres graphiques qui partagent le filtre d'échéances. Le graphique s'ouvre entièrement dézoomé sur tous les strikes chargés ; les boutons de zoom X et Y et les barres de défilement le resserrent.

### Call Wall / Put Wall

Les strikes présentant le plus grand gamma côté call et côté put. Ils agissent souvent comme une friction intraday - mais le type d'option à lui seul ne fixe pas la direction ; qu'un wall se comporte comme une résistance, un support, un aimant ou un accélérateur dépend du signe modélisé du gamma des dealers et du flux environnant. Le comportement de « mur » est le plus net lorsque les dealers sont, selon le modèle, long gamma.

## Le graphique Open Interest by Strike

Les contrats derrière le gamma : l'open interest à chaque strike, calls au-dessus de l'axe et puts en dessous, empilé par échéance de la même façon. Basculez entre **OI** (contrats ouverts) et **Notional** (strike × 100 × OI). Un gros bloc d'open interest loin du spot peut porter peu de gamma - c'est pourquoi les walls sont classés selon le gamma, et non selon l'open interest.

## Les heatmaps GEX

Deux heatmaps montrent comment le gamma se répartit dans le temps et entre les échéances :

- **GEX Heatmap Timeseries** - le gamma net des dealers par strike au fil de la séance, orange pour le positif et bleu pour le négatif, avec les bougies du prix et le gamma flip tracés par-dessus. C'est le même graphique que la page autonome GEX Heatmap.
- **GEX Heatmap · Strike × DTE** - le gamma net des dealers pour les strikes portant le plus de gamma sur la semaine à venir (lignes, strike le plus haut en tête) selon les jours avant l'échéance (colonnes, jusqu'à 7DTE). Le vert est positif, le rouge négatif, et plus la teinte est soutenue, plus la valeur est grande. Une couronne marque le **GEX King** - le strike présentant le plus grand gamma net des dealers sur ces échéances proches.

Utile pour :

- Repérer un **comportement de pin sur 0DTE** isolé du book plus large.
- Déterminer si un wall est concentré sur l'échéance la plus proche (transitoire) ou réparti sur les suivantes (plus durable).

Les heatmaps se mettent à jour au fil de la séance à mesure que le spot, le temps et l'IV déplacent le gamma modélisé - observer leur mouvement est instructif.

## Le reste de la page

- **Charm & Vanna Flows** - le vanna et le charm agrégés sur la chaîne, une estimation du charm de fin de journée pour la pression de hedging vers la clôture, et une lecture du risque d'expansion de la volatilité.
- **Volatility Surface** - la volatilité implicite par strike pour les échéances proches par rapport aux échéances plus lointaines.
- **GEX Metrics Snapshot** - le tableau strike par strike : net GEX, vanna, charm, open interest et volume, centré sur le spot avec le flip et les walls marqués. Filtrez-le par échéance ; le sélecteur **Strikes** masque les strikes sans open interest.

## Lire le dealer positioning en trois étapes

1. **Où se situe le spot par rapport au flip ?** Au-dessus ⇒ tendance modélisée à la stabilisation ; en dessous ⇒ tendance modélisée à l'amplification.
2. **Où se situent les walls ?** Le call wall est votre friction à la hausse ; le put wall est votre friction à la baisse.
3. **Comment la heatmap évolue-t-elle ?** Si le call wall dérive vers le haut, le strike du call wall modélisé (là où le gamma côté call culmine) monte à mesure que le spot, le gamma, le temps et l'IV évoluent - une inclinaison structurelle haussière. Le wall peut bouger sans nouvel open interest : il suit le point où culmine l'exposition modélisée, et non un OI intraday vérifié.

## Pourquoi le calcul du gamma flip de ZeroGEX est différent

Le flip est calculé à partir d'un **profil de gamma des dealers à spot décalé** - et non d'une approximation basée sur le Net GEX cumulé. Pour la méthodologie et la comparaison avant/après, voir [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Lectures courantes

- **Spot nettement au-dessus du flip, call wall proche au-dessus** ⇒ pin vers la clôture, fade des extensions.
- **Spot en dessous du flip, put wall proche en dessous** ⇒ biais de tendance ; amplification attendue en cas de cassure.
- **Spot proche du flip avec une vol en hausse** ⇒ risque de changement de régime ; réduisez la taille ou attendez.
- **Concentration de la heatmap sur les strikes call 0DTE proches du spot** ⇒ pression de pin vers la clôture.

## Voir aussi

- [GEX Summary](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
