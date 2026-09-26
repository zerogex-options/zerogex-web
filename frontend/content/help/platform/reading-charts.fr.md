# Comment lire les graphiques ZeroGEX

*Un vocabulaire visuel commun - couleurs, échelles, comportement au survol, légendes et les notes spécifiques à chaque graphique pour le profil de gamma, l'open interest, les heatmaps et le Gamma Chart.*

---

## Le langage des couleurs

ZeroGEX utilise une palette restreinte et cohérente sur tous les graphiques. Une fois qu'on la connaît, chaque graphique se lit plus vite.

- **Ambre / orange chaud** - couleur d'accent ; utilisée pour les avertissements, la mise en avant de la marque et la trace de la score-line.
- **Vert** - haussier, positif, direction long, gain.
- **Rouge** - baissier, négatif, direction short, perte.
- **Bleu / bleu marine foncé** - information structurelle neutre ; lignes de référence, axes, lignes de base.
- **Corail / rose** - informatif secondaire ; badges de session comme Pre-market, After hours et Futures.

La **signification** des couleurs reste stable d'un graphique à l'autre. Le même vert signifie « haussier » partout. Les surfaces qui colorent le gamma des dealers selon son signe utilisent leurs propres dégradés, indiqués dans la légende de chaque graphique : la heatmap GEX dans le temps va du bleu (négatif) à l'orange (positif) en passant par le blanc, et les ribbons du Gamma Chart sont dorés pour le gamma long et violets pour le gamma short.

### Les niveaux clés

Sur le Gamma Chart et les autres graphiques de prix qui les tracent, quatre niveaux ont leur propre couleur, tenue à l'écart du langage haussier/baissier ci-dessus pour qu'un niveau ne se lise jamais comme une direction :

- **Azur** - le **gamma flip**. C'est la frontière entre la zone de gamma longue et la zone de gamma courte : il n'est donc délibérément ni vert ni rouge.
- **Or** - le **max pain**.
- **Turquoise** - le **pin strike**.
- **Violet** - le **GEX king**, le nœud de gamma dominant.

Le **call wall** et le **put wall** prennent les couleurs directionnelles. Sur le Gamma Chart, ils sont colorés selon ce que fait le niveau - le call wall en rouge (résistance au-dessus), le put wall en vert (support en dessous). Les graphiques qui séparent calls et puts, comme les barres par strike de Dealer Positioning, gardent les calls en vert et les puts en rouge. Le **dernier prix traité** en direct prend l'accent chaud de chaque thème - toujours une couleur chaude, jamais l'azur du flip.

Le graphique Gamma Exposure by Strike de Dealer Positioning étiquette ses lignes de référence en texte (Spot, Flip, Call Wall, Put Wall) et trace son flip en ambre : fiez-vous donc à l'étiquette sur ce graphique.

## La score line

Chaque score des signaux Basic et Advanced se situe sur la même échelle de **−100 à +100** - le score de [-1, +1], multiplié par 100 - avec le zéro au centre.

- Le signe code la direction.
- La distance au zéro code la conviction.
- Les cartes des signaux Advanced indiquent le seuil à partir duquel le signal s'active (« activates at ±N »).
- Sur la chronologie des événements d'un signal, le score est la ligne ambre, le zéro la ligne horizontale pâle, et des triangles marquent les changements de direction - verts vers haussier, rouges vers baissier.

Pour une lecture plus approfondie, voir [Lire la Score Line](/help/platform/score-line).

## Le graphique Gamma Exposure by Strike

Un incontournable de la page Dealer Positioning.

- **Axe X** - prix de strike.
- **Barres** - le gamma modélisé des dealers par strike en dollars, signé selon la convention calls positifs / puts négatifs : calls vers le haut, puts vers le bas, chaque barre empilée par échéance avec la plus proche la plus marquée.
- **Courbe GEX Profile** - le profil modélisé de gamma des dealers selon le prix, sur son propre axe.
- **Là où la courbe croise le zéro** - le gamma flip.
- **Barres de calls hautes** - accumulations de gamma côté call (candidats call wall).
- **Barres de puts hautes** - accumulations de gamma côté put (candidats put wall).
- **Lignes de référence** - le spot, le flip, et les call et put walls.

Le graphique s'ouvre entièrement dézoomé sur tous les strikes chargés. Les boutons X zooment sur les strikes, les boutons Y agrandissent l'échelle du gamma pour examiner les petites barres, et le bouton de réinitialisation rétablit les deux.

## Le graphique d'open interest

Open Interest by Strike, également sur Dealer Positioning : les contrats ouverts à chaque strike, calls au-dessus de l'axe et puts en dessous, empilés par échéance comme les barres de gamma. Basculez entre **OI** (nombre de contrats) et **Notional** (strike × 100 × OI) ; une ligne pointillée marque le spot. Lisez-le à côté du graphique de gamma - l'open interest montre où sont les contrats, le gamma combien de hedging ils impliquent.

## La heatmap strike × DTE

GEX Heatmap · Strike × DTE, sur la page Dealer Positioning.

- **Lignes** - les strikes portant le plus de gamma sur la semaine à venir, strike le plus haut en tête.
- **Colonnes** - jours avant l'échéance, jusqu'à 7DTE.
- **Couleur de cellule** - le gamma net des dealers pour cette combinaison strike/échéance : vert positif, rouge négatif, plus soutenu quand la valeur est plus grande.
- **Couronne** - le GEX king, le strike présentant le plus grand gamma net des dealers sur ces échéances.

Les cellules les plus « chaudes » sont les strikes qui comptent pour les échéances les plus proches. Observez la heatmap évoluer en cours de journée - si la cellule la plus lumineuse change de strike, le wall se déplace.

## La heatmap GEX dans le temps

GEX Heatmap Timeseries, sur la page GEX Heatmap et sur Dealer Positioning : les strikes à la verticale, le temps à l'horizontale, chaque colonne le gamma net des dealers à cet instant - orange positif, bleu négatif, presque blanc autour de zéro - avec les bougies et le gamma flip tracés par-dessus. Les portions en pointillés de la ligne du flip marquent des cycles où le flip n'a été trouvé qu'en élargissant la recherche loin du spot ; considérez-les comme marginales.

## Le Gamma Chart

Le graphique de prix du Gamma Terminal et le ZeroGEX Gamma Chart du Main Dashboard sont le même graphique : le prix du sous-jacent avec la structure de gamma des dealers tracée dessus.

- **Symbole et timeframe** - SPY, QQQ, SPX, NDX, ES ou NQ, en barres de 1m, 5m, 15m, 1H ou 1D.
- **Style de prix** - Candle, Line ou Area, au-dessus d'un volet de volume qui affiche le volume Up/Down ou le net Cumulative de la séance.
- **Expiry** - sur le graphique en direct, limite les niveaux de gamma et le rail aux échéances choisies ; **All** correspond à toute la chaîne.

Les superpositions sont la touche ZeroGEX, chacune activée par une pastille au-dessus du graphique :

- **Gamma Levels** - la ligne du gamma flip (tirets longs, azur, étiquetée `FLIP` sur le bord gauche) et les lignes du call wall et du put wall.
- **Gamma Rail** - le gamma des dealers par strike, tracé à hauteur des prix du graphique, sous forme de silhouette lissée ou de barres Net, Split ou Combined. Sur le Gamma Terminal, il se trouve dans le panneau à côté du graphique, où vous pouvez le remplacer par deux échelles de Net GEX alignées par strike.
- **Max Pain** et **Pin Strike** - leurs propres lignes en or et en turquoise ; la ligne du pin porte sa force, comme dans `PIN · STRONG`.
- **VWAP**, et l'ombrage **Regime** - les zones de gamma long et de gamma short de part et d'autre du flip.
- Désactivées tant que vous ne les activez pas : **GEX King** et, sur le graphique en direct, **Expected Range**, **Ribbons** (le gamma par strike dans le temps, derrière le prix) et **Bar Timer**.

La ligne finement pointillée dans l'accent chaud du thème est le **dernier prix traité**, pas un niveau gamma - elle figure sous le nom « Last » dans la légende sous le graphique.

Ces superpositions permettent de lire l'évolution du prix à travers le prisme du dealer positioning sans quitter le graphique. Sans abonnement Basic ou Pro, le Gamma Terminal affiche un instantané différé d'environ 15 minutes, avec le symbole et le timeframe figés ; les membres le voient en direct.

### Quand il n'y a pas de ligne de flip

Un niveau n'est tracé que tant qu'il se situe dans la plage de prix affichée : sur un sous-jacent à prix élevé dont le flip est loin du spot - NDX en particulier - la ligne de flip peut donc sortir de l'échelle visible. Le graphique le signale au lieu de vous laisser deviner : une pastille au bord de la zone de tracé affiche `FLIP ↓ 22,600.00` avec la direction et le prix, et l'axe des prix de droite porte une étiquette fléchée correspondante. Dézoomez l'axe des prix (le bouton **Price −**, Maj+molette, ou en faisant glisser l'échelle de prix de droite) pour ramener la ligne à l'écran.

Il arrive qu'aucun flip ne puisse être déterminé. Le résolveur ne publie qu'un passage par zéro assez proche du spot pour être négociable et adossé à un intérêt ouvert réel ; quand le spot est loin à l'intérieur d'un régime de gamma, ou que la chaîne est mince ou d'un seul côté (hors séance, pic de volatilité implicite), aucun passage ne franchit cette barre. La pastille affiche alors `FLIP UNAVAILABLE` avec un `?` ambre à côté - survolez la marque pour connaître la raison et, sur ES / NQ, la chaîne sur laquelle le flip a manqué - et le badge « Dealer Gamma @ Spot » affiche un simple `—`. Nous préférons ne rien tracer plutôt qu'un niveau auquel nous ne faisons pas confiance ; le flip se résout normalement de nouveau sur un instantané ultérieur.

Un flip vide signifie autre chose lorsque le filtre **Expiry** ne retient qu'une partie de la chaîne. Le graphique trace alors les niveaux des échéances que vous avez choisies, et leur flip est reconstruit à partir de ces seuls strikes ; or un sous-ensemble est souvent d'un seul signe (un carnet 0DTE d'après-midi à gamma négatif sur tous les strikes ne franchit jamais le zéro), il n'y a donc aucun passage à tracer. La pastille le dit directement : `NO FLIP IN SELECTED EXPIRIES`. Contrairement au cas précédent, celui-là ne se résoudra *pas* sur un instantané ultérieur, car rien ne manque. Remettez **Expiry** sur **All** pour voir le flip de la chaîne entière - le niveau que rapporte la page Dealer Positioning, qui lit la chaîne complète et continue donc d'afficher un nombre pendant que le graphique est restreint.

## Comportement au survol

La plupart des graphiques affichent une infobulle au survol avec les valeurs précises à la coordonnée x du curseur. L'infobulle respecte le langage des couleurs du graphique - la couleur de la pastille de valeur correspond à celle de la série.

## Légendes

Les légendes nomment chaque série et sa couleur - ce sont des clés, pas des interrupteurs. Sur le Gamma Chart, ce sont les pastilles de superposition au-dessus du graphique qui activent et désactivent les couches.

## Sparklines

Les cartes de signaux des dashboards utilisent des sparklines - de petits mini-graphiques en ligne montrant le score sur la fenêtre récente. La pente de la sparkline est plus informative que son niveau absolu : un score à +40 en hausse ne se lit pas comme +40 en baisse.

## Mode clair

Chaque graphique fonctionne à la fois en thème sombre et en thème clair. Les **identités** de couleur restent les mêmes ; les **valeurs** s'inversent pour préserver le contraste. Vert-haussier et rouge-baissier restent stables d'un thème à l'autre.

## Erreurs courantes

- **Lire le mauvais axe.** Les graphiques de score vont de −100 à +100 ; les graphiques GEX sont en dollars. Ne les comparez pas entre eux.
- **Traiter une sparkline comme un graphique de trading.** Les sparklines sont du contexte, pas des signaux d'entrée.
- **Lire la heatmap de loin.** Tout l'intérêt de la heatmap est dans la texture - zoomez si les cellules sont petites.

## Voir aussi

- [Lire le Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Lire la Score Line](/help/platform/score-line)
