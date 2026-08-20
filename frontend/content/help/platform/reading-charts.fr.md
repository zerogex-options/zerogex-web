# Comment lire les graphiques ZeroGEX

*Un vocabulaire visuel commun — couleurs, échelles, comportement au survol, légendes et les notes spécifiques à chaque graphique pour le profil GEX, les walls et les heatmaps.*

---

## Le langage des couleurs

ZeroGEX utilise une palette restreinte et cohérente sur tous les graphiques. Une fois qu'on la connaît, chaque graphique se lit plus vite.

- **Ambre / orange chaud** — couleur d'accent ; utilisée pour les avertissements, la mise en avant de la marque et la trace de la score-line.
- **Vert** — haussier, positif, direction long, gain.
- **Rouge** — baissier, négatif, direction short, perte.
- **Bleu / bleu marine foncé** — information structurelle neutre ; lignes de référence, axes, lignes de base.
- **Corail / rose** — informatif secondaire ; tags smart-money, mises en évidence spéciales.

La **signification** des couleurs reste stable d'un graphique à l'autre. Le même vert signifie « haussier » partout.

### Les niveaux clés

Quatre niveaux ont leur propre couleur partout où ils sont tracés, tenue à l'écart du langage haussier/baissier ci-dessus pour qu'un niveau ne se lise jamais comme une direction :

- **Azur** — le **gamma flip**. C'est la frontière entre la zone de gamma longue et la zone de gamma courte : il n'est donc délibérément ni vert ni rouge.
- **Or** — le **max pain**.
- **Turquoise** — le **pin strike**.
- **Violet** — le **GEX king**, le nœud de gamma dominant.

Le **call wall** et le **put wall** prennent en revanche les couleurs directionnelles, et le **dernier prix traité** prend l'accent chaud de chaque thème — toujours une couleur chaude, jamais l'azur du flip.

## La score line

Chaque score de signal est tracé sur le même axe y **[-1, +1]** avec la ligne du zéro au centre. La teinte de fond près des seuils de déclenchement rappelle à quel niveau le signal devient exploitable.

- La couleur de la trace code l'ampleur.
- Le signe code la direction.
- Une ligne pointillée horizontale au seuil de déclenchement rend le franchissement visible.

Pour une lecture plus approfondie, voir [Lire la Score Line [-1, +1]](/help/platform/score-line).

## Le graphique de profil GEX

Un incontournable de la page Dealer Positioning.

- **Axe X** — prix de strike.
- **Axe Y** — gamma du dealer en dollars, signé.
- **Ligne verticale** — spot actuel.
- **Là où la courbe croise le zéro** — le gamma flip.
- **Barres positives hautes** — candidats call wall.
- **Barres négatives hautes** — candidats put wall.

Le graphique se centre automatiquement sur le spot. La plage par défaut est d'environ ±5 % autour du spot — assez large pour voir les walls structurels, assez étroite pour garder les strikes pertinents lisibles.

## Le graphique des walls

Les mêmes données que le profil GEX, mais avec la structure des walls mise en évidence : le call wall, le put wall, le max pain et le gamma flip superposés sur le même axe. À utiliser quand on veut une seule image qui résume toute la lecture structurelle.

## La heatmap strike × DTE

Une heatmap 2D sur la page Dealer Positioning.

- **Lignes** — strike (triés autour du spot).
- **Colonnes** — DTE (0DTE, 1DTE, hebdomadaire, mensuel).
- **Couleur de cellule** — gamma du dealer pour cette combinaison strike/échéance.

Les cellules les plus « chaudes » sont les strikes qui comptent pour les échéances les plus proches. Observez la heatmap évoluer en cours de journée — si la cellule la plus lumineuse change de strike, le wall se déplace.

## Le graphique en chandeliers

Chandeliers OHLC classiques avec le VWAP et les superpositions gamma. Ces superpositions sont la touche ZeroGEX :

- La ligne de **gamma flip** — tirets longs, azur, étiquetée `FLIP` sur le bord gauche.
- Les lignes de **call wall** et de **put wall**.
- Le **max pain** (le cas échéant).

La ligne finement pointillée dans l'accent chaud du thème est le **dernier prix traité**, pas un niveau gamma — elle figure sous le nom « Last » dans la légende sous le graphique.

Ces superpositions permettent de lire l'évolution du prix à travers le prisme du dealer positioning sans quitter le graphique.

### Quand il n'y a pas de ligne de flip

Un niveau n'est tracé que tant qu'il se situe dans la plage de prix affichée : sur un sous-jacent à prix élevé dont le flip est loin du spot — NDX en particulier — la ligne de flip peut donc sortir de l'échelle visible. Le graphique le signale au lieu de vous laisser deviner : une pastille au bord de la zone de tracé affiche `FLIP ↓ 22,600.00` avec la direction et le prix, et l'axe des prix de droite porte une étiquette fléchée correspondante. Dézoomez l'axe des prix (le bouton **Price −**, Maj+molette, ou en faisant glisser l'échelle de prix de droite) pour ramener la ligne à l'écran.

Il arrive qu'aucun flip ne puisse être déterminé — le profil gamma balayé ressort d'un seul signe, ou la chaîne est trop mince pour placer le passage par zéro. La pastille affiche alors `FLIP UNAVAILABLE` et le badge « Dealer Gamma @ Spot » affiche un simple `—`. Nous préférons ne rien tracer plutôt qu'un niveau auquel nous ne faisons pas confiance.

## Comportement au survol

La plupart des graphiques affichent une infobulle au survol avec les valeurs précises à la coordonnée x du curseur. L'infobulle respecte le langage des couleurs du graphique — la couleur de la pastille de valeur correspond à celle de la série.

## Légendes

Les légendes sont cliquables sur la plupart des graphiques — cliquez sur une série pour la masquer. Utile pour isoler un signal ou un greek en particulier.

## Sparklines

Les cartes de signaux des dashboards utilisent des sparklines — de petits mini-graphiques en ligne montrant le score sur la fenêtre récente. La pente de la sparkline est plus informative que son niveau absolu : un score à +0,4 en hausse ne se lit pas comme +0,4 en baisse.

## Mode clair

Chaque graphique fonctionne à la fois en thème sombre et en thème clair. Les **identités** de couleur restent les mêmes ; les **valeurs** s'inversent pour préserver le contraste. Vert-haussier et rouge-baissier restent stables d'un thème à l'autre.

## Erreurs courantes

- **Lire le mauvais axe.** Les graphiques de score sont en [-1, +1] ; les graphiques GEX sont en dollars. Ne les comparez pas entre eux.
- **Traiter une sparkline comme un graphique de trading.** Les sparklines sont du contexte, pas des signaux d'entrée.
- **Lire la heatmap de loin.** Tout l'intérêt de la heatmap est dans la texture — zoomez si les cellules sont petites.

## Voir aussi

- [Lire le Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Lire la Score Line [-1, +1]](/help/platform/score-line)
