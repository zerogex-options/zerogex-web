# ZeroGEX vs Quant Data (2026) : cartes GEX, tarifs et couverture comparés

*Une comparaison équitable de ZeroGEX et de Quant Data (quantdata.us) : ce pour quoi chaque plateforme est conçue, comment se comparent l'Interval Map de Quant Data et la GEX Heatmap de ZeroGEX, ce que coûtent les API, là où Quant Data est le choix le plus solide, et là où un outil dédié aux niveaux des indices convient mieux. Les informations sur Quant Data proviennent de son propre site, de son centre d'aide et de ses fiches d'applications, vérifiées le {{quantdata:checked}}.*

---

## En bref

- **Quant Data** est construit autour du flux d'ordres d'options en temps réel, avec les transactions des dark pools et des lit pools, des actualités, des alertes et des applications iOS et Android. Ses outils d'exposition, dont l'Interval Map, couvrent toute action ou tout indice américain doté d'options cotées.
- **ZeroGEX** est construit autour d'une seule tâche : le positionnement modélisé des dealers - le gamma flip, le call wall et le put wall, et les signaux construits à partir d'eux - pour six symboles : SPX, SPY, QQQ, NDX, et les futures ES et NQ.

Si vos trades partent du flux d'ordres sur l'ensemble du marché, Quant Data est plus proche de ce qu'il vous faut. Si vous faites du day trading sur le complexe des indices et voulez ses niveaux en profondeur, c'est le cas de ZeroGEX.

## L'Interval Map et la GEX Heatmap

La vue la plus connue de Quant Data est l'Interval Map : les strikes sur l'axe vertical, la séance sur l'axe horizontal, et une bulle par strike et par intervalle, dimensionnée selon l'exposition et colorée en vert pour une valeur positive et en rouge pour une valeur négative, avec le prix du sous-jacent tracé à travers. Elle peut afficher l'exposition gamma, delta, vanna ou charm, à des intervalles d'une minute ou plus, en valeurs brutes ou en variation d'un intervalle au suivant.

La vue la plus proche chez ZeroGEX est la GEX Heatmap, incluse dans Basic : le gamma net des dealers par strike tout au long de la séance, en orange pour le positif et en violet pour le négatif (en bleu avec les thèmes clairs), avec les bougies de prix et le gamma flip tracés par-dessus ([comment la lire](/help/platform/reading-charts)). Sa vue Dots présente les mêmes chiffres de la même manière que l'Interval Map : un point par strike et par intervalle, dimensionné selon le gamma à cet endroit, en vert pour le positif et en rouge pour le négatif, pour 10, 20 ou 40 strikes autour du prix, avec le prix tracé à travers. Sur la page Dealer Positioning, une seconde heatmap croise les strikes avec le nombre de jours avant l'échéance, jusqu'à une semaine, pour que vous puissiez voir quelles échéances portent le gamma à chaque strike.

Les différences jouent dans les deux sens :

- **Plus d'expositions et de tickers chez Quant Data.** ZeroGEX ne cartographie que le gamma, sur six symboles. Il lit le vanna et le charm sous forme de signal plutôt que de carte, et il ne publie pas l'exposition delta, délibérément : [pourquoi ZeroGEX ne publie pas le DEX](/education/why-we-dont-publish-dex).
- **La ligne de régime chez ZeroGEX.** Le gamma flip est tracé sur la heatmap elle-même, à partir d'un profil de gamma calculé sur une plage de prix, de sorte que le prix, les strikes et la ligne de régime tiennent dans une seule image. La méthode figure sur la page [Méthodologie](/methodology).

Les deux outils modélisent le gamma des dealers selon le même principe de base : à partir de la chaîne d'options, en comptant les calls comme positifs et les puts comme négatifs. Le centre d'aide de Quant Data présente ses chiffres comme une estimation, et non comme une vue directe sur l'inventaire d'un dealer, et ZeroGEX dit la même chose.

### Lire un strike qui « se renforce » au fil de la journée

L'open interest est publié une fois par jour, après la clôture. Sur une carte de gamma construite à partir de lui, la couleur d'un strike change pendant la séance parce que ses options sont revalorisées à mesure que le prix, le temps et la volatilité implicite évoluent, et non parce que les dealers ont ouvert de nouvelles positions. Près de l'échéance, le gamma proche de la monnaie augmente à mesure que le temps s'écoule, si bien qu'un strike 0DTE voisin du prix peut s'intensifier au fil de la journée sans aucune nouvelle position. Lisez une bulle ou une bande qui grossit comme « ce strike compte davantage à mesure que l'horloge tourne », et lisez le flux séparément. Sur ZeroGEX, c'est la page Hedging Flow, qui estime la couverture impliquée par les transactions du jour ([comment cela fonctionne](/education/hedging-flow-explained)).

## Prix

Prix catalogue, hors promotions et hors taxes, vérifiés le {{quantdata:checked}}. L'offre plateforme de Quant Data, qui couvre son tableau de bord web et ses applications iOS et Android, coûte {{quantdata:platform:monthly}} par mois, ou {{quantdata:platform:annual}} par an, avec un essai gratuit de 7 jours dans les deux cas. Ces deux prix s'adressent aux traders non professionnels ; les professionnels enregistrés sont orientés vers une offre Professional distincte. Son API fait l'objet d'une autre offre distincte. Les prix de ZeroGEX sont ceux qui figurent aujourd'hui sur sa page [Tarifs](/pricing).

| Offre | Facturation mensuelle | Facturation annuelle |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mois | {{zgx:basic:annual}}/an (environ {{zgx:basic:annual:mo}}/mois) |
| ZeroGEX Pro, avec accès API | {{zgx:pro:monthly}}/mois | {{zgx:pro:annual}}/an (environ {{zgx:pro:annual:mo}}/mois) |
| Quant Data, non professionnels | {{quantdata:platform:monthly}}/mois | {{quantdata:platform:annual}}/an (environ {{quantdata:platform:annual:mo}}/mois) |
| Quant Data, offre API | {{quantdata:api:monthly}}/mois | {{quantdata:api:annual}}/an (environ {{quantdata:api:annual:mo}}/mois) |

Les deux offres ZeroGEX coûtent moins cher que l'offre plateforme de Quant Data, en mensuel comme en annuel, et ZeroGEX Pro inclut l'accès API que Quant Data vend sous forme d'offre distincte. Ces prix n'achètent toutefois pas la même chose : celui de Quant Data couvre le flux d'ordres, les transactions de dark pool, les actualités et des cartes d'exposition sur plus de 6 000 tickers, et celui de ZeroGEX couvre six symboles en profondeur.

Les deux API n'ont pas non plus la même taille. Celle de Quant Data couvre plus de 30 endpoints sur plus de 6 000 tickers, dont les transactions de dark pool et les surfaces de volatilité implicite, avec un an d'historique et un serveur MCP hébergé. Celle de ZeroGEX couvre les six symboles qu'il suit : niveaux, GEX, flux, signaux et leur historique.

ZeroGEX Basic mensuel commence par un essai gratuit de 7 jours, et toutes les autres offres ZeroGEX sont couvertes par une garantie satisfait ou remboursé de 7 jours. Le détail complet se trouve sur la page [Tarifs](/pricing).

## Là où Quant Data est le choix le plus solide

- **Étendue.** Le flux d'ordres et des cartes d'exposition pour toute action ou tout indice américain doté d'options cotées. ZeroGEX couvre six symboles.
- **Flux d'ordres, transactions de dark pool et actualités dans un seul fil.** C'est le cœur de Quant Data. ZeroGEX n'a ni données de dark pool ni fil d'actualités, et ses pages de flux ne couvrent que le complexe des indices.
- **Plus de types d'exposition sur la carte.** Delta, vanna et charm en plus du gamma, aux intervalles de votre choix.
- **Applications mobiles et alertes push.** Quant Data dispose d'applications natives iOS et Android avec notifications push. ZeroGEX fonctionne dans le navigateur, sur ordinateur ou sur téléphone, et ses déclenchements de signaux s'affichent dans l'application.
- **Une API plus étendue.** Plus de 30 endpoints, un an d'historique et des données de dark pool, pour construire vos propres outils sur de nombreux tickers.
- **Une assistance 24 h/24.** Les offres de Quant Data mentionnent une assistance par chat en direct 24 h/24, 7 j/7. L'assistance de ZeroGEX se fait par e-mail.

## Là où ZeroGEX est le choix le plus solide

- **Profondeur sur le complexe des indices.** Tout ce que ZeroGEX construit vise SPX, SPY, QQQ, NDX, ES et NQ : le gamma flip, les walls, le gamma par échéance, le flux de vanna et de charm, le flux de couverture, et quatorze signaux construits sur les niveaux, dont les méthodes sont exposées dans le [guide des signaux](/guides/signals-explained).
- **La ligne de régime sur chaque graphique.** Le gamma flip est tracé sur la GEX Heatmap et sur les graphiques de prix : le niveau où la couverture modélisée des dealers tend à passer de l'amortissement des mouvements à leur prolongement.
- **Une méthode publiée et un historique noté.** ZeroGEX documente la façon dont il calcule le gamma flip sur sa page [Méthodologie](/methodology) et note chaque prévision qu'il publie, erreurs comprises, dans son [Track Record](/track-record).
- **Les niveaux là où vous tracez déjà vos graphiques.** Des scripts TradingView et thinkorswim gratuits, et des indicateurs NinjaTrader, Sierra Chart et Bookmap qui se mettent à jour d'eux-mêmes avec Pro. Voir [Intégrations](/integrations).
- **Un prix plus bas, API incluse.** Les deux offres ZeroGEX coûtent moins cher que l'offre plateforme de Quant Data, et l'accès API est fourni avec Pro au lieu de faire l'objet d'une offre distincte.
- **Un moyen gratuit de vérifier d'abord.** La page [niveaux gamma SPX](/spx-gamma-levels) et ses pages sœurs ne demandent aucune inscription, pas plus que le [serveur MCP](/education/gamma-levels-in-claude) qui met les mêmes niveaux à disposition des assistants IA.

## Comment choisir

- **Vous tradez des actions individuelles à partir du flux d'ordres, ou voulez les transactions de dark pool et les actualités dans un seul fil :** Quant Data.
- **Vous voulez des cartes de delta, de vanna et de charm sur de nombreux tickers :** Quant Data.
- **Vous faites du day trading sur SPX, SPY, QQQ, NDX, ES ou NQ et voulez le flip, les walls et des signaux de positionnement des dealers en profondeur :** ZeroGEX.
- **Vous n'êtes pas encore sûr :** ouvrez la page gratuite [niveaux gamma SPX](/spx-gamma-levels), sans inscription, et comparez-la avec ce que vous utilisez aujourd'hui.

---

Les fonctionnalités et les prix de Quant Data proviennent de [quantdata.us](https://quantdata.us) et de son [centre d'aide](https://help.quantdata.us/en/), vérifiés le {{quantdata:checked}}, et peuvent changer à tout moment ; confirmez-les donc sur ces sites. Les prix de ZeroGEX indiqués sur cette page sont lus en direct dans sa grille tarifaire. ZeroGEX n'est pas affilié à Quant Data. Contenu éducatif uniquement, pas une recommandation de trading.
