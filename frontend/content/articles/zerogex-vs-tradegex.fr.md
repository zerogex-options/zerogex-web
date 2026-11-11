# ZeroGEX vs TradeGEX (2026) : niveaux gamma sur futures, tarifs et couverture comparés

*Une comparaison équitable de ZeroGEX et de TradeGEX : ce pour quoi chaque plateforme est conçue, comment leurs walls et leur gamma flip sont définis, d'où viennent les niveaux ES et NQ de chacune, ce que coûte chacune, là où TradeGEX est le choix le plus solide, et là où ZeroGEX convient mieux. Les offres, les prix et les fonctionnalités de TradeGEX proviennent de son propre site et de son académie, vérifiés le {{tradegex:checked}}.*

---

## En bref

Les deux plateformes tirent des niveaux gamma du marché des options et les tracent sur des graphiques de futures. Elles diffèrent par ce qu'elles couvrent, par la façon dont elles construisent les niveaux et par ce qui les accompagne.

- **TradeGEX** est conçu pour les day traders de futures. Il trace en temps réel des barres d'exposition gamma et delta, un call wall et un put wall, un gamma flip et son propre indicateur Hedge Flow sur les futures ES, NQ, YM, RTY, or et pétrole brut, ainsi que sur sept grandes valeurs technologiques, avec des applications natives Mac et Windows, un simulateur de trading intégré et des indicateurs pour TradingView, Tradovate, ATAS et NinjaTrader.
- **ZeroGEX** couvre six symboles - SPX, SPY, QQQ, NDX, et les futures ES et NQ - et va plus en profondeur sur ceux-ci : des walls pondérés par le gamma, un gamma flip calculé à partir d'un profil de gamma sur une plage de prix, une heatmap gamma tout au long de la séance, le flux de couverture, et quatorze signaux construits sur les niveaux, avec une méthode publiée et un historique noté.

Si vous tradez le Dow, le Russell, l'or, le pétrole brut ou les grandes valeurs technologiques, ou voulez une application de bureau avec un simulateur de trading, TradeGEX est plus proche de ce qu'il vous faut. Si vous faites du day trading sur le complexe S&P et Nasdaq et voulez savoir comment chaque niveau est construit et à quelle fréquence les walls ont tenu, c'est le cas de ZeroGEX.

## Les niveaux, côte à côte

Les deux plateformes publient le même ensemble de niveaux, la plupart sous les mêmes noms :

| TradeGEX | ZeroGEX | Ce qu'il indique |
|---|---|---|
| Call Wall | Call Wall | Le strike call le plus lourd : selon l'open interest chez TradeGEX, selon l'open interest pondéré par le gamma chez ZeroGEX |
| Put Wall | Put Wall | La même chose côté puts |
| Gamma Flip | Gamma Flip | La ligne entre un gamma dealer modélisé positif et négatif |
| Key Gamma Strike (KGS) | GEX King | Le strike qui porte le plus de gamma |
| Max Pain | Max Pain | Le prix à l'échéance qui laisse aux détenteurs d'options la plus faible valeur totale |

Les deux vous laissent choisir les échéances à lire. Le sélecteur d'échéances de TradeGEX propose 0DTE, hebdomadaire, mensuelle, ou toutes les échéances combinées. Sur ZeroGEX, le filtre d'échéances du Gamma Chart restreint la chaîne à n'importe quel ensemble d'échéances, 0DTE compris, et les walls et le flip suivent ce filtre.

### Mêmes noms, walls différents

Les walls partagent leurs noms mais pas leurs définitions. Le [guide des niveaux clés](https://tradegex.pro/academy/call-wall-put-wall-gamma-flip) de TradeGEX place le call wall sur le strike qui a le plus d'open interest en calls et le put wall sur le strike qui a le plus d'open interest en puts, et ses guides sur les graphiques et sur l'open interest disent la même chose. (Son guide sur les grecques décrit en revanche les walls comme les strikes de gamma call et put dominants.) ZeroGEX pondère l'open interest par le gamma, qui est le plus élevé pour les options proches du prix actuel, là où la couverture des dealers est la plus sensible à un mouvement. Les deux méthodes peuvent désigner des strikes différents lorsqu'un gros bloc d'open interest se trouve loin du prix : dans un décompte brut, il compte pleinement, et pondéré par le gamma, il compte peu.

Les deux décrivent aussi les walls différemment. Les guides de TradeGEX décrivent le call wall comme une résistance et le put wall comme un support. ZeroGEX traite un wall comme une concentration de gamma et a mesuré à quelle fréquence les walls ont réellement tenu : dans son étude de 737 tests de walls, les walls du S&P ont tenu environ deux fois sur trois dans l'heure suivant un test et ceux du Nasdaq environ une fois sur deux, et aucun des dix-neuf éléments qu'il a mesurés sur les walls individuels n'a permis de dire lesquels allaient céder ([l'étude](/education/how-often-do-gamma-walls-break)).

ZeroGEX modélise le gamma des dealers à partir de la chaîne d'options plutôt que de l'observer, calcule son flip à partir d'un profil de gamma sur une plage de prix, et laisse le flip vide lorsque la chaîne ne permet pas de déterminer un croisement fiable. La méthode figure sur sa page [Méthodologie](/methodology). L'académie de TradeGEX donne sa formule du GEX, à savoir le gamma multiplié par l'open interest, par le multiplicateur du contrat et par le carré du prix spot, additionné strike par strike, et décrit le flip comme le prix où ce total passe du positif au négatif.

### À quelle fréquence les niveaux sont mis à jour

L'open interest officiel est publié une fois par jour, après la clôture. Le [guide sur l'open interest](https://tradegex.pro/academy/open-interest-analysis) de TradeGEX indique que la plateforme estime l'open interest pendant la séance à partir du volume et des transactions, et son site indique que ses niveaux GEX se rafraîchissent à quelques secondes d'intervalle. ZeroGEX recalcule ses niveaux environ une fois par minute tout au long de la séance régulière, dans les deux offres, à mesure que le prix, le temps et la volatilité implicite évoluent par rapport à l'open interest publié. Son estimation de la couverture impliquée par les transactions du jour est une lecture distincte, sur la page [Hedging Flow](/education/hedging-flow-explained). Si vous scalpez à partir des niveaux, un rafraîchissement à quelques secondes d'intervalle mérite d'être pris en compte.

### D'où viennent les niveaux ES et NQ

Pour ES et NQ, aucune des deux plateformes ne lit les options sur les futures eux-mêmes. Toutes deux construisent les niveaux à partir des options sur l'indice ou l'ETF que suit chaque future, et les reportent sur le prix du future. TradeGEX vous laisse choisir la source d'options derrière ses barres GEX - un ETF comme SPY, QQQ ou IWM, ou un indice comme SPX, NDX ou RUT - et son [académie](https://tradegex.pro/academy/etf-options-futures-correlation) indique que le ratio de conversion varie avec les dividendes et le coût de portage. ZeroGEX construit les niveaux ES à partir de la chaîne SPX et les niveaux NQ à partir de la chaîne NDX, et les projette sur le contrat future dont il affiche le cours en utilisant le coût de portage de ce contrat ([comment cela fonctionne](/help/platform/futures-contract-months)).

## Prix

Prix catalogue, hors promotions et hors taxes, vérifiés le {{tradegex:checked}}. TradeGEX vend une seule offre avec accès complet à la plateforme, facturée chaque mois, tous les six mois ({{tradegex:platform:sixMonths}}) ou chaque année. Les prix de ZeroGEX sont ceux qui figurent aujourd'hui sur sa page [Tarifs](/pricing).

| Offre | Facturation mensuelle | Facturation annuelle |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mois | {{zgx:basic:annual}}/an (environ {{zgx:basic:annual:mo}}/mois) |
| ZeroGEX Pro, avec accès API | {{zgx:pro:monthly}}/mois | {{zgx:pro:annual}}/an (environ {{zgx:pro:annual:mo}}/mois) |
| TradeGEX | {{tradegex:platform:monthly}}/mois | {{tradegex:platform:annual}}/an (environ {{tradegex:platform:annual:mo}}/mois) |

En facturation mensuelle, ZeroGEX Basic coûte moins cher que TradeGEX, et ZeroGEX Pro coûte à peu près le même prix. En facturation annuelle, ZeroGEX Pro coûte environ moitié moins cher que TradeGEX - le même prix que l'offre semestrielle de TradeGEX - et inclut l'accès API. Ces prix n'achètent toutefois pas la même chose : celui de TradeGEX couvre plus de marchés, des applications de bureau et un simulateur de trading, et celui de ZeroGEX couvre six symboles en profondeur.

Les essais et les remboursements diffèrent aussi. ZeroGEX Basic mensuel commence par un essai gratuit de 7 jours, sans aucun prélèvement avant la fin de l'essai, et toutes les autres offres ZeroGEX sont couvertes par une garantie satisfait ou remboursé de 7 jours. TradeGEX propose un essai gratuit de 3 jours qui demande un numéro de mobile mais pas de carte et ne se transforme pas tout seul en offre payante, et ses conditions indiquent que les remboursements ne sont accordés que dans des circonstances exceptionnelles.

## Là où TradeGEX est le choix le plus solide

- **Plus de marchés.** Les futures ES, NQ, YM (Dow), RTY (Russell 2000), or et pétrole brut, plus NVDA, TSLA, AAPL, MSFT, AMZN, META et GOOGL. ZeroGEX couvre six symboles.
- **Un rafraîchissement plus rapide.** TradeGEX indique que ses niveaux GEX se rafraîchissent à quelques secondes d'intervalle. ZeroGEX recalcule ses niveaux environ une fois par minute.
- **Applications de bureau et simulateur de trading.** Des applications natives Mac et Windows (Windows en bêta), et un simulateur intégré pour s'entraîner à trader les futures sur des prix en direct, avec des ordres bracket et des statistiques de performance. ZeroGEX fonctionne dans le navigateur et n'a pas de simulateur pour vous entraîner sur vos propres trades.
- **Tradovate et ATAS.** TradeGEX trace ses niveaux sur le graphique web de Tradovate et dans ATAS, ainsi que sur TradingView et NinjaTrader. ZeroGEX fonctionne avec TradingView, thinkorswim, NinjaTrader, Sierra Chart et Bookmap.
- **Exposition delta et oscillateur multi-marchés.** Des barres d'exposition delta, l'indicateur Hedge Flow, un oscillateur qui combine ES, NQ, le VIX et le flux d'options, une ligne du VIX sur le graphique de prix, une vue double graphique et un rapport hebdomadaire Commitments of Traders pour ES et NQ. ZeroGEX laisse délibérément de côté l'exposition delta brute : [pourquoi ZeroGEX ne publie pas le DEX](/education/why-we-dont-publish-dex).

## Là où ZeroGEX est le choix le plus solide

- **Des walls pondérés par le gamma.** L'open interest compté selon la couverture qu'il porte près du prix, et non par le seul nombre de contrats, critère retenu par le guide des niveaux clés de TradeGEX pour décrire ses walls.
- **Une méthode publiée et un historique noté.** La page [Méthodologie](/methodology) expose la façon dont les niveaux sont calculés, le [Track Record](/track-record) note chaque prévision que ZeroGEX publie, erreurs comprises, et l'[étude sur les walls](/education/how-often-do-gamma-walls-break) publie la fréquence à laquelle les walls ont réellement cédé.
- **Profondeur sur le complexe S&P et Nasdaq.** Une heatmap gamma tout au long de la séance, le gamma par échéance, le flux de vanna et de charm, le flux de couverture, le flux forcé, et quatorze signaux construits sur les niveaux, dont les méthodes sont exposées dans le [guide des signaux](/guides/signals-explained). L'académie de TradeGEX indique qu'il n'a pas de ligne unique de vanna ou de charm ; ces effets se lisent à partir de sa ligne du VIX, de son sélecteur d'échéances et des niveaux.
- **Accès API et serveur MCP.** ZeroGEX Pro inclut des clés d'API pour les mêmes données, et le [serveur MCP](/education/gamma-levels-in-claude) gratuit met les niveaux différés à disposition d'assistants IA comme Claude et ChatGPT. L'offre de TradeGEX ne mentionne aucune API.
- **Le prix en facturation annuelle.** ZeroGEX Pro coûte environ la moitié du prix annuel de TradeGEX, API incluse.
- **Un moyen gratuit de vérifier d'abord.** Les pages [niveaux gamma ES](/es-gamma-levels) et [niveaux gamma NQ](/nq-gamma-levels), différées d'environ 15 minutes, ne demandent aucune inscription.

## Comment choisir

- **Vous tradez YM, RTY, l'or, le pétrole brut ou des valeurs technologiques individuelles :** TradeGEX.
- **Vous voulez une application de bureau, un simulateur de trading intégré, ou vos niveaux sur Tradovate ou ATAS :** TradeGEX.
- **Vous faites du day trading sur ES, NQ, SPX, SPY, QQQ ou NDX et voulez savoir comment chaque niveau est construit et à quelle fréquence les walls ont tenu :** ZeroGEX.
- **Vous n'êtes pas encore sûr :** ouvrez la page gratuite [niveaux gamma ES](/es-gamma-levels), sans inscription, et comparez-la avec les niveaux que vous utilisez aujourd'hui.

---

Les offres, les prix et les fonctionnalités de TradeGEX proviennent de [tradegex.pro](https://tradegex.pro) et de son académie, vérifiés le {{tradegex:checked}}, et peuvent changer à tout moment ; confirmez-les donc sur ce site. Les prix de ZeroGEX indiqués sur cette page sont lus en direct dans sa grille tarifaire. ZeroGEX n'est pas affilié à TradeGEX. Contenu éducatif uniquement, pas une recommandation de trading.
